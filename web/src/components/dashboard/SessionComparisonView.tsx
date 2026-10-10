"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  GitCompare,
  ArrowLeftRight,
  TrendingDown,
  TrendingUp,
  Minus,
  AlertTriangle,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Layers,
  Info,
} from "lucide-react";
import { StoredScreening, getScreeningTimestampMs } from "@/lib/firestore";
import { SessionUtterance } from "@/lib/api-client";

interface SessionComparisonViewProps {
  history: StoredScreening[];
  externalPair?: { sessionAId?: string; sessionBId?: string } | null;
}

const SEVERITY_RANK: Record<string, number> = {
  normal: 0,
  healthy: 0,
  none: 0,
  mild: 1,
  moderate: 2,
  severe: 3,
};

function getSeverityRank(sev: string): number {
  const key = (sev || "normal").toLowerCase().trim();
  return SEVERITY_RANK[key] ?? 1;
}

function formatDateLabel(item: StoredScreening): string {
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
  return item.timestamp || "Recorded Session";
}

function formatShortDate(item: StoredScreening): string {
  const ms = getScreeningTimestampMs(item);
  if (ms > 0) {
    return new Date(ms).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return item.session_id.slice(0, 10);
}

function matchTaskUtterance(
  session: StoredScreening,
  slotIndex: number,
  keyword: string
): SessionUtterance | undefined {
  if (!session.utterances || session.utterances.length === 0) return undefined;
  const byKey = session.utterances.find((u) =>
    u.task_name.toLowerCase().includes(keyword)
  );
  if (byKey) return byKey;
  return session.utterances[slotIndex];
}

export function SessionComparisonView({
  history,
  externalPair,
}: SessionComparisonViewProps) {
  // Sort chronologically oldest -> newest so Session #1 is Baseline and #N is Latest
  const chronological = useMemo(() => {
    return [...history].sort(
      (a, b) => getScreeningTimestampMs(a) - getScreeningTimestampMs(b)
    );
  }, [history]);

  const [sessionAId, setSessionAId] = useState<string>("");
  const [sessionBId, setSessionBId] = useState<string>("");

  // Initialize default selection: Baseline (#1) vs. Latest (#N)
  useEffect(() => {
    if (chronological.length >= 2) {
      const firstId = chronological[0].session_id;
      const lastId = chronological[chronological.length - 1].session_id;
      setSessionAId((prev) =>
        chronological.some((s) => s.session_id === prev) ? prev : firstId
      );
      setSessionBId((prev) =>
        chronological.some((s) => s.session_id === prev) ? prev : lastId
      );
    } else if (chronological.length === 1) {
      setSessionAId(chronological[0].session_id);
      setSessionBId(chronological[0].session_id);
    }
  }, [chronological]);

  // Apply external selection when user clicks "Compare" on a history card
  useEffect(() => {
    if (!externalPair) return;
    if (
      externalPair.sessionAId &&
      chronological.some((s) => s.session_id === externalPair.sessionAId)
    ) {
      setSessionAId(externalPair.sessionAId);
    }
    if (
      externalPair.sessionBId &&
      chronological.some((s) => s.session_id === externalPair.sessionBId)
    ) {
      setSessionBId(externalPair.sessionBId);
    }
  }, [externalPair, chronological]);

  if (chronological.length < 2) {
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-10 w-10 rounded-2xl bg-slate-900 text-vitality flex items-center justify-center shrink-0">
            <GitCompare className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              Side-by-Side Session Comparison (Phase 12B.7)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed max-w-xl">
              {chronological.length === 1
                ? "1 baseline session is recorded. Complete a second screening session to unlock side-by-side before/after comparison of risk index, severity grade, and per-task speech biomarkers."
                : "Record at least 2 screening sessions to compare before/after speech metrics side-by-side."}
            </p>
          </div>
        </div>
        <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold shrink-0">
          {chronological.length} / 2 Sessions Required
        </span>
      </div>
    );
  }

  const indexA = chronological.findIndex((s) => s.session_id === sessionAId);
  const indexB = chronological.findIndex((s) => s.session_id === sessionBId);

  const sessionA = chronological[indexA >= 0 ? indexA : 0];
  const sessionB =
    chronological[indexB >= 0 ? indexB : chronological.length - 1];

  const numA = (indexA >= 0 ? indexA : 0) + 1;
  const numB = (indexB >= 0 ? indexB : chronological.length - 1) + 1;

  const probA = Math.round(sessionA.consensus_probability * 100);
  const probB = Math.round(sessionB.consensus_probability * 100);
  const deltaProb = probB - probA;

  const sevRankA = getSeverityRank(sessionA.consensus_severity);
  const sevRankB = getSeverityRank(sessionB.consensus_severity);
  const sevDiff = sevRankB - sevRankA;

  // Clinical interpretation for family/caregiver & clinician
  let statusTone: "improved" | "worsened" | "stable" = "stable";
  if (deltaProb <= -3 || sevDiff < 0) statusTone = "improved";
  else if (deltaProb >= 3 || sevDiff > 0) statusTone = "worsened";

  let caregiverGuidance =
    "Acoustic motor speech indicators remain stable between these two sessions. Continue routine home speech exercises and scheduled follow-ups.";
  if (statusTone === "improved") {
    caregiverGuidance =
      "Positive trajectory: overall dysarthria risk index decreased from Session A to Session B, indicating stronger vocal stability and clearer articulatory execution.";
  } else if (statusTone === "worsened") {
    caregiverGuidance =
      "Elevated risk signal: Session B shows a higher motor speech risk score or severity tier than Session A. Consider scheduling an in-person Speech-Language Pathologist (SLP) review and verifying recording conditions.";
  }

  const taskComparisons = [
    {
      key: "vowel",
      title: "Task 1: Sustained Vowel (/a/)",
      subtitle: "Phonation & Respiratory Stability",
      uttA: matchTaskUtterance(sessionA, 0, "vowel"),
      uttB: matchTaskUtterance(sessionB, 0, "vowel"),
    },
    {
      key: "ddk",
      title: "Task 2: DDK Syllables (/pa-ta-ka/)",
      subtitle: "Articulatory Speed & Motor Coordination",
      uttA: matchTaskUtterance(sessionA, 1, "ddk"),
      uttB: matchTaskUtterance(sessionB, 1, "ddk"),
    },
    {
      key: "sentence",
      title: "Task 3: Connected Speech Passage",
      subtitle: "Prosodic Continuity & Intelligibility",
      uttA: matchTaskUtterance(sessionA, 2, "sentence"),
      uttB: matchTaskUtterance(sessionB, 2, "sentence"),
    },
  ];

  const handleSelectBaselineVsLatest = () => {
    setSessionAId(chronological[0].session_id);
    setSessionBId(chronological[chronological.length - 1].session_id);
  };

  const handleSelectPreviousVsLatest = () => {
    if (chronological.length >= 2) {
      setSessionAId(chronological[chronological.length - 2].session_id);
      setSessionBId(chronological[chronological.length - 1].session_id);
    }
  };

  const handleSwapSessions = () => {
    setSessionAId(sessionB.session_id);
    setSessionBId(sessionA.session_id);
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-sm space-y-6">
      {/* Header & Quick Presets */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-[#14171A] text-vitality flex items-center justify-center">
              <GitCompare className="h-4 w-4" />
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Multi-Session Side-by-Side Comparison
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Select any two recorded screening sessions to compare risk shifts, severity progression, and per-task acoustic changes side-by-side.
          </p>
        </div>

        {/* Preset Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSelectBaselineVsLatest}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              sessionA.session_id === chronological[0].session_id &&
              sessionB.session_id ===
                chronological[chronological.length - 1].session_id
                ? "bg-[#14171A] text-white border-black"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            Baseline (#1) vs. Latest (#{chronological.length})
          </button>

          {chronological.length >= 3 && (
            <button
              type="button"
              onClick={handleSelectPreviousVsLatest}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                sessionA.session_id ===
                  chronological[chronological.length - 2].session_id &&
                sessionB.session_id ===
                  chronological[chronological.length - 1].session_id
                  ? "bg-[#14171A] text-white border-black"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              Previous (#{chronological.length - 1}) vs. Latest (#
              {chronological.length})
            </button>
          )}

          <button
            type="button"
            onClick={handleSwapSessions}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            title="Swap Session A and Session B"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Swap A / B</span>
          </button>
        </div>
      </div>

      {/* Session Pickers (Dropdown A & Dropdown B) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Session A Selector */}
        <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800">
              Session A · Reference / Earlier
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {sessionA.session_id}
            </span>
          </div>
          <select
            value={sessionA.session_id}
            onChange={(e) => setSessionAId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none cursor-pointer"
          >
            {chronological.map((s, idx) => (
              <option key={s.session_id} value={s.session_id}>
                Session #{idx + 1} — {formatShortDate(s)} ·{" "}
                {Math.round(s.consensus_probability * 100)}% Risk (
                {s.consensus_severity.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Session B Selector */}
        <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#14171A] text-vitality">
              Session B · Follow-Up / Target
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {sessionB.session_id}
            </span>
          </div>
          <select
            value={sessionB.session_id}
            onChange={(e) => setSessionBId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none cursor-pointer"
          >
            {chronological.map((s, idx) => (
              <option key={s.session_id} value={s.session_id}>
                Session #{idx + 1} — {formatShortDate(s)} ·{" "}
                {Math.round(s.consensus_probability * 100)}% Risk (
                {s.consensus_severity.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Executive Differential Summary Banner */}
      <div
        className={`rounded-2xl p-5 border ${
          statusTone === "improved"
            ? "bg-emerald-50/70 border-emerald-200"
            : statusTone === "worsened"
            ? "bg-amber-50/70 border-amber-200"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-slate-200/70">
          {/* Metric 1: Risk Index Shift */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Risk Index Shift (Session #{numA} → #{numB})
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-black font-mono text-slate-900">
                {probA}% → {probB}%
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold font-mono ${
                  deltaProb <= -3
                    ? "bg-emerald-600 text-white"
                    : deltaProb >= 3
                    ? "bg-amber-600 text-white"
                    : "bg-slate-200 text-slate-800"
                }`}
              >
                {deltaProb < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5" />
                ) : deltaProb > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <Minus className="h-3.5 w-3.5" />
                )}
                {deltaProb > 0 ? `+${deltaProb}%` : `${deltaProb}%`}
              </span>
            </div>
          </div>

          {/* Metric 2: Severity Grade Transition */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Severity Grade Transition
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-black uppercase text-slate-900">
                {sessionA.consensus_severity} → {sessionB.consensus_severity}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  sevDiff < 0
                    ? "bg-emerald-100 text-emerald-800"
                    : sevDiff > 0
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {sevDiff < 0
                  ? "Reduced Severity"
                  : sevDiff > 0
                  ? "Increased Severity"
                  : "Unchanged Grade"}
              </span>
            </div>
          </div>

          {/* Metric 3: Flagged Battery Vote Comparison */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Flagged Speech Tasks
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-black font-mono text-slate-900">
                {sessionA.dysarthria_vote_ratio} → {sessionB.dysarthria_vote_ratio}
              </span>
              <span className="text-xs text-slate-500">
                ({sessionB.confidence_rating} confidence)
              </span>
            </div>
          </div>
        </div>

        {/* Caregiver & Clinical Decision Note */}
        <div className="pt-3 flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
          <Info className="h-4 w-4 text-clinical-cyan shrink-0 mt-0.5" />
          <p>
            <strong className="text-slate-900">
              Caregiver &amp; Clinical Comparison Summary:
            </strong>{" "}
            {caregiverGuidance}
          </p>
        </div>
      </div>

      {/* Side-by-Side Session Cards (Two Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: `Session A (#${numA})`, data: sessionA, prob: probA, isRef: true },
          { label: `Session B (#${numB})`, data: sessionB, prob: probB, isRef: false },
        ].map((col) => (
          <div
            key={col.label}
            className={`rounded-2xl p-5 border space-y-4 ${
              col.isRef
                ? "bg-slate-50/60 border-slate-200/80"
                : "bg-white border-slate-300 shadow-soft-sm"
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
              <div>
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                    col.isRef
                      ? "bg-slate-200 text-slate-800"
                      : "bg-[#14171A] text-vitality"
                  }`}
                >
                  {col.label}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>{formatDateLabel(col.data)}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black font-mono text-slate-900">
                  {col.prob}%
                </span>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Risk Index
                </span>
              </div>
            </div>

            {/* Verdict & Severity Row */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                {col.data.is_dysarthric ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                )}
                <span>{col.data.consensus_diagnosis}</span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                  col.data.is_dysarthric
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {col.data.consensus_severity}
              </span>
            </div>

            {/* Risk Progress Bar */}
            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    col.prob >= 65
                      ? "bg-rose-500"
                      : col.prob >= 40
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(4, col.prob))}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Flagged Tasks: {col.data.dysarthria_vote_ratio}</span>
                <span>Confidence: {col.data.confidence_rating}</span>
              </div>
            </div>

            {/* Clinical Recommendation Excerpt */}
            <div className="p-3 rounded-xl bg-white border border-slate-200/70 text-xs text-slate-600 leading-relaxed">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Session Clinical Impression
              </span>
              {col.data.clinical_recommendation}
            </div>
          </div>
        ))}
      </div>

      {/* Per-Task Speech Battery Differential Matrix */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Layers className="h-4 w-4 text-clinical-cyan" />
            <span>Per-Task Speech Battery Differential (Session A vs. Session B)</span>
          </h3>
          <span className="text-[11px] text-slate-400">
            Lower % indicates healthier speech motor control
          </span>
        </div>

        <div className="space-y-2.5">
          {taskComparisons.map((task) => {
            const pA = task.uttA
              ? Math.round(task.uttA.dysarthria_probability * 100)
              : null;
            const pB = task.uttB
              ? Math.round(task.uttB.dysarthria_probability * 100)
              : null;
            const dTask = pA !== null && pB !== null ? pB - pA : null;

            return (
              <div
                key={task.key}
                className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 grid grid-cols-1 lg:grid-cols-12 items-center gap-4"
              >
                {/* Task Title */}
                <div className="lg:col-span-4">
                  <h4 className="text-xs font-extrabold text-slate-900">
                    {task.title}
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    {task.subtitle}
                  </span>
                </div>

                {/* Visual Dual-Bar Comparison */}
                <div className="lg:col-span-5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-[10px] font-bold text-slate-500 font-mono">
                      A (#{numA}):
                    </span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-500 rounded-full"
                        style={{ width: `${pA ?? 0}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-bold font-mono text-slate-700">
                      {pA !== null ? `${pA}%` : "—"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-16 text-[10px] font-bold text-slate-900 font-mono">
                      B (#{numB}):
                    </span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          dTask !== null && dTask <= -3
                            ? "bg-emerald-500"
                            : dTask !== null && dTask >= 3
                            ? "bg-amber-500"
                            : "bg-slate-900"
                        }`}
                        style={{ width: `${pB ?? 0}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-extrabold font-mono text-slate-900">
                      {pB !== null ? `${pB}%` : "—"}
                    </span>
                  </div>
                </div>

                {/* Task Delta Badge */}
                <div className="lg:col-span-3 flex items-center justify-between lg:justify-end gap-2">
                  {dTask !== null ? (
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                        dTask <= -3
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : dTask >= 3
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-white text-slate-600 border-slate-200"
                      }`}
                    >
                      {dTask <= -3 ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>{dTask}% Improved</span>
                        </>
                      ) : dTask >= 3 ? (
                        <>
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          <span>+{dTask}% Elevated</span>
                        </>
                      ) : (
                        <span>{dTask === 0 ? "0% Unchanged" : `${dTask > 0 ? "+" : ""}${dTask}% Stable`}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">N/A</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
