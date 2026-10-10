import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { StoredScreening } from "@/lib/firestore";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "screenings.json");
const TMP_FILE = path.join(os.tmpdir(), "sonora_screenings.json");

function readJsonList(filePath: string): StoredScreening[] {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function getStoredScreenings(): StoredScreening[] {
  const bundled = readJsonList(DATA_FILE);
  const tmp = readJsonList(TMP_FILE);
  if (!tmp.length) return bundled;
  const seen = new Set<string>();
  const merged: StoredScreening[] = [];
  for (const s of [...tmp, ...bundled]) {
    if (s && s.session_id && !seen.has(s.session_id)) {
      seen.add(s.session_id);
      merged.push(s);
    }
  }
  return merged;
}

function saveStoredScreenings(screenings: StoredScreening[]) {
  const payload = JSON.stringify(screenings, null, 2);
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, payload, "utf-8");
  } catch {
    try {
      fs.writeFileSync(TMP_FILE, payload, "utf-8");
    } catch (err) {
      console.error("Error writing screenings store:", err);
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

    if ((!userId || userId === "guest" || userId === "anonymous") && (!email || email === "anonymous")) {
      return NextResponse.json(
        {
          success: true,
          screenings: [],
        },
        { headers: CORS_HEADERS }
      );
    }

    const all = getStoredScreenings();
    const filtered = all.filter((s) => {
      if (userId && userId !== "guest" && userId !== "anonymous" && s.userId === userId) {
        return true;
      }
      if (email && email !== "anonymous" && s.userEmail && s.userEmail.trim().toLowerCase() === email) {
        return true;
      }
      return false;
    });

    // Sort newest first
    filtered.sort((a, b) => {
      const aSec = typeof a.createdAt === "object" && a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
      const bSec = typeof b.createdAt === "object" && b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
      const timeA = new Date((a.timestamp || "").replace(" ", "T") || aSec).getTime();
      const timeB = new Date((b.timestamp || "").replace(" ", "T") || bSec).getTime();
      return timeB - timeA;
    });

    return NextResponse.json(
      {
        success: true,
        screenings: filtered,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch screenings";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userEmail, screening } = body;

    if (!screening || !screening.session_id) {
      return NextResponse.json(
        { success: false, error: "Invalid screening payload" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const item: StoredScreening = {
      ...screening,
      userId: userId || "guest",
      userEmail: userEmail || "anonymous",
      timestamp: screening.timestamp || new Date().toISOString(),
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
    };

    const all = getStoredScreenings();
    // Filter out duplicate session_id if re-saved
    const filtered = all.filter((s) => s.session_id !== item.session_id);
    filtered.unshift(item);

    saveStoredScreenings(filtered);

    return NextResponse.json(
      {
        success: true,
        session_id: item.session_id,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save screening";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
