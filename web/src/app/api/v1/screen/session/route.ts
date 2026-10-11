import { NextRequest, NextResponse } from "next/server";
import {
  CLOUD_API_URL,
  screenClipViaGradioSpace,
  aggregateClipsToSessionResponse,
  ClipDiagnosticResponse,
} from "@/lib/api-client";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const rawFiles = formData.getAll("files");
    const taskLabelsRaw = formData.get("task_labels");
    const labels =
      typeof taskLabelsRaw === "string"
        ? taskLabelsRaw.split(",").map((s) => s.trim())
        : [];

    const files = rawFiles.filter((f): f is File => typeof f !== "string");
    if (files.length === 0) {
      return NextResponse.json(
        { detail: "At least one audio clip is required for session screening." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 1. Try direct FastAPI /api/v1/screen/session on HuggingFace Space
    try {
      const upstreamForm = new FormData();
      files.forEach((f, idx) => {
        const fname = (f as File).name || `clip_${idx + 1}.wav`;
        upstreamForm.append("files", f, fname);
      });
      if (typeof taskLabelsRaw === "string") {
        upstreamForm.append("task_labels", taskLabelsRaw);
      }

      const res = await fetch(`${CLOUD_API_URL}/api/v1/screen/session`, {
        method: "POST",
        body: upstreamForm,
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data, { headers: CORS_HEADERS });
      }
    } catch {
      // Fallback to Gradio 6 ZeroGPU below
    }

    // 2. Screen each clip via Gradio 6 ZeroGPU and aggregate into SessionDiagnosticResponse
    const clipResults: {
      taskName: string;
      filename: string;
      clip: ClipDiagnosticResponse;
    }[] = [];

    for (let idx = 0; idx < files.length; idx++) {
      const f = files[idx];
      const fname = (f as File).name || `clip_${idx + 1}.wav`;
      const taskName = labels[idx] || `task_${idx + 1}`;
      const clip = await screenClipViaGradioSpace(CLOUD_API_URL, f, fname);
      clipResults.push({ taskName, filename: fname, clip });
    }

    const sessionResult = aggregateClipsToSessionResponse(clipResults);
    return NextResponse.json(sessionResult, { headers: CORS_HEADERS });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to screen clinical session.";
    return NextResponse.json(
      { detail: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
