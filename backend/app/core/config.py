"""Application configuration and environment settings."""

import os
from pathlib import Path
from typing import List

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings:
    PROJECT_NAME: str = "DysarthriaNet-XC Clinical Diagnostic API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Model bundle location
    MODEL_BUNDLE_PATH: Path = BACKEND_ROOT / "models" / "dysarthrianet_unified_v1.joblib"
    
    # CORS Origins (Allow web frontend and Android emulator)
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://10.0.2.2",       # Android Emulator loopback
        "http://10.0.2.2:8000",
        "*",                     # Development permissive
    ]
    
    # Audio validation limits
    MIN_AUDIO_DURATION_SEC: float = 0.4
    MAX_AUDIO_DURATION_SEC: float = 90.0
    MAX_FILE_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB
    TARGET_SAMPLE_RATE: int = 16000


settings = Settings()
