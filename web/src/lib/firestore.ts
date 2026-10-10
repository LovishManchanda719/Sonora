import { SessionDiagnosticResponse } from "./api-client";

export const ADMIN_EMAIL = "lovishmanchanda719@gmail.com";

export interface StoredScreening extends SessionDiagnosticResponse {
  userId?: string;
  userEmail?: string;
  createdAt?: { seconds: number; nanoseconds?: number } | string | number | null;
}

export interface HistoryQueryResult {
  items: StoredScreening[];
  isBlockedOrOffline: boolean;
}

export interface ContactInquiryRecord {
  id: string;
  name: string;
  email: string;
  affiliation: string;
  inquiryType: string;
  message: string;
  userId?: string;
  userRole?: "admin" | "user" | "guest";
  createdAt: string;
  status?: "new" | "reviewed";
}

const LOCAL_STORAGE_KEY_PREFIX = "dysarthrianet_screenings_";
const GLOBAL_LOCAL_STORAGE_KEY = "dysarthrianet_all_screenings";
const USER_PHOTO_KEY_PREFIX = "dysarthrianet_pfp_";

export function getScreeningTimestampMs(item: StoredScreening): number {
  if (item.timestamp) {
    const t = new Date(item.timestamp).getTime();
    if (!isNaN(t)) return t;
  }
  if (
    item.createdAt &&
    typeof item.createdAt === "object" &&
    "seconds" in item.createdAt
  ) {
    return ((item.createdAt as { seconds: number }).seconds || 0) * 1000;
  }
  if (typeof item.createdAt === "number") return item.createdAt;
  return 0;
}

/**
 * Retrieve cached screenings from local browser storage for a specific signed-in user.
 * If userId is not provided (user is signed out), returns [] so stats never leak after sign-out.
 */
export function getLocalScreenings(userId?: string): StoredScreening[] {
  if (typeof window === "undefined") return [];
  if (!userId || userId === "guest") return [];

  try {
    const listMap = new Map<string, StoredScreening>();

    // 1. Read user-specific key
    const userKey = `${LOCAL_STORAGE_KEY_PREFIX}${userId}`;
    const rawUser = localStorage.getItem(userKey);
    if (rawUser) {
      try {
        const userList: StoredScreening[] = JSON.parse(rawUser);
        userList.forEach((s) => listMap.set(s.session_id, s));
      } catch {
        // ignore corrupted JSON
      }
    }

    // 2. Read global device key ONLY for records matching this userId
    const rawGlobal = localStorage.getItem(GLOBAL_LOCAL_STORAGE_KEY);
    if (rawGlobal) {
      try {
        const globalList: StoredScreening[] = JSON.parse(rawGlobal);
        globalList.forEach((s) => {
          if (s.userId === userId) {
            listMap.set(s.session_id, s);
          }
        });
      } catch {
        // ignore corrupted JSON
      }
    }

    const items = Array.from(listMap.values());
    items.sort((a, b) => getScreeningTimestampMs(b) - getScreeningTimestampMs(a));
    return items;
  } catch (err) {
    console.warn("Failed to retrieve local screenings:", err);
    return [];
  }
}

/**
 * Save screening to local browser storage so it is immediately accessible.
 */
export function saveLocalScreening(
  userId: string | undefined,
  screening: StoredScreening
) {
  if (typeof window === "undefined") return;
  try {
    const sessionItem: StoredScreening = {
      ...screening,
      userId: userId || "guest",
      timestamp: screening.timestamp || new Date().toISOString(),
      createdAt: screening.createdAt || {
        seconds: Math.floor(Date.now() / 1000),
      },
    };

    if (userId && userId !== "guest") {
      const userKey = `${LOCAL_STORAGE_KEY_PREFIX}${userId}`;
      const existing = getLocalScreenings(userId);
      const filtered = existing.filter(
        (s) => s.session_id !== sessionItem.session_id
      );
      localStorage.setItem(
        userKey,
        JSON.stringify([sessionItem, ...filtered])
      );
    }

    const rawGlobal = localStorage.getItem(GLOBAL_LOCAL_STORAGE_KEY);
    const existingGlobal: StoredScreening[] = rawGlobal
      ? JSON.parse(rawGlobal)
      : [];
    const filteredGlobal = existingGlobal.filter(
      (s) => s.session_id !== sessionItem.session_id
    );
    localStorage.setItem(
      GLOBAL_LOCAL_STORAGE_KEY,
      JSON.stringify([sessionItem, ...filteredGlobal])
    );
  } catch (err) {
    console.warn("Failed to save local screening cache:", err);
  }
}

