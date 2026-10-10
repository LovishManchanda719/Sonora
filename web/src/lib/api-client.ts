/**
 * API client communicating with DysarthriaNet-XC Cloud FastAPI service.
 */

const LOCAL_API_URL = "http://127.0.0.1:8000";
const CLOUD_API_URL = "https://lumosmaximus-dysarthrianet-api.hf.space";

let activeBaseUrl = process.env.NEXT_PUBLIC_API_URL || "";

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

export async function checkBackendHealth(): Promise<{ status: string; device: string; version: string }> {
  const candidates = isLocalHost()
    ? [LOCAL_API_URL, CLOUD_API_URL]
    : [CLOUD_API_URL, LOCAL_API_URL];

  for (const base of candidates) {
    for (const path of ["/api/v1/health", "/health"]) {
      try {
        const res = await fetch(`${base}${path}`, { method: "GET" });
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("application/json")) {
          const data = await res.json();
          if (data && data.status) {
            activeBaseUrl = base;
            return data;
          }
        }
      } catch {
        // try next endpoint/candidate
      }
    }
  }

  throw new Error("Unable to establish connection with AI backend service.");
}

export async function screenSingleClip(audioBlobOrFile: Blob | File, filename = "audio.wav"): Promise<ClipDiagnosticResponse> {
  const baseUrl = getApiBaseUrl();
  const formData = new FormData();
  formData.append("file", audioBlobOrFile, filename);

  try {
    const res = await fetch(`${baseUrl}/api/v1/screen/clip`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.detail || `Server error: ${res.statusText}`);
    }

    return await res.json();
  } catch (err: unknown) {
    if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
      throw new Error(`Unable to connect to the AI backend service at ${baseUrl}. Please ensure the FastAPI backend is running.`);
    }
    throw err;
  }
}

export async function screenSession(
  audioClips: { blob: Blob | File; filename: string; taskName: string }[]
): Promise<SessionDiagnosticResponse> {
  const baseUrl = getApiBaseUrl();
  const formData = new FormData();
  const taskLabels: string[] = [];

  audioClips.forEach((item) => {
    formData.append("files", item.blob, item.filename);
    taskLabels.push(item.taskName);
  });

  formData.append("task_labels", taskLabels.join(","));

  try {
    const res = await fetch(`${baseUrl}/api/v1/screen/session`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.detail || `Server error: ${res.statusText}`);
    }

    return await res.json();
  } catch (err: unknown) {
    if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
      throw new Error(`Unable to connect to the AI backend service at ${baseUrl}. Please ensure the FastAPI backend is running.`);
    }
    throw err;
  }
}

export async function fetchBackendAgentReport(
  report: SessionDiagnosticResponse,
  audienceMode: "health_worker" | "caregiver"
) {
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
  if (!res.ok) {
    throw new Error(`Report agent returned status ${res.status}`);
  }
  return await res.json();
}
