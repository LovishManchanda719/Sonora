/**
 * API client communicating with DysarthriaNet-XC Cloud FastAPI & Gradio ZeroGPU service.
 * Automatically supports both direct FastAPI (/api/v1/*), HuggingFace Gradio 6 (/gradio_api/*),
 * and first-party Vercel proxy routes (/api/v1/*) so screening never fails due to CORS or Brave Shields.
 */

import { buildAgentReportForSession } from "@/lib/report-agent";

const LOCAL_API_URL = "http://127.0.0.1:8000";
export const CLOUD_API_URL = "https://lumosmaximus-dysarthrianet-api.hf.space";

let activeBaseUrl = process.env.NEXT_PUBLIC_API_URL || "";
let activeProtocol: "fastapi" | "gradio" | "proxy" = "fastapi";

export function isLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0";
}

export function getApiBaseUrl(): string {
  if (activeBaseUrl) return activeBaseUrl;
  if (isLocalHost()) {
    return LOCAL_API_URL;
  }
  return CLOUD_API_URL;
}

export const API_BASE_URL = getApiBaseUrl();

export interface ClipDiagnosticResponse {
  clip_id: string;
  filename: string;
  is_dysarthric: boolean;
  dysarthria_probability: number;
  confidence_level: "High" | "Moderate" | "Low";
  predicted_severity: "normal" | "mild" | "moderate" | "severe";
  severity_probabilities: {
    mild: number;
    moderate: number;
    severe: number;
  };
  audio_quality: {
    duration_seconds: number;
    sample_rate: number;
    channels: number;
    peak_amplitude: number;
    is_clipping: boolean;
  };
  clinical_note: string;
}

export interface SessionUtterance {
  utterance_index: number;
  task_name: string;
  filename: string;
  is_dysarthric: boolean;
  dysarthria_probability: number;
  predicted_severity: string;
  severity_probabilities?: {
    mild: number;
    moderate: number;
    severe: number;
  };
  audio_quality?: {
    duration_seconds?: number;
    sample_rate?: number;
    channels?: number;
    peak_amplitude?: number;
    is_clipping?: boolean;
  };
  clinical_note?: string;
}

export interface SessionDiagnosticResponse {
  session_id: string;
  timestamp: string;
  total_utterances: number;
  consensus_diagnosis: string;
  is_dysarthric: boolean;
  consensus_probability: number;
  consensus_severity: string;
  confidence_rating: string;
  dysarthria_vote_ratio: string;
  clinical_recommendation: string;
  utterances: SessionUtterance[];
  agent_reports?: {
    health_worker?: {
      audience_mode: "health_worker" | "caregiver";
      headline: string;
      overview_paragraph: string;
      task_takeaways: string[];
      reassurance_or_protocol_note: string;
      next_steps_paragraph: string;
      generated_by: string;
    };
    caregiver?: {
      audience_mode: "health_worker" | "caregiver";
      headline: string;
      overview_paragraph: string;
      task_takeaways: string[];
      reassurance_or_protocol_note: string;
      next_steps_paragraph: string;
      generated_by: string;
    };
  };
}

function parsePctToRatio(val: unknown, fallback = 0): number {
  if (typeof val === "number") return val > 1 ? val / 100 : val;
  if (typeof val === "string") {
    const num = parseFloat(val.replace("%", "").trim());
    if (!isNaN(num)) return Math.round((num / 100) * 10000) / 10000;
  }
  return fallback;
}

/**
 * On the server (Vercel proxy routes) an optional HF_TOKEN env var is sent so ZeroGPU
 * usage counts against the Space owner's account instead of Vercel's shared IP quota.
 * In the browser no token is ever sent.
 */
