import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { ClinicalProfile, DEFAULT_CLINICAL_PROFILE } from "@/lib/firestore";

const DATA_DIR = path.join(process.cwd(), "data");
const PROFILES_FILE = path.join(DATA_DIR, "profiles.json");
const TMP_PROFILES_FILE = path.join(os.tmpdir(), "sonora_profiles.json");

interface StoredUserProfileRecord {
  userId: string;
  email?: string;
  clinicalProfile: ClinicalProfile;
  photoURL?: string;
  updatedAt: string;
}

function readJsonObj(filePath: string): Record<string, StoredUserProfileRecord> {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {}
  return {};
}

function readProfilesStore(): Record<string, StoredUserProfileRecord> {
  const bundled = readJsonObj(PROFILES_FILE);
  const tmp = readJsonObj(TMP_PROFILES_FILE);
  return { ...bundled, ...tmp };
}

function writeProfilesStore(store: Record<string, StoredUserProfileRecord>) {
  const payload = JSON.stringify(store, null, 2);
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PROFILES_FILE, payload, "utf-8");
  } catch {
    try {
      fs.writeFileSync(TMP_PROFILES_FILE, payload, "utf-8");
    } catch (err) {
      console.error("Error writing profiles store:", err);
    }
  }
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const email = searchParams.get("email")?.trim().toLowerCase();

    if ((!userId || userId === "guest") && !email) {
      return NextResponse.json(
        {
          success: true,
          profile: null,
        },
        { headers: CORS_HEADERS }
      );
    }

    const store = readProfilesStore();
    let record = (userId && store[userId]) || null;
    if (!record && email) {
      record =
        Object.values(store).find(
          (r) => r.email && r.email.trim().toLowerCase() === email
        ) || null;
    }

    return NextResponse.json(
      {
        success: true,
        profile: record,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to load profile",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email, clinicalProfile, photoURL } = body;

    if (!userId || userId === "guest") {
      return NextResponse.json(
        { success: false, error: "Valid userId required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const store = readProfilesStore();
    const existing = store[userId];
    const now = new Date().toISOString();

    const mergedProfile: ClinicalProfile = {
      ...DEFAULT_CLINICAL_PROFILE,
      ...(existing?.clinicalProfile || {}),
      ...(clinicalProfile || {}),
      photoURL:
        photoURL ||
        clinicalProfile?.photoURL ||
        existing?.photoURL ||
        existing?.clinicalProfile?.photoURL,
      updatedAt: now,
    };

    const updatedRecord: StoredUserProfileRecord = {
      userId,
      email: email || existing?.email || "",
      clinicalProfile: mergedProfile,
      photoURL: mergedProfile.photoURL,
      updatedAt: now,
    };

    store[userId] = updatedRecord;
    writeProfilesStore(store);

    return NextResponse.json(
      {
        success: true,
        profile: updatedRecord,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to save profile",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
