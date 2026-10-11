import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  readOtpQuotaStore,
  writeOtpQuotaStore,
  recordOtpEvent,
  DESCOPE_MONTHLY_SMS_LIMIT,
} from "@/lib/otp-quota";
import {
  deriveDefaultPhoneCredentials,
  getIdentityByPhone,
  getIdentityByUid,
  getIdentityByEmail,
  upsertIdentityLink,
  decryptSecret,
} from "@/lib/identity-links";
import { ADMIN_EMAIL } from "@/lib/firestore";

const DESCOPE_PROJECT_ID =
  process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID?.trim() ||
  "P3KWVTtqHWyqAB1LbAh0ey4CH2nF";
const DESCOPE_BASE_URL = "https://api.descope.com";
const CAPTCHA_SECRET =
  process.env.OTP_CAPTCHA_SECRET ||
  `sonora_descope_captcha_secret_${DESCOPE_PROJECT_ID}`;

// Anti-DDoS & Rate-Limiting state in memory
const ipRequestTimestamps = new Map<string, number[]>();
const phoneLastSentMap = new Map<string, number>();
const phoneMinuteTimestamps = new Map<string, number[]>();
const usedCaptchaNonces = new Set<string>();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "local_ip";
}

function sanitizeMobile10(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits;
}

