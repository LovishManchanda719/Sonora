import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const LINKS_FILE = path.join(DATA_DIR, "identity_links.json");
const TMP_LINKS_FILE = path.join(os.tmpdir(), "sonora_identity_links.json");

const DESCOPE_PROJECT_ID =
  process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID?.trim() ||
  "P3KWVTtqHWyqAB1LbAh0ey4CH2nF";
const SECRET_KEY = crypto
  .createHash("sha256")
  .update(
    process.env.FIREBASE_PHONE_BRIDGE_SECRET ||
      `sonora_descope_phone_bridge_${DESCOPE_PROJECT_ID}`
  )
  .digest();

export interface IdentityLinkRecord {
  uid: string;
  phoneKey: string; // e.g. "919876543210"
  formattedPhone: string; // e.g. "+91 98765 43210"
  firebaseAuthEmail: string; // Actual email used in Firebase Auth (either phone_91...@sonora.speech.ai or real email)
  encryptedFirebasePassword: string; // AES-256-GCM encrypted password for Firebase Auth bridge
  linkedEmail?: string; // User's real linked email address (from Email or Google)
  googleLinked?: boolean;
  hasCustomPassword?: boolean;
  updatedAt: string;
}

interface IdentityLinksStore {
  byUid: Record<string, IdentityLinkRecord>;
  phoneToUid: Record<string, string>;
  emailToUid: Record<string, string>;
}

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", SECRET_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(cipherText: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = (cipherText || "").split(".");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const encrypted = Buffer.from(dataB64, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", SECRET_KEY, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

export function deriveDefaultPhoneCredentials(
  countryCode: string,
  mobileNumber: string
) {
  const phoneKey = `${countryCode}${mobileNumber}`;
  const hmac = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(phoneKey)
    .digest("hex");

  const firebaseEmail = `phone_${phoneKey}@sonora.speech.ai`;
  const firebasePassword = `Sn!${hmac.slice(0, 28)}9a`;
  const formattedDisplay =
    countryCode === "91" && mobileNumber.length === 10
      ? `+91 ${mobileNumber.slice(0, 5)} ${mobileNumber.slice(5)}`
      : `+${countryCode} ${mobileNumber}`;

  return {
    phoneKey,
    firebaseEmail,
    firebasePassword,
    formattedDisplay,
    phoneNumber: `+${countryCode}${mobileNumber}`,
  };
}

export function readIdentityLinksStore(): IdentityLinksStore {
  const empty: IdentityLinksStore = {
    byUid: {},
    phoneToUid: {},
    emailToUid: {},
  };

  for (const filePath of [TMP_LINKS_FILE, LINKS_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw) as Partial<IdentityLinksStore>;
        if (parsed && typeof parsed === "object") {
          return {
            byUid: parsed.byUid || {},
            phoneToUid: parsed.phoneToUid || {},
            emailToUid: parsed.emailToUid || {},
          };
        }
      }
    } catch {
      // ignore read error
    }
  }
  return empty;
}

export function writeIdentityLinksStore(store: IdentityLinksStore): void {
  const payload = JSON.stringify(store, null, 2);
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LINKS_FILE, payload, "utf-8");
  } catch {
    // ignore
  }
  try {
    fs.writeFileSync(TMP_LINKS_FILE, payload, "utf-8");
  } catch {
    // ignore
  }
}

export function getIdentityByPhone(phoneKey: string): IdentityLinkRecord | null {
  const store = readIdentityLinksStore();
  const uid = store.phoneToUid[phoneKey];
  if (uid && store.byUid[uid]) {
    return store.byUid[uid];
  }
  return null;
}

export function getIdentityByUid(uid: string): IdentityLinkRecord | null {
  const store = readIdentityLinksStore();
  return store.byUid[uid] || null;
}

export function getIdentityByEmail(email: string): IdentityLinkRecord | null {
  const clean = (email || "").trim().toLowerCase();
  if (!clean) return null;
  const store = readIdentityLinksStore();
  const uid = store.emailToUid[clean];
  if (uid && store.byUid[uid]) {
    return store.byUid[uid];
  }
  return null;
}

export function upsertIdentityLink(params: {
  uid: string;
  phoneKey?: string;
  formattedPhone?: string;
  firebaseAuthEmail?: string;
  plainFirebasePassword?: string;
  linkedEmail?: string;
  googleLinked?: boolean;
  hasCustomPassword?: boolean;
}): IdentityLinkRecord {
  const store = readIdentityLinksStore();
  const existing = store.byUid[params.uid];

  // If changing phone number, remove old phoneToUid index
  if (
    existing?.phoneKey &&
    params.phoneKey &&
    existing.phoneKey !== params.phoneKey
  ) {
    delete store.phoneToUid[existing.phoneKey];
  }

  // If changing linked email, remove old emailToUid index
  if (
    existing?.linkedEmail &&
    params.linkedEmail &&
    existing.linkedEmail.toLowerCase() !== params.linkedEmail.toLowerCase()
  ) {
    delete store.emailToUid[existing.linkedEmail.toLowerCase()];
  }

  const phoneKey = params.phoneKey ?? existing?.phoneKey ?? "";
  const formattedPhone =
    params.formattedPhone ?? existing?.formattedPhone ?? "";
  const firebaseAuthEmail =
    params.firebaseAuthEmail ?? existing?.firebaseAuthEmail ?? "";
  const encryptedFirebasePassword = params.plainFirebasePassword
    ? encryptSecret(params.plainFirebasePassword)
    : existing?.encryptedFirebasePassword || "";
  const linkedEmail = (
    params.linkedEmail ??
    existing?.linkedEmail ??
    ""
  )
    .trim()
    .toLowerCase();

  const updated: IdentityLinkRecord = {
    uid: params.uid,
    phoneKey,
    formattedPhone,
    firebaseAuthEmail,
    encryptedFirebasePassword,
    linkedEmail: linkedEmail || undefined,
    googleLinked: params.googleLinked ?? existing?.googleLinked ?? false,
    hasCustomPassword:
      params.hasCustomPassword ?? existing?.hasCustomPassword ?? false,
    updatedAt: new Date().toISOString(),
  };

  store.byUid[params.uid] = updated;
  if (phoneKey) {
    store.phoneToUid[phoneKey] = params.uid;
  }
  if (linkedEmail && !linkedEmail.endsWith("@sonora.speech.ai")) {
    store.emailToUid[linkedEmail] = params.uid;
  }

  writeIdentityLinksStore(store);
  return updated;
}
