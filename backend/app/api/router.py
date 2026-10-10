"""Central API v1 router mounting all diagnostic and operational endpoints."""

from fastapi import APIRouter
from backend.app.api.endpoints import health, screening

api_router = APIRouter()

api_router.include_router(health.router, tags=["System Health"])
api_router.include_router(screening.router, prefix="/screen", tags=["Clinical Speech Screening"])
