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

const DATASETS_USED = [
  {
    id: "torgo",
    name: "TORGO Database of Acoustic & Articulatory Speech",
    institution: "University of Toronto & Holland Bloorview Kids Rehabilitation Hospital (Canada)",
    language: "English",
    cohort: "Speakers with Cerebral Palsy (CP), Amyotrophic Lateral Sclerosis (ALS), and Matched Controls",
    roleInProject:
      "Primary English dysarthria training & cross-corpus source benchmark (Sustained vowels, DDK repetitions, words, and standardized clinical sentences).",
    citation:
      "Rudzicz, F., Namasivayam, A. K., & Wolff, T. (2012). The TORGO database of acoustic and articulatory speech from speakers with dysarthria. Language Resources and Evaluation, 46(4), 523–541.",
    links: [
      {
        label: "Official UToronto Portal",
        url: "https://www.cs.toronto.edu/~complingweb/data/TORGO/torgo.html",
      },
      {
        label: "SpringerLink Paper (DOI)",
        url: "https://doi.org/10.1007/s10579-011-9145-0",
      },
      {
        label: "Hugging Face Dataset Mirror",
        url: "https://huggingface.co/datasets/abnerh/TORGO-database",
      },
    ],
  },
  {
    id: "easycall",
    name: "EasyCall Dysarthric Speech Corpus",
    institution: "University of Genoa & Istituto Italiano di Tecnologia — IIT (Italy)",
    language: "Italian",
    cohort: "Multi-Etiology Dysarthric Speakers (Mild, Moderate & Severe) + Healthy Controls",
    roleInProject:
      "Smartphone-recorded dysarthric corpus used to train and validate CORAL heterogeneous domain adaptation across real-world mobile microphone channels.",
    citation:
      "Turrisi, R., Braccia, A., Emanuele, M., Giulietti, S., Pugliatti, M., Sensi, M., Fadiga, L., & Badino, L. (2021). EasyCall corpus: a dysarthric speech dataset. Proc. Interspeech 2021, 41–45.",
    links: [
      {
        label: "ISCA Interspeech Paper",
        url: "https://www.isca-archive.org/interspeech_2021/turrisi21_interspeech.html",
      },
      {
        label: "Official Dataset DOI",
        url: "https://doi.org/10.21437/Interspeech.2021-549",
      },
    ],
  },
  {
    id: "ipvs",
    name: "Italian Parkinson's Voice and Speech (IPVS) Corpus",
    institution: "University of Bari Aldo Moro & Fondazione Salvatore Maugeri (Italy)",
    language: "Italian",
    cohort: "Idiopathic Parkinson's Disease (Hypokinetic Dysarthria) & Healthy Elderly Controls",
    roleInProject:
      "Evaluates phonatory tremor, hypophonia, DDK (/pa-ta-ka/) articulatory breakdown, and connected passage reading in hypokinetic dysarthria.",
    citation:
      "Dimauro, G., Di Nicola, V., Bevilacqua, V., Caivano, D., & Girardi, F. (2017). Assessment of speech intelligibility in Parkinson's disease using a speech-to-text system. IEEE Access, 5, 22199–22208.",
    links: [
      {
        label: "IEEE DataPort Dataset",
        url: "https://ieee-dataport.org/open-access/italian-parkinsons-voice-and-speech",
      },
      {
        label: "IEEE Access Paper (DOI)",
        url: "https://doi.org/10.1109/ACCESS.2017.2762475",
      },
    ],
  },
  {
    id: "uaspeech",
    name: "UA-Speech Universal Access Dysarthric Corpus (Benchmark Reference)",
    institution: "University of Illinois Urbana-Champaign (UIUC Speech & Hearing Science)",
    language: "English",
    cohort: "Speakers with Spastic, Athetoid, and Mixed Dysarthria Stratified by Intelligibility",
    roleInProject:
      "Reference clinical intelligibility stratification scale (High, Mild, Moderate, Severe) used for severity threshold calibration in DysarthriaNet-XC.",
    citation:
      "Kim, H., Hasegawa-Johnson, M., Perlman, A., Gunderson, J., Huang, T. S., Watkin, K., & Frame, S. (2008). Dysarthric speech database for universal access research. Proc. Interspeech 2008, 1741–1744.",
    links: [
      {
        label: "UIUC Official Corpus Page",
        url: "http://www.isle.illinois.edu/sst/data/UASpeech/",
      },
      {
        label: "ISCA Interspeech Paper",
        url: "https://www.isca-archive.org/interspeech_2008/kim08c_interspeech.html",
      },
    ],
  },
];

