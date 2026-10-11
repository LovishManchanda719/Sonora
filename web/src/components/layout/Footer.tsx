import React from "react";
import Link from "next/link";
import { ShieldCheck, Activity, Database, Smartphone, Download } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-200/80 bg-white/70 backdrop-blur-sm mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          {/* Brand & Mission Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-clinical-cyan flex items-center justify-center text-white shadow-soft-sm">
                <Activity className="h-4 w-4" />
              </div>
              <span className="font-extrabold text-base tracking-tight text-slate-900">
                Sonora<span className="text-clinical-cyan">.ai</span>{" "}
                <span className="text-xs font-semibold text-slate-400">
                  (DysarthriaNet-XC)
                </span>
              </span>
            </div>
            <p className="text-xs text-slate-600 max-w-md leading-relaxed">
              Clinical motor speech assessment &amp; vocal rehabilitation platform powered by self-supervised Wav2Vec 2.0 representations
              and cross-corpus domain adaptation across TORGO, EasyCall, and Italian Parkinson’s cohorts.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href="https://github.com/LovishManchanda719/Sonora/raw/main/android/sonora-android.apk"
                download="Sonora-Android.apk"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#14171A] hover:bg-black text-vitality text-[11px] font-bold shadow-soft-sm transition-all"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Download Android APK</span>
                <Download className="h-3 w-3" />
              </a>
              <a
                href="https://github.com/LovishManchanda719/Sonora"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold transition-all"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 fill-current"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <span>GitHub Repository</span>
              </a>
            </div>
          </div>

          {/* Trained Corpora & Datasets - Clickable Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-clinical-cyan" />
              Trained Corpora &amp; Links
            </h4>
            <ul className="text-xs space-y-2 text-slate-600">
              <li>
                <a
                  href="https://www.cs.toronto.edu/~complingweb/data/TORGO/torgo.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-clinical-cyan hover:underline transition-colors"
                >
                  TORGO Database (English CP &amp; ALS) ↗
                </a>
              </li>
              <li>
                <a
                  href="https://www.isca-archive.org/interspeech_2021/turrisi21_interspeech.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-clinical-cyan hover:underline transition-colors"
                >
                  EasyCall Corpus (Italian Multi-etiology) ↗
                </a>
              </li>
              <li>
                <a
                  href="https://ieee-dataport.org/open-access/italian-parkinsons-voice-and-speech"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-clinical-cyan hover:underline transition-colors"
                >
                  IPVS Cohort (Italian Parkinson’s Disease) ↗
                </a>
              </li>
              <li className="pt-0.5">
                <Link
                  href="/about#datasets"
                  className="text-[11px] font-bold text-clinical-cyan hover:underline"
                >
                  All Datasets, Models &amp; Research Links →
                </Link>
              </li>
            </ul>
          </div>

          {/* Regulatory & Medical Disclaimer - India Safe Harbor */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-clinical-emerald" />
              Medical &amp; Legal Disclaimer
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Academic research &amp; educational speech-awareness prototype. <strong>Not a certified Medical Device (CDSCO Rules, 2017)</strong> and does not provide clinical diagnosis under the <strong>RCI Act, 1992</strong>. For medical emergencies, dial <strong>112 / 108</strong>.
            </p>
          </div>

        </div>

        {/* Clean, Non-Redundant Bottom Bar Navigation */}
        <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-4">
          <p>© 2026 Sonora (DysarthriaNet-XC) Academic Research Initiative (India). Educational &amp; research use only — not medical advice.</p>
          <div className="flex flex-wrap items-center gap-5 font-medium">
            <a
              href="https://github.com/LovishManchanda719/Sonora/raw/main/android/sonora-android.apk"
              download="Sonora-Android.apk"
              className="hover:text-slate-900 font-bold text-clinical-cyan transition-colors"
            >
              Android APK
            </a>
            <a
              href="https://github.com/LovishManchanda719/Sonora"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 transition-colors"
            >
              GitHub
            </a>
            <Link href="/about" className="hover:text-slate-900 transition-colors">
              About
            </Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">
              Contact
            </Link>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">
              Privacy (DPDP Act)
            </Link>
            <Link href="/terms" className="hover:text-slate-900 transition-colors">
              Terms &amp; Disclaimer
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
