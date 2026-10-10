"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-context";
import { getClinicalProfile } from "./firestore";

const ANON_VID_KEY = "dysarthrianet_visitor_id";
const DETECTED_CITY_KEY = "dysarthrianet_detected_city";

export function getOrCreateVisitorId(userId?: string): string {
  if (userId) return userId;
  if (typeof window === "undefined") return "guest_visitor";
  let vid = localStorage.getItem(ANON_VID_KEY);
  if (!vid) {
    vid = `anon_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(ANON_VID_KEY, vid);
  }
  return vid;
}

export function setDetectedUserCity(city: string) {
  if (typeof window === "undefined" || !city) return;
  try {
    localStorage.setItem(DETECTED_CITY_KEY, city);
  } catch {
    // ignore
  }
}

export function getClientEnvironmentInfo() {
  if (typeof window === "undefined") {
    return {
      deviceType: "Desktop" as const,
      browser: "Server",
      os: "Unknown",
      timezone: "Asia/Kolkata",
      city: "India",
      country: "India",
    };
  }

  const ua = navigator.userAgent || "";
  const isMobile = /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const deviceType: "Desktop" | "Mobile" | "Tablet" = isTablet
    ? "Tablet"
    : isMobile
    ? "Mobile"
    : "Desktop";

  let browser = "Chrome";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";
  else if (ua.includes("Chrome/")) browser = "Chrome";

  let os = "Windows";
  if (ua.includes("Win")) os = "Windows";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";

  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  const savedCity = localStorage.getItem(DETECTED_CITY_KEY);
  const tzParts = timezone.split("/");
  const inferredCity =
    savedCity ||
    (tzParts.length > 1
      ? tzParts[tzParts.length - 1].replace(/_/g, " ")
      : "India");
  const country =
    timezone.includes("Kolkata") || timezone.includes("Calcutta")
      ? "India"
      : tzParts[0] || "Global";

  return {
    deviceType,
    browser,
    os,
    timezone,
    city: inferredCity,
    country,
  };
}

export async function trackAnalyticsEvent(params: {
  eventType:
    | "page_view"
    | "screening_completed"
    | "pdf_downloaded"
    | "therapy_used"
    | "slp_locator_used"
    | "user_auth";
  path?: string;
  userId?: string;
  userEmail?: string | null;
  userName?: string | null;
  authProvider?: string;
  condition?: string;
  age?: string;
  sex?: string;
  photoURL?: string | null;
  metadata?: Record<string, string | number | boolean>;
}) {
  if (typeof window === "undefined") return;
  try {
    const env = getClientEnvironmentInfo();
    const uid = getOrCreateVisitorId(params.userId);
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: params.eventType,
        path: params.path || window.location.pathname,
        userId: uid,
        userEmail: params.userEmail || "anonymous",
        userName: params.userName || undefined,
        authProvider: params.authProvider || "guest",
        condition: params.condition,
        age: params.age,
        sex: params.sex,
        photoURL: params.photoURL || undefined,
        city: env.city,
        country: env.country,
        timezone: env.timezone,
        deviceType: env.deviceType,
        browser: env.browser,
        os: env.os,
        metadata: params.metadata,
      }),
    });
  } catch {
    // Non-blocking analytics
  }
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const { user, profilePhotoUrl } = useAuth();
  const lastTrackedRef = useRef<string>("");

  useEffect(() => {
    const key = `${pathname}_${user?.uid || "guest"}`;
    if (lastTrackedRef.current === key) return;
    lastTrackedRef.current = key;

    const clinical = getClinicalProfile(
      user?.uid,
      user?.displayName || undefined
    );
    const provider = user?.providerData?.some(
      (p) => p.providerId === "google.com"
    )
      ? "Google"
      : user?.email
      ? "Email/Password"
      : "Guest";

    trackAnalyticsEvent({
      eventType: "page_view",
      path: pathname,
      userId: user?.uid,
      userEmail: user?.email,
      userName:
        clinical.patientName ||
        user?.displayName ||
        (user?.email ? user.email.split("@")[0] : "Guest Visitor"),
      authProvider: provider,
      condition: clinical.primaryEtiology,
      age: clinical.age,
      sex: clinical.sex,
      photoURL: profilePhotoUrl || user?.photoURL,
    });
  }, [pathname, user, profilePhotoUrl]);

  return null;
}