/**
 * Primary save routine:
 * 1. Writes to local device storage instantly.
 * 2. Writes to first-party API endpoint (`/api/screenings`) — 100% immune to ad-blockers (`ERR_BLOCKED_BY_CLIENT`).
 */
export async function saveScreeningResult(
  userId: string,
  userEmail: string,
  result: SessionDiagnosticResponse
): Promise<string> {
  const localRecord: StoredScreening = {
    ...result,
    userId: userId || "guest",
    userEmail: userEmail || "anonymous",
    timestamp: result.timestamp || new Date().toISOString(),
    createdAt: { seconds: Math.floor(Date.now() / 1000) },
  };

  // 1. Instant local persistence
  saveLocalScreening(userId, localRecord);

  // 2. First-party server API persistence
  try {
    const res = await fetch("/api/screenings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userId || "guest",
        userEmail: userEmail || "anonymous",
        screening: result,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "screening_completed",
          path: `/results/${result.session_id}`,
          userId: userId || "guest",
          userEmail: userEmail || "anonymous",
          metadata: {
            sessionId: result.session_id,
            isDysarthric: result.is_dysarthric,
            severity: result.consensus_severity,
            probability: result.consensus_probability,
          },
        }),
      }).catch(() => {});
      return data.session_id || result.session_id;
    }
  } catch (error) {
    console.warn("Local storage fallback used for screening persistence:", error);
  }

  return result.session_id;
}

/**
 * Primary history retrieval routine:
 * Returns [] when userId is undefined/guest so signed-out users never see stale stats.
 */
export async function getUserScreeningHistory(
  userId?: string
): Promise<HistoryQueryResult> {
  if (!userId || userId === "guest") {
    return { items: [], isBlockedOrOffline: false };
  }

  const localList = getLocalScreenings(userId);

  try {
    const url = `/api/screenings?userId=${encodeURIComponent(userId)}`;
    const res = await fetch(url, { method: "GET" });
    if (res.ok) {
      const data = await res.json();
      const serverList: StoredScreening[] = data.screenings || [];

      const mergedMap = new Map<string, StoredScreening>();
      serverList.forEach((s) => {
        if (s.userId === userId) {
          mergedMap.set(s.session_id, s);
        }
      });
      localList.forEach((s) => {
        if (!mergedMap.has(s.session_id)) {
          mergedMap.set(s.session_id, s);
        }
      });

      const merged = Array.from(mergedMap.values());
      merged.sort((a, b) => getScreeningTimestampMs(b) - getScreeningTimestampMs(a));

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `${LOCAL_STORAGE_KEY_PREFIX}${userId}`,
            JSON.stringify(merged)
          );
        } catch {
          // ignore cache write error
        }
      }

      return { items: merged, isBlockedOrOffline: false };
    }
  } catch (error) {
    console.info("Using local screening history repository:", error);
  }

  return { items: localList, isBlockedOrOffline: false };
}

export interface ClinicalProfile {
  patientName: string;
  age: string;
  sex: "Male" | "Female" | "Other" | "Unspecified";
  accountRole:
    | "Patient / Self-Screening"
    | "Family Caregiver"
    | "Speech-Language Pathologist (SLP)"
    | "Neurology Researcher";
  primaryEtiology: string;
  diagnosisYear: string;
  symptomTags: string[];
  supervisingClinician: string;
  clinicalFacility: string;
  targetPacingWpm: number;
  targetLoudnessDb: number;
  clinicalNotes: string;
  photoURL?: string;
  updatedAt?: string;
}