const FOUNDATION_MODELS = [
  {
    name: "Wav2Vec 2.0 Base (facebook/wav2vec2-base)",
    org: "Meta AI Research / Hugging Face",
    description:
      "Self-supervised 16 kHz raw-waveform transformer encoder extracting early acoustic layer representations (Layers 1–4) sensitive to vocal fold jitter, shimmer, and phonatory instability.",
    links: [
      { label: "Hugging Face Model Card", url: "https://huggingface.co/facebook/wav2vec2-base" },
      { label: "NeurIPS 2020 Paper", url: "https://arxiv.org/abs/2006.11477" },
    ],
  },
  {
    name: "WavLM Base Plus (microsoft/wavlm-base-plus)",
    org: "Microsoft Research / Hugging Face",
    description:
      "Denoised masked speech prediction backbone trained on 94,000 hours of speech for robust dysarthric articulation feature extraction under ambient room noise.",
    links: [
      { label: "Hugging Face Model Card", url: "https://huggingface.co/microsoft/wavlm-base-plus" },
      { label: "IEEE JSTSP Paper", url: "https://arxiv.org/abs/2110.13900" },
    ],
  },
  {
    name: "SpeechBrain ECAPA-TDNN (spkrec-ecapa-voxceleb)",
    org: "SpeechBrain Consortium",
    description:
      "Channel-attentive time-delay neural network capturing vocal tract resonance, formant transitions, and speaker-level glottal timbre.",
    links: [
      { label: "Hugging Face Model Card", url: "https://huggingface.co/speechbrain/spkrec-ecapa-voxceleb" },
      { label: "ECAPA-TDNN Paper", url: "https://arxiv.org/abs/2005.07143" },
    ],
  },
  {
    name: "CORAL Domain Alignment & Sonora Open-Source Engine",
    org: "DysarthriaNet-XC Research Monorepo",
    description:
      "Regularized Correlation Alignment (CORAL) across multi-corpus acoustic distributions, deployed on Hugging Face ZeroGPU with full open-source code on GitHub.",
    links: [
      { label: "Sonora GitHub Repository", url: "https://github.com/LovishManchanda719/Sonora" },
      { label: "Hugging Face Live Space", url: "https://huggingface.co/spaces/lovish719/dysarthria-api" },
      { label: "CORAL AAAI Paper", url: "https://arxiv.org/abs/1511.05547" },
    ],
  },
];

