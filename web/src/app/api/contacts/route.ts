import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ADMIN_EMAIL, ContactInquiryRecord } from "@/lib/firestore";

const DATA_DIR = path.join(process.cwd(), "data");
const CONTACTS_FILE = path.join(DATA_DIR, "contacts.json");

// Simple in-memory rate limiter per IP (max 15 requests per minute)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxRequests = 15): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

function sanitizeText(input: unknown, maxLen = 1500): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLen);
}

function getStoredContacts(): ContactInquiryRecord[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(CONTACTS_FILE)) {
      fs.writeFileSync(CONTACTS_FILE, "[]", "utf-8");
      return [];
    }
    const raw = fs.readFileSync(CONTACTS_FILE, "utf-8");
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error("Error reading contacts store:", err);
    return [];
  }
}

function saveStoredContacts(contacts: ContactInquiryRecord[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing contacts store:", err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "local";
    if (!checkRateLimit(ip, 30)) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const adminEmail = searchParams.get("adminEmail")?.trim().toLowerCase();

    if (adminEmail !== ADMIN_EMAIL) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Admin access required to view user inquiries.",
        },
        { status: 403 }
      );
    }

    const all = getStoredContacts();
    all.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      inquiries: all,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load inquiries";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "local";
    if (!checkRateLimit(ip, 10)) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please wait a minute before sending another message.",
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const name = sanitizeText(body.name, 120);
    const email = sanitizeText(body.email, 160);
    const affiliation = sanitizeText(body.affiliation, 200);
    const inquiryType = sanitizeText(body.inquiryType, 100);
    const message = sanitizeText(body.message, 2500);
    const userId = sanitizeText(body.userId, 128);

    if (!name || !email || !message) {
      return NextResponse.json(
        {
          success: false,
          error: "Name, email, and message are required.",
        },
        { status: 400 }
      );
    }

    const record: ContactInquiryRecord = {
      id: sanitizeText(body.id, 80) || `inq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      email,
      affiliation: affiliation || "Independent User",
      inquiryType: inquiryType || "General Inquiry",
      message,
      userId: userId || undefined,
      userRole:
        email.toLowerCase() === ADMIN_EMAIL
          ? "admin"
          : userId
          ? "user"
          : "guest",
      createdAt: body.createdAt || new Date().toISOString(),
      status: "new",
    };

    const all = getStoredContacts();
    all.unshift(record);
    saveStoredContacts(all);

    return NextResponse.json({
      success: true,
      inquiry: record,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to submit inquiry";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