const CLINICAL_PROFILE_KEY_PREFIX = "dysarthrianet_clinical_profile_";

export const DEFAULT_CLINICAL_PROFILE: ClinicalProfile = {
  patientName: "",
  age: "",
  sex: "Unspecified",
  accountRole: "Patient / Self-Screening",
  primaryEtiology: "Undiagnosed / General Motor Speech Screening",
  diagnosisYear: "",
  symptomTags: [],
  supervisingClinician: "",
  clinicalFacility: "",
  targetPacingWpm: 100,
  targetLoudnessDb: 65,
  clinicalNotes: "",
};

export function getClinicalProfile(
  userId?: string,
  defaultName?: string
): ClinicalProfile {
  if (typeof window === "undefined") {
    return { ...DEFAULT_CLINICAL_PROFILE, patientName: defaultName || "" };
  }
  if (!userId || userId === "guest") {
    return { ...DEFAULT_CLINICAL_PROFILE, patientName: defaultName || "" };
  }
  try {
    const key = `${CLINICAL_PROFILE_KEY_PREFIX}${userId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CLINICAL_PROFILE,
        ...parsed,
        patientName: parsed.patientName || defaultName || "",
      };
    }
  } catch (err) {
    console.warn("Failed to read clinical profile:", err);
  }
  return { ...DEFAULT_CLINICAL_PROFILE, patientName: defaultName || "" };
}

/**
 * Saves ClinicalProfile to local storage AND syncs to our first-party `/api/profile`
 * and `/api/analytics` endpoints (100% immune to ad-blocker ERR_BLOCKED_BY_CLIENT).
 */
export async function saveClinicalProfileAsync(
  userId: string | undefined,
  profile: ClinicalProfile,
  userEmail?: string | null
): Promise<ClinicalProfile> {
  const updated: ClinicalProfile = {
    ...profile,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined" && userId && userId !== "guest") {
    try {
      const key = `${CLINICAL_PROFILE_KEY_PREFIX}${userId}`;
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (err) {
      console.warn("Failed to save local clinical profile:", err);
    }
  }

  if (userId && userId !== "guest") {
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email: userEmail || "",
          clinicalProfile: updated,
        }),
      });
      // Also update analytics user record so Admin Dashboard immediately sees their updated name/age/sex/condition
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          userEmail: userEmail || "anonymous",
          userName: updated.patientName,
          condition: updated.primaryEtiology,
          age: updated.age,
          sex: updated.sex,
        }),
      }).catch(() => {});
    } catch (err) {
      console.warn("Server profile sync fallback:", err);
    }
  }

  return updated;
}

export function saveClinicalProfile(
  userId: string | undefined,
  profile: ClinicalProfile
): ClinicalProfile {
  const updated: ClinicalProfile = {
    ...profile,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined" && userId && userId !== "guest") {
    try {
      const key = `${CLINICAL_PROFILE_KEY_PREFIX}${userId}`;
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (err) {
      console.warn("Failed to save clinical profile:", err);
    }
    saveClinicalProfileAsync(userId, updated).catch(() => {});
  }
  return updated;
}

/**
 * Loads ClinicalProfile from first-party `/api/profile` store and updates local cache.
 */
export async function fetchClinicalProfileFromFirestore(
  userId: string,
  defaultName?: string
): Promise<ClinicalProfile> {
  const local = getClinicalProfile(userId, defaultName);
  if (!userId || userId === "guest") return local;

  try {
    const res = await fetch(
      `/api/profile?userId=${encodeURIComponent(userId)}`,
      { method: "GET" }
    );
    if (res.ok) {
      const data = await res.json();
      const remoteRecord = data?.profile;
      if (remoteRecord?.clinicalProfile) {
        const merged: ClinicalProfile = {
          ...DEFAULT_CLINICAL_PROFILE,
          ...local,
          ...remoteRecord.clinicalProfile,
          photoURL:
            remoteRecord.photoURL ||
            remoteRecord.clinicalProfile.photoURL ||
            local.photoURL,
        };
        if (typeof window !== "undefined") {
          localStorage.setItem(
            `${CLINICAL_PROFILE_KEY_PREFIX}${userId}`,
            JSON.stringify(merged)
          );
          if (merged.photoURL) {
            localStorage.setItem(
              `${USER_PHOTO_KEY_PREFIX}${userId}`,
              merged.photoURL
            );
          }
        }
        return merged;
      }
    }
  } catch {
    // Offline fallback
  }
  return local;
}

/**
 * Save user's Profile Picture (compressed Data URL) to `/api/profile`, `/api/analytics`, and local cache.
 */
export async function saveUserProfilePhoto(
  userId: string,
  photoDataUrl: string,
  userEmail?: string | null
): Promise<void> {
  const currentProfile = getClinicalProfile(userId);
  const updatedProfile = { ...currentProfile, photoURL: photoDataUrl };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${USER_PHOTO_KEY_PREFIX}${userId}`, photoDataUrl);
      localStorage.setItem(
        `${CLINICAL_PROFILE_KEY_PREFIX}${userId}`,
        JSON.stringify(updatedProfile)
      );
    } catch (e) {
      console.warn("Local photo cache warning:", e);
    }
  }

  try {
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        email: userEmail || "",
        clinicalProfile: updatedProfile,
        photoURL: photoDataUrl,
      }),
    });
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        userEmail: userEmail || "anonymous",
        photoURL: photoDataUrl,
      }),
    }).catch(() => {});
  } catch (e) {
    console.warn("Server photo sync fallback:", e);
  }
}