const CLINICAL_REFERENCES = [
  {
    title: "ASHA Practice Portal — Dysarthria in Adults",
    source: "American Speech-Language-Hearing Association (ASHA)",
    description:
      "Evidence-based clinical practice guidelines for differential diagnosis, subsystem assessment, and behavioral treatment of adult motor speech disorders.",
    url: "https://www.asha.org/practice-portal/clinical-topics/dysarthria/",
  },
  {
    title: "Mayo Clinic — Dysarthria Symptoms, Causes & Rehabilitation",
    source: "Mayo Foundation for Medical Education and Research",
    description:
      "Patient and family clinical overview of neurological causes of dysarthria, diagnostic evaluation, and speech-language therapy strategies.",
    url: "https://www.mayoclinic.org/diseases-conditions/dysarthria/symptoms-causes/syc-20371994",
  },
  {
    title: "NIH / NIDCD — Voice, Speech, and Language Disorders",
    source: "National Institute on Deafness and Other Communication Disorders (NIH)",
    description:
      "Federal clinical research repository covering apraxia, dysarthria, spasmodic dysphonia, and assistive communication technologies.",
    url: "https://www.nidcd.nih.gov/health/voice-speech-and-language",
  },
  {
    title: "Neurological Exam: Dysarthria & Dysphonia Clinical Video",
    source: "Spencer S. Eccles Health Sciences Library (University of Utah)",
    description:
      "Clinical demonstration of motor speech examination (MSE) comparing articulatory dysarthria and phonatory dysphonia.",
    url: "https://youtu.be/SMmoAByOX_U",
  },
  {
    title: "Rehabilitation Council of India (RCI) & AIISH Mysuru",
    source: "Ministry of Social Justice & Empowerment / MoHFW, Govt. of India",
    description:
      "Official statutory registry of licensed Audiologists and Speech-Language Pathologists (CRR) and India's apex national speech institute.",
    url: "https://rehabcouncil.nic.in",
  },
  {
    title: "Indian Speech and Hearing Association (ISHA)",
    source: "National Professional Body of SLPs & Audiologists in India",
    description:
      "Clinical resources, public awareness guides, and nationwide directory of certified speech-language pathology practitioners.",
    url: "https://ishaindia.org.in",
  },
];

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
      <div id="datasets" className="scroll-mt-24 space-y-6">
        {/* Section A: Training & Evaluation Speech Datasets */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-100 shadow-soft-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-clinical-cyan"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-clinical-cyan">
                  31,634 Speech Recordings · 135 Patient &amp; Control Speakers
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                Clinical Speech Datasets &amp; Corpora Used in Sonora
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
                Direct links to the peer-reviewed dysarthric speech corpora, official institutional repositories, and DOI publications used to train and cross-validate the DysarthriaNet-XC engine.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-clinical-cyan border border-sky-200 text-[11px] font-bold shrink-0">
              <Database className="h-3.5 w-3.5" />
              <span>Multi-Corpus Benchmark</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {DATASETS_USED.map((ds) => (
              <div
                key={ds.id}
                className="p-5 sm:p-6 rounded-2xl bg-slate-50/80 border border-slate-200/80 hover:border-clinical-cyan/40 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-white text-slate-800 font-bold text-[10px] uppercase border border-slate-200">
                      {ds.language}
                    </span>
                    <span className="text-[11px] font-semibold text-clinical-cyan">
                      {ds.institution}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900">
                    {ds.name}
                  </h3>

                  <p className="text-xs text-slate-700 font-semibold">
                    Cohort: <span className="font-normal text-slate-600">{ds.cohort}</span>
                  </p>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {ds.roleInProject}
                  </p>

                  <div className="p-3 rounded-xl bg-white border border-slate-200/70 text-[11px] text-slate-500 font-mono leading-relaxed">
                    {ds.citation}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {ds.links.map((lk) => (
                    <a
                      key={lk.url}
                      href={lk.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#14171A] hover:bg-black text-white text-xs font-bold transition-all shadow-soft-sm"
                    >
                      <span>{lk.label}</span>
                      <ExternalLink className="h-3 w-3 text-vitality" />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section B: Pre-Trained Foundation Models & Open-Source Code */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-100 shadow-soft-md space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-clinical-cyan" />
              <span className="text-xs font-bold uppercase tracking-wider text-clinical-cyan">
                Self-Supervised Acoustic Backbones &amp; Codebase
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
              Pre-Trained Speech Foundation Models &amp; Open-Source Links
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Neural representations, domain alignment papers, Hugging Face model cards, and the Sonora monorepo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FOUNDATION_MODELS.map((m) => (
              <div
                key={m.name}
                className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {m.org}
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900 pt-1">
                    {m.name}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {m.description}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {m.links.map((lk) => (
                    <a
                      key={lk.url}
                      href={lk.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-sky-50 text-slate-800 hover:text-clinical-cyan border border-slate-200 text-xs font-bold transition-all"
                    >
                      <FileText className="h-3 w-3 text-clinical-cyan" />
                      <span>{lk.label}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section C: Clinical Literature & Speech-Language Pathology References */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-100 shadow-soft-md space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                Clinical Practice Portals &amp; Medical Literature
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
              Clinical Speech-Language Pathology &amp; Research References
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Authoritative medical portals, rehabilitation frameworks, and statutory Indian speech-language pathology directories.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CLINICAL_REFERENCES.map((ref) => (
              <a
                key={ref.url}
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70 hover:border-clinical-cyan hover:bg-white transition-all flex flex-col justify-between gap-3 group"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-clinical-cyan">
                      {ref.source}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover:text-clinical-cyan shrink-0" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-clinical-cyan transition-colors">
                    {ref.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {ref.description}
                  </p>
                </div>
              </a>
            ))}
          </div>
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
