"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Mail,
  Building2,
  User,
  MessageSquare,
  Send,
  CheckCircle2,
  ShieldCheck,
  HelpCircle,
  Loader2,
  RefreshCw,
  Clock,
  Inbox,
  Search,
  Mic,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  ADMIN_EMAIL,
  ContactInquiryRecord,
  submitContactInquiry,
  fetchAllContactInquiries,
} from "@/lib/firestore";

const INQUIRY_LABELS: Record<string, string> = {
  clinical_trial: "Clinical Screening & Validation",
  research_access: "Academic Dataset & Model Collaboration",
  speech_pathology: "Speech-Language Pathology Support",
  bug_technical: "Technical Issue / Bug Report",
  other: "General Developer Inquiry",
};

export default function ContactPage() {
  const { user, isAdmin } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [inquiryType, setInquiryType] = useState("clinical_trial");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Admin Inbox states
  const [inquiries, setInquiries] = useState<ContactInquiryRecord[]>([]);
  const [loadingInquiries, setLoadingInquiries] = useState(false);
  const [filterUseCase, setFilterUseCase] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user) {
      if (!name && user.displayName) setName(user.displayName);
      if (!email && user.email) setEmail(user.email);
    }
  }, [user, name, email]);

  const loadAdminInquiries = useCallback(async () => {
    if (!isAdmin || !user?.email) return;
    setLoadingInquiries(true);
    try {
      const list = await fetchAllContactInquiries(user.email);
      setInquiries(list);
    } catch (err) {
      console.warn("Failed to load admin inquiries:", err);
    } finally {
      setLoadingInquiries(false);
    }
  }, [isAdmin, user?.email]);

  useEffect(() => {
    if (isAdmin) {
      loadAdminInquiries();
    }
  }, [isAdmin, loadAdminInquiries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await submitContactInquiry({
        name,
        email,
        affiliation,
        inquiryType,
        message,
        userId: user?.uid,
      });
      setSubmitted(true);
      if (isAdmin) {
        loadAdminInquiries();
      }
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Could not send your message. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInquiries = inquiries.filter((item) => {
    if (filterUseCase !== "all" && item.inquiryType !== filterUseCase) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.message.toLowerCase().includes(q) ||
        (item.affiliation || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20 pt-2">
      {/* Page Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-200/70 text-slate-700 text-xs font-semibold">
          <Mail className="h-3.5 w-3.5 text-clinical-cyan" />
          <span>CONTACT THE DEVELOPERS</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Connect with the{" "}
          <span className="text-clinical-cyan">DysarthriaNet Team</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
          Have questions about dysarthria voice screening, rehabilitation tools,
          research collaboration, or technical feedback? Send a message directly
          to our developer team below.
        </p>
      </div>

      {/* ADMIN DASHBOARD SECTION (Visible only to Admin: lovishmanchanda719@gmail.com) */}
      {isAdmin && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-[#14171A] shadow-soft-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#14171A] text-vitality text-[11px] font-extrabold uppercase tracking-wider">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Admin Developer Portal ({ADMIN_EMAIL})</span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 pt-1">
                User Contact Inquiries &amp; Use-Case Submissions ({inquiries.length})
              </h2>
              <p className="text-xs text-slate-500">
                View every user who has contacted the developers, their selected
                use case, affiliation, email address, and full message.
              </p>
            </div>

            <button
              type="button"
              onClick={loadAdminInquiries}
              disabled={loadingInquiries}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer self-start sm:self-center"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  loadingInquiries ? "animate-spin" : ""
                }`}
              />
              <span>Refresh Inbox</span>
            </button>
          </div>

          {/* Search & Use-Case Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by user name, email, organization, or message..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <select
                value={filterUseCase}
                onChange={(e) => setFilterUseCase(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-slate-900 focus:outline-none"
              >
                <option value="all">All Use Cases ({inquiries.length})</option>
                {Object.entries(INQUIRY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Inquiries List */}
          {loadingInquiries ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-clinical-cyan mx-auto" />
              <p className="text-xs text-slate-500">
                Loading user contact submissions...
              </p>
            </div>
          ) : filteredInquiries.length === 0 ? (
            <div className="py-10 text-center bg-slate-50/70 rounded-2xl border border-slate-100 space-y-2">
              <Inbox className="h-7 w-7 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                No Contact Submissions Found
              </p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                When users submit the Contact Us form below, their name, email,
                use case, and message will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {filteredInquiries.map((inq) => (
                <div
                  key={inq.id}
                  className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3 hover:bg-slate-50 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">
                        {inq.name}
                      </span>
                      <a
                        href={`mailto:${inq.email}`}
                        className="text-xs font-mono text-clinical-cyan hover:underline"
                      >
                        &lt;{inq.email}&gt;
                      </a>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#14171A] text-vitality text-[10px] font-bold">
                        {INQUIRY_LABELS[inq.inquiryType] || inq.inquiryType}
                      </span>
                      {inq.affiliation && (
                        <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 text-[10px] font-semibold">
                          {inq.affiliation}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(inq.createdAt).toLocaleString()}
                      </span>
                      <a
                        href={`mailto:${inq.email}?subject=${encodeURIComponent(
                          `Re: DysarthriaNet Inquiry (${
                            INQUIRY_LABELS[inq.inquiryType] || inq.inquiryType
                          })`
                        )}`}
                        className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-800 hover:bg-slate-900 hover:text-white font-bold transition-colors"
                      >
                        Reply via Email
                      </a>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 bg-white p-3.5 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-wrap">
                    {inq.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Contact Form (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-8 sm:p-10 border border-slate-100 shadow-soft-md">
          {submitted ? (
            <div className="py-12 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-soft-sm">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Message Sent to Developers
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Thank you, {name || "Friend"}. Your inquiry has been logged in
                our developer portal and routed to{" "}
                <strong>{ADMIN_EMAIL}</strong>.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setMessage("");
                }}
                className="mt-2 text-xs font-bold text-clinical-cyan hover:underline cursor-pointer"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your Full Name"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-clinical-cyan focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Your Email Address
                  </label>
                  <div className="relative">
                    <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-clinical-cyan focus:outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Organization / Role (Optional)
                </label>
                <div className="relative">
                  <Building2 className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={affiliation}
                    onChange={(e) => setAffiliation(e.target.value)}
                    placeholder="e.g. Patient, Family Caregiver, Student, or Speech Clinic"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-clinical-cyan focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Use Case / Nature of Inquiry
                </label>
                <select
                  value={inquiryType}
                  onChange={(e) => setInquiryType(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:bg-white focus:border-clinical-cyan focus:outline-none transition-all"
                >
                  <option value="clinical_trial">
                    Clinical Screening &amp; Validation
                  </option>
                  <option value="research_access">
                    Academic Dataset &amp; Model Collaboration
                  </option>
                  <option value="speech_pathology">
                    Speech-Language Pathology Support
                  </option>
                  <option value="bug_technical">
                    Technical Issue / Bug Report
                  </option>
                  <option value="other">General Developer Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Message Details
                </label>
                <div className="relative">
                  <MessageSquare className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your question, use case, or feedback for the developers..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-clinical-cyan focus:outline-none transition-all resize-none"
                  />
                </div>
              </div>

              {submitError && (
                <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#14171A] hover:bg-black text-white font-bold py-3.5 px-6 rounded-full text-xs shadow-soft-sm hover:shadow-soft-md transition-all hover:scale-[1.01] cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>
                  {isSubmitting ? "Sending Message..." : "Send Message to Developers"}
                </span>
              </button>
            </form>
          )}
        </div>

        {/* Verified Direct Developer Contact Channels (5 cols) — No hypothetical links/emails */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-sky-50 text-clinical-cyan flex items-center justify-center">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Direct Developer Contact
                </h3>
                <p className="text-xs text-slate-500">
                  Project Lead &amp; Administrator
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              For direct inquiries, collaboration, or project support, you can
              use the Contact Us form on this page or email the lead developer
              directly at{" "}
              <a
                href={`mailto:${ADMIN_EMAIL}`}
                className="font-bold text-clinical-cyan hover:underline break-all"
              >
                {ADMIN_EMAIL}
              </a>
              .
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Mic className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Platform Modules &amp; Screening
                </h3>
                <p className="text-xs text-slate-500">
                  Explore DysarthriaNet-XC features
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Access our 3-task acoustic voice screener, interactive speech
              rehabilitation exercises, or locate verified Speech-Language
              Pathology centers near you.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/screen"
                className="px-3.5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
              >
                Voice Screener
              </Link>
              <Link
                href="/therapy"
                className="px-3.5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
              >
                Rehab Exercises
              </Link>
              <Link
                href="/resources"
                className="px-3.5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
              >
                Find an SLP
              </Link>
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-200/60 space-y-2.5">
            <div className="flex items-center gap-2 text-slate-700">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold">
                Role-Based Access &amp; Privacy
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              All messages submitted through this form are securely stored and
              reviewed exclusively by the project administrator (
              <span className="font-mono text-slate-700">{ADMIN_EMAIL}</span>).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
