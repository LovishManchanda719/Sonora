"use client";

import React, { useState, useMemo } from "react";
import {
  TrendingDown,
  TrendingUp,
  Minus,
  Activity,
  Layers,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { StoredScreening, getScreeningTimestampMs } from "@/lib/firestore";

interface ProgressTrendChartProps {
  history: StoredScreening[];
}

type ChartMode = "consensus" | "tasks" | "severity";

const SEVERITY_LEVEL_MAP: Record<string, number> = {
  normal: 0,
  mild: 1,
  moderate: 2,
  severe: 3,
};

const SEVERITY_LABELS = ["Normal", "Mild", "Moderate", "Severe"];

function formatShortDate(item: StoredScreening, index: number): string {
  const ms = getScreeningTimestampMs(item);
  if (ms > 0) {
    const d = new Date(ms);
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return `S${index + 1}`;
}

function formatFullTimestamp(item: StoredScreening): string {
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

function getTaskProbPct(item: StoredScreening, taskKeyword: string): number | null {
  if (!item.utterances || item.utterances.length === 0) return null;
  const match = item.utterances.find((u) =>
    u.task_name.toLowerCase().includes(taskKeyword)
  );
  if (match) return Math.round(match.dysarthria_probability * 100);
  return null;
}

export function ProgressTrendChart({ history }: ProgressTrendChartProps) {
  const [chartMode, setChartMode] = useState<ChartMode>("consensus");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Order oldest -> newest (left -> right) for longitudinal plotting
  const chronological = useMemo(() => {
    const copy = [...history];
    copy.sort((a, b) => getScreeningTimestampMs(a) - getScreeningTimestampMs(b));
    return copy;
  }, [history]);

  const activePointIdx =
    selectedIdx !== null && selectedIdx < chronological.length
      ? selectedIdx
      : chronological.length - 1;
  const activeSession = chronological[activePointIdx];

  // Summary KPIs
  const totalSessions = chronological.length;
  const firstSession = chronological[0];
  const latestSession = chronological[chronological.length - 1];

  const firstPct = firstSession ? Math.round(firstSession.consensus_probability * 100) : 0;
  const latestPct = latestSession ? Math.round(latestSession.consensus_probability * 100) : 0;
  const deltaPct = totalSessions >= 2 ? latestPct - firstPct : 0;

  const avgPct = useMemo(() => {
    if (totalSessions === 0) return 0;
    const sum = chronological.reduce(
      (acc, item) => acc + item.consensus_probability * 100,
      0
    );
    return Math.round(sum / totalSessions);
  }, [chronological, totalSessions]);

  if (totalSessions === 0) return null;

  // SVG coordinate space
  const svgWidth = 760;
  const svgHeight = 250;
  const padLeft = 52;
  const padRight = 28;
  const padTop = 24;
  const padBottom = 38;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const getX = (idx: number) => {
    if (totalSessions === 1) return padLeft + plotW / 2;
    return padLeft + (idx / (totalSessions - 1)) * plotW;
  };

  const getYFromPct = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, pct));
    return padTop + plotH - (clamped / 100) * plotH;
  };

  const getYFromSeverity = (sev: string) => {
    const lvl = SEVERITY_LEVEL_MAP[sev.toLowerCase()] ?? 0;
    return padTop + plotH - (lvl / 3) * plotH;
  };

  // Build path strings
  const consensusPoints = chronological.map((item, idx) => {
    const pct = Math.round(item.consensus_probability * 100);
    return {
      x: getX(idx),
      y: getYFromPct(pct),
      pct,
      sev: item.consensus_severity,
      item,
      idx,
    };
  });

  const severityPoints = chronological.map((item, idx) => {
    const sev = item.consensus_severity || "normal";
    const lvl = SEVERITY_LEVEL_MAP[sev.toLowerCase()] ?? 0;
    return {
      x: getX(idx),
      y: getYFromSeverity(sev),
      lvl,
      sev,
      item,
      idx,
    };
  });

  const buildPolyline = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const buildAreaPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return "";
    if (pts.length === 1) {
      const p = pts[0];
      return `M ${padLeft} ${padTop + plotH} L ${padLeft} ${p.y} L ${padLeft + plotW} ${p.y} L ${padLeft + plotW} ${padTop + plotH} Z`;
    }
    const linePart = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const firstX = pts[0].x.toFixed(1);
    const lastX = pts[pts.length - 1].x.toFixed(1);
    const bottomY = (padTop + plotH).toFixed(1);
    return `${linePart} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  // Task trajectories (Sustained Vowel, DDK, Sentence)
  const vowelPts = chronological
    .map((item, idx) => {
      const val = getTaskProbPct(item, "vowel") ?? Math.round((item.utterances?.[0]?.dysarthria_probability ?? item.consensus_probability) * 100);
      return { x: getX(idx), y: getYFromPct(val), val, idx };
    });
  const ddkPts = chronological
    .map((item, idx) => {
      const val = getTaskProbPct(item, "ddk") ?? Math.round((item.utterances?.[1]?.dysarthria_probability ?? item.consensus_probability) * 100);
      return { x: getX(idx), y: getYFromPct(val), val, idx };
    });
  const sentencePts = chronological
    .map((item, idx) => {
      const val = getTaskProbPct(item, "sentence") ?? Math.round((item.utterances?.[2]?.dysarthria_probability ?? item.consensus_probability) * 100);
      return { x: getX(idx), y: getYFromPct(val), val, idx };
    });

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-md space-y-6">
      
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-clinical-cyan"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-clinical-cyan">
              Phase 12B.1 · Longitudinal Biomarker Trajectory
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
            Motor Speech Progression Over Time
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
            Visualizes dysarthria risk index, clinical severity grading, and per-task vocal stability across sequential screening sessions.
          </p>
        </div>

        {/* Chart Mode Toggle Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-2xl text-xs font-bold self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setChartMode("consensus")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
              chartMode === "consensus"
                ? "bg-[#14171A] text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Activity className={`h-3.5 w-3.5 ${chartMode === "consensus" ? "text-vitality" : "text-slate-400"}`} />
            <span>Consensus Risk (%)</span>
          </button>

          <button
            type="button"
            onClick={() => setChartMode("tasks")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
              chartMode === "tasks"
                ? "bg-[#14171A] text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className={`h-3.5 w-3.5 ${chartMode === "tasks" ? "text-vitality" : "text-slate-400"}`} />
            <span>By Speech Task</span>
          </button>

          <button
            type="button"
            onClick={() => setChartMode("severity")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
              chartMode === "severity"
                ? "bg-[#14171A] text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BarChart3 className={`h-3.5 w-3.5 ${chartMode === "severity" ? "text-vitality" : "text-slate-400"}`} />
            <span>Severity Grade</span>
          </button>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Recorded Sessions
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
            {totalSessions}
          </div>
          <span className="text-[11px] text-slate-500">
            {totalSessions === 1 ? "Initial baseline" : "Longitudinal points"}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Latest Risk Index
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
            {latestPct}%
          </div>
          <span className="text-[11px] font-semibold uppercase text-clinical-cyan">
            {latestSession?.consensus_severity || "Normal"} Grade
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Mean Cohort Risk
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
            {avgPct}%
          </div>
          <span className="text-[11px] text-slate-500">
            Across {totalSessions} {totalSessions === 1 ? "session" : "sessions"}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Net Trajectory (Δ)
          </span>
          {totalSessions < 2 ? (
            <>
              <div className="text-lg font-extrabold text-slate-700 mt-1.5 flex items-center gap-1">
                <Minus className="h-4 w-4 text-slate-400" />
                <span>Baseline Set</span>
              </div>
              <span className="text-[11px] text-slate-500">
                Complete 2nd screen for Δ
              </span>
            </>
          ) : (
            <>
              <div
                className={`text-2xl font-black mt-1 font-mono flex items-center gap-1 ${
                  deltaPct < 0
                    ? "text-emerald-600"
                    : deltaPct > 0
                    ? "text-amber-600"
                    : "text-slate-700"
                }`}
              >
                {deltaPct < 0 ? (
                  <TrendingDown className="h-5 w-5 text-emerald-600 shrink-0" />
                ) : deltaPct > 0 ? (
                  <TrendingUp className="h-5 w-5 text-amber-600 shrink-0" />
                ) : (
                  <Minus className="h-5 w-5 text-slate-400 shrink-0" />
                )}
                <span>{deltaPct > 0 ? `+${deltaPct}%` : `${deltaPct}%`}</span>
              </div>
              <span className="text-[11px] text-slate-500">
                {deltaPct < 0
                  ? "Reduced acoustic risk"
                  : deltaPct > 0
                  ? "Increased acoustic risk"
                  : "Stable acoustic profile"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main SVG Trend Canvas */}
      <div className="bg-[#14171A] rounded-3xl p-4 sm:p-6 text-white shadow-soft-lg space-y-4">
        
        {/* Legend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 px-1">
          <span className="font-mono uppercase tracking-wider text-slate-300">
            {chartMode === "consensus"
              ? "Consensus Dysarthria Probability (0% – 100%)"
              : chartMode === "tasks"
              ? "Sub-Task Probability Trajectories (Vowel / DDK / Sentence)"
              : "Clinical Severity Progression (Normal → Severe)"}
          </span>

          {chartMode === "consensus" && (
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-vitality"></span>
                <span className="text-slate-300">Session Risk %</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-rose-400/80 inline-block"></span>
                <span>50% Screening Threshold</span>
              </span>
            </div>
          )}

          {chartMode === "tasks" && (
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#D2F800]"></span>
                <span className="text-slate-200">Task 1: Vowel /a/</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#38BDF8]"></span>
                <span className="text-slate-200">Task 2: DDK /pa-ta-ka/</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#34D399]"></span>
                <span className="text-slate-200">Task 3: Connected Speech</span>
              </span>
            </div>
          )}

          {chartMode === "severity" && (
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="text-emerald-400">0: Normal</span>
              <span className="text-amber-300">1: Mild</span>
              <span className="text-orange-400">2: Moderate</span>
              <span className="text-rose-400">3: Severe</span>
            </div>
          )}
        </div>

        {/* Responsive SVG Plot */}
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-56 sm:h-64 select-none"
          >
            <defs>
              <linearGradient id="consensusAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D2F800" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#0284C7" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="severityAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.30" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines & Y-Axis Labels */}
            {chartMode !== "severity" ? (
              <>
                {[0, 25, 50, 75, 100].map((tick) => {
                  const y = getYFromPct(tick);
                  const isThreshold = tick === 50;
                  return (
                    <g key={tick}>
                      <line
                        x1={padLeft}
                        y1={y}
                        x2={svgWidth - padRight}
                        y2={y}
                        stroke={isThreshold ? "rgba(244, 63, 94, 0.55)" : "rgba(255, 255, 255, 0.08)"}
                        strokeWidth={isThreshold ? 1.5 : 1}
                        strokeDasharray={isThreshold ? "5 5" : undefined}
                      />
                      <text
                        x={padLeft - 10}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-slate-400 text-[10px] font-mono"
                      >
                        {tick}%
                      </text>
                    </g>
                  );
                })}
              </>
            ) : (
              <>
                {[0, 1, 2, 3].map((lvl) => {
                  const y = padTop + plotH - (lvl / 3) * plotH;
                  return (
                    <g key={lvl}>
                      <line
                        x1={padLeft}
                        y1={y}
                        x2={svgWidth - padRight}
                        y2={y}
                        stroke="rgba(255, 255, 255, 0.09)"
                        strokeWidth={1}
                      />
                      <text
                        x={padLeft - 8}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-slate-400 text-[10px] font-mono"
                      >
                        {SEVERITY_LABELS[lvl]}
                      </text>
                    </g>
                  );
                })}
              </>
            )}

            {/* X-Axis Session Labels */}
            {chronological.map((item, idx) => {
              const x = getX(idx);
              const isSelected = idx === activePointIdx;
              return (
                <g
                  key={item.session_id}
                  className="cursor-pointer"
                  onClick={() => setSelectedIdx(idx)}
                >
                  <line
                    x1={x}
                    y1={padTop}
                    x2={x}
                    y2={padTop + plotH}
                    stroke={isSelected ? "rgba(210, 248, 0, 0.28)" : "rgba(255, 255, 255, 0.04)"}
                    strokeWidth={isSelected ? 1.5 : 1}
                  />
                  <text
                    x={x}
                    y={svgHeight - 12}
                    textAnchor="middle"
                    className={`text-[10px] font-mono ${
                      isSelected ? "fill-vitality font-bold" : "fill-slate-400"
                    }`}
                  >
                    {formatShortDate(item, idx)} #{idx + 1}
                  </text>
                </g>
              );
            })}

            {/* MODE 1: CONSENSUS PROBABILITY */}
            {chartMode === "consensus" && (
              <>
                <path
                  d={buildAreaPath(consensusPoints)}
                  fill="url(#consensusAreaGrad)"
                />
                {consensusPoints.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#D2F800"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={buildPolyline(consensusPoints)}
                  />
                )}
                {consensusPoints.map((pt) => {
                  const isSelected = pt.idx === activePointIdx;
                  return (
                    <g
                      key={pt.item.session_id}
                      className="cursor-pointer"
                      onClick={() => setSelectedIdx(pt.idx)}
                    >
                      {isSelected && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={11}
                          fill="rgba(210, 248, 0, 0.22)"
                        />
                      )}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 6.5 : 5}
                        fill={pt.pct >= 50 ? "#D2F800" : "#10B981"}
                        stroke="#14171A"
                        strokeWidth={2}
                      />
                      <text
                        x={pt.x}
                        y={pt.y - 12}
                        textAnchor="middle"
                        className="fill-white text-[10px] font-mono font-bold"
                      >
                        {pt.pct}%
                      </text>
                    </g>
                  );
                })}
              </>
            )}

            {/* MODE 2: PER-TASK TRAJECTORIES */}
            {chartMode === "tasks" && (
              <>
                {vowelPts.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#D2F800"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    points={buildPolyline(vowelPts)}
                  />
                )}
                {ddkPts.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    points={buildPolyline(ddkPts)}
                  />
                )}
                {sentencePts.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#34D399"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    points={buildPolyline(sentencePts)}
                  />
                )}

                {vowelPts.map((p) => (
                  <circle
                    key={`v-${p.idx}`}
                    cx={p.x}
                    cy={p.y}
                    r={4.5}
                    fill="#D2F800"
                    stroke="#14171A"
                    strokeWidth={1.5}
                    className="cursor-pointer"
                    onClick={() => setSelectedIdx(p.idx)}
                  />
                ))}
                {ddkPts.map((p) => (
                  <circle
                    key={`d-${p.idx}`}
                    cx={p.x}
                    cy={p.y}
                    r={4.5}
                    fill="#38BDF8"
                    stroke="#14171A"
                    strokeWidth={1.5}
                    className="cursor-pointer"
                    onClick={() => setSelectedIdx(p.idx)}
                  />
                ))}
                {sentencePts.map((p) => (
                  <circle
                    key={`s-${p.idx}`}
                    cx={p.x}
                    cy={p.y}
                    r={4.5}
                    fill="#34D399"
                    stroke="#14171A"
                    strokeWidth={1.5}
                    className="cursor-pointer"
                    onClick={() => setSelectedIdx(p.idx)}
                  />
                ))}
              </>
            )}

            {/* MODE 3: SEVERITY GRADE */}
            {chartMode === "severity" && (
              <>
                <path
                  d={buildAreaPath(severityPoints)}
                  fill="url(#severityAreaGrad)"
                />
                {severityPoints.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={buildPolyline(severityPoints)}
                  />
                )}
                {severityPoints.map((pt) => {
                  const isSelected = pt.idx === activePointIdx;
                  const dotColor =
                    pt.lvl === 3
                      ? "#EF4444"
                      : pt.lvl === 2
                      ? "#F97316"
                      : pt.lvl === 1
                      ? "#F59E0B"
                      : "#10B981";
                  return (
                    <g
                      key={pt.item.session_id}
                      className="cursor-pointer"
                      onClick={() => setSelectedIdx(pt.idx)}
                    >
                      {isSelected && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={11}
                          fill="rgba(245, 158, 11, 0.25)"
                        />
                      )}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 6.5 : 5}
                        fill={dotColor}
                        stroke="#14171A"
                        strokeWidth={2}
                      />
                      <text
                        x={pt.x}
                        y={pt.y - 12}
                        textAnchor="middle"
                        className="fill-white text-[10px] font-mono font-bold uppercase"
                      >
                        {pt.sev}
                      </text>
                    </g>
                  );
                })}
              </>
            )}
          </svg>
        </div>

        {/* Selected Data Point Inspector Bar */}
        {activeSession && (
          <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                  activeSession.is_dysarthric
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-emerald-500/20 text-emerald-400"
                }`}
              >
                {activeSession.is_dysarthric ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-white">
                    Session #{activePointIdx + 1}: {activeSession.consensus_diagnosis}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono uppercase text-vitality">
                    {activeSession.consensus_severity}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    ({Math.round(activeSession.consensus_probability * 100)}% risk · {activeSession.dysarthria_vote_ratio} tasks)
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Recorded {formatFullTimestamp(activeSession)} · Click any node on the chart above to inspect session tasks
                </span>
              </div>
            </div>

            {/* Per-Task Mini Pills for Selected Session */}
            {activeSession.utterances && activeSession.utterances.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {activeSession.utterances.map((u) => (
                  <div
                    key={u.utterance_index}
                    className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-[10px] font-mono flex items-center gap-1.5"
                  >
                    <span className="text-slate-400 uppercase">
                      T{u.utterance_index}:
                    </span>
                    <span className="font-bold text-white">
                      {Math.round(u.dysarthria_probability * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