export async function getUserProfilePhoto(
  userId?: string
): Promise<string | null> {
  if (!userId || typeof window === "undefined") return null;
  const cached = localStorage.getItem(`${USER_PHOTO_KEY_PREFIX}${userId}`);
  if (cached) return cached;

  try {
    const res = await fetch(
      `/api/profile?userId=${encodeURIComponent(userId)}`,
      { method: "GET" }
    );
    if (res.ok) {
      const data = await res.json();
      const photo = data?.profile?.photoURL;
      if (photo) {
        localStorage.setItem(`${USER_PHOTO_KEY_PREFIX}${userId}`, photo);
        return photo;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function clearLocalScreenings(userId?: string) {
  if (typeof window === "undefined") return;
  try {
    if (userId && userId !== "guest") {
      localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`);
    }
    localStorage.removeItem(GLOBAL_LOCAL_STORAGE_KEY);
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith("screening_")) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch (err) {
    console.warn("Failed to clear local screenings:", err);
  }
}

/**
 * Contact Us Inquiry Submission & Admin Retrieval via first-party `/api/contacts`
 * (100% immune to ad-blocker ERR_BLOCKED_BY_CLIENT).
 */
export async function submitContactInquiry(payload: {
  name: string;
  email: string;
  affiliation: string;
  inquiryType: string;
  message: string;
  userId?: string;
}): Promise<ContactInquiryRecord> {
  const createdAt = new Date().toISOString();
  const isUserAdmin = payload.email.trim().toLowerCase() === ADMIN_EMAIL;

  const res = await fetch("/api/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      userRole: isUserAdmin ? "admin" : payload.userId ? "user" : "guest",
      createdAt,
    }),
  });

  if (res.ok) {
    const data = await res.json();
    return data.inquiry;
  }

  return {
    id: `inq_${Date.now()}`,
    ...payload,
    userRole: isUserAdmin ? "admin" : payload.userId ? "user" : "guest",
    createdAt,
    status: "new",
  };
}

export async function fetchAllContactInquiries(
  adminEmail?: string | null
): Promise<ContactInquiryRecord[]> {
  if (!adminEmail || adminEmail.trim().toLowerCase() !== ADMIN_EMAIL) {
    return [];
  }

  try {
    const res = await fetch(
      `/api/contacts?adminEmail=${encodeURIComponent(adminEmail)}`,
      { method: "GET" }
    );
    if (res.ok) {
      const data = await res.json();
      const list: ContactInquiryRecord[] = data.inquiries || [];
      list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return list;
    }
  } catch (e) {
    console.warn("Failed to fetch /api/contacts:", e);
  }

  return [];
}
