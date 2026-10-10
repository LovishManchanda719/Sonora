"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Shield,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function AuthPage() {
  const router = useRouter();
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in, redirect safely after render
  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

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

  return (
    <div className="w-full max-w-7xl mx-auto py-4 lg:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* Left Section: Pitch & Onboarding Illustration */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6 lg:space-y-8">
          
          {/* Headline & Description */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              Objective speech assessment, made{" "}
              <span className="text-clinical-cyan">simple.</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-500 max-w-xl leading-relaxed">
              Record standardized vocal tasks, analyze motor speech features, and track clinical progress over time.
            </p>
          </div>

          {/* Onboarding Clinical Vector Illustration */}
          <div className="relative w-full max-w-2xl aspect-[16/9] overflow-hidden rounded-3xl bg-white/60 border border-slate-100/80 shadow-soft-sm p-3">
            <img
              src="/images/signup-illustration.png"
              alt="DysarthriaNet Clinical Speech AI Signup"
              className="w-full h-full object-contain rounded-2xl"
            />
          </div>

        </div>

        {/* Right Section: Sign Up / Sign In Form Card */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          <div className="w-full max-w-md bg-white rounded-[32px] p-8 sm:p-10 border border-slate-100 shadow-2xl space-y-6">
            
            {/* Top Shield Badge */}
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-[#14171A] text-vitality mx-auto flex items-center justify-center mb-4 shadow-soft-md">
                <Shield className="h-6 w-6 text-vitality" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {mode === "signup" ? "Sign Up for DysarthriaNet" : "Sign In to DysarthriaNet"}
              </h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {mode === "signup"
                  ? "Create your account to access speech assessment tools and clinical reports."
                  : "Welcome back! Enter your clinical credentials to continue."}
              </p>
            </div>

            {/* Error Notice */}
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Google OAuth Button */}
            <button
              onClick={handleGoogleSignIn}
              type="button"
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-3 px-5 rounded-full text-xs shadow-soft-sm hover:shadow-soft-md transition-all hover:scale-[1.01]"
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

            {/* Divider */}
            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-slate-200"></div>
              <span className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {mode === "signup" ? "Or sign up with email" : "Or sign in with email"}
              </span>
              <div className="flex-1 border-t border-slate-200"></div>
            </div>

            {/* Form */}
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
                    placeholder={mode === "signup" ? "Create a strong password" : "Enter your password"}
                    className="w-full pl-11 pr-11 py-3 bg-slate-50/70 border border-slate-200 rounded-full text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-clinical-cyan focus:bg-white transition-all shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-[#14171A] hover:bg-black text-white font-bold py-3.5 px-6 rounded-full text-xs shadow-soft-md hover:shadow-soft-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
              >
                <span>{mode === "signup" ? "Create Account" : "Sign In"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>

            {/* Bottom Switch Link */}
            <div className="pt-2 text-center text-xs text-slate-500">
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
