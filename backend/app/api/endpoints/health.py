"""Health check and service status endpoint."""

from fastapi import APIRouter
from backend.app.schemas.screening import HealthResponse
from backend.app.services.inference_service import get_model_service
from backend.app.core.config import settings

router = APIRouter()


@router.get("/health", response_model=HealthResponse, summary="Service & Model Health")
async def health_check():
    """Verify backend status, device acceleration, and model bundle availability."""
    service = get_model_service()
    return HealthResponse(
        status="HEALTHY",
        version=settings.VERSION,
        project=settings.PROJECT_NAME,
        model_loaded=bool(service.bundle is not None),
        device=service.device,
        supported_tasks=[
            "binary_dysarthria_screening",
            "cost_sensitive_clinical_severity",
            "multi_utterance_session_consensus",
        ],
    )
