"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Users,
  Activity,
  MapPin,
  Monitor,
  Smartphone,
  FileDown,
  Inbox,
  RefreshCw,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Eye,
  BarChart3,
  Globe,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  Database,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  ADMIN_EMAIL,
  StoredScreening,
  ContactInquiryRecord,
  getScreeningTimestampMs,
} from "@/lib/firestore";
import {
  TrackedUserRecord,
  AnalyticsEventRecord,
} from "@/app/api/analytics/route";
import { generateClinicalPdfReport } from "@/lib/report-pdf";

type AdminTab = "overview" | "users" | "screenings" | "events" | "inquiries";

const INQUIRY_LABELS: Record<string, string> = {
  clinical_trial: "Clinical Screening & Validation",
  research_access: "Academic Dataset & Model Collaboration",
  speech_pathology: "Speech-Language Pathology Support",
  bug_technical: "Technical Issue / Bug Report",
  other: "General Developer Inquiry",
};

export default function AdminDashboardPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<TrackedUserRecord[]>([]);
  const [events, setEvents] = useState<AnalyticsEventRecord[]>([]);
  const [screenings, setScreenings] = useState<StoredScreening[]>([]);
  const [contacts, setContacts] = useState<ContactInquiryRecord[]>([]);

  const [userSearch, setUserSearch] = useState("");
  const [screeningSearch, setScreeningSearch] = useState("");
  const [inquiryFilter, setInquiryFilter] = useState("all");

  const loadAnalytics = useCallback(async () => {
    if (!isAdmin || !user?.email) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analytics?adminEmail=${encodeURIComponent(user.email)}`
      );
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setEvents(data.events || []);
        setScreenings(data.screenings || []);
        setContacts(data.contacts || []);
      }
    } catch (err) {
      console.warn("Failed to load admin analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.email]);

  useEffect(() => {
    if (!authLoading) {
      loadAnalytics();
    }
  }, [authLoading, loadAnalytics]);

  // Computed Platform Analytics
  const stats = useMemo(() => {
    const registeredUsers = users.filter((u) => u.role !== "guest").length;
    const guestUsers = users.filter((u) => u.role === "guest").length;

    const totalScreenings = screenings.length;
    const dysarthricCount = screenings.filter((s) => s.is_dysarthric).length;
    const healthyCount = totalScreenings - dysarthricCount;
    const dysarthricRate =
      totalScreenings > 0
        ? Math.round((dysarthricCount / totalScreenings) * 100)
        : 0;

    // Severity counts
    const severityCounts = {
      normal: 0,
      mild: 0,
      moderate: 0,
      severe: 0,
    };
    screenings.forEach((s) => {
      const sev = (s.consensus_severity || "normal").toLowerCase();
      if (!s.is_dysarthric || sev === "normal") severityCounts.normal += 1;
      else if (sev === "mild") severityCounts.mild += 1;
      else if (sev === "moderate") severityCounts.moderate += 1;
      else severityCounts.severe += 1;
    });

    // Unique cities
    const cityCounts: Record<string, number> = {};
    users.forEach((u) => {
      const loc = `${u.city || "India"}, ${u.country || "India"}`;
      cityCounts[loc] = (cityCounts[loc] || 0) + 1;
    });
    const topLocations = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);

    // Page views breakdown
    const pageCounts: Record<string, number> = {};
    let pdfDownloads = 0;
    let slpSearches = 0;
    events.forEach((e) => {
      if (e.type === "page_view") {
        pageCounts[e.path || "/"] = (pageCounts[e.path || "/"] || 0) + 1;
      } else if (e.type === "pdf_downloaded") {
        pdfDownloads += 1;
      } else if (e.type === "slp_locator_used") {
        slpSearches += 1;
      }
    });
    const topPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]);

    // Device & Browser breakdown
    const deviceCounts: Record<string, number> = {
      Desktop: 0,
      Mobile: 0,
      Tablet: 0,
    };
    const browserCounts: Record<string, number> = {};
    const osCounts: Record<string, number> = {};
    users.forEach((u) => {
      deviceCounts[u.deviceType || "Desktop"] =
        (deviceCounts[u.deviceType || "Desktop"] || 0) + 1;
      browserCounts[u.browser || "Chrome"] =
        (browserCounts[u.browser || "Chrome"] || 0) + 1;
      osCounts[u.os || "Windows"] = (osCounts[u.os || "Windows"] || 0) + 1;
    });

    return {
      totalUsers: users.length,
      registeredUsers,
      guestUsers,
      totalScreenings,
      dysarthricCount,
      healthyCount,
      dysarthricRate,
      severityCounts,
      topLocations,
      topPages,
      totalEvents: events.length,
      pdfDownloads,
      slpSearches,
      deviceCounts,
      browserCounts,
      osCounts,
    };
  }, [users, screenings, events]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.city.toLowerCase().includes(q) ||
        (u.condition || "").toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const filteredScreenings = useMemo(() => {
    const sorted = [...screenings].sort(
      (a, b) => getScreeningTimestampMs(b) - getScreeningTimestampMs(a)
    );
    if (!screeningSearch.trim()) return sorted;
    const q = screeningSearch.toLowerCase();
    return sorted.filter(
      (s) =>
        s.session_id.toLowerCase().includes(q) ||
        (s.userEmail || "").toLowerCase().includes(q) ||
        s.consensus_diagnosis.toLowerCase().includes(q) ||
        s.consensus_severity.toLowerCase().includes(q)
    );
  }, [screenings, screeningSearch]);

  const filteredInquiries = useMemo(() => {
    if (inquiryFilter === "all") return contacts;
    return contacts.filter((c) => c.inquiryType === inquiryFilter);
  }, [contacts, inquiryFilter]);

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center space-y-3">
        <Loader2 className="h-7 w-7 animate-spin text-clinical-cyan mx-auto" />
        <p className="text-xs text-slate-500">
          Verifying administrator credentials...
        </p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="max-w-xl mx-auto py-20">
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-soft-md text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            Administrator Access Required
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            This analytics and user telemetry command center is restricted to
            the project administrator (
            <span className="font-mono font-bold text-slate-800">
              {ADMIN_EMAIL}
            </span>
            ).
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 bg-[#14171A] hover:bg-black text-white px-5 py-2.5 rounded-full text-xs font-bold transition-all"
            >
              <span>Sign In as Admin</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-full text-xs font-bold transition-all"
            >
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 pt-2">
      {/* 1. ADMIN COMMAND CENTER HEADER */}
      <div className="bg-[#14171A] text-white rounded-3xl p-6 sm:p-8 shadow-soft-lg border border-white/10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vitality/20 border border-vitality/40 text-vitality text-[11px] font-extrabold uppercase tracking-wider">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>First-Party Admin Analytics Engine • Zero External Setup Needed</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              DysarthriaNet-XC Admin Command Center
            </h1>
            <p className="text-xs text-slate-400">
              Signed in as Administrator:{" "}
              <span className="text-white font-mono font-semibold">
                {user.email}
              </span>{" "}
              • Built-in server telemetry (works automatically without Google Analytics or Firebase Analytics setup)
            </p>
          </div>

          <button
            type="button"
            onClick={loadAnalytics}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-vitality hover:bg-vitality-hover text-[#14171A] px-5 py-2.5 rounded-full text-xs font-extrabold transition-all cursor-pointer self-start md:self-center"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span>Refresh Live Telemetry</span>
          </button>
        </div>

        {/* 6 Top-Level Admin KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase">
              <span>Tracked Users</span>
              <Users className="h-3.5 w-3.5 text-clinical-cyan" />
            </div>
            <div className="text-2xl font-black font-mono mt-1.5">
              {stats.totalUsers}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {stats.registeredUsers} signed-in · {stats.guestUsers} guests
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase">
              <span>Voice Screenings</span>
              <Activity className="h-3.5 w-3.5 text-vitality" />
            </div>
            <div className="text-2xl font-black font-mono mt-1.5">
              {stats.totalScreenings}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {stats.dysarthricCount} flagged · {stats.healthyCount} normal
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase">
              <span>Locations</span>
              <MapPin className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-black font-mono mt-1.5">
              {stats.topLocations.length}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 truncate">
              Top: {stats.topLocations[0]?.[0] || "India"}
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase">
              <span>Tracked Events</span>
              <Eye className="h-3.5 w-3.5 text-sky-400" />
            </div>
            <div className="text-2xl font-black font-mono mt-1.5">
              {stats.totalEvents}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Page views &amp; tool usage
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase">
              <span>PDF Exports</span>
              <FileDown className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-black font-mono mt-1.5">
              {stats.pdfDownloads}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Clinical reports downloaded
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase">
              <span>Contact Inbox</span>
              <Inbox className="h-3.5 w-3.5 text-purple-400" />
            </div>
            <div className="text-2xl font-black font-mono mt-1.5">
              {contacts.length}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              User inquiries received
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white/5 p-1.5 rounded-2xl border border-white/10">
          {[
            { id: "overview", label: "Overview & Funnel", icon: BarChart3 },
            {
              id: "users",
              label: `Users & Locations (${users.length})`,
              icon: Users,
            },
            {
              id: "screenings",
              label: `All Screenings (${screenings.length})`,
              icon: Activity,
            },
            {
              id: "events",
              label: `Live Telemetry Feed (${events.length})`,
              icon: Globe,
            },
            {
              id: "inquiries",
              label: `Contact Inquiries (${contacts.length})`,
              icon: Inbox,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? "bg-vitality text-[#14171A] shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. TAB CONTENTS */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Visited Pages */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-clinical-cyan" />
                <span>Most Visited Pages</span>
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                Page Views
              </span>
            </div>

            {stats.topPages.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Page views will populate automatically as users browse.
              </p>
            ) : (
              <div className="space-y-3">
                {stats.topPages.slice(0, 8).map(([path, count]) => {
                  const maxCount = stats.topPages[0][1] || 1;
                  const pct = Math.max(8, Math.round((count / maxCount) * 100));
                  return (
                    <div key={path} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-slate-800">
                          {path}
                        </span>
                        <span className="font-mono font-semibold text-slate-500">
                          {count} views
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-clinical-cyan"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Geographic Locations & SLP Demand */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <span>User Locations &amp; Regions</span>
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                Users
              </span>
            </div>

            {stats.topLocations.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No user locations recorded yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {stats.topLocations.map(([loc, count]) => (
                  <div
                    key={loc}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs"
                  >
                    <span className="font-bold text-slate-800 flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-emerald-600" />
                      {loc}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 font-mono font-bold text-slate-700">
                      {count} {count === 1 ? "user" : "users"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
              <strong>How Location Tracking Works:</strong> Automatically
              detects city/region from browser timezone, Vercel edge IP headers,
              and GPS coordinates when a user searches on the{" "}
              <strong>Find an SLP</strong> page.
            </div>
          </div>

          {/* Devices, Browsers & Clinical Severity Split */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-sm space-y-5">
            <div className="space-y-3">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Monitor className="h-4 w-4 text-indigo-500" />
                <span>Device, Browser &amp; OS Telemetry</span>
              </h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <Monitor className="h-4 w-4 text-slate-600 mx-auto mb-1" />
                  <div className="text-base font-black text-slate-900 font-mono">
                    {stats.deviceCounts.Desktop || 0}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold">
                    Desktop
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <Smartphone className="h-4 w-4 text-slate-600 mx-auto mb-1" />
                  <div className="text-base font-black text-slate-900 font-mono">
                    {stats.deviceCounts.Mobile || 0}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold">
                    Mobile
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <Database className="h-4 w-4 text-slate-600 mx-auto mb-1" />
                  <div className="text-base font-black text-slate-900 font-mono">
                    {Object.keys(stats.browserCounts).length}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold">
                    Browsers
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(stats.browserCounts).map(([b, c]) => (
                  <span
                    key={b}
                    className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold"
                  >
                    {b}: {c}
                  </span>
                ))}
                {Object.entries(stats.osCounts).map(([os, c]) => (
                  <span
                    key={os}
                    className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold"
                  >
                    {os}: {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2.5">
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Clinical Screening Severity Breakdown
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <span className="font-bold text-emerald-900">Normal</span>
                  <span className="font-mono font-black text-emerald-700">
                    {stats.severityCounts.normal}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                  <span className="font-bold text-amber-900">Mild</span>
                  <span className="font-mono font-black text-amber-700">
                    {stats.severityCounts.mild}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-between">
                  <span className="font-bold text-orange-900">Moderate</span>
                  <span className="font-mono font-black text-orange-700">
                    {stats.severityCounts.moderate}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                  <span className="font-bold text-rose-900">Severe</span>
                  <span className="font-mono font-black text-rose-700">
                    {stats.severityCounts.severe}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USERS & LOCATIONS */}
      {activeTab === "users" && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Tracked Users, Profiles &amp; Geographic Locations ({filteredUsers.length})
              </h2>
              <p className="text-xs text-slate-500">
                Inspect every registered user and guest visitor, their city/country, device, login method, and clinical profile.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search name, email, city, condition..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-400">
                  <th className="py-3 pr-4">User / Email</th>
                  <th className="py-3 px-3">Role &amp; Auth</th>
                  <th className="py-3 px-3">Location &amp; Timezone</th>
                  <th className="py-3 px-3">Device / OS</th>
                  <th className="py-3 px-3">Clinical Info</th>
                  <th className="py-3 px-3 text-center">Screenings</th>
                  <th className="py-3 pl-3 text-right">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredUsers.map((u) => (
                  <tr key={u.userId} className="hover:bg-slate-50/80">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        {u.photoURL ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={u.photoURL}
                            alt={u.name}
                            className="h-8 w-8 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-[#14171A] text-vitality font-bold flex items-center justify-center text-xs shrink-0">
                            {u.name?.[0]?.toUpperCase() || "U"}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900">
                            {u.name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          u.role === "admin"
                            ? "bg-vitality text-[#14171A]"
                            : u.role === "user"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {u.role}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        via {u.authProvider}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span>
                          {u.city}, {u.country}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {u.timezone}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-medium text-slate-800">
                        {u.deviceType} • {u.browser}
                      </div>
                      <div className="text-[10px] text-slate-400">{u.os}</div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="text-slate-700 font-medium max-w-[180px] truncate">
                        {u.condition || "General Screening"}
                      </div>
                      {(u.age || u.sex) && (
                        <div className="text-[10px] text-slate-400">
                          {u.age ? `${u.age} yrs` : ""} {u.sex || ""}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-900">
                      {u.screeningsCount || 0}
                    </td>
                    <td className="py-3.5 pl-3 text-right text-[11px] text-slate-500 font-mono">
                      {new Date(u.lastActive).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ALL SCREENINGS LOG */}
      {activeTab === "screenings" && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                All Platform Voice Screenings ({filteredScreenings.length})
              </h2>
              <p className="text-xs text-slate-500">
                Complete audit log of every dysarthria screening session across all users.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={screeningSearch}
                onChange={(e) => setScreeningSearch(e.target.value)}
                placeholder="Search session ID, email, diagnosis..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredScreenings.map((s) => {
              const probPct = Math.round(s.consensus_probability * 100);
              return (
                <div
                  key={s.session_id}
                  className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        #{s.session_id}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        ({s.userEmail || s.userId || "guest"})
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          s.is_dysarthric
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {s.consensus_severity}
                      </span>
                    </div>
                    <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      {s.is_dysarthric ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                      <span>{s.consensus_diagnosis}</span>
                      <span className="text-slate-400 font-normal">
                        • {s.dysarthria_vote_ratio} tasks flagged •{" "}
                        {s.timestamp}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-base font-black font-mono text-slate-900">
                        {probPct}%
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Probability
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        generateClinicalPdfReport(s, {
                          patientName: s.userEmail || "Evaluated Participant",
                        })
                      }
                      className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      PDF
                    </button>
                    <Link
                      href={`/results/${s.session_id}`}
                      className="px-3.5 py-1.5 rounded-full bg-[#14171A] text-white text-xs font-bold hover:bg-black"
                    >
                      Inspect
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: LIVE TELEMETRY FEED */}
      {activeTab === "events" && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-sm space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              Real-Time User Activity &amp; Telemetry Stream ({events.length})
            </h2>
            <p className="text-xs text-slate-500">
              Live log of page views, voice screenings, PDF downloads, and SLP location searches.
            </p>
          </div>

          <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#14171A] text-vitality font-mono text-[10px] font-bold uppercase">
                    {ev.type.replace(/_/g, " ")}
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {ev.path}
                  </span>
                  <span className="text-slate-500">
                    by{" "}
                    <strong className="text-slate-700">
                      {ev.userEmail !== "anonymous"
                        ? ev.userEmail
                        : ev.userId}
                    </strong>
                  </span>
                  <span className="text-slate-400">
                    • {ev.city}, {ev.country} • {ev.deviceType} ({ev.browser} /{" "}
                    {ev.os})
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono shrink-0">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: CONTACT INQUIRIES INBOX */}
      {activeTab === "inquiries" && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Developer Contact Inquiries ({filteredInquiries.length})
              </h2>
              <p className="text-xs text-slate-500">
                Messages submitted by users on the Contact Us page, categorized by use case.
              </p>
            </div>
            <select
              value={inquiryFilter}
              onChange={(e) => setInquiryFilter(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800"
            >
              <option value="all">All Use Cases ({contacts.length})</option>
              {Object.entries(INQUIRY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {filteredInquiries.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No contact inquiries in this category yet.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInquiries.map((inq) => (
                <div
                  key={inq.id}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">
                        {inq.name}
                      </span>
                      <a
                        href={`mailto:${inq.email}`}
                        className="text-xs font-mono text-clinical-cyan hover:underline"
                      >
                        &lt;{inq.email}&gt;
                      </a>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#14171A] text-vitality text-[10px] font-bold">
                        {INQUIRY_LABELS[inq.inquiryType] || inq.inquiryType}
                      </span>
                      {inq.affiliation && (
                        <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 text-[10px] font-semibold">
                          {inq.affiliation}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(inq.createdAt).toLocaleString()}</span>
                      <a
                        href={`mailto:${inq.email}?subject=${encodeURIComponent(
                          `Re: DysarthriaNet Inquiry (${
                            INQUIRY_LABELS[inq.inquiryType] || inq.inquiryType
                          })`
                        )}`}
                        className="ml-2 px-3 py-1 rounded-full bg-[#14171A] text-white text-[11px] font-bold hover:bg-black inline-flex items-center gap-1"
                      >
                        <Mail className="h-3 w-3 text-vitality" />
                        <span>Reply</span>
                      </a>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 bg-white p-3.5 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-wrap">
                    {inq.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
