"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, Lock, EyeOff, Server, ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 pt-2">
      
      {/* Header */}
      <div className="space-y-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>INDIA DPDP ACT 2023 &amp; IT ACT 2000 PRIVACY FRAMEWORK</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Data Protection &amp; Privacy Policy
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Effective Date: October 2026 · Compliant with the Digital Personal Data Protection Act, 2023 (India)
        </p>
      </div>

      {/* Core Privacy Guarantees Callout */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-soft-sm space-y-2">
          <div className="h-8 w-8 rounded-xl bg-sky-50 text-clinical-cyan flex items-center justify-center">
            <Lock className="h-4 w-4" />
          </div>
          <h4 className="text-xs font-bold text-slate-900">Zero Commercial Resale</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            User voice recordings and account details are never monetized, sold, or shared with third-party advertisers.
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-soft-sm space-y-2">
          <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <EyeOff className="h-4 w-4" />
          </div>
          <h4 className="text-xs font-bold text-slate-900">Informed Consent &amp; Erasure</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Users control their own screening history and can wipe local browser cache or request full data deletion anytime.
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-soft-sm space-y-2">
          <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Server className="h-4 w-4" />
          </div>
          <h4 className="text-xs font-bold text-slate-900">Volatile RAM Audio Processing</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Raw voice waveforms are analyzed in transient memory to compute acoustic metrics and immediately discarded.
          </p>
        </div>
      </div>

      {/* Policy Clauses Body */}
      <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-100 shadow-soft-md space-y-8 text-xs text-slate-600 leading-relaxed">
        
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-clinical-cyan"></span>
            1. Scope, Educational Purpose &amp; Legal Framework
          </h2>
          <p>
            DysarthriaNet-XC (&quot;Platform&quot;, &quot;we&quot;, &quot;us&quot;) is an academic research and educational speech-wellness
            screening prototype developed in India. This Privacy Policy is published in accordance with the{" "}
            <strong>Digital Personal Data Protection Act, 2023 (DPDP Act, 2023)</strong> and the{" "}
            <strong>Information Technology Act, 2000</strong> (and applicable SPDI Rules) of India.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-clinical-cyan"></span>
            2. Transient Voice Audio Capture &amp; Non-Retention of Raw Biometrics
          </h2>
          <p>
            When you voluntarily initiate a voice screening or therapy biofeedback exercise, audio is captured locally via your
            browser&apos;s standard Web Audio API with your explicit microphone permission.
          </p>
          <p>
            For the 3-step screening battery, audio clips are transmitted over encrypted HTTPS solely to compute mathematical
            acoustic features (such as pitch stability, jitter, shimmer, harmonic-to-noise ratio, and syllable cadence) in
            volatile memory. <strong>Raw voice audio files are immediately discarded after inference and are never archived on our servers.</strong>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-clinical-cyan"></span>
            3. Optional Account Data &amp; Local Browser Storage
          </h2>
          <p>
            Unauthenticated visitors may use the educational tools without creating an account; temporary screening results are
            kept in your browser&apos;s local storage and can be wiped in one click from the Profile page.
          </p>
          <p>
            If you choose to sign in via Email or Google Authentication, your basic profile preferences (name, optional age/sex
            reference norms, profile picture, and numerical screening summary scores) are stored strictly for your personal
            progress tracking.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-clinical-cyan"></span>
            4. Data Principal Rights &amp; Grievance Redressal Officer (India DPDP Act, 2023)
          </h2>
          <p>
            Under the Digital Personal Data Protection Act, 2023, you have the right to access, correct, withdraw consent, and
            erase your personal data at any time. In accordance with the IT Act, 2000 and DPDP Act, 2023, the designated
            Data Protection &amp; Grievance Officer is:
          </p>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-slate-700">
            <p className="font-bold text-slate-900">Grievance Officer: Lovish Manchanda</p>
            <p>Project: DysarthriaNet-XC Academic Research Initiative (New Delhi / NCR, India)</p>
            <p>
              Email:{" "}
              <a href="mailto:lovishmanchanda719@gmail.com" className="font-bold text-clinical-cyan hover:underline">
                lovishmanchanda719@gmail.com
              </a>{" "}
              | Contact Portal:{" "}
              <Link href="/contact" className="font-bold text-clinical-cyan hover:underline">
                /contact
              </Link>
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-clinical-cyan"></span>
            5. Technical Security Safeguards
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-500">
            <li>HTTPS / TLS encryption across all client-to-API requests and security headers (CSP, HSTS, X-Frame-Options).</li>
            <li>Strict payload size limits, MIME validation, and anti-abuse rate limiting on all API endpoints.</li>
            <li>Zero third-party ad-network tracking cookies or commercial data brokers.</li>
          </ul>
        </section>

      </div>

    </div>
  );
}