function generateCaptchaChallenge() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += alphabet[crypto.randomInt(0, alphabet.length)];
  }

  const nonce = crypto.randomBytes(8).toString("hex");
  const issuedAt = Date.now();
  const payload = `${code.toUpperCase()}|${issuedAt}|${nonce}`;
  const sig = crypto
    .createHmac("sha256", CAPTCHA_SECRET)
    .update(payload)
    .digest("hex");
  const captchaToken = Buffer.from(`${issuedAt}|${nonce}|${sig}`).toString(
    "base64url"
  );

  const charsSvg = code
    .split("")
    .map((ch, idx) => {
      const x = 24 + idx * 28 + crypto.randomInt(-3, 4);
      const y = 31 + crypto.randomInt(-4, 5);
      const rot = crypto.randomInt(-18, 19);
      return `<text x="${x}" y="${y}" transform="rotate(${rot} ${x} ${y})" fill="#14171A" font-family="monospace" font-size="22" font-weight="900" letter-spacing="2">${ch}</text>`;
    })
    .join("");

  const line1Y1 = crypto.randomInt(10, 36);
  const line1Y2 = crypto.randomInt(10, 36);
  const line2Y1 = crypto.randomInt(8, 38);
  const line2Y2 = crypto.randomInt(8, 38);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="168" height="44" viewBox="0 0 168 44">
    <rect width="168" height="44" rx="10" fill="#F1F5F9"/>
    <path d="M 8 ${line1Y1} Q 84 ${crypto.randomInt(4, 40)} 160 ${line1Y2}" stroke="#94A3B8" stroke-width="1.5" fill="none" opacity="0.65"/>
    <path d="M 12 ${line2Y1} Q 84 ${crypto.randomInt(4, 40)} 156 ${line2Y2}" stroke="#0284C7" stroke-width="1.2" fill="none" opacity="0.45"/>
    ${charsSvg}
  </svg>`;

  const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  return {
    captchaToken,
    svgDataUrl,
  };
}

function verifyCaptchaChallenge(
  captchaToken: string,
  userAnswer: string
): { valid: boolean; reason?: string } {
  if (!captchaToken || !userAnswer) {
    return {
      valid: false,
      reason: "Please complete the security CAPTCHA verification.",
    };
  }

  try {
    const decoded = Buffer.from(captchaToken, "base64url").toString("utf-8");
    const parts = decoded.split("|");
    if (parts.length !== 3) {
      return { valid: false, reason: "Invalid security challenge token." };
    }
    const [issuedAtStr, nonce, sig] = parts;
    const issuedAt = Number(issuedAtStr);
    const now = Date.now();

    if (!issuedAt || isNaN(issuedAt)) {
      return { valid: false, reason: "Malformed security challenge." };
    }

    if (now - issuedAt < 500) {
      return {
        valid: false,
        reason: "Submission too fast. Automated request blocked.",
      };
    }

    if (now - issuedAt > 5 * 60 * 1000) {
      return {
        valid: false,
        reason: "Security CAPTCHA expired. Please enter the new code.",
      };
    }

    if (usedCaptchaNonces.has(nonce)) {
      return {
        valid: false,
        reason:
          "Security CAPTCHA already used. Please enter the refreshed code.",
      };
    }

    const cleanAnswer = userAnswer.trim().toUpperCase();
    const expectedPayload = `${cleanAnswer}|${issuedAtStr}|${nonce}`;
    const expectedSig = crypto
      .createHmac("sha256", CAPTCHA_SECRET)
      .update(expectedPayload)
      .digest("hex");

    if (sig !== expectedSig) {
      return {
        valid: false,
        reason: "Incorrect security CAPTCHA code. Please try again.",
      };
    }

    usedCaptchaNonces.add(nonce);
    if (usedCaptchaNonces.size > 2000) {
      const first = usedCaptchaNonces.values().next().value;
      if (first) usedCaptchaNonces.delete(first);
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "Security verification failed." };
  }
}

function checkRateLimitAndDdos(
  ip: string,
  phoneKey: string
): { allowed: boolean; error?: string; retryAfterSec?: number } {
  const now = Date.now();

  const ipHistory = (ipRequestTimestamps.get(ip) || []).filter(
    (t) => now - t < 60 * 60 * 1000
  );
  const ipLastMinute = ipHistory.filter((t) => now - t < 60 * 1000);

  if (ipLastMinute.length >= 3) {
    return {
      allowed: false,
      retryAfterSec: 30,
      error:
        "DDoS protection active: Too many OTP requests from your network. Please wait 30 seconds.",
    };
  }
  if (ipHistory.length >= 8) {
    return {
      allowed: false,
      retryAfterSec: 300,
      error:
        "Hourly OTP limit reached for this network connection. Please try again later or sign in with Google.",
    };
  }

  const lastSent = phoneLastSentMap.get(phoneKey) || 0;
  const elapsedSec = Math.floor((now - lastSent) / 1000);
  if (lastSent > 0 && elapsedSec < 30) {
    const waitSec = 30 - elapsedSec;
    return {
      allowed: false,
      retryAfterSec: waitSec,
      error: `Please wait ${waitSec} seconds before requesting another code.`,
    };
  }

  const phoneMinute = (phoneMinuteTimestamps.get(phoneKey) || []).filter(
    (t) => now - t < 60 * 1000
  );
  if (phoneMinute.length >= 3) {
    return {
      allowed: false,
      retryAfterSec: 60,
      error:
        "Maximum 3 OTP retries per 60 seconds reached. Please wait a minute.",
    };
  }

  return { allowed: true };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid")?.trim() || "";

  const challenge = generateCaptchaChallenge();
  const quota = readOtpQuotaStore();
  const linkRecord = uid ? getIdentityByUid(uid) : null;

  return NextResponse.json(
    {
      success: true,
      ...challenge,
      identityLink: linkRecord
        ? {
            uid: linkRecord.uid,
            phoneKey: linkRecord.phoneKey,
            formattedPhone: linkRecord.formattedPhone,
            linkedEmail: linkRecord.linkedEmail || "",
            googleLinked: Boolean(linkRecord.googleLinked),
            hasCustomPassword: Boolean(linkRecord.hasCustomPassword),
          }
        : null,
      quota: {
        monthKey: quota.monthKey,
        monthlyLimit: quota.monthlyLimit,
        usedCount: quota.usedCount,
        remainingCount: Math.max(0, quota.monthlyLimit - quota.usedCount),
      },
    },
    { headers: CORS_HEADERS }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      countryCode = "91",
      mobileNumber: rawMobile = "",
      code = "",
      captchaToken = "",
      captchaAnswer = "",
      honeypot = "",
      channel = "web",
      adminEmail = "",
      newUsedCount,
      uid = "",
      firebaseAuthEmail = "",
      plainFirebasePassword = "",
      linkedEmail = "",
      googleLinked,
      hasCustomPassword,
      skipCaptchaForLinkedUser = false,
      accessToken = "",
    } = body as {
      action:
        | "send"
        | "verify"
        | "link_phone"
        | "sync_identity"
        | "resolve_email"
        | "record_flow_send"
        | "admin_set_used"
        | "facebook_direct_login";
      countryCode?: string;
      mobileNumber?: string;
      code?: string;
      captchaToken?: string;
      captchaAnswer?: string;
      honeypot?: string;
      channel?: "web" | "android" | "flow";
      adminEmail?: string;
      newUsedCount?: number;
      uid?: string;
      firebaseAuthEmail?: string;
      plainFirebasePassword?: string;
      linkedEmail?: string;
      googleLinked?: boolean;
      hasCustomPassword?: boolean;
      skipCaptchaForLinkedUser?: boolean;
      accessToken?: string;
    };

    // 0. Primary Facebook Sign-In verification (bypasses Firebase same-email provider collision)
    if (action === "facebook_direct_login") {
      if (!accessToken) {
        return NextResponse.json(
          { success: false, error: "Missing Facebook access token." },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const fbRes = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(
          accessToken
        )}`,
        { cache: "no-store" }
      );
      const fbData = await fbRes.json().catch(() => null);
      if (!fbRes.ok || !fbData?.id) {
        return NextResponse.json(
          {
            success: false,
            error:
              fbData?.error?.message || "Could not verify Facebook token.",
          },
          { status: 401, headers: CORS_HEADERS }
        );
      }

      const fbId = String(fbData.id);
      const fbEmail = String(fbData.email || "").trim().toLowerCase();
      const fbName = String(fbData.name || "Facebook User").trim();
      const fbPhoto = String(fbData.picture?.data?.url || "").trim();

      // Check if this email already has a stored password in identity-links.ts
      const existingByEmail = fbEmail ? getIdentityByEmail(fbEmail) : null;
      const existingPass = existingByEmail?.encryptedFirebasePassword
        ? decryptSecret(existingByEmail.encryptedFirebasePassword)
        : null;

      const defaultFbEmail = `fb_${fbId}@sonora.speech.ai`;
      const defaultFbPassword = `SnrFb!${crypto
        .createHmac("sha256", CAPTCHA_SECRET)
        .update(`sonora_fb_primary_${fbId}`)
        .digest("base64url")
        .slice(0, 22)}`;

      return NextResponse.json(
        {
          success: true,
          fbId,
          fbName,
          fbEmail,
          fbPhoto,
          firebaseEmail:
            existingPass && existingByEmail?.firebaseAuthEmail
              ? existingByEmail.firebaseAuthEmail
              : defaultFbEmail,
          firebasePassword: existingPass || defaultFbPassword,
          fallbackEmail: defaultFbEmail,
          fallbackPassword: defaultFbPassword,
        },
        { headers: CORS_HEADERS }
      );
    }

    // 1. Resolve linked email -> underlying Firebase auth email (Permutation A1)
    if (action === "resolve_email") {
      const cleanEmail = (linkedEmail || "").trim().toLowerCase();
      const record = getIdentityByEmail(cleanEmail);
      return NextResponse.json(
        {
          success: true,
          firebaseAuthEmail: record?.firebaseAuthEmail || cleanEmail,
        },
        { headers: CORS_HEADERS }
      );
    }

    // 2. Sync identity state when user updates password, email, or Google link (Permutations A1, A2, B1, C1, C2)
    if (action === "sync_identity") {
      if (!uid) {
        return NextResponse.json(
          { success: false, error: "Valid user uid required." },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const cleanCountry =
        String(countryCode || "91").replace(/\D/g, "") || "91";
      const cleanMobile = sanitizeMobile10(rawMobile);
      const phoneKey =
        cleanMobile.length === 10 ? `${cleanCountry}${cleanMobile}` : undefined;
      const formattedPhone =
        cleanMobile.length === 10
          ? `+${cleanCountry} ${cleanMobile.slice(0, 5)} ${cleanMobile.slice(5)}`
          : undefined;

      const updated = upsertIdentityLink({
        uid,
        phoneKey,
        formattedPhone,
        firebaseAuthEmail: firebaseAuthEmail || undefined,
        plainFirebasePassword: plainFirebasePassword || undefined,
        linkedEmail: linkedEmail || undefined,
        googleLinked,
        hasCustomPassword,
      });

      return NextResponse.json(
        {
          success: true,
          identityLink: {
            uid: updated.uid,
            phoneKey: updated.phoneKey,
            formattedPhone: updated.formattedPhone,
            linkedEmail: updated.linkedEmail || "",
            googleLinked: Boolean(updated.googleLinked),
            hasCustomPassword: Boolean(updated.hasCustomPassword),
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    // 3. Admin action: adjust/sync monthly OTP used count
    if (action === "admin_set_used") {
      if (adminEmail.trim().toLowerCase() !== ADMIN_EMAIL) {
        return NextResponse.json(
          { success: false, error: "Unauthorized admin request." },
          { status: 403, headers: CORS_HEADERS }
        );
      }
      const store = readOtpQuotaStore();
      const clamped = Math.max(
        0,
        Math.min(DESCOPE_MONTHLY_SMS_LIMIT, Number(newUsedCount) || 0)
      );
      store.usedCount = clamped;
      writeOtpQuotaStore(store);
      return NextResponse.json(
        {
          success: true,
          quota: {
            monthKey: store.monthKey,
            monthlyLimit: store.monthlyLimit,
            usedCount: store.usedCount,
            remainingCount: Math.max(0, store.monthlyLimit - store.usedCount),
            verifiedCount: store.verifiedCount,
            blockedAttacksCount: store.blockedAttacksCount,
            logs: store.logs,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    if (action === "record_flow_send") {
      const store = recordOtpEvent({
        phone: rawMobile || "+91",
        channel: "flow",
        status: "sent",
      });
      return NextResponse.json(
        {
          success: true,
          usedCount: store.usedCount,
          remainingCount: Math.max(0, store.monthlyLimit - store.usedCount),
        },
        { headers: CORS_HEADERS }
      );
    }

    const cleanCountry = String(countryCode || "91").replace(/\D/g, "") || "91";
    const mobileNumber = sanitizeMobile10(rawMobile);
    const e164Phone = `+${cleanCountry}${mobileNumber}`;
    const phoneKey = `${cleanCountry}${mobileNumber}`;
    const clientIp = getClientIp(request);

    // Honeypot Bot Trap Check
    if (honeypot && honeypot.trim().length > 0) {
      recordOtpEvent({
        phone: e164Phone,
        channel: channel || "web",
        status: "blocked",
        reason: "Honeypot bot trap triggered",
      });
      return NextResponse.json(
        {
          success: false,
          error: "Automated bot request blocked.",
          newCaptcha: generateCaptchaChallenge(),
        },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    if (mobileNumber.length !== 10) {
      return NextResponse.json(
        {
          success: false,
          error: "Enter a valid 10-digit mobile number.",
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (action === "send") {
      const requireCaptcha =
        channel !== "android" && !(skipCaptchaForLinkedUser && uid);
      if (requireCaptcha) {
        const captchaCheck = verifyCaptchaChallenge(captchaToken, captchaAnswer);
        if (!captchaCheck.valid) {
          recordOtpEvent({
            phone: e164Phone,
            channel: "web",
            status: "blocked",
            reason: captchaCheck.reason || "Invalid CAPTCHA",
          });
          return NextResponse.json(
            {
              success: false,
              error: captchaCheck.reason || "Invalid security CAPTCHA.",
              newCaptcha: generateCaptchaChallenge(),
            },
            { status: 400, headers: CORS_HEADERS }
          );
        }
      }

      const rateCheck = checkRateLimitAndDdos(clientIp, e164Phone);
      if (!rateCheck.allowed) {
        recordOtpEvent({
          phone: e164Phone,
          channel: channel || "web",
          status: "blocked",
          reason: rateCheck.error || "Rate limit exceeded",
        });
        return NextResponse.json(
          {
            success: false,
            error: rateCheck.error,
            retryAfterSec: rateCheck.retryAfterSec || 30,
            newCaptcha: generateCaptchaChallenge(),
          },
          { status: 429, headers: CORS_HEADERS }
        );
      }

      const currentQuota = readOtpQuotaStore();
      if (currentQuota.usedCount >= currentQuota.monthlyLimit) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Monthly SMS OTP limit (100/100) reached. Please sign in with Google or Email.",
          },
          { status: 429, headers: CORS_HEADERS }
        );
      }

      const descopeRes = await fetch(
        `${DESCOPE_BASE_URL}/v1/auth/otp/signup-in/sms`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${DESCOPE_PROJECT_ID}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            loginId: e164Phone,
          }),
          cache: "no-store",
        }
      );

      const descopeData = await descopeRes.json().catch(() => ({}));
      if (!descopeRes.ok) {
        const rawErr =
          descopeData?.errorMessage ||
          descopeData?.errorDescription ||
          descopeData?.message ||
          "Could not send SMS code.";
        const friendlyErr = /rate|limit|too many/i.test(rawErr)
          ? "Too many attempts. Please wait a minute before trying again."
          : rawErr;
        return NextResponse.json(
          {
            success: false,
            error: friendlyErr,
            newCaptcha: generateCaptchaChallenge(),
          },
          { status: descopeRes.status || 400, headers: CORS_HEADERS }
        );
      }

      const now = Date.now();
      const ipHistory = ipRequestTimestamps.get(clientIp) || [];
      ipHistory.push(now);
      ipRequestTimestamps.set(clientIp, ipHistory);

      phoneLastSentMap.set(e164Phone, now);
      const phoneMin = phoneMinuteTimestamps.get(e164Phone) || [];
      phoneMin.push(now);
      phoneMinuteTimestamps.set(e164Phone, phoneMin);

      const updatedQuota = recordOtpEvent({
        phone: e164Phone,
        channel: channel || "web",
        status: "sent",
      });

      return NextResponse.json(
        {
          success: true,
          maskedPhone: descopeData?.maskedPhone || e164Phone,
          cooldownSec: 30,
          quota: {
            usedCount: updatedQuota.usedCount,
            remainingCount: Math.max(
              0,
              updatedQuota.monthlyLimit - updatedQuota.usedCount
            ),
            monthlyLimit: updatedQuota.monthlyLimit,
          },
          newCaptcha: generateCaptchaChallenge(),
        },
        { headers: CORS_HEADERS }
      );
    }

    if (action === "verify" || action === "link_phone") {
      const cleanCode = String(code || "").replace(/\D/g, "");
      if (cleanCode.length !== 6) {
        return NextResponse.json(
          {
            success: false,
            error: "Enter the 6-digit code sent to your phone.",
          },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const verifyRes = await fetch(
        `${DESCOPE_BASE_URL}/v1/auth/otp/verify/sms`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${DESCOPE_PROJECT_ID}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            loginId: e164Phone,
            code: cleanCode,
          }),
          cache: "no-store",
        }
      );

      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        const rawErr =
          verifyData?.errorMessage ||
          verifyData?.errorDescription ||
          verifyData?.message ||
          "";
        let friendly = "Wrong verification code. Please check and try again.";
        if (/expire/i.test(rawErr)) {
          friendly = "This code has expired. Request a new code.";
        } else if (/many|attempt|limit/i.test(rawErr)) {
          friendly =
            "Too many attempts. Wait 60 seconds and request a new code.";
        }
        return NextResponse.json(
          {
            success: false,
            error: friendly,
          },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      recordOtpEvent({
        phone: e164Phone,
        channel: channel || "web",
        status: "verified",
      });

      const defaultCreds = deriveDefaultPhoneCredentials(
        cleanCountry,
        mobileNumber
      );

      // Permutations A3, B3, C3: Linking/Changing a Phone Number on an already signed-in account
      if (action === "link_phone" && uid) {
        const existingForUid = getIdentityByUid(uid);
        const existingPass = existingForUid?.encryptedFirebasePassword
          ? decryptSecret(existingForUid.encryptedFirebasePassword)
          : null;
        const bridgePassword =
          plainFirebasePassword || existingPass || defaultCreds.firebasePassword;
        const targetAuthEmail =
          firebaseAuthEmail ||
          existingForUid?.firebaseAuthEmail ||
          defaultCreds.firebaseEmail;

        const updatedLink = upsertIdentityLink({
          uid,
          phoneKey,
          formattedPhone: defaultCreds.formattedDisplay,
          firebaseAuthEmail: targetAuthEmail,
          plainFirebasePassword: bridgePassword,
          linkedEmail:
            linkedEmail && !linkedEmail.endsWith("@sonora.speech.ai")
              ? linkedEmail
              : existingForUid?.linkedEmail,
          googleLinked,
        });

        return NextResponse.json(
          {
            success: true,
            verified: true,
            bridgePassword,
            identityLink: {
              uid: updatedLink.uid,
              phoneKey: updatedLink.phoneKey,
              formattedPhone: updatedLink.formattedPhone,
              linkedEmail: updatedLink.linkedEmail || "",
              googleLinked: Boolean(updatedLink.googleLinked),
              hasCustomPassword: Boolean(updatedLink.hasCustomPassword),
            },
          },
          { headers: CORS_HEADERS }
        );
      }

      // Check if this phone number is already linked to an account in identity-links.ts
      const linkedIdentity = getIdentityByPhone(phoneKey);
      const storedPass = linkedIdentity?.encryptedFirebasePassword
        ? decryptSecret(linkedIdentity.encryptedFirebasePassword)
        : null;

      const resolvedEmail =
        linkedIdentity?.firebaseAuthEmail || defaultCreds.firebaseEmail;
      const resolvedPassword = storedPass || defaultCreds.firebasePassword;
      const descopeUser = verifyData?.user || {};

      return NextResponse.json(
        {
          success: true,
          verified: true,
          sessionJwt: verifyData?.sessionJwt || "",
          refreshJwt: verifyData?.refreshJwt || "",
          descopeUser: {
            userId:
              descopeUser.userId || `descope_${cleanCountry}${mobileNumber}`,
            phone: descopeUser.phone || e164Phone,
            name: descopeUser.name || defaultCreds.formattedDisplay,
            email: descopeUser.email || linkedIdentity?.linkedEmail || "",
          },
          phoneKey,
          firebaseEmail: resolvedEmail,
          firebasePassword: resolvedPassword,
          formattedDisplay: defaultCreds.formattedDisplay,
          phoneNumber: defaultCreds.phoneNumber,
        },
        { headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { success: false, error: "Invalid action." },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Server error during phone verification.",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