function hfAuthHeaders(): Record<string, string> {
  if (typeof window !== "undefined") return {};
  const token = process.env.HF_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function friendlyZeroGpuError(raw: string): string {
  if (/quota|exceeded/i.test(raw)) {
    return "The AI model's free GPU time is used up for now. Please try again later.";
  }
  return raw || "ZeroGPU inference error on HuggingFace Space.";
}

/**
 * Runs a single audio clip through the HuggingFace Gradio 6 ZeroGPU API (/gradio_api/upload + /gradio_api/call/predict)
 */
export async function screenClipViaGradioSpace(
  spaceBaseUrl: string,
  audioBlobOrFile: Blob | File,
  filename = "audio.wav"
): Promise<ClipDiagnosticResponse> {
  // 1. Upload audio blob to Gradio server
  const uploadForm = new FormData();
  uploadForm.append("files", audioBlobOrFile, filename);

  const uploadRes = await fetch(`${spaceBaseUrl}/gradio_api/upload`, {
    method: "POST",
    headers: hfAuthHeaders(),
    body: uploadForm,
  });

  if (!uploadRes.ok) {
    throw new Error(`Failed to upload audio to ZeroGPU Space (HTTP ${uploadRes.status})`);
  }

  const uploadedPaths: string[] = await uploadRes.json();
  const serverFilePath = uploadedPaths?.[0];
  if (!serverFilePath) {
    throw new Error("Gradio upload did not return a valid file path.");
  }

  // 2. Initiate ZeroGPU prediction job
  const callRes = await fetch(`${spaceBaseUrl}/gradio_api/call/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...hfAuthHeaders() },
    body: JSON.stringify({
      data: [
        {
          path: serverFilePath,
          orig_name: filename,
          meta: { _type: "gradio.FileData" },
        },
      ],
    }),
  });

  if (!callRes.ok) {
    throw new Error(`ZeroGPU inference request failed (HTTP ${callRes.status})`);
  }

  const callData = await callRes.json();
  const eventId = callData?.event_id;
  if (!eventId) {
    throw new Error("ZeroGPU inference did not return an event_id.");
  }

  // 3. Read SSE result stream
  const streamRes = await fetch(`${spaceBaseUrl}/gradio_api/call/predict/${eventId}`, {
    method: "GET",
    headers: hfAuthHeaders(),
  });

  if (!streamRes.ok) {
    throw new Error(`ZeroGPU result stream failed (HTTP ${streamRes.status})`);
  }

  const sseText = await streamRes.text();
  const lines = sseText.split(/\r?\n/);
  let currentEvent = "";
  let parsedResult: Record<string, unknown> | null = null;

  for (const line of lines) {
    if (line.startsWith("event:")) {
      currentEvent = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      const rawData = line.slice(5).trim();
      if (currentEvent === "error") {
        let detail = rawData;
        try {
          const parsed = JSON.parse(rawData);
          detail = (parsed && (parsed.title || parsed.error)) || rawData;
        } catch {
          // keep raw text
        }
        throw new Error(friendlyZeroGpuError(detail === "null" ? "" : detail));
      }
      if (currentEvent === "complete" || rawData.startsWith("[")) {
        try {
          const arr = JSON.parse(rawData);
          if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "object") {
            parsedResult = arr[0] as Record<string, unknown>;
          }
        } catch {
          // continue scanning lines
        }
      }
    }
  }

  if (!parsedResult) {
    throw new Error("Unable to parse diagnostic response from ZeroGPU engine.");
  }

  if (typeof parsedResult.error === "string" && parsedResult.error) {
    throw new Error(parsedResult.error);
  }

  const prob = parsePctToRatio(parsedResult["Probability"], 0.15);
  const diagStr = String(parsedResult["Diagnosis"] || "");
  const isDys = diagStr.toLowerCase().includes("dysarthria") || prob >= 0.5;
  const rawSev = String(parsedResult["Predicted Severity"] || "normal").toLowerCase();
  const predictedSeverity = (
    isDys
      ? rawSev === "severe" || rawSev === "moderate" || rawSev === "mild"
        ? rawSev
        : "mild"
      : "normal"
  ) as "normal" | "mild" | "moderate" | "severe";

  const rawConf = String(parsedResult["Confidence Rating"] || "High");
  const confidenceLevel = (
    rawConf === "High" || rawConf === "Moderate" || rawConf === "Low"
      ? rawConf
      : prob >= 0.75 || prob <= 0.25
      ? "High"
      : "Moderate"
  ) as "High" | "Moderate" | "Low";

  const sevProbsObj = (parsedResult["Severity Probabilities"] || {}) as Record<string, unknown>;
  const aqObj = (parsedResult["Audio Quality"] || {}) as Record<string, unknown>;

  return {
    clip_id: `clip_${Math.random().toString(36).slice(2, 12)}`,
    filename,
    is_dysarthric: isDys,
    dysarthria_probability: prob,
    confidence_level: confidenceLevel,
    predicted_severity: predictedSeverity,
    severity_probabilities: {
      mild: parsePctToRatio(sevProbsObj.mild, 0.34),
      moderate: parsePctToRatio(sevProbsObj.moderate, 0.33),
      severe: parsePctToRatio(sevProbsObj.severe, 0.33),
    },
    audio_quality: {
      duration_seconds: Number(aqObj.duration_seconds) || 4.0,
      sample_rate: Number(aqObj.sample_rate) || 16000,
      channels: Number(aqObj.channels) || 1,
      peak_amplitude: Number(aqObj.peak_amplitude) || 0.5,
      is_clipping: Boolean(aqObj.is_clipping),
    },
    clinical_note:
      typeof parsedResult["Clinical Interpretation"] === "string"
        ? parsedResult["Clinical Interpretation"]
        : isDys
        ? "Acoustic markers indicate motor speech deviation warranting clinical follow-up."
        : "Phonatory and articulatory acoustic measures are within normal clinical thresholds.",
  };
}

/**
 * Aggregates per-utterance clip results into a full SessionDiagnosticResponse
 * matching the FastAPI /api/v1/screen/session specification.
 */
export function aggregateClipsToSessionResponse(
  clipResults: { taskName: string; filename: string; clip: ClipDiagnosticResponse }[]
): SessionDiagnosticResponse {
  const utterances: SessionUtterance[] = [];
  let probSum = 0;
  let dysVotes = 0;

  clipResults.forEach((item, idx) => {
    const { taskName, filename, clip } = item;
    probSum += clip.dysarthria_probability;
    if (clip.is_dysarthric) {
      dysVotes += 1;
    }
    utterances.push({
      utterance_index: idx + 1,
      task_name: taskName,
      filename,
      is_dysarthric: clip.is_dysarthric,
      dysarthria_probability: clip.dysarthria_probability,
      predicted_severity: clip.predicted_severity,
      severity_probabilities: clip.severity_probabilities,
      audio_quality: clip.audio_quality,
      clinical_note: clip.clinical_note,
    });
  });

  const total = Math.max(1, utterances.length);
  const avgProb = Math.round((probSum / total) * 10000) / 10000;
  const isConsensusDys = dysVotes >= total / 2.0;

  let consensusSev = "normal";
  let diagStr = "Speech Within Normal Limits";
  let action =
    "Motor speech acoustics within standard physiological boundaries. Re-screen if patient reports speech fatigue or change.";

  if (isConsensusDys) {
    const counts: Record<string, number> = {};
    utterances
      .filter((u) => u.is_dysarthric)
      .forEach((u) => {
        const s = u.predicted_severity || "mild";
        counts[s] = (counts[s] || 0) + 1;
      });
    const topSev = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    consensusSev = topSev || "mild";
    diagStr = "Dysarthria Detected";

    if (consensusSev === "severe") {
      action =
        "Urgent: Immediate Comprehensive Speech-Language Pathology and Neurological Workup Recommended";
    } else if (consensusSev === "moderate") {
      action =
        "Prompt: Referral to Speech-Language Pathologist for Instrumental Acoustic and Aerodynamic Motor Assessment";
    } else {
      action =
        "Mild/Borderline: Longitudinal Speech Acoustic Monitoring and Preventive Clinical Screening";
    }
  }

  const confRating = avgProb >= 0.8 || avgProb <= 0.2 ? "High" : "Moderate";
  const voteRatio = `${dysVotes}/${total}`;
  const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z").replace("T", " ");

  const baseSession: SessionDiagnosticResponse = {
    session_id: `sess_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`,
    timestamp: nowIso,
    total_utterances: total,
    consensus_diagnosis: diagStr,
    is_dysarthric: isConsensusDys,
    consensus_probability: avgProb,
    consensus_severity: consensusSev,
    confidence_rating: confRating,
    dysarthria_vote_ratio: voteRatio,
    clinical_recommendation: action,
    utterances,
  };

  baseSession.agent_reports = {
    health_worker: buildAgentReportForSession(baseSession, "health_worker"),
    caregiver: buildAgentReportForSession(baseSession, "caregiver"),
  };

  return baseSession;
}

export async function checkBackendHealth(): Promise<{ status: string; device: string; version: string }> {
  const candidates = isLocalHost()
    ? [LOCAL_API_URL, CLOUD_API_URL]
    : [CLOUD_API_URL];

  // 1. Check standard FastAPI health endpoints & Gradio 6 info endpoint
  for (const base of candidates) {
    for (const path of ["/api/v1/health", "/health"]) {
      try {
        const res = await fetch(`${base}${path}`, { method: "GET" });
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("application/json")) {
          const data = await res.json();
          if (data && data.status) {
            activeBaseUrl = base;
            activeProtocol = "fastapi";
            return data;
          }
        }
      } catch {
        // try next endpoint
      }
    }

    // Check Gradio 6 ZeroGPU endpoint (/gradio_api/info) on HuggingFace Space
    try {
      const gradioRes = await fetch(`${base}/gradio_api/info`, { method: "GET" });
      if (gradioRes.ok) {
        const info = await gradioRes.json();
        if (info && info.named_endpoints) {
          activeBaseUrl = base;
          activeProtocol = "gradio";
          return {
            status: "HEALTHY",
            device: "ZeroGPU A10G (CUDA)",
            version: "1.0.0",
          };
        }
      }
    } catch {
      // try next candidate
    }
  }

  // 2. First-party same-origin proxy fallback (/api/v1/health on Vercel)
  // Immune to Brave Shields / strict third-party blockers
  if (typeof window !== "undefined") {
    try {
      const proxyRes = await fetch("/api/v1/health", { method: "GET" });
      if (proxyRes.ok) {
        const proxyData = await proxyRes.json();
        if (proxyData && proxyData.status) {
          activeBaseUrl = "";
          activeProtocol = "proxy";
          return proxyData;
        }
      }
    } catch {
      // ignore
    }
  }

  throw new Error("Unable to establish connection with AI backend service.");
}

export async function screenSingleClip(
  audioBlobOrFile: Blob | File,
  filename = "audio.wav"
): Promise<ClipDiagnosticResponse> {
  const baseUrl = getApiBaseUrl();

  // 1. If we already know the server is running Gradio 6 directly, use Gradio protocol
  if (activeProtocol === "gradio") {
    return await screenClipViaGradioSpace(CLOUD_API_URL, audioBlobOrFile, filename);
  }

  // 2. Try FastAPI /api/v1/screen/clip endpoint first
  const formData = new FormData();
  formData.append("file", audioBlobOrFile, filename);

  try {
    const endpoint = activeProtocol === "proxy" ? "/api/v1/screen/clip" : `${baseUrl}/api/v1/screen/clip`;
    const res = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback to Gradio / first-party proxy below
  }

  // 3. Fallback to Gradio 6 ZeroGPU API directly
  try {
    const result = await screenClipViaGradioSpace(CLOUD_API_URL, audioBlobOrFile, filename);
    activeProtocol = "gradio";
    return result;
  } catch {
    // 4. Final fallback: first-party Vercel proxy /api/v1/screen/clip
    const proxyForm = new FormData();
    proxyForm.append("file", audioBlobOrFile, filename);
    const proxyRes = await fetch("/api/v1/screen/clip", {
      method: "POST",
      body: proxyForm,
    });
    if (!proxyRes.ok) {
      const errJson = await proxyRes.json().catch(() => ({}));
      throw new Error(errJson.detail || `Server error: ${proxyRes.statusText}`);
    }
    return await proxyRes.json();
  }
}

export async function screenSession(
  audioClips: { blob: Blob | File; filename: string; taskName: string }[]
): Promise<SessionDiagnosticResponse> {
  const baseUrl = getApiBaseUrl();

  // 1. If Gradio protocol is active, screen each clip via ZeroGPU and aggregate session consensus
  if (activeProtocol === "gradio") {
    try {
      const clipResults: { taskName: string; filename: string; clip: ClipDiagnosticResponse }[] = [];
      for (const item of audioClips) {
        const clip = await screenClipViaGradioSpace(CLOUD_API_URL, item.blob, item.filename);
        clipResults.push({ taskName: item.taskName, filename: item.filename, clip });
      }
      return aggregateClipsToSessionResponse(clipResults);
    } catch {
      // fall through to proxy fallback if direct browser-to-HF upload was blocked by shields
    }
  }

  // 2. Try FastAPI /api/v1/screen/session
  if (activeProtocol !== "gradio") {
    const formData = new FormData();
    const taskLabels: string[] = [];

    audioClips.forEach((item) => {
      formData.append("files", item.blob, item.filename);
      taskLabels.push(item.taskName);
    });
    formData.append("task_labels", taskLabels.join(","));

    try {
      const endpoint =
        activeProtocol === "proxy" ? "/api/v1/screen/session" : `${baseUrl}/api/v1/screen/session`;
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fall through to Gradio / proxy fallback
    }
  }

  // 3. Try Gradio 6 ZeroGPU API directly
  try {
    const clipResults: { taskName: string; filename: string; clip: ClipDiagnosticResponse }[] = [];
    for (const item of audioClips) {
      const clip = await screenClipViaGradioSpace(CLOUD_API_URL, item.blob, item.filename);
      clipResults.push({ taskName: item.taskName, filename: item.filename, clip });
    }
    activeProtocol = "gradio";
    return aggregateClipsToSessionResponse(clipResults);
  } catch {
    // 4. Final fallback: first-party Vercel proxy (/api/v1/screen/session)
    const proxyForm = new FormData();
    const taskLabels: string[] = [];
    audioClips.forEach((item) => {
      proxyForm.append("files", item.blob, item.filename);
      taskLabels.push(item.taskName);
    });
    proxyForm.append("task_labels", taskLabels.join(","));

    const proxyRes = await fetch("/api/v1/screen/session", {
      method: "POST",
      body: proxyForm,
    });

    if (!proxyRes.ok) {
      const errorJson = await proxyRes.json().catch(() => ({}));
      throw new Error(errorJson.detail || `Server error: ${proxyRes.statusText}`);
    }
    activeProtocol = "proxy";
    return await proxyRes.json();
  }
}

export async function fetchBackendAgentReport(
  report: SessionDiagnosticResponse,
  audienceMode: "health_worker" | "caregiver"
) {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/screen/report-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audience_mode: audienceMode,
        is_dysarthric: report.is_dysarthric,
        consensus_probability: report.consensus_probability,
        consensus_severity: report.consensus_severity,
        confidence_rating: report.confidence_rating,
        dysarthria_vote_ratio: report.dysarthria_vote_ratio,
        utterances: report.utterances || [],
      }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fallback to deterministic client agent report
  }
  return buildAgentReportForSession(report, audienceMode);
}
