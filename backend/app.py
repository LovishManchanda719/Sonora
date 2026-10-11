"""
Hugging Face Spaces Entrypoint for DysarthriaNet-XC.
Mounts FastAPI REST API alongside a clean Gradio test playground.
- REST API: /api/v1/screen/clip, /api/v1/screen/session, /api/v1/health, /docs
- Web Playground: Interactive microphone recording and clinical report viewer
"""

import sys
from pathlib import Path
import types

# 1. ZeroGPU initialization MUST be at the very top before torch/transformers
try:
    import spaces
except ImportError:
    class _MockSpaces:
        @staticmethod
        def GPU(fn=None, **kwargs):
            if fn is not None and callable(fn):
                return fn
            return lambda f: f
    spaces = _MockSpaces()

# Add backend directory and project root to sys.path
_CUR_DIR = Path(__file__).resolve().parent
_ROOT_DIR = _CUR_DIR.parent
for p in [str(_CUR_DIR), str(_ROOT_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Handle flat deployment layout in Hugging Face Spaces where /app is root
# 1. Register 'backend' package
backend_mod = types.ModuleType("backend")
backend_mod.__path__ = [str(_CUR_DIR)]
sys.modules["backend"] = backend_mod

# 2. Register 'backend.app' package pointing directly to the app/ directory
# This prevents /app/app.py from colliding with the app/ directory package
app_dir = _CUR_DIR / "app"
backend_app_mod = types.ModuleType("backend.app")
backend_app_mod.__path__ = [str(app_dir)]
sys.modules["backend.app"] = backend_app_mod

import os
import io
import time
import gradio as gr
import numpy as np
import soundfile as sf

from backend.app.services.inference_service import get_model_service
from backend.app.services.audio_service import load_and_preprocess_audio, AudioValidationError


@spaces.GPU(duration=60)
def gradio_analyze_speech(audio_file_path):
    """Callback for the Gradio interactive playground decorated with ZeroGPU."""
    if not audio_file_path:
        return {"error": "Please record or upload an audio sample first."}

    try:
        with open(audio_file_path, "rb") as f:
            content = f.read()
        filename = Path(audio_file_path).name
        waveform, quality = load_and_preprocess_audio(content, filename)
    except AudioValidationError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": f"Audio processing failed: {str(e)}"}

    service = get_model_service()
    pred = service.predict_from_waveform(
        waveform,
        task_name=filename,
        input_rms_db=quality.get("input_rms_db"),
    )

    return {
        "Diagnosis": "Dysarthria Detected" if pred["is_dysarthric"] else "Speech Within Normal Limits",
        "Probability": f"{pred['dysarthria_probability'] * 100:.1f}%",
        "Confidence Rating": pred["confidence_level"],
        "Predicted Severity": pred["predicted_severity"].capitalize(),
        "Severity Probabilities": {
            k: f"{v * 100:.1f}%" for k, v in pred["severity_probabilities"].items()
        },
        "Clinical Interpretation": pred["clinical_note"],
        "Audio Quality": quality,
    }


# Build Gradio Playground
custom_css = """
.container { max-width: 900px; margin: auto; padding-top: 20px; }
.header { text-align: center; margin-bottom: 25px; }
"""

with gr.Blocks(title="DysarthriaNet-XC API & Playground", css=custom_css, theme=gr.themes.Soft()) as demo:
    with gr.Column(elem_classes=["container"]):
        gr.Markdown(
            """
            # DysarthriaNet-XC Clinical Diagnostic Engine
            **Multi-Corpus Cross-Domain Foundation Model for Automated Motor Speech Assessment**
            
            * REST API: Access interactive Swagger documentation at **[/docs](/docs)**
            * Live Endpoints: `/api/v1/screen/clip`, `/api/v1/screen/session`, `/api/v1/health`
            ---
            """
        )

        with gr.Row():
            with gr.Column(scale=1):
                audio_input = gr.Audio(
                    sources=["microphone", "upload"],
                    type="filepath",
                    label="Patient Voice Sample (Sustained Vowel /a/, DDK /pa-ta-ka/, or Sentence)",
                )
                analyze_btn = gr.Button("Run Diagnostic Screening", variant="primary")
            with gr.Column(scale=1):
                result_json = gr.JSON(label="Clinical Diagnostic Report")

        analyze_btn.click(
            fn=gradio_analyze_speech,
            inputs=[audio_input],
            outputs=[result_json],
            api_name="predict",
        )

# Configure CORS and mount REST endpoints onto Gradio's FastAPI app
# In Gradio 5/6, demo.launch() calls App.create_app() again and replaces demo.app,
# so we hook App.create_app to ensure custom FastAPI routes are mounted on the active server_app.
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api.router import api_router


def _mount_custom_rest_api(fastapi_app):
    if getattr(fastapi_app, "_dysarthrianet_mounted", False):
        return fastapi_app

    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    existing_count = len(fastapi_app.router.routes)
    fastapi_app.include_router(api_router, prefix="/api/v1")

    @fastapi_app.get("/api/v1/health", tags=["System Health"])
    @fastapi_app.get("/health", tags=["System Health"])
    async def root_health():
        return {
            "status": "HEALTHY",
            "version": "1.0.0",
            "device": "cuda",
            "model_loaded": True,
            "project": "DysarthriaNet-XC Clinical Diagnostic API",
        }

    # Place custom REST API routes before Gradio's SPA catch-all route
    new_routes = fastapi_app.router.routes[existing_count:]
    fastapi_app.router.routes = new_routes + fastapi_app.router.routes[:existing_count]
    fastapi_app._dysarthrianet_mounted = True
    return fastapi_app


# Mounting the REST routes is best-effort: if a Gradio version changes these internals,
# the Space must still start and keep serving the Gradio /predict API.
try:
    _orig_create_app = gr.routes.App.create_app

    def _patched_create_app(*args, **kwargs):
        created_app = _orig_create_app(*args, **kwargs)
        try:
            return _mount_custom_rest_api(created_app)
        except Exception as mount_err:  # pragma: no cover
            print(f"[DysarthriaNet] REST mount skipped: {mount_err}")
            return created_app

    gr.routes.App.create_app = staticmethod(_patched_create_app)
except Exception as patch_err:  # pragma: no cover
    print(f"[DysarthriaNet] Could not patch Gradio App.create_app: {patch_err}")

try:
    if getattr(demo, "app", None) is not None:
        _mount_custom_rest_api(demo.app)
except Exception as early_err:  # pragma: no cover
    print(f"[DysarthriaNet] Early REST mount skipped: {early_err}")

if __name__ == "__main__":
    try:
        demo.launch(server_name="0.0.0.0", server_port=7860, ssr_mode=False, strict_cors=False)
    except TypeError:
        # Older Gradio without strict_cors / ssr_mode keyword arguments
        demo.launch(server_name="0.0.0.0", server_port=7860)

