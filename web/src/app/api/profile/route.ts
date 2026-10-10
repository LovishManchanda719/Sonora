import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ClinicalProfile, DEFAULT_CLINICAL_PROFILE } from "@/lib/firestore";

const DATA_DIR = path.join(process.cwd(), "data");
const PROFILES_FILE = path.join(DATA_DIR, "profiles.json");

interface StoredUserProfileRecord {
  userId: string;
  email?: string;
  clinicalProfile: ClinicalProfile;
  photoURL?: string;
  updatedAt: string;
}

function readProfilesStore(): Record<string, StoredUserProfileRecord> {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(PROFILES_FILE)) {
      fs.writeFileSync(PROFILES_FILE, "{}", "utf-8");
      return {};
    }
    const raw = fs.readFileSync(PROFILES_FILE, "utf-8");
    return JSON.parse(raw) || {};
  } catch (err) {
    console.error("Error reading profiles store:", err);
    return {};
  }
}

function writeProfilesStore(store: Record<string, StoredUserProfileRecord>) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing profiles store:", err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId || userId === "guest") {
      return NextResponse.json({
        success: true,
        profile: null,
      });
    }

    const store = readProfilesStore();
    const record = store[userId] || null;

    return NextResponse.json({
      success: true,
      profile: record,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to load profile",
      },
      { status: 500 }
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
        { status: 400 }
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

    return NextResponse.json({
      success: true,
      profile: updatedRecord,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to save profile",
      },
      { status: 500 }
    );
  }
}
