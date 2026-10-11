"use client";

import React from "react";
import Link from "next/link";
import {
  Activity,
  Database,
  TrendingUp,
  Brain,
  ShieldCheck,
  ArrowRight,
  Waves,
  Cpu,
  FileText,
  Users,
  Smartphone,
  Download,
  ExternalLink,
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20 pt-2">
      
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-200/70 text-slate-700 text-xs font-semibold">
          <Activity className="h-3.5 w-3.5 text-clinical-cyan animate-pulse" />
          <span>SONORA · POWERED BY DYSARTHRIANET-XC</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Democratizing Acoustic Speech Biomarkers for <span className="text-clinical-cyan">Neurological Care</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-500 leading-relaxed max-w-2xl mx-auto">
          <strong>Sonora</strong> (powered by the <strong>DysarthriaNet-XC</strong> neural engine) is an open clinical artificial intelligence platform engineered to screen,
          grade, and monitor neurological motor speech impairment across Web and Android.
        </p>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-sm">
          <div className="h-10 w-10 rounded-2xl bg-sky-50 text-clinical-cyan flex items-center justify-center mb-4">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">79.96%</div>
          <div className="text-xs font-bold text-clinical-cyan mt-1">Cross-Corpus ROC-AUC</div>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Strict 5-fold cross-validated evaluation with zero speaker leakage across independent testing cohorts.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-sm">
          <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
            <Database className="h-5 w-5" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">31,634</div>
          <div className="text-xs font-bold text-emerald-600 mt-1">Speech Recordings</div>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Trained across TORGO (English ALS/CP), EasyCall (Italian Multi-etiology), and IPVS (Parkinson’s Disease).
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-sm">
          <div className="h-10 w-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
            <Users className="h-5 w-5" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">135</div>
          <div className="text-xs font-bold text-purple-600 mt-1">Human Patient Speakers</div>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Spanning diverse neurological etiologies, speech severity scales, and standardized diagnostic guidelines.
          </p>
        </div>
      </div>

      {/* Core Technology Deep Dive */}
      <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-100 shadow-soft-md space-y-8">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Scientific Foundation &amp; Model Architecture
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
            How self-supervised representation learning transforms subjective perceptual assessments into quantifiable biomarkers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-[#14171A] text-vitality flex items-center justify-center shrink-0">
                <Brain className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-base text-slate-900">
                Self-Supervised Wav2Vec 2.0 Acoustic Embeddings
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Rather than relying solely on classical handcrafted acoustic features (jitter, shimmer, formant frequencies)
              which often degrade across different microphone setups, Sonora leverages latent speech representations
              pre-trained on thousands of hours of speech and fine-tuned for motor speech degradation.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-sky-50 text-clinical-cyan flex items-center justify-center shrink-0">
                <Cpu className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-base text-slate-900">
                ZeroGPU Cloud Acceleration &amp; Domain Adaptation
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Inference is hosted on Hugging Face Spaces with dynamic ZeroGPU acceleration, featuring Coral / MMD domain
              alignment to mitigate acoustic channel disparities and acoustic confounders across diverse clinical environments.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Waves className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-base text-slate-900">
                Dual-Mode Tri-Task &amp; 3×30s Statement Protocol
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Supports both the rapid 3-subsystem clinical battery (Sustained Vowel /a/, DDK /pa-ta-ka/, and Sentence Reading)
              and the high-precision 3 × 30-second Extended Statement Protocol for multi-window syllable cadence and vocal fatigue evaluation.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-base text-slate-900">
                Clinical Assistive Scope &amp; Ethical AI
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sonora is created to empower speech-language pathologists (SLPs), neurologists, patients, and families
              with objective longitudinal triage data and interactive home rehabilitation biofeedback.
            </p>
          </div>
        </div>
      </div>

      {/* Datasets, Pre-Trained Backbones & Clinical References */}
      <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-100 shadow-soft-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Datasets, Pre-Trained Models &amp; Clinical References
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Direct links to the peer-reviewed speech corpora, foundation models, and medical literature powering Sonora.
            </p>
          </div>
          <Link
            href="/resources?tab=datasets"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-clinical-cyan hover:underline shrink-0"
          >
            <span>Open Full Datasets &amp; Research Directory</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <a
            href="https://www.cs.toronto.edu/~complingweb/data/TORGO/torgo.html"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-2xl bg-slate-50 hover:bg-sky-50/60 border border-slate-200/80 hover:border-clinical-cyan transition-all flex flex-col justify-between gap-2 group"
          >
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-clinical-cyan">
                <span>University of Toronto</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-900 mt-1 group-hover:text-clinical-cyan">
                TORGO Dysarthria Database
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                English Cerebral Palsy (CP) &amp; ALS acoustic and articulatory corpus (Rudzicz et al., 2012).
              </p>
            </div>
          </a>

          <a
            href="https://www.isca-archive.org/interspeech_2021/turrisi21_interspeech.html"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-2xl bg-slate-50 hover:bg-sky-50/60 border border-slate-200/80 hover:border-clinical-cyan transition-all flex flex-col justify-between gap-2 group"
          >
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-clinical-cyan">
                <span>University of Genoa / IIT</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-900 mt-1 group-hover:text-clinical-cyan">
                EasyCall Dysarthric Corpus
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                Multi-etiology smartphone dysarthric speech dataset (Turrisi et al., Interspeech 2021).
              </p>
            </div>
          </a>

          <a
            href="https://ieee-dataport.org/open-access/italian-parkinsons-voice-and-speech"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-2xl bg-slate-50 hover:bg-sky-50/60 border border-slate-200/80 hover:border-clinical-cyan transition-all flex flex-col justify-between gap-2 group"
          >
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-clinical-cyan">
                <span>IEEE DataPort / Univ. of Bari</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-900 mt-1 group-hover:text-clinical-cyan">
                Italian Parkinson&apos;s Voice &amp; Speech (IPVS)
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                Hypokinetic Parkinson&apos;s disease phonation, DDK, and reading corpus (Dimauro et al., 2017).
              </p>
            </div>
          </a>

          <a
            href="http://www.isle.illinois.edu/sst/data/UASpeech/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-2xl bg-slate-50 hover:bg-sky-50/60 border border-slate-200/80 hover:border-clinical-cyan transition-all flex flex-col justify-between gap-2 group"
          >
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-clinical-cyan">
                <span>UIUC Speech &amp; Hearing Science</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-900 mt-1 group-hover:text-clinical-cyan">
                UA-Speech Benchmark Reference
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                Intelligibility-stratified universal access dysarthric speech benchmark (Kim et al., 2008).
              </p>
            </div>
          </a>

          <a
            href="https://huggingface.co/facebook/wav2vec2-base"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-2xl bg-slate-50 hover:bg-sky-50/60 border border-slate-200/80 hover:border-clinical-cyan transition-all flex flex-col justify-between gap-2 group"
          >
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-clinical-cyan">
                <span>Meta AI / Hugging Face</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-900 mt-1 group-hover:text-clinical-cyan">
                Wav2Vec 2.0 &amp; WavLM Backbones
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                Self-supervised 16 kHz transformer speech representations (Baevski et al., NeurIPS 2020).
              </p>
            </div>
          </a>

          <a
            href="https://www.asha.org/practice-portal/clinical-topics/dysarthria/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-2xl bg-slate-50 hover:bg-sky-50/60 border border-slate-200/80 hover:border-clinical-cyan transition-all flex flex-col justify-between gap-2 group"
          >
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-clinical-cyan">
                <span>ASHA Clinical Practice Portal</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-900 mt-1 group-hover:text-clinical-cyan">
                ASHA Dysarthria Clinical Guidelines
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                Evidence-based motor speech evaluation and behavioral rehabilitation protocols.
              </p>
            </div>
          </a>
        </div>
      </div>

      {/* Bottom CTA Banner */}
      <div className="bg-[#14171A] text-white rounded-3xl p-8 sm:p-10 shadow-soft-lg flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Experience Sonora on Web or Android
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-md">
            Begin the guided vocal screening battery, download the Android APK, or inspect the open-source repository on GitHub.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href="/screen"
            className="inline-flex items-center gap-2 bg-vitality hover:bg-vitality-hover text-[#14171A] font-extrabold px-6 py-3.5 rounded-full text-xs shadow-soft-sm transition-all hover:scale-105"
          >
            <span>Start Screening Battery</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="/downloads/sonora-android.apk"
            download="Sonora-Android.apk"
            className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white font-bold px-5 py-3.5 rounded-full text-xs border border-white/15 transition-all"
          >
            <Smartphone className="h-4 w-4 text-vitality" />
            <span>Download Android APK</span>
            <Download className="h-3.5 w-3.5" />
          </a>
          <a
            href="https://github.com/LovishManchanda719/Sonora"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-3.5 rounded-full text-xs border border-white/10 transition-all"
          >
            <FileText className="h-4 w-4" />
            <span>GitHub Repo</span>
          </a>
        </div>
      </div>

    </div>
  );
}
