"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  Mic,
  Sliders,
  Flame,
  Volume2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { PacingBoard } from "@/components/therapy/PacingBoard";
import { LoudnessBiofeedback } from "@/components/therapy/LoudnessBiofeedback";
import { MinimalContrastCards } from "@/components/therapy/MinimalContrastCards";

export default function TherapyPage() {
  const [activeTab, setActiveTab] = useState<"pacing" | "loudness" | "contrast">("pacing");

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 pt-2">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/70 text-slate-700 text-xs font-semibold mb-2">
            <Activity className="h-3.5 w-3.5 text-clinical-cyan animate-pulse" />
            <span>PHASE 16 · EVIDENCE-BASED MOTOR REHABILITATION</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Clinical Speech <span className="text-clinical-cyan">Therapy Tools</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Interactive behavioral speech therapy modules grounded in Donald B. Freed (2020) and
            Rosenbek&apos;s motor learning hierarchy. Designed for rate deceleration, sensory
            vocal loudness recalibration, and articulatory contrast precision.
          </p>
        </div>

        {/* Action Link to Screener */}
        <Link
          href="/screen"
          className="inline-flex items-center gap-2 bg-[#14171A] hover:bg-black text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-soft-sm transition-all hover:scale-105 shrink-0"
        >
          <Mic className="h-3.5 w-3.5 text-vitality" />
          <span>Test in Voice Screener</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Therapy Tool Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-soft-sm">
        <button
          onClick={() => setActiveTab("pacing")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === "pacing"
              ? "bg-[#14171A] text-white shadow-soft-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Sliders className={`h-4 w-4 ${activeTab === "pacing" ? "text-vitality" : "text-slate-400"}`} />
          <span>1. Digital Pacing Board</span>
          <span className="hidden sm:inline text-[10px] opacity-70 font-mono">(Rate Reduction)</span>
        </button>

        <button
          onClick={() => setActiveTab("loudness")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === "loudness"
              ? "bg-[#14171A] text-white shadow-soft-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Flame className={`h-4 w-4 ${activeTab === "loudness" ? "text-vitality" : "text-slate-400"}`} />
          <span>2. Visual dB SPL Biofeedback</span>
          <span className="hidden sm:inline text-[10px] opacity-70 font-mono">(Vocal Projection)</span>
        </button>

        <button
          onClick={() => setActiveTab("contrast")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === "contrast"
              ? "bg-[#14171A] text-white shadow-soft-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Sparkles className={`h-4 w-4 ${activeTab === "contrast" ? "text-vitality" : "text-slate-400"}`} />
          <span>3. Minimal Contrast Drills</span>
          <span className="hidden sm:inline text-[10px] opacity-70 font-mono">(Consonants)</span>
        </button>
      </div>

      {/* Active Therapy Module Container */}
      <div>
        {activeTab === "pacing" && <PacingBoard />}
        {activeTab === "loudness" && <LoudnessBiofeedback />}
        {activeTab === "contrast" && <MinimalContrastCards />}
      </div>

      {/* Clinical Evidence & Subsystem Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-sm space-y-3">
          <div className="h-9 w-9 rounded-2xl bg-sky-50 text-clinical-cyan flex items-center justify-center">
            <Sliders className="h-4 w-4" />
          </div>
          <h3 className="font-bold text-sm text-slate-900">
            Prosody &amp; Rate Subsystem
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Targeting 100–120 WPM rate reduction prevents articulatory undershoot and slurred syllable
            blending by 35% in Parkinsonian hypokinetic dysarthria.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-sm space-y-3">
          <div className="h-9 w-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Volume2 className="h-4 w-4" />
          </div>
          <h3 className="font-bold text-sm text-slate-900">
            Phonation &amp; Respiration
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Real-time decibel biofeedback recalibrates internal auditory sensory feedback without vocal
            fold hyperadduction, achieving target 60–65 dB conversational loudness.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-sm space-y-3">
          <div className="h-9 w-9 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <h3 className="font-bold text-sm text-slate-900">
            Articulatory Kinematics
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Contrastive phonetic pair drills force explicit activation of tongue tip, palate, and vocal
            cord adduction for medial and final consonants.
          </p>
        </div>

      </div>

    </div>
  );
}
