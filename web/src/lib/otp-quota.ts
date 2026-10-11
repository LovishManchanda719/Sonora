import fs from "fs";
import os from "os";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const OTP_USAGE_FILE = path.join(DATA_DIR, "otp_usage.json");
const TMP_OTP_USAGE_FILE = path.join(os.tmpdir(), "sonora_otp_usage.json");

export const DESCOPE_MONTHLY_SMS_LIMIT = 100;

export interface OtpAuditLogEntry {
  id: string;
  timestamp: string;
  maskedPhone: string;
  channel: "web" | "android" | "flow";
  status: "sent" | "verified" | "blocked";
  reason?: string;
}

export interface OtpMonthlyQuotaStore {
  monthKey: string; // e.g. "2026-10"
  monthlyLimit: number;
  usedCount: number;
  verifiedCount: number;
  blockedAttacksCount: number;
  logs: OtpAuditLogEntry[];
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function maskPhoneNumber(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length >= 10) {
    const last4 = digits.slice(-4);
    const first2 = digits.slice(-10, -8);
    return `+91 ${first2}****${last4}`;
  }
  return "+91 **********";
}

export function readOtpQuotaStore(): OtpMonthlyQuotaStore {
  const currentMonth = getCurrentMonthKey();
  const defaultStore: OtpMonthlyQuotaStore = {
    monthKey: currentMonth,
    monthlyLimit: DESCOPE_MONTHLY_SMS_LIMIT,
    usedCount: 0,
    verifiedCount: 0,
    blockedAttacksCount: 0,
    logs: [],
  };

  for (const filePath of [TMP_OTP_USAGE_FILE, OTP_USAGE_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw) as Partial<OtpMonthlyQuotaStore>;
        if (parsed && typeof parsed === "object") {
          // Automatically reset monthly counters when a new calendar month begins
          if (parsed.monthKey !== currentMonth) {
            return defaultStore;
          }
          return {
            monthKey: currentMonth,
            monthlyLimit: DESCOPE_MONTHLY_SMS_LIMIT,
            usedCount:
              typeof parsed.usedCount === "number" && parsed.usedCount >= 0
                ? parsed.usedCount
                : 0,
            verifiedCount:
              typeof parsed.verifiedCount === "number" &&
              parsed.verifiedCount >= 0
                ? parsed.verifiedCount
                : 0,
            blockedAttacksCount:
              typeof parsed.blockedAttacksCount === "number" &&
              parsed.blockedAttacksCount >= 0
                ? parsed.blockedAttacksCount
                : 0,
            logs: Array.isArray(parsed.logs) ? parsed.logs.slice(0, 200) : [],
          };
        }
      }
    } catch {
      // ignore read errors
    }
  }

  return defaultStore;
}

export function writeOtpQuotaStore(store: OtpMonthlyQuotaStore): void {
  const payload = JSON.stringify(store, null, 2);
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(OTP_USAGE_FILE, payload, "utf-8");
  } catch {
    // fallback to tmp
  }
  try {
    fs.writeFileSync(TMP_OTP_USAGE_FILE, payload, "utf-8");
  } catch {
    // ignore tmp write errors
  }
}

export function recordOtpEvent(params: {
  phone: string;
  channel: "web" | "android" | "flow";
  status: "sent" | "verified" | "blocked";
  reason?: string;
}): OtpMonthlyQuotaStore {
  const store = readOtpQuotaStore();
  if (params.status === "sent") {
    store.usedCount += 1;
  } else if (params.status === "verified") {
    store.verifiedCount += 1;
  } else if (params.status === "blocked") {
    store.blockedAttacksCount += 1;
  }

  const entry: OtpAuditLogEntry = {
    id: `otp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    maskedPhone: maskPhoneNumber(params.phone),
    channel: params.channel,
    status: params.status,
    reason: params.reason,
  };

  store.logs.unshift(entry);
  if (store.logs.length > 200) {
    store.logs = store.logs.slice(0, 200);
  }

  writeOtpQuotaStore(store);
  return store;
}
