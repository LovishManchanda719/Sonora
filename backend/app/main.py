"""
DysarthriaNet-XC FastAPI Application Entrypoint.
Provides production REST endpoints for clinical speech screening, severity estimation,
and multi-utterance session consensus aggregation with rate-limiting and security headers.
"""

import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from backend.app.core.config import settings
from backend.app.api.router import api_router
from backend.app.services.inference_service import get_model_service

# Sliding-window IP rate limiter to prevent DoS / automated abuse
_RATE_WINDOW_SEC = 60.0
_MAX_REQUESTS_PER_WINDOW = 60
_ip_request_log: dict[str, deque[float]] = defaultdict(deque)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up production model and transformer backbone during startup."""
    print("Initializing DysarthriaNet-XC service and loading production weights...")
    svc = get_model_service()
    svc._ensure_wav2vec2_loaded()
    yield
    print("DysarthriaNet-XC service shutting down gracefully.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Production Clinical Speech Screening API based on Wav2Vec 2.0 foundation representations "
        "and multi-corpus cross-domain generalization (TORGO, EasyCall, Italian Parkinson's)."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.middleware("http")
async def security_and_rate_limit_middleware(request: Request, call_next):
    """Enforces sliding-window rate limits, payload size bounds, and HTTP security & CORS headers."""
    origin = request.headers.get("origin") or "*"
    cors_headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
    }

    if request.method == "OPTIONS":
        return JSONResponse(status_code=200, content={}, headers=cors_headers)

    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )

    # Check Content-Length header early to block oversized DoS payloads
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.MAX_FILE_SIZE_BYTES * 6:
        return JSONResponse(
            status_code=413,
            content={"detail": "Request payload exceeds maximum permitted size."},
            headers=cors_headers,
        )

    now = time.time()
    q = _ip_request_log[client_ip]
    while q and now - q[0] > _RATE_WINDOW_SEC:
        q.popleft()

    if len(q) >= _MAX_REQUESTS_PER_WINDOW:
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Rate limit exceeded. Please wait before submitting additional requests."
            },
            headers=cors_headers,
        )
    q.append(now)

    try:
        response = await call_next(request)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal inference error: {str(exc)}"},
            headers=cors_headers,
        )

    for k, v in cors_headers.items():
        if k not in response.headers:
            response.headers[k] = v
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Mount API Router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", include_in_schema=False)
async def root_redirect():
    """Redirect root traffic to interactive Swagger documentation."""
    return RedirectResponse(url="/docs")


@app.get("/health", tags=["System Health"])
async def root_health():
    """Lightweight ping endpoint for container orchestrators."""
    return {"status": "HEALTHY", "version": settings.VERSION}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
