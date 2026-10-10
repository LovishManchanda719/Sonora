"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  LogOut,
  Check,
  History,
  FileSpreadsheet,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ArrowRight,
  RefreshCw,
  FileDown,
  UserCheck,
  Activity,
  TrendingDown,
  TrendingUp,
  Minus,
  Database,
  Trash2,
  ClipboardList,
  Loader2,
  LogIn,
  Camera,
  KeyRound,
  CloudCheck,
  Lock,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  getUserScreeningHistory,
  StoredScreening,
  getScreeningTimestampMs,
  ClinicalProfile,
  DEFAULT_CLINICAL_PROFILE,
  getClinicalProfile,
  saveClinicalProfileAsync,
  fetchClinicalProfileFromFirestore,
  clearLocalScreenings,
} from "@/lib/firestore";
import { ProgressTrendChart } from "@/components/dashboard/ProgressTrendChart";
import { generateClinicalPdfReport } from "@/lib/report-pdf";

type ProfileTab = "history" | "dossier" | "account";

const ETIOLOGY_OPTIONS = [
  "Undiagnosed / General Motor Speech Screening",
  "Healthy Control / Normal Speech Baseline",
  "Parkinson's Disease (Hypokinetic Dysarthria)",
  "Post-Stroke / Cerebrovascular Accident",
  "ALS / Motor Neuron Disease",
  "Cerebral Palsy / Spastic Dysarthria",
  "Multiple Sclerosis / Ataxic Speech",
  "Traumatic Brain Injury (TBI)",
];

