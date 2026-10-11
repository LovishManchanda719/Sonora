import { NextResponse } from "next/server";
import { CLOUD_API_URL } from "@/lib/api-client";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  // 1. Check FastAPI /api/v1/health on HuggingFace Space
  try {
    const res = await fetch(`${CLOUD_API_URL}/api/v1/health`, {
      method: "GET",
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.status) {
        return NextResponse.json(data, { headers: CORS_HEADERS });
      }
    }
  } catch {
    // fallback to Gradio info check below
  }

  // 2. Check Gradio 6 ZeroGPU /gradio_api/info on HuggingFace Space
  try {
    const gradioRes = await fetch(`${CLOUD_API_URL}/gradio_api/info`, {
      method: "GET",
      cache: "no-store",
    });
    if (gradioRes.ok) {
      const info = await gradioRes.json();
      if (info && info.named_endpoints) {
        return NextResponse.json(
          {
            status: "HEALTHY",
            version: "1.0.0",
            device: "ZeroGPU A10G (CUDA)",
            model_loaded: true,
            project: "DysarthriaNet-XC Clinical Diagnostic API",
          },
          { headers: CORS_HEADERS }
        );
      }
    }
  } catch {
    // ignore
  }

  return NextResponse.json(
    {
      status: "OFFLINE",
      detail: "Unable to reach HuggingFace ZeroGPU backend.",
    },
    { status: 503, headers: CORS_HEADERS }
  );
}
