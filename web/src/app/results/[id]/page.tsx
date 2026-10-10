"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  FileDown,
  Loader2,
} from "lucide-react";
import { SeverityGauge } from "@/components/dashboard/SeverityGauge";
import { SessionDiagnosticResponse } from "@/lib/api-client";
import { generateClinicalPdfReport } from "@/lib/report-pdf";
import { useAuth } from "@/lib/auth-context";
import {
  getClinicalProfile,
  getLocalScreenings,
  getUserScreeningHistory,
} from "@/lib/firestore";

export default function ResultsPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const { user } = useAuth();

  const [report, setReport] = useState<SessionDiagnosticResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = () => {
    if (!report) return;
    try {
      setIsGeneratingPdf(true);
      const profile = getClinicalProfile(
        user?.uid,
        user?.displayName || user?.email || undefined
      );

      generateClinicalPdfReport(report, {
        patientName:
          profile.patientName ||
          user?.displayName ||
          user?.email ||
          "Evaluated Participant",
        evaluator: "DysarthriaNet-XC Unified Protocol",
        etiology: profile.primaryEtiology || undefined,
      });
    } catch (err) {
      console.error("Failed to generate PDF report:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  useEffect(() => {
    let active = true;

    async function loadReport() {
      // 1. Check sessionStorage first
      const cached = sessionStorage.getItem(`screening_${sessionId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (active) setReport(parsed);
          return;
        } catch (e) {
          console.error("Failed to parse cached report:", e);
        }
      }

      // 2. Check localStorage screenings
      const localItems = getLocalScreenings(user?.uid);
      const localMatch = localItems.find(
        (item) => item.session_id === sessionId
      );
      if (localMatch) {
        if (active) setReport(localMatch);
        return;
      }

      // 3. Fetch from first-party server store (/api/screenings)
      try {
        const historyRes = await getUserScreeningHistory(user?.uid);
        const serverMatch = historyRes.items.find(
          (item) => item.session_id === sessionId
        );
        if (serverMatch) {
          if (active) setReport(serverMatch);
          return;
        }
      } catch (e) {
        console.warn("Failed to fetch screening from server store:", e);
      }

      if (active) setNotFound(true);
    }

    loadReport();
    return () => {
      active = false;
    };
  }, [sessionId, user?.uid]);

  if (!report) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-3">
        <h2 className="text-xl font-bold text-slate-800">
          Session Diagnostic Report
        </h2>
        <p className="text-xs text-slate-500">
          {notFound ? (
            <>
              No report found for session ID:{" "}
              <span className="font-mono text-slate-700">{sessionId}</span>. Use{" "}
              <strong>Voice Screener</strong> or <strong>Profile</strong> in the
              navigation bar above.
            </>
          ) : (
            <>
              Loading report for session ID:{" "}
              <span className="font-mono text-slate-700">{sessionId}</span>...
            </>
          )}
        </p>
      </div>
    );
  }

  const score100 = Math.round(report.consensus_probability * 100);
  const isDys = report.is_dysarthric;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 print:p-0">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-clinical-cyan"></span>
            <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
              SESSION: {report.session_id}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Clinical Diagnostic Evaluation Report
          </h1>
          <span className="text-xs text-slate-400">
            Timestamp: {report.timestamp}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="flex items-center gap-2 bg-[#0F172A] hover:bg-black text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-soft-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            title="Download detailed clinical PDF report"
          >
            {isGeneratingPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-clinical-cyan" />
            ) : (
              <FileDown className="h-3.5 w-3.5 text-clinical-cyan" />
            )}
            <span>
              {isGeneratingPdf
                ? "Generating PDF..."
                : "Download Diagnostic Report PDF"}
            </span>
          </button>
        </div>
      </div>

      {/* Main Verdict Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Circular Gauge Card */}
        <div className="md:col-span-1">
          <SeverityGauge
            score={score100}
            label="Dysarthria Probability"
            severity={report.consensus_severity}
            size={190}
          />
        </div>

        {/* Diagnostic Verdict & Recommendation Card */}
        <div className="md:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Consensus Diagnosis
              </span>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                Confidence: {report.confidence_rating}
              </span>
            </div>

            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              {isDys ? (
                <>
                  <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
                  <span>{report.consensus_diagnosis}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                  <span>{report.consensus_diagnosis}</span>
                </>
              )}
            </h2>

            <div className="flex items-center gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Graded Severity:</span>
                <span className="font-bold uppercase text-slate-900">
                  {report.consensus_severity}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Battery Consensus:</span>
                <span className="font-bold text-slate-900 font-mono">
                  {report.dysarthria_vote_ratio} Tasks Flagged
                </span>
              </div>
            </div>

            <div className="mt-5 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Clinical Recommendation
              </span>
              <p className="text-xs font-medium text-slate-800 leading-relaxed">
                {report.clinical_recommendation}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Model: DysarthriaNet-XC Unified (Wav2Vec2 Foundation)</span>
            <span>31,634 Clips Reference Pool</span>
          </div>
        </div>
      </div>

      {/* Per-Task Breakdown Cards */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-sm">
        <h3 className="font-bold text-base text-slate-900 mb-4 flex items-center gap-2">
          <Layers className="h-4 w-4 text-clinical-cyan" />
          <span>Multi-Utterance Battery Breakdown</span>
        </h3>

        <div className="space-y-3">
          {report.utterances.map((u) => {
            const probPct = Math.round(u.dysarthria_probability * 100);
            return (
              <div
                key={u.utterance_index}
                className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center font-bold text-xs text-slate-700 shadow-sm border border-slate-100">
                      {u.utterance_index}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase">
                        {u.task_name.replace(/_/g, " ")}
                      </h4>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {u.filename}
                        {u.audio_quality?.duration_seconds
                          ? ` • ${u.audio_quality.duration_seconds.toFixed(1)}s`
                          : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        {probPct}%
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Probability
                      </span>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        u.is_dysarthric
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {u.is_dysarthric
                        ? `${u.predicted_severity.toUpperCase()}`
                        : "NORMAL"}
                    </span>
                  </div>
                </div>

                {u.clinical_note && (
                  <p className="text-xs text-slate-600 pl-11 leading-relaxed">
                    {u.clinical_note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
