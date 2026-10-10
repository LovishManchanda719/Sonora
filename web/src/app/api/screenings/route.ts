import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { StoredScreening } from "@/lib/firestore";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "screenings.json");

function getStoredScreenings(): StoredScreening[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, "[]", "utf-8");
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error("Error reading screenings store:", err);
    return [];
  }
}

function saveStoredScreenings(screenings: StoredScreening[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(screenings, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing screenings store:", err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId || userId === "guest" || userId === "anonymous") {
      return NextResponse.json({
        success: true,
        screenings: [],
      });
    }

    const all = getStoredScreenings();
    const filtered = all.filter((s) => s.userId === userId);

    // Sort newest first
    filtered.sort((a, b) => {
      const aSec = typeof a.createdAt === "object" && a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
      const bSec = typeof b.createdAt === "object" && b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
      const timeA = new Date(a.timestamp || aSec).getTime();
      const timeB = new Date(b.timestamp || bSec).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({
      success: true,
      screenings: filtered,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch screenings";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
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
        { status: 400 }
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

    return NextResponse.json({
      success: true,
      session_id: item.session_id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save screening";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
