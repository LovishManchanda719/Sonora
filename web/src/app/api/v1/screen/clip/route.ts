import { NextRequest, NextResponse } from "next/server";
import { CLOUD_API_URL, screenClipViaGradioSpace } from "@/lib/api-client";

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
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { detail: "Audio file is required." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const filename = (file as File).name || "recording.wav";

    // 1. Try direct FastAPI /api/v1/screen/clip on HuggingFace Space
    try {
      const upstreamForm = new FormData();
      upstreamForm.append("file", file, filename);
      const taskName = formData.get("task_name");
      if (typeof taskName === "string") {
        upstreamForm.append("task_name", taskName);
      }

      const res = await fetch(`${CLOUD_API_URL}/api/v1/screen/clip`, {
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

    // 2. Run via Gradio 6 ZeroGPU (/gradio_api/upload + /gradio_api/call/predict)
    const clipResult = await screenClipViaGradioSpace(
      CLOUD_API_URL,
      file,
      filename
    );
    return NextResponse.json(clipResult, { headers: CORS_HEADERS });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to screen audio clip.";
    return NextResponse.json(
      { detail: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
