"""DysarthriaNet-XC: Core Library Package."""

from src.project_paths import (
    PROJECT_ROOT,
    DATA_DIR,
    RESULTS_DIR,
    RAW_DIR,
    METADATA_DIR,
    FEATURES_DIR,
    EMBEDDINGS_DIR,
    FIGURES_DIR,
    TABLES_DIR,
    get_layer_embedding_path,
    resolve_project_path,
)
from src.data_loading import (
    load_and_preprocess_audio,
    get_audio_info,
    load_severity_data,
)
from src.feature_extraction import (
    extract_mfcc_features,
    extract_egemaps_features,
)
from src.embeddings import (
    get_wav2vec2_extractor,
    extract_wav2vec2_embedding_single,
    batch_extract_wav2vec2_embeddings,
)
from src.models import (
    PyTorchMLPClassifier,
    SoftVotingEnsemble,
    build_multimodal_features,
    build_trimodal_features,
    get_champion_detector_pipeline,
    predict_patient_session,
)
from src.evaluation import (
    evaluate_speaker_independent,
)
from src.coral import (
    coral_align,
)

__all__ = [
    "PROJECT_ROOT",
    "DATA_DIR",
    "RESULTS_DIR",
    "RAW_DIR",
    "METADATA_DIR",
    "FEATURES_DIR",
    "EMBEDDINGS_DIR",
    "FIGURES_DIR",
    "TABLES_DIR",
    "get_layer_embedding_path",
    "resolve_project_path",
    "load_and_preprocess_audio",
    "get_audio_info",
    "load_severity_data",
    "extract_mfcc_features",
    "extract_egemaps_features",
    "get_wav2vec2_extractor",
    "extract_wav2vec2_embedding_single",
    "batch_extract_wav2vec2_embeddings",
    "PyTorchMLPClassifier",
    "SoftVotingEnsemble",
    "build_multimodal_features",
    "build_trimodal_features",
    "get_champion_detector_pipeline",
    "predict_patient_session",
    "evaluate_speaker_independent",
    "coral_align",
]
