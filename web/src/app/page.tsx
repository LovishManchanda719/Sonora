"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Mic,
  Database,
  ArrowRight,
  TrendingUp,
  Radio,
  Zap,
  Sparkles,
  Sliders,
  Smartphone,
  Download,
  CheckCircle2,
} from "lucide-react";
import { checkBackendHealth } from "@/lib/api-client";

export default function HomePage() {
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [backendMeta, setBackendMeta] = useState<{ device?: string; version?: string }>({});

  useEffect(() => {
    checkBackendHealth()
      .then((data) => {
        setBackendStatus("online");
        setBackendMeta(data);
      })
      .catch(() => {
        setBackendStatus("offline");
      });
  }, []);

  return (
    <div className="space-y-8 pb-12">
      
      {/* Top Welcome & Health Overview */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-2">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/70 text-slate-700 text-xs font-semibold mb-3">
            <Radio className="h-3.5 w-3.5 text-clinical-cyan animate-pulse" />
            <span>SONORA · POWERED BY DYSARTHRIANET-XC</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Sonora <span className="text-clinical-cyan">Voice Clarity &amp; Speech AI</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Non-invasive screening and vocal biofeedback for neurological motor speech disorders utilizing cross-corpus Wav2Vec 2.0 representations.
          </p>
        </div>

        {/* Backend Cloud Status Pill */}
        <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-soft-sm">
          <div className="relative flex h-3 w-3">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                backendStatus === "online"
                  ? "bg-emerald-400"
                  : backendStatus === "checking"
                  ? "bg-amber-400"
                  : "bg-rose-400"
              }`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                backendStatus === "online"
                  ? "bg-emerald-500"
                  : backendStatus === "checking"
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
            ></span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[11px] font-bold text-slate-900 leading-none">
              {backendStatus === "online"
                ? "AI Engine Live"
                : backendStatus === "checking"
                ? "Checking Backend..."
                : "Backend Offline"}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              {backendMeta.device
                ? `Device: ${backendMeta.device.toUpperCase()}`
                : "FastAPI / ZeroGPU"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">

        {/* Hero Card 1: Start Screening (Large 2-column card) */}
        <div className="md:col-span-2 lg:col-span-2 bg-[#14171A] text-white rounded-3xl p-6 sm:p-8 shadow-soft-lg relative overflow-hidden group flex flex-col justify-between">
          
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-clinical-cyan/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
            {/* Left: Heading and CTA */}
            <div className="sm:col-span-7 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-vitality text-xs font-bold mb-4 border border-white/10">
                  <Zap className="h-3.5 w-3.5" />
                  <span>DUAL-MODE VOICE BIOMARKER BATTERY</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-3">
                  Screen Speech in 3 Rapid Tasks or 3 × 30s Statements
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                  Choose our rapid 3-subsystem check (Vowel, Pa-Ta-Ka, Sentence) or the high-precision 3 × 30s Extended Statement Protocol for deep cadence and fatigue analysis.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <Link
                  href="/screen"
                  className="inline-flex items-center gap-2 bg-vitality hover:bg-vitality-hover text-[#14171A] font-extrabold px-5 py-3 rounded-full text-xs shadow-soft-sm hover:shadow-glow-vitality transition-all hover:scale-105"
                >
                  <Mic className="h-4 w-4" />
                  <span>Begin Clinical Battery</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="https://github.com/LovishManchanda719/Sonora/raw/main/android/sonora-android.apk"
                  download="Sonora-Android.apk"
                  className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/15 font-bold px-4 py-3 rounded-full text-xs transition-all"
                >
                  <Smartphone className="h-3.5 w-3.5 text-vitality" />
                  <span>Get Android APK</span>
                </a>
              </div>
            </div>

            {/* Right: Hero Illustration with Ambient Glow */}
            <div className="sm:col-span-5 flex items-center justify-center relative py-2">
              <div className="absolute inset-0 bg-clinical-cyan/25 rounded-full blur-3xl pointer-events-none scale-90"></div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/hero-consultation.png"
                alt="Clinical Consultation Illustration"
                className="relative z-10 w-full max-h-56 object-contain drop-shadow-2xl transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Model Benchmark Specs (Clean White Card) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Benchmark Metric
              </span>
              <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="text-4xl font-extrabold text-slate-900 tracking-tight">
              79.96%
            </div>
            <span className="text-xs font-semibold text-emerald-600 mt-1 inline-flex items-center gap-1">
              ROC-AUC Across 135 Speakers
            </span>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              5-fold cross-validated with strict zero speaker overlap across multi-corpus validation folds.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Accuracy Balance</span>
            <span className="font-bold text-slate-900">72.30% ± 7.8%</span>
          </div>
        </div>

        {/* Card 3: Trained Corpora (High-Contrast White Card) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Training Scale
              </span>
              <div className="h-8 w-8 rounded-full bg-sky-50 text-clinical-cyan flex items-center justify-center">
                <Database className="h-4 w-4" />
              </div>
            </div>
            <div className="text-4xl font-extrabold text-slate-900 tracking-tight">
              31,634
            </div>
            <span className="text-xs font-semibold text-clinical-cyan mt-1 inline-block">
              Clinical Speech Recordings
            </span>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              Trained across TORGO (English CP/ALS), EasyCall (Italian), and IPVS (Parkinson&apos;s Disease).
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Clinical Cohort</span>
            <span className="font-bold text-slate-900">135 Human Patients</span>
          </div>
        </div>

        {/* Card 4: Speech Rehabilitation & Therapy Engine */}
        <div className="md:col-span-3 lg:col-span-4 bg-gradient-to-r from-slate-900 via-[#14171A] to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-soft-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-vitality/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vitality/20 text-vitality text-xs font-bold border border-vitality/30">
                <Sparkles className="h-3.5 w-3.5" />
                <span>PHASE 16 · EVIDENCE-BASED MOTOR REHABILITATION</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Interactive Motor Speech Therapy Suite
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Evidence-based behavioral therapy tools grounded in Donald B. Freed (2020) and Rosenbek&apos;s
                hierarchy: Digital Pacing Board for rate reduction, Real-Time dB SPL Visual Loudness Biofeedback
                (&quot;Think Loud&quot;), and Minimal Contrast Consonant Drills.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-vitality"></span>
                  Pacing Metronome &amp; Tap Board
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  Live Web Audio dB Meter
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-clinical-cyan"></span>
                  Rosenbek 1–3 Self-Rating
                </span>
              </div>
            </div>

            <div className="shrink-0">
              <Link
                href="/therapy"
                className="inline-flex items-center gap-2 bg-vitality hover:bg-vitality-hover text-[#14171A] font-extrabold px-6 py-3.5 rounded-full text-xs shadow-soft-sm hover:shadow-glow-vitality transition-all hover:scale-105"
              >
                <Sliders className="h-4 w-4" />
                <span>Launch Therapy Suite</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Card 5: Sonora Android App (.APK) & Open-Source GitHub Showcase Card */}
        <div className="md:col-span-3 lg:col-span-4 bg-gradient-to-br from-[#E2F3FB] via-[#F2F9F6] to-[#EEF8D8] rounded-3xl p-6 sm:p-8 border border-sky-200/70 shadow-soft-md relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#14171A] text-vitality text-[11px] font-extrabold uppercase tracking-wider">
                <Smartphone className="h-3.5 w-3.5" />
                <span>SONORA FOR ANDROID · NATIVE APK &amp; OPEN SOURCE</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Take Sonora Everywhere on Your Android Phone
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                Install the standalone <strong>Sonora Android App (.apk)</strong> for 60 FPS pocket voice screening, real-time dB SPL vocal loudness biofeedback, tactile pacing board drills, GPS RCI Speech-Language Pathologist lookup, and synced cloud clinical dossiers.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  16 kHz Noise-Filtered Mic
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  3-Task &amp; 3×30s Statement Modes
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  Full Therapy &amp; SLP Locator
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <a
                href="https://github.com/LovishManchanda719/Sonora/raw/main/android/sonora-android.apk"
                download="Sonora-Android.apk"
                className="inline-flex items-center gap-2 bg-[#14171A] hover:bg-black text-vitality font-extrabold px-6 py-3.5 rounded-full text-xs shadow-soft-md transition-all hover:scale-105"
              >
                <Download className="h-4 w-4" />
                <span>Download Android APK</span>
              </a>

              <a
                href="https://github.com/LovishManchanda719/Sonora"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 font-extrabold px-5 py-3.5 rounded-full text-xs shadow-soft-sm transition-all hover:scale-105"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 fill-current"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <span>View on GitHub</span>
              </a>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
