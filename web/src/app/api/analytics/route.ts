import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ADMIN_EMAIL, StoredScreening, ContactInquiryRecord } from "@/lib/firestore";

const DATA_DIR = path.join(process.cwd(), "data");
const ANALYTICS_FILE = path.join(DATA_DIR, "analytics.json");
const SCREENINGS_FILE = path.join(DATA_DIR, "screenings.json");
const CONTACTS_FILE = path.join(DATA_DIR, "contacts.json");

export interface TrackedUserRecord {
  userId: string;
  email: string;
  name: string;
  authProvider: string;
  role: "admin" | "user" | "guest";
  city: string;
  country: string;
  timezone: string;
  deviceType: "Desktop" | "Mobile" | "Tablet";
  browser: string;
  os: string;
  condition?: string;
  age?: string;
  sex?: string;
  photoURL?: string;
  screeningsCount: number;
  firstSeen: string;
  lastActive: string;
}

export interface AnalyticsEventRecord {
  id: string;
  type:
    | "page_view"
    | "screening_completed"
    | "pdf_downloaded"
    | "therapy_used"
    | "slp_locator_used"
    | "user_auth";
  path: string;
  userId: string;
  userEmail: string;
  city: string;
  country: string;
  deviceType: "Desktop" | "Mobile" | "Tablet";
  browser: string;
  os: string;
  metadata?: Record<string, string | number | boolean>;
  timestamp: string;
}

interface AnalyticsStore {
  users: Record<string, TrackedUserRecord>;
  events: AnalyticsEventRecord[];
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), "utf-8");
      return fallback;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) || fallback;
  } catch {
    return fallback;
  }
}

function writeJsonFile<T>(filePath: string, data: T) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed writing analytics store:", err);
  }
}

function sanitizeStr(val: unknown, maxLen = 200): string {
  if (typeof val !== "string") return "";
  return val.replace(/[<>]/g, "").trim().slice(0, maxLen);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const store = readJsonFile<AnalyticsStore>(ANALYTICS_FILE, {
      users: {},
      events: [],
    });

    const headerCity = request.headers.get("x-vercel-ip-city") || "";
    const headerCountry = request.headers.get("x-vercel-ip-country") || "";

    const userId = sanitizeStr(body.userId, 120) || "guest_visitor";
    const email = sanitizeStr(body.userEmail, 160) || "anonymous";
    const name =
      sanitizeStr(body.userName, 120) ||
      (email !== "anonymous" ? email.split("@")[0] : "Guest Visitor");
    const authProvider = sanitizeStr(body.authProvider, 60) || "guest";
    const city =
      sanitizeStr(body.city, 80) ||
      decodeURIComponent(headerCity) ||
      "Local / India";
    const country =
      sanitizeStr(body.country, 80) || headerCountry || "India";
    const timezone = sanitizeStr(body.timezone, 80) || "Asia/Kolkata";
    const deviceType =
      body.deviceType === "Mobile" || body.deviceType === "Tablet"
        ? body.deviceType
        : "Desktop";
    const browser = sanitizeStr(body.browser, 60) || "Browser";
    const os = sanitizeStr(body.os, 60) || "OS";
    const now = new Date().toISOString();

    const existingUser = store.users[userId];
    const isUserAdmin = email.toLowerCase() === ADMIN_EMAIL;

    store.users[userId] = {
      userId,
      email: email !== "anonymous" ? email : existingUser?.email || "anonymous",
      name: name !== "Guest Visitor" ? name : existingUser?.name || "Guest Visitor",
      authProvider:
        authProvider !== "guest"
          ? authProvider
          : existingUser?.authProvider || "guest",
      role: isUserAdmin
        ? "admin"
        : userId !== "guest_visitor" && !userId.startsWith("anon_")
        ? "user"
        : "guest",
      city: city !== "Local / India" ? city : existingUser?.city || city,
      country,
      timezone,
      deviceType,
      browser,
      os,
      condition:
        sanitizeStr(body.condition, 140) || existingUser?.condition || undefined,
      age: sanitizeStr(body.age, 20) || existingUser?.age || undefined,
      sex: sanitizeStr(body.sex, 20) || existingUser?.sex || undefined,
      photoURL:
        typeof body.photoURL === "string" && body.photoURL.length < 150000
          ? body.photoURL
          : existingUser?.photoURL,
      screeningsCount:
        typeof body.screeningsCount === "number"
          ? body.screeningsCount
          : existingUser?.screeningsCount || 0,
      firstSeen: existingUser?.firstSeen || now,
      lastActive: now,
    };

    if (body.eventType) {
      const eventRecord: AnalyticsEventRecord = {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: body.eventType,
        path: sanitizeStr(body.path, 120) || "/",
        userId,
        userEmail: email,
        city: store.users[userId].city,
        country,
        deviceType,
        browser,
        os,
        metadata:
          body.metadata && typeof body.metadata === "object"
            ? body.metadata
            : undefined,
        timestamp: now,
      };
      store.events.unshift(eventRecord);
      // Keep most recent 1,500 events so file stays fast and compact
      if (store.events.length > 1500) {
        store.events = store.events.slice(0, 1500);
      }
    }

    writeJsonFile(ANALYTICS_FILE, store);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to track event",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminEmail = searchParams.get("adminEmail")?.trim().toLowerCase();

    if (adminEmail !== ADMIN_EMAIL) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Admin access required.",
        },
        { status: 403 }
      );
    }

    const store = readJsonFile<AnalyticsStore>(ANALYTICS_FILE, {
      users: {},
      events: [],
    });
    const screenings = readJsonFile<StoredScreening[]>(SCREENINGS_FILE, []);
    const contacts = readJsonFile<ContactInquiryRecord[]>(CONTACTS_FILE, []);

    // Enrich user screening counts from screenings.json
    const userScreeningCounts: Record<string, number> = {};
    screenings.forEach((s) => {
      const uid = s.userId || "guest_visitor";
      userScreeningCounts[uid] = (userScreeningCounts[uid] || 0) + 1;
    });

    const usersList = Object.values(store.users).map((u) => ({
      ...u,
      screeningsCount: Math.max(
        u.screeningsCount || 0,
        userScreeningCounts[u.userId] || 0
      ),
    }));
    usersList.sort(
      (a, b) =>
        new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
    );

    return NextResponse.json({
      success: true,
      users: usersList,
      events: store.events.slice(0, 300),
      screenings,
      contacts,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to load analytics",
      },
      { status: 500 }
    );
  }
}