function formatSessionDate(item: StoredScreening): string {
  const ms = getScreeningTimestampMs(item);
  if (ms > 0) {
    return new Date(ms).toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (item.timestamp) return item.timestamp;
  return "Recorded Session";
}

/**
 * Compresses an uploaded image file to a clean 256x256 JPEG Data URL
 * so it can be stored directly in Firebase Firestore & rendered instantaneously.
 */
function compressImageToDataUrl(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image format."));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context unavailable."));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const router = useRouter();
  const {
    user,
    loading: authLoading,
    isAdmin,
    profilePhotoUrl,
    updateUserPassword,
    linkGoogleAccount,
    updateUserPhoto,
    signOut,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<ProfileTab>("history");
  const [history, setHistory] = useState<StoredScreening[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [profile, setProfile] = useState<ClinicalProfile>(DEFAULT_CLINICAL_PROFILE);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [confirmClearCache, setConfirmClearCache] = useState(false);
  const [downloadingSessionId, setDownloadingSessionId] = useState<string | null>(null);

  // Profile picture states
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [photoStatusMsg, setPhotoStatusMsg] = useState<string | null>(null);

  // Password & Google linking states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load clinical dossier on mount / auth change — reset when signed out!
  useEffect(() => {
    let active = true;
    if (!user) {
      setProfile(DEFAULT_CLINICAL_PROFILE);
      setPendingPhotoUrl(null);
      return;
    }

    const defaultName =
      user.displayName || (user.email ? user.email.split("@")[0] : "");
    const localLoaded = getClinicalProfile(user.uid, defaultName);
    setProfile(localLoaded);

    fetchClinicalProfileFromFirestore(user.uid, defaultName).then((remote) => {
      if (active) setProfile(remote);
    });

    return () => {
      active = false;
    };
  }, [user]);

  // Load patient screening history — strictly clear to [] when user is signed out!
  const loadHistory = useCallback(async () => {
    if (!user?.uid) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await getUserScreeningHistory(user.uid);
      setHistory(res.items);
    } catch (err) {
      console.warn("Error loading screening history:", err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Compute longitudinal KPI metrics from history (0 when signed out)
  const metrics = useMemo(() => {
    if (!user || history.length === 0) {
      return {
        totalSessions: 0,
        latestProbPct: null as number | null,
        latestSeverity: "No Baseline",
        latestDateStr: "No sessions yet",
        deltaPct: null as number | null,
        trendLabel: "Awaiting Baseline",
      };
    }

    const chronological = [...history].sort(
      (a, b) => getScreeningTimestampMs(a) - getScreeningTimestampMs(b)
    );
    const baseline = chronological[0];
    const latest = chronological[chronological.length - 1];

    const baselinePct = Math.round(baseline.consensus_probability * 100);
    const latestProbPct = Math.round(latest.consensus_probability * 100);
    const deltaPct =
      chronological.length >= 2 ? latestProbPct - baselinePct : null;

    let trendLabel = "Baseline Established";
    if (deltaPct !== null) {
      if (deltaPct <= -3) trendLabel = "Improved Risk";
      else if (deltaPct >= 3) trendLabel = "Elevated Risk";
      else trendLabel = "Stable Trajectory";
    }

    return {
      totalSessions: history.length,
      latestProbPct,
      latestSeverity: latest.consensus_severity,
      latestDateStr: formatSessionDate(latest),
      deltaPct,
      trendLabel,
    };
  }, [user, history]);

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingProfile(true);
    try {
      const updated = await saveClinicalProfileAsync(
        user?.uid,
        profile,
        user?.email
      );
      setProfile(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSelectPhotoFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoStatusMsg(null);
    try {
      const dataUrl = await compressImageToDataUrl(file, 256);
      setPendingPhotoUrl(dataUrl);
    } catch (err: unknown) {
      setPhotoStatusMsg(
        err instanceof Error ? err.message : "Could not process image."
      );
    }
  };

  const handleApplyPhoto = async () => {
    if (!pendingPhotoUrl || !user) return;
    setIsSavingPhoto(true);
    setPhotoStatusMsg(null);
    try {
      await updateUserPhoto(pendingPhotoUrl);
      setPendingPhotoUrl(null);
      setPhotoStatusMsg("Profile picture saved to Firebase & applied!");
      setTimeout(() => setPhotoStatusMsg(null), 3500);
    } catch (err: unknown) {
      setPhotoStatusMsg(
        err instanceof Error ? err.message : "Failed to save profile picture."
      );
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);
    if (newPassword.length < 6) {
      setPasswordStatus({
        type: "error",
        text: "Password must be at least 6 characters long.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({
        type: "error",
        text: "Passwords do not match.",
      });
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await updateUserPassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus({
        type: "success",
        text: "Password updated successfully in Firebase Auth!",
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message.replace("Firebase: ", "")
          : "Failed to update password. If it has been a long time since sign-in, please sign out and sign back in first.";
      setPasswordStatus({ type: "error", text: msg });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleConnectGoogle = async () => {
    setGoogleStatus(null);
    setIsLinkingGoogle(true);
    try {
      await linkGoogleAccount();
      setGoogleStatus({
        type: "success",
        text: "Google account connected & authenticated!",
      });
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "";
      if (
        raw.includes("auth/popup-closed-by-user") ||
        raw.includes("auth/cancelled-popup-request")
      ) {
        return;
      }
      const msg = raw
        ? raw.replace("Firebase: ", "")
        : "Could not connect Google account.";
      setGoogleStatus({ type: "error", text: msg });
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  const handleDownloadSessionPdf = (session: StoredScreening) => {
    try {
      setDownloadingSessionId(session.session_id);
      generateClinicalPdfReport(session, {
        patientName:
          profile.patientName ||
          user?.displayName ||
          user?.email ||
          "Evaluated Participant",
        evaluator: "DysarthriaNet-XC Unified Protocol",
        etiology: profile.primaryEtiology || undefined,
      });
    } catch (err) {
      console.error("Failed to generate session PDF:", err);
    } finally {
      setDownloadingSessionId(null);
    }
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      clinicalProfile: profile,
      totalScreenings: history.length,
      screenings: history,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DysarthriaNet_Longitudinal_Record_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const headers = [
      "Session ID",
      "Timestamp",
      "Patient Name",
      "Primary Condition",
      "Consensus Diagnosis",
      "Consensus Probability (%)",
      "Consensus Severity",
      "Flagged Tasks Ratio",
      "Confidence Rating",
    ];
    const rows = history.map((s) => [
      s.session_id,
      formatSessionDate(s).replace(/,/g, " "),
      (profile.patientName || user?.displayName || "Anonymous").replace(
        /,/g,
        " "
      ),
      (profile.primaryEtiology || "Unspecified").replace(/,/g, " "),
      s.consensus_diagnosis.replace(/,/g, " "),
      Math.round(s.consensus_probability * 100).toString(),
      s.consensus_severity,
      s.dysarthria_vote_ratio,
      s.confidence_rating,
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DysarthriaNet_History_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLocalCache = () => {
    clearLocalScreenings(user?.uid);
    setConfirmClearCache(false);
    setHistory([]);
  };

  const handleSignOut = async () => {
    setHistory([]);
    setProfile(DEFAULT_CLINICAL_PROFILE);
    await signOut();
    router.push("/");
  };

  const displayTitle = user
    ? profile.patientName ||
      user.displayName ||
      (user.email ? user.email.split("@")[0] : "Signed-In User")
    : "Guest Visitor (Signed Out)";

  const activeAvatar =
    pendingPhotoUrl || profilePhotoUrl || user?.photoURL || null;

  const isGoogleLinked = Boolean(
    user?.providerData?.some((p) => p.providerId === "google.com")
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 pt-2">
      {/* 1. PROFILE IDENTITY & LIVE LONGITUDINAL SNAPSHOT HEADER */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0">
              {user && activeAvatar ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={activeAvatar}
                  alt="Profile Avatar"
                  className="h-16 w-16 rounded-2xl object-cover border-2 border-clinical-cyan/40 shadow-sm"
                />
              ) : (
                <div className="h-16 w-16 rounded-2xl bg-[#14171A] text-vitality flex items-center justify-center font-black text-2xl shadow-sm">
                  {user ? displayTitle[0]?.toUpperCase() || "U" : "G"}
                </div>
              )}
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("account");
                    setTimeout(() => fileInputRef.current?.click(), 100);
                  }}
                  title="Upload or change profile picture"
                  className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-[#14171A] text-vitality border-2 border-white flex items-center justify-center shadow-sm hover:scale-105 transition-transform cursor-pointer"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  {displayTitle}
                </h1>
                {user && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isAdmin
                        ? "bg-vitality text-[#14171A]"
                        : "bg-slate-900 text-vitality"
                    }`}
                  >
                    {isAdmin ? "Administrator" : "Registered User"}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                {user ? (
                  <>
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      {user.email}
                    </span>
                    <span className="text-slate-300 hidden sm:inline">•</span>
                    <span className="font-medium text-slate-700">
                      {profile.primaryEtiology}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-500 font-medium">
                    Sign in to view your personal screening stats, save your clinical profile to Firebase, and customize your account.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Account Actions */}
          <div className="flex items-center gap-2 self-start md:self-center">
            {!user && !authLoading ? (
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 bg-[#14171A] hover:bg-black text-white px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-soft-sm"
              >
                <LogIn className="h-3.5 w-3.5 text-vitality" />
                <span>Sign In / Create Account</span>
              </Link>
            ) : user ? (
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-full text-xs font-bold border border-red-100 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* 3 Live Longitudinal Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Card 1: Total Screenings */}
          <div className="rounded-2xl bg-slate-50/90 border border-slate-100 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Patient History
              </span>
              <History className="h-4 w-4 text-clinical-cyan" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {metrics.totalSessions}
              </span>
              <span className="text-xs font-semibold text-slate-600 ml-1.5">
                {metrics.totalSessions === 1 ? "Session" : "Sessions"}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 truncate">
              {user ? `Latest: ${metrics.latestDateStr}` : "Sign in to view history"}
            </span>
          </div>

          {/* Card 2: Latest Risk & Severity */}
          <div className="rounded-2xl bg-slate-50/90 border border-slate-100 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Latest Risk Index
              </span>
              <Activity className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {metrics.latestProbPct !== null
                  ? `${metrics.latestProbPct}%`
                  : "—"}
              </span>
              <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                {metrics.latestSeverity}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1">
              Multi-Utterance Consensus
            </span>
          </div>

          {/* Card 3: Longitudinal Delta */}
          <div className="rounded-2xl bg-slate-50/90 border border-slate-100 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Trajectory vs. Baseline
              </span>
              {metrics.deltaPct !== null && metrics.deltaPct < 0 ? (
                <TrendingDown className="h-4 w-4 text-emerald-600" />
              ) : metrics.deltaPct !== null && metrics.deltaPct > 0 ? (
                <TrendingUp className="h-4 w-4 text-amber-600" />
              ) : (
                <Minus className="h-4 w-4 text-slate-400" />
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={`text-2xl font-black font-mono ${
                  metrics.deltaPct !== null && metrics.deltaPct <= -3
                    ? "text-emerald-600"
                    : metrics.deltaPct !== null && metrics.deltaPct >= 3
                    ? "text-amber-600"
                    : "text-slate-900"
                }`}
              >
                {metrics.deltaPct !== null
                  ? `${metrics.deltaPct > 0 ? "+" : ""}${metrics.deltaPct}%`
                  : "—"}
              </span>
              <span className="text-xs font-semibold text-slate-600">
                {metrics.trendLabel}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1">
              {metrics.totalSessions >= 2
                ? `Tracked across ${metrics.totalSessions} sessions`
                : "Complete ≥2 sessions to track trend"}
            </span>
          </div>
        </div>

        {/* Navigation Switcher inside Profile Page */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="inline-flex flex-wrap items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200/70 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "history"
                  ? "bg-[#14171A] text-white shadow-soft-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <History className="h-3.5 w-3.5 text-vitality" />
              <span>Screening History</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  activeTab === "history"
                    ? "bg-white/15 text-vitality"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {history.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("dossier")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "dossier"
                  ? "bg-[#14171A] text-white shadow-soft-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5 text-clinical-cyan" />
              <span>Basic Clinical Info</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("account")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "account"
                  ? "bg-[#14171A] text-white shadow-soft-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Lock className="h-3.5 w-3.5 text-emerald-400" />
              <span>Account, Photo &amp; Data</span>
            </button>
          </div>

          {activeTab === "history" && user && (
            <button
              type="button"
              onClick={() => loadHistory()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 text-xs transition-all cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
              <span>Refresh History</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. TAB CONTENT */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {!user ? (
            <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-100 shadow-soft-sm flex flex-col items-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <LogIn className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg text-slate-900">
                  You Are Currently Signed Out
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                  For your privacy, screening statistics and past session reports are hidden when signed out. Sign in to view your personal screening timeline.
                </p>
              </div>
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 bg-[#14171A] hover:bg-black text-white px-5 py-2.5 rounded-full text-xs font-bold transition-all"
              >
                <LogIn className="h-3.5 w-3.5 text-vitality" />
                <span>Sign In to View History</span>
              </Link>
            </div>
          ) : historyLoading ? (
            <div className="bg-white rounded-3xl p-16 border border-slate-100 shadow-soft-sm text-center flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-6 w-6 animate-spin text-clinical-cyan" />
              <span className="text-xs text-slate-500">
                Loading your screening history...
              </span>
            </div>
          ) : history.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-100 shadow-soft-sm flex flex-col items-center space-y-4">
              <div className="relative mb-1">
                <div className="absolute inset-0 bg-clinical-cyan/10 rounded-full blur-2xl pointer-events-none scale-90"></div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/history-empty.png"
                  alt="No Patient Screenings Recorded"
                  className="relative z-10 w-60 sm:w-68 max-h-44 object-contain drop-shadow-md rounded-2xl"
                />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg text-slate-900">
                  No Screening Sessions Recorded Yet
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                  Complete a 3-step vocal assessment using <strong>Screen Voice</strong> in the top navigation bar to establish your baseline and track your progress over time.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Longitudinal Trend Chart */}
              <ProgressTrendChart history={history} />

              {/* Recorded Screening Sessions Feed (Side-by-side comparison removed as requested) */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                      Recorded Screening Sessions ({history.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Open any session to view its full diagnostic evaluation or download its unified PDF report.
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {history.map((item) => {
                    const probPct = Math.round(
                      item.consensus_probability * 100
                    );
                    const isDownloading =
                      downloadingSessionId === item.session_id;

                    return (
                      <div
                        key={item.session_id}
                        className="rounded-2xl p-5 bg-slate-50/70 hover:bg-slate-50 border border-slate-200/70 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              {formatSessionDate(item)}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500">
                              {item.session_id}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                                item.is_dysarthric
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {item.consensus_severity}
                            </span>
                          </div>

                          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                            {item.is_dysarthric ? (
                              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                            ) : (
                              <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                            )}
                            <span>{item.consensus_diagnosis}</span>
                          </h3>

                          {item.utterances && item.utterances.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {item.utterances.map((u) => (
                                <span
                                  key={u.utterance_index}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200/80 text-[11px] text-slate-600"
                                >
                                  <span className="font-semibold text-slate-700 capitalize">
                                    {u.task_name.replace(/_/g, " ")}:
                                  </span>
                                  <span className="font-mono font-bold text-slate-900">
                                    {Math.round(u.dysarthria_probability * 100)}%
                                  </span>
                                </span>
                              ))}
                              <span className="text-[11px] text-slate-400 font-medium pl-1">
                                ({item.dysarthria_vote_ratio} tasks flagged)
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200/60">
                          <div className="text-left lg:text-right pr-2">
                            <span className="text-xl font-black text-slate-900 font-mono">
                              {probPct}%
                            </span>
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">
                              Risk Index
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDownloadSessionPdf(item)}
                              disabled={isDownloading}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold shadow-sm transition-all cursor-pointer"
                              title="Download Clinical PDF Report for this session"
                            >
                              {isDownloading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-clinical-cyan" />
                              ) : (
                                <FileDown className="h-3.5 w-3.5 text-clinical-cyan" />
                              )}
                              <span>PDF</span>
                            </button>

                            <Link
                              href={`/results/${item.session_id}`}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#14171A] hover:bg-black text-white text-xs font-bold shadow-sm transition-all"
                            >
                              <span>Open Report</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: MINIMAL, ESSENTIAL CLINICAL DOSSIER (SAVED TO FIREBASE FIRESTORE) */}
      {activeTab === "dossier" && (
        <form
          onSubmit={handleSaveProfile}
          className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-sm space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-clinical-cyan" />
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Essential Patient Information
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Just 4 quick, essential fields used to label your PDF reports and set your age/sex voice reference norms. Saved directly to Firebase Firestore.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full shrink-0">
              <CloudCheck className="h-3.5 w-3.5" />
              <span>Firebase Firestore Sync Active</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                1. Full Name
              </label>
              <input
                type="text"
                value={profile.patientName}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    patientName: e.target.value,
                  }))
                }
                placeholder="e.g., Lovish Manchanda"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                2. Age (Years)
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={profile.age}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, age: e.target.value }))
                }
                placeholder="e.g., 21"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                3. Sex
              </label>
              <select
                value={profile.sex}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    sex: e.target.value as ClinicalProfile["sex"],
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
              >
                <option value="Unspecified">Prefer not to say / General</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                4. Primary Condition / Screening Reason
              </label>
              <select
                value={profile.primaryEtiology}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    primaryEtiology: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
              >
                {ETIOLOGY_OPTIONS.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Brief Note (Optional)
              </label>
              <input
                type="text"
                value={profile.clinicalNotes}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    clinicalNotes: e.target.value,
                  }))
                }
                placeholder="Any optional context for your PDF report..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="inline-flex items-center gap-2 bg-vitality hover:bg-vitality-hover text-[#14171A] px-6 py-3 rounded-full text-xs font-bold shadow-soft-sm transition-all cursor-pointer disabled:opacity-60"
            >
              {isSavingProfile ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving to Firebase...</span>
                </>
              ) : savedSuccess ? (
                <>
                  <Check className="h-4 w-4 text-emerald-900" />
                  <span>Saved to Firebase Firestore!</span>
                </>
              ) : (
                <span>Save Basic Profile</span>
              )}
            </button>

            {profile.updatedAt && (
              <span className="text-[11px] text-slate-400 font-mono">
                Last synced: {new Date(profile.updatedAt).toLocaleString()}
              </span>
            )}
          </div>
        </form>
      )}

      {/* TAB 3: ACCOUNT SECURITY (PFP, PASSWORD, GOOGLE SIGN-IN) & DATA PRIVACY */}
      {activeTab === "account" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Profile Picture Upload (Saved to Firebase) */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-sm space-y-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-clinical-cyan" />
                  <h2 className="text-base font-extrabold text-slate-900">
                    Profile Picture (Saved in Firebase)
                  </h2>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Upload a photo from your device and click <strong>Apply &amp; Save to Firebase</strong>. Your avatar will appear across the navigation bar and your profile.
                </p>
              </div>

              {!user ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
                  Please sign in first to upload and save your profile picture to Firebase.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    {activeAvatar ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={activeAvatar}
                        alt="Preview Avatar"
                        className="h-20 w-20 rounded-2xl object-cover border-2 border-clinical-cyan shadow-sm"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-2xl bg-[#14171A] text-vitality flex items-center justify-center font-black text-2xl">
                        {displayTitle[0]?.toUpperCase() || "U"}
                      </div>
                    )}

                    <div className="space-y-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSelectPhotoFile}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        <span>Choose Image...</span>
                      </button>

                      {pendingPhotoUrl && (
                        <button
                          type="button"
                          onClick={handleApplyPhoto}
                          disabled={isSavingPhoto}
                          className="inline-flex items-center gap-2 bg-vitality hover:bg-vitality-hover text-[#14171A] px-4 py-2 rounded-full text-xs font-bold shadow-sm transition-all cursor-pointer ml-2"
                        >
                          {isSavingPhoto ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          <span>Apply &amp; Save to Firebase</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {photoStatusMsg && (
                    <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl">
                      {photoStatusMsg}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Card 2: Set / Update Password & Connect Google Account */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-sm space-y-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-indigo-500" />
                  <h2 className="text-base font-extrabold text-slate-900">
                    Password &amp; Google Sign-In
                  </h2>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Set or update your account password, or connect your Google account so you can sign in with either method anytime.
                </p>
              </div>

              {!user ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
                  Please sign in first to manage your password and Google sign-in methods.
                </p>
              ) : (
                <div className="space-y-5">
                  {/* Set / Update Password Form */}
                  <form onSubmit={handleSetPassword} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password (min 6 chars)"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                      />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isUpdatingPassword}
                      className="inline-flex items-center gap-2 bg-[#14171A] hover:bg-black text-white px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isUpdatingPassword ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <KeyRound className="h-3.5 w-3.5 text-vitality" />
                      )}
                      <span>Set / Update Password</span>
                    </button>

                    {passwordStatus && (
                      <p
                        className={`text-xs font-medium px-3 py-2 rounded-xl border ${
                          passwordStatus.type === "success"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        {passwordStatus.text}
                      </p>
                    )}
                  </form>

                  {/* Google Sign-In / Link Option */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Google Account Sign-In
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {isGoogleLinked
                          ? "Connected to Google Auth"
                          : "Signed in with Email/Password — connect Google for 1-click login"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleConnectGoogle}
                      disabled={isLinkingGoogle}
                      className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 px-4 py-2 rounded-full text-xs font-bold shadow-sm transition-all cursor-pointer"
                    >
                      {isLinkingGoogle ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <svg
                          className="h-4 w-4 shrink-0"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                            fill="#4285F4"
                          />
                          <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                          />
                          <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                          />
                          <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                          />
                        </svg>
                      )}
                      <span>
                        {isGoogleLinked
                          ? "Switch / Re-verify Google"
                          : "Connect / Sign In with Google"}
                      </span>
                    </button>
                  </div>

                  {googleStatus && (
                    <p
                      className={`text-xs font-medium px-3 py-2 rounded-xl border ${
                        googleStatus.type === "success"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}
                    >
                      {googleStatus.text}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Data Export & Shared Computer Privacy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-sm flex flex-col justify-between space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-clinical-cyan" />
                  <h2 className="text-base font-extrabold text-slate-900">
                    Download Your Screening Data
                  </h2>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Export your {history.length} recorded screening{" "}
                  {history.length === 1 ? "session" : "sessions"} as a spreadsheet (CSV) or JSON file to share with your speech therapist or doctor.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={history.length === 0}
                  className="inline-flex items-center gap-2 bg-[#14171A] hover:bg-black disabled:opacity-40 text-white px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-vitality" />
                  <span>Export CSV ({history.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportJson}
                  disabled={history.length === 0}
                  className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer"
                >
                  <Database className="h-3.5 w-3.5 text-slate-600" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {/* Clear Explanation of Browser Cache & Shared Workstation Privacy */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-sm flex flex-col justify-between space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-base font-extrabold text-slate-900">
                    What Does &ldquo;Clear Local Browser Cache&rdquo; Do?
                  </h2>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Whenever you complete a voice screening, your browser saves a fast local copy in <code>localStorage</code> so your reports open immediately even if your internet drops. If you are on a <strong>shared computer</strong> (like a college lab or clinic PC), clicking the button below wipes those saved copies from this browser so the next person cannot see them.
                </p>
              </div>

              <div className="pt-2">
                {!confirmClearCache ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearCache(true)}
                    className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 px-4 py-2.5 rounded-full text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear Saved Copies from This Browser</span>
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClearLocalCache}
                      className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Confirm Wipe Browser Cache</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearCache(false)}
                      className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sonora Android App & Open-Source GitHub Card */}
          <div className="bg-gradient-to-r from-[#14171A] via-slate-900 to-[#14171A] text-white rounded-3xl p-6 sm:p-8 shadow-soft-md flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5 max-w-xl">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-vitality/20 text-vitality text-[10px] font-extrabold uppercase tracking-wider">
                Sonora Mobile &amp; Open Source
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-white">
                Download Sonora for Android (.apk) or Explore on GitHub
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Install the standalone Sonora Android application on your phone for pocket voice screening, live dB SPL biofeedback, pacing board drills, and GPS SLP center lookup.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <a
                href="/downloads/sonora-android.apk"
                download="Sonora-Android.apk"
                className="inline-flex items-center gap-2 bg-vitality hover:bg-vitality-hover text-[#14171A] font-extrabold px-5 py-3 rounded-full text-xs shadow-soft-sm transition-all hover:scale-105"
              >
                <Download className="h-4 w-4" />
                <span>Download Android APK</span>
              </a>
              <a
                href="https://github.com/LovishManchanda719/Sonora"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/15 font-bold px-5 py-3 rounded-full text-xs transition-all"
              >
                <span>GitHub Repo</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
