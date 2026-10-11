"use client";

/**
 * Facebook sign-in bridge for the Sonora Android app.
 *
 * The Android app opens this page in the phone's browser. We send the user to
 * Facebook's OAuth dialog, Facebook redirects back here with an access token in
 * the URL hash, and we hand that token back to the app through the
 * sonora://auth deep link. The app then exchanges it for a Firebase session.
 *
 * This exact URL must be listed under Meta app > Facebook Login > Settings >
 * Valid OAuth Redirect URIs.
 */

import React, { useEffect, useState } from "react";
import { ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { FACEBOOK_APP_ID } from "@/lib/firebase";
import { FacebookIcon } from "@/components/icons/BrandIcons";

type Stage = "redirecting" | "ready" | "error";

function buildAppLink(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `intent://auth?${qs}#Intent;scheme=sonora;package=ai.sonora.speech;end`;
}

export default function FacebookMobileBridge() {
  const [stage, setStage] = useState<Stage>("redirecting");
  const [appLink, setAppLink] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const token = hash.get("access_token");
    const fbError =
      hash.get("error_description") ||
      query.get("error_description") ||
      hash.get("error") ||
      query.get("error");

    if (token) {
      const link = buildAppLink({ provider: "facebook", access_token: token });
      setAppLink(link);
      setStage("ready");
      // Clear the token from the address bar, then try to jump back automatically.
      window.history.replaceState(null, "", window.location.pathname);
      window.location.href = link;
      return;
    }

    if (fbError) {
      setError(fbError.replace(/\+/g, " "));
      setAppLink(buildAppLink({ provider: "facebook", error: fbError }));
      setStage("error");
      return;
    }

    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    const dialog = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    dialog.searchParams.set("client_id", FACEBOOK_APP_ID);
    dialog.searchParams.set("redirect_uri", redirectUri);
    dialog.searchParams.set("response_type", "token");
    dialog.searchParams.set("scope", "email,public_profile");
    dialog.searchParams.set("state", Math.random().toString(36).slice(2));
    window.location.replace(dialog.toString());
  }, []);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-100 shadow-soft-sm p-6 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-[#1877F2] text-white flex items-center justify-center">
          <FacebookIcon className="h-6 w-6" />
        </div>

        {stage === "redirecting" && (
          <>
            <h1 className="text-lg font-extrabold text-slate-900">Opening Facebook</h1>
            <p className="text-sm text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> One moment
            </p>
          </>
        )}

        {stage === "ready" && (
          <>
            <h1 className="text-lg font-extrabold text-slate-900">Signed in with Facebook</h1>
            <p className="text-sm text-slate-500">Tap below to go back to the Sonora app.</p>
            <a
              href={appLink}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#14171A] text-white font-bold py-3 rounded-full text-sm"
            >
              <span>Return to Sonora</span>
              <ArrowRight className="h-4 w-4" />
            </a>
          </>
        )}

        {stage === "error" && (
          <>
            <h1 className="text-lg font-extrabold text-slate-900">Facebook sign-in failed</h1>
            <p className="text-sm text-red-600 flex items-start justify-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </p>
            <a
              href={appLink}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#14171A] text-white font-bold py-3 rounded-full text-sm"
            >
              <span>Back to Sonora</span>
            </a>
          </>
        )}
      </div>
    </div>
  );
}
