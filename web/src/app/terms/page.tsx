"use client";

import React from "react";
import Link from "next/link";
import { Scale, AlertTriangle, Stethoscope, BookOpen, ArrowLeft } from "lucide-react";

export default function TermsOfServicePage() {
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold">
          <Scale className="h-3.5 w-3.5 text-sky-600" />
          <span>EDUCATIONAL &amp; ACADEMIC RESEARCH USAGE AGREEMENT (INDIA)</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Terms of Service &amp; Medical Disclaimer
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Effective Date: October 2026 · Governed by the Laws of India (CDSCO, RCI Act 1992, &amp; DPDP Act 2023)
        </p>
      </div>

      {/* Core Terms Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-soft-sm space-y-2">
          <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <h4 className="text-xs font-bold text-slate-900">Not a Medical Device (CDSCO)</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            DysarthriaNet-XC is an academic research &amp; educational speech-wellness prototype, not a licensed medical device.
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-soft-sm space-y-2">
          <div className="h-8 w-8 rounded-xl bg-sky-50 text-clinical-cyan flex items-center justify-center">
            <Stethoscope className="h-4 w-4" />
          </div>
          <h4 className="text-xs font-bold text-slate-900">Not a Clinical Diagnosis (RCI)</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Outputs do not replace evaluation by a Rehabilitation Council of India (RCI)-licensed Speech-Language Pathologist.
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-soft-sm space-y-2">
          <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <BookOpen className="h-4 w-4" />
          </div>
          <h4 className="text-xs font-bold text-slate-900">Emergency Warning (112 / 108)</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Never use this website for medical emergencies. Sudden slurred speech requires immediate emergency hospital care.
          </p>
        </div>
      </div>

      {/* Policy Clauses Body */}
      <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-100 shadow-soft-md space-y-8 text-xs text-slate-600 leading-relaxed">
        
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-clinical-cyan"></span>
            1. Non-Medical Device &amp; Regulatory Safe-Harbor Disclaimer (India)
          </h2>
          <p>
            By accessing or using the DysarthriaNet-XC website (&quot;Platform&quot;), you acknowledge and agree that this
            Platform is an <strong>academic machine-learning research project and educational speech-awareness prototype</strong>.
          </p>
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-900 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-800 text-[11px]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Important Regulatory Notice (CDSCO &amp; RCI Act, 1992)</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              1. <strong>Not a Medical Device:</strong> DysarthriaNet-XC is NOT a registered or certified Medical Device
              (SaMD) under the <strong>Indian Medical Devices Rules, 2017 (Central Drugs Standard Control Organization — CDSCO)</strong>,
              the <strong>Drugs and Cosmetics Act, 1940</strong>, or US FDA regulations.<br />
              2. <strong>Not Clinical Practice:</strong> Automated acoustic scores and biofeedback exercises provided here
              do NOT constitute medical advice, clinical diagnosis, prognosis, treatment, or speech-language pathology
              practice under the <strong>Rehabilitation Council of India (RCI) Act, 1992</strong>.<br />
              3. <strong>Consult a Licensed Doctor / RCI Specialist:</strong> Always seek the advice of a qualified
              neurologist, physician, or RCI-registered Speech-Language Pathologist (CRR) for any questions regarding a
              medical or speech condition.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-clinical-cyan"></span>
            2. Acute Medical Emergency Warning (Call 112 or 108 in India)
          </h2>
          <p>
            <strong>DO NOT USE THIS WEBSITE IN A MEDICAL EMERGENCY.</strong> Sudden onset of slurred speech, facial
            drooping, arm weakness, confusion, or difficulty swallowing can be symptoms of an acute stroke or life-threatening
            neurological emergency. If you or someone near you experiences sudden speech changes, immediately call{" "}
            <strong>112</strong> or <strong>108</strong> (India Emergency Ambulance Services) or proceed to the nearest
            hospital emergency department.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-clinical-cyan"></span>
            3. Algorithmic Boundaries &amp; Statistical Variance
          </h2>
          <p>
            Machine learning inferences generated by DysarthriaNet-XC represent experimental mathematical estimates derived
            from acoustic features (pitch, jitter, shimmer, harmonic-to-noise ratio, and syllable rate). False positives and
            false negatives can occur due to:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-500">
            <li>Microphone hardware gain differences, headset placement, or background room noise.</li>
            <li>Temporary vocal fatigue, common cold, hoarseness, regional accents, or speaking pace variations.</li>
            <li>Non-standard task execution during recording.</li>
          </ul>
          <p>
            You agree not to rely on any score generated by this Platform to start, stop, or modify any medical treatment
            or medication.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-clinical-cyan"></span>
            4. Intellectual Property, Trademarks &amp; Academic Citation
          </h2>
          <p>
            All custom code, neural network weights, and educational illustrations are provided for academic demonstration
            and public awareness. Any third-party clinical literature or rehabilitation methodologies referenced on this site
            are cited strictly for educational attribution under fair-dealing principles (Section 52 of the Indian Copyright
            Act, 1957). DysarthriaNet-XC is an independent academic project and is not affiliated with or endorsed by any
            commercial speech therapy trademark holder.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-clinical-cyan"></span>
            5. Complete Limitation of Liability &amp; &quot;As-Is&quot; Warranty Disclaimer
          </h2>
          <p>
            This Platform is provided free of charge on an <strong>&quot;AS IS&quot; and &quot;AS AVAILABLE&quot;</strong>{" "}
            basis without warranties of any kind, express or implied. To the fullest extent permitted under the{" "}
            <strong>Indian Contract Act, 1872</strong> and applicable law, the student developers, researchers, and academic
            contributors of DysarthriaNet-XC shall have <strong>zero liability</strong> for any direct, indirect, incidental,
            consequential, or special damages, emotional distress, or health outcomes arising out of or connected with the
            use of or inability to use this Platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-clinical-cyan"></span>
            6. Governing Law, Jurisdiction &amp; Grievance Contact
          </h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the <strong>Republic of India</strong>.
            Any legal questions or disputes shall be subject to the exclusive jurisdiction of the competent courts located in{" "}
            <strong>New Delhi, India</strong>. For any questions, takedown requests, or compliance inquiries, please contact{" "}
            <a href="mailto:lovishmanchanda719@gmail.com" className="font-bold text-clinical-cyan hover:underline">
              lovishmanchanda719@gmail.com
            </a>{" "}
            or use our{" "}
            <Link href="/contact" className="font-bold text-clinical-cyan hover:underline">
              Contact Us page
            </Link>
            .
          </p>
        </section>

      </div>
    </div>
  );
}
