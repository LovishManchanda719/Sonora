"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Shield,
  Smartphone,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Phone,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const OTP_LENGTH = 6;

export default function AuthPage() {
  const router = useRouter();
  const {
    user,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signInWithPhoneVerified,
  } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [authMethod, setAuthMethod] = useState<"phone" | "email">("phone");

  // Email states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Phone OTP states (Descope 6-digit SMS OTP)
  const [countryCode] = useState("91");
  const [mobileNumber, setMobileNumber] = useState("");
  const [otpStep, setOtpStep] = useState<"input_phone" | "verify_otp">(
    "input_phone"
  );
  const [otpDigits, setOtpDigits] = useState<string[]>(
    Array(OTP_LENGTH).fill("")
  );
  const [resendTimer, setResendTimer] = useState(0);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Anti-DDoS SVG CAPTCHA states
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaSvg, setCaptchaSvg] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const res = await fetch("/api/auth/otp", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.captchaToken && data.svgDataUrl) {
          setCaptchaToken(data.captchaToken);
          setCaptchaSvg(data.svgDataUrl);
          setCaptchaAnswer("");
        }
      }
    } catch {
      // ignore network error on initial load
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha]);

  // If already logged in, redirect safely after render
  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  // 30-second countdown timer for OTP resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  // Browser WebOTP API auto-read support on mobile web
  useEffect(() => {
    if (otpStep !== "verify_otp" || typeof window === "undefined") return;
    if (!("OTPCredential" in window)) return;

    const ac = new AbortController();
    navigator.credentials
      .get({
        // @ts-expect-error WebOTP API transport option
        otp: { transport: ["sms"] },
        signal: ac.signal,
      })
      .then((cred: unknown) => {
        const code = (cred as { code?: string })?.code;
        if (code) {
          const digits = code.replace(/\D/g, "").slice(0, OTP_LENGTH).split("");
          if (digits.length === OTP_LENGTH) {
            setOtpDigits(digits);
            void verifyOtpCode(digits.join(""));
          }
        }
      })
      .catch(() => {
        // Ignore abort or unsupported WebOTP
      });

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpStep]);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    try {
      await signInWithGoogle();
      router.push("/");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Google sign in failed.";
      setErrorMsg(msg);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
      router.push("/");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Authentication failed.";
      setErrorMsg(msg);
      setIsSubmitting(false);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setStatusNotice(null);

    const cleanedPhone = mobileNumber.replace(/\D/g, "");
    if (cleanedPhone.length !== 10) {
      setErrorMsg("Enter a valid 10-digit mobile number.");
      return;
    }

    if (!captchaAnswer.trim() || captchaAnswer.trim().length < 5) {
      setErrorMsg("Enter the 5-character security CAPTCHA code.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          countryCode,
          mobileNumber: cleanedPhone,
          captchaToken,
          captchaAnswer: captchaAnswer.trim(),
          honeypot,
          channel: "web",
        }),
      });

      const data = await res.json();
      if (data.newCaptcha?.captchaToken && data.newCaptcha?.svgDataUrl) {
        setCaptchaToken(data.newCaptcha.captchaToken);
        setCaptchaSvg(data.newCaptcha.svgDataUrl);
        setCaptchaAnswer("");
      }

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Could not send code. Try again.");
        setIsSubmitting(false);
        return;
      }

      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setOtpStep("verify_otp");
      setResendTimer(Number(data.cooldownSec || 30));
      setStatusNotice(`6-digit code sent to +${countryCode} ${cleanedPhone}`);
      setIsSubmitting(false);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 80);
    } catch {
      setErrorMsg("No internet connection.");
      setIsSubmitting(false);
    }
  };

  const verifyOtpCode = async (codeOverride?: string) => {
    const code = (codeOverride ?? otpDigits.join("")).replace(/\D/g, "");
    if (code.length < OTP_LENGTH) {
      setErrorMsg(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const cleanedPhone = mobileNumber.replace(/\D/g, "");
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          countryCode,
          mobileNumber: cleanedPhone,
          code,
          channel: "web",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Wrong verification code.");
        setIsSubmitting(false);
        return;
      }

      await signInWithPhoneVerified(
        data.firebaseEmail,
        data.firebasePassword,
        data.formattedDisplay,
        cleanedPhone
      );
      router.push("/");
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Phone verification failed."
      );
      setIsSubmitting(false);
    }
  };

  const handleOtpDigitChange = (idx: number, rawVal: string) => {
    const digit = rawVal.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[idx] = digit;
    setOtpDigits(next);
    setErrorMsg(null);

    if (digit && idx < OTP_LENGTH - 1) {
      otpInputRefs.current[idx + 1]?.focus();
    }

    if (digit && idx === OTP_LENGTH - 1 && next.every((d) => d.length === 1)) {
      void verifyOtpCode(next.join(""));
    }
  };

  const handleOtpKeyDown = (
    idx: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otpDigits[idx] && idx > 0) {
      otpInputRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH)
      .fill("")
      .map((_, i) => pasted[i] || "");
    setOtpDigits(next);
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    otpInputRefs.current[focusIdx]?.focus();
    if (pasted.length === OTP_LENGTH) {
      void verifyOtpCode(pasted);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-4 lg:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Section: Pitch & Onboarding Illustration */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6 lg:space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              Objective speech assessment, made{" "}
              <span className="text-clinical-cyan">simple.</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-500 max-w-xl leading-relaxed">
              Record standardized vocal tasks, analyze motor speech features,
              and track clinical progress over time.
            </p>
          </div>

          <div className="relative w-full max-w-2xl aspect-[16/9] overflow-hidden rounded-3xl bg-white/60 border border-slate-100/80 shadow-soft-sm p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/signup-illustration.png"
              alt="DysarthriaNet Clinical Speech AI Signup"
              className="w-full h-full object-contain rounded-2xl"
            />
          </div>
        </div>

        {/* Right Section: Sign Up / Sign In Form Card */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          <div className="w-full max-w-md bg-white rounded-[32px] p-8 sm:p-10 border border-slate-100 shadow-2xl space-y-5">
            {/* Top Shield Badge */}
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-[#14171A] text-vitality mx-auto flex items-center justify-center mb-4 shadow-soft-md">
                <Shield className="h-6 w-6 text-vitality" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {mode === "signup"
                  ? "Sign Up for DysarthriaNet"
                  : "Sign In to DysarthriaNet"}
              </h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {mode === "signup"
                  ? "Create your account with Phone, Google, or Email."
                  : "Sign in with Phone, Google, or Email."}
              </p>
            </div>

            {/* Error Notice */}
            {errorMsg && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Status Notice */}
            {statusNotice && !errorMsg && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{statusNotice}</span>
              </div>
            )}

            {/* Google OAuth Button */}
            <button
              onClick={handleGoogleSignIn}
              type="button"
              className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-3 px-4 rounded-full text-xs shadow-soft-sm hover:shadow-soft-md transition-all hover:scale-[1.01] cursor-pointer"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Auth Method Switcher (Phone OTP vs Email) */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-full border border-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod("phone");
                  setErrorMsg(null);
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  authMethod === "phone"
                    ? "bg-[#14171A] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Continue with Phone</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMethod("email");
                  setErrorMsg(null);
                  setStatusNotice(null);
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  authMethod === "email"
                    ? "bg-[#14171A] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Email</span>
              </button>
            </div>

            {/* PHONE OTP FLOW (Descope + CAPTCHA Anti-DDoS) */}
            {authMethod === "phone" ? (
              otpStep === "input_phone" ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  {/* Hidden Honeypot Input for Bot Prevention */}
                  <input
                    type="text"
                    name="website_url"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    className="hidden"
                    aria-hidden="true"
                  />

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Mobile Number
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-3.5 py-3 bg-slate-100 border border-slate-200 rounded-full text-xs font-bold text-slate-700 shrink-0">
                        <Phone className="h-3.5 w-3.5 text-slate-500" />
                        <span>+91</span>
                      </div>
                      <div className="relative flex-1">
                        <Smartphone className="h-4 w-4 text-slate-400 absolute left-4 top-3.5" />
                        <input
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          required
                          maxLength={10}
                          value={mobileNumber}
                          onChange={(e) =>
                            setMobileNumber(
                              e.target.value.replace(/\D/g, "").slice(0, 10)
                            )
                          }
                          placeholder="XXXXX XXXXX"
                          className="w-full pl-11 pr-4 py-3 bg-slate-50/70 border border-slate-200 rounded-full text-xs font-semibold tracking-wide text-slate-900 placeholder-slate-400 focus:outline-none focus:border-clinical-cyan focus:bg-white transition-all shadow-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Anti-DDoS Security CAPTCHA */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        <ShieldCheck className="h-3.5 w-3.5 text-clinical-cyan" />
                        <span>Security Verification</span>
                      </span>
                      <button
                        type="button"
                        onClick={loadCaptcha}
                        disabled={captchaLoading}
                        title="Refresh CAPTCHA"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${
                            captchaLoading ? "animate-spin" : ""
                          }`}
                        />
                        <span>Refresh</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="h-11 w-[150px] rounded-xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center shrink-0">
                        {captchaSvg ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={captchaSvg}
                            alt="Security CAPTCHA"
                            className="h-full w-full object-cover select-none"
                            draggable={false}
                          />
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">
                            Loading...
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={5}
                        value={captchaAnswer}
                        onChange={(e) =>
                          setCaptchaAnswer(
                            e.target.value
                              .replace(/[^a-zA-Z0-9]/g, "")
                              .toUpperCase()
                              .slice(0, 5)
                          )
                        }
                        placeholder="Enter code"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase tracking-widest text-slate-900 placeholder-slate-400 focus:outline-none focus:border-clinical-cyan text-center"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      mobileNumber.length < 10 ||
                      captchaAnswer.length < 5
                    }
                    className="w-full mt-2 bg-[#14171A] hover:bg-black text-white font-bold py-3.5 px-6 rounded-full text-xs shadow-soft-md hover:shadow-soft-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                  >
                    <span>{isSubmitting ? "Sending Code..." : "Send Code"}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200/80">
                    <div className="text-xs text-slate-600">
                      Code sent to{" "}
                      <span className="font-bold text-slate-900">
                        +{countryCode} {mobileNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep("input_phone");
                        setErrorMsg(null);
                        setStatusNotice(null);
                        loadCaptcha();
                      }}
                      className="text-[11px] font-bold text-clinical-cyan hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
                      Enter 6-Digit Code
                    </label>
                    <div className="flex items-center justify-center gap-2">
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => {
                            otpInputRefs.current[idx] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          autoComplete={idx === 0 ? "one-time-code" : "off"}
                          maxLength={1}
                          value={digit}
                          onChange={(e) =>
                            handleOtpDigitChange(idx, e.target.value)
                          }
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          onPaste={handleOtpPaste}
                          className="w-11 h-12 text-center text-base font-black text-slate-900 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-clinical-cyan focus:bg-white transition-all shadow-sm"
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => verifyOtpCode()}
                    disabled={
                      isSubmitting || otpDigits.some((d) => d.length === 0)
                    }
                    className="w-full bg-[#14171A] hover:bg-black text-white font-bold py-3.5 px-6 rounded-full text-xs shadow-soft-md hover:shadow-soft-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                  >
                    <span>{isSubmitting ? "Verifying..." : "Verify"}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>

                  <div className="flex items-center justify-center pt-1">
                    {resendTimer > 0 ? (
                      <span className="text-xs text-slate-400 font-medium">
                        Resend code in{" "}
                        <span className="font-bold text-slate-600">
                          {resendTimer}s
                        </span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => {
                          setOtpStep("input_phone");
                          loadCaptcha();
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-clinical-cyan hover:underline cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Resend Code</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            ) : (
              /* EMAIL & PASSWORD FLOW */
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="h-4 w-4 text-slate-400 absolute left-4 top-3.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@hospital.org"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/70 border border-slate-200 rounded-full text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-clinical-cyan focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-slate-400 absolute left-4 top-3.5" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        mode === "signup"
                          ? "Create a strong password"
                          : "Enter your password"
                      }
                      className="w-full pl-11 pr-11 py-3 bg-slate-50/70 border border-slate-200 rounded-full text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-clinical-cyan focus:bg-white transition-all shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 bg-[#14171A] hover:bg-black text-white font-bold py-3.5 px-6 rounded-full text-xs shadow-soft-md hover:shadow-soft-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                >
                  <span>
                    {mode === "signup" ? "Create Account" : "Sign In"}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>
            )}

            {/* Bottom Switch Link */}
            <div className="pt-1 text-center text-xs text-slate-500">
              {mode === "signup" ? (
                <span>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setErrorMsg(null);
                    }}
                    className="font-bold text-clinical-cyan hover:underline"
                  >
                    Sign in
                  </button>
                </span>
              ) : (
                <span>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setErrorMsg(null);
                    }}
                    className="font-bold text-clinical-cyan hover:underline"
                  >
                    Sign up
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
