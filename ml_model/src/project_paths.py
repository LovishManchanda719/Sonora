"""Central, portable paths for project files."""

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
RESULTS_DIR = PROJECT_ROOT / "results"
MODELS_DIR = PROJECT_ROOT / "models"

RAW_DIR = DATA_DIR / "raw"
METADATA_DIR = DATA_DIR / "metadata"
FEATURES_DIR = DATA_DIR / "features"
EMBEDDINGS_DIR = DATA_DIR / "embeddings"

FIGURES_DIR = RESULTS_DIR / "figures"
TABLES_DIR = RESULTS_DIR / "tables"

# Ensure all subdirectories exist
for d in [RAW_DIR, METADATA_DIR, FEATURES_DIR, EMBEDDINGS_DIR, FIGURES_DIR, TABLES_DIR, MODELS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Metadata catalogs
TORGO_METADATA_CSV = METADATA_DIR / "torgo_metadata.csv"
METADATA_CSV = TORGO_METADATA_CSV
EASYCALL_METADATA_CSV = METADATA_DIR / "easycall_metadata.csv"
PARKINSONS_METADATA_CSV = METADATA_DIR / "parkinsons_metadata.csv"
ITALIAN_PARKINSONS_METADATA_CSV = METADATA_DIR / "italian_parkinsons_metadata.csv"

# Classical baseline features
MFCC_FEATURES_CSV = FEATURES_DIR / "torgo_features_mfcc.csv"
EGEMAPS_FEATURES_CSV = FEATURES_DIR / "torgo_features_egemaps.csv"

# Pre-computed Wav2Vec 2.0 Base embeddings (Layers 1, 4, 7, 12)
TORGO_EMBEDDINGS_WAV2VEC2_NPY = EMBEDDINGS_DIR / "torgo_embeddings_wav2vec2.npy"
WAV2VEC2_EMBEDDINGS_NPY = TORGO_EMBEDDINGS_WAV2VEC2_NPY
EASYCALL_EMBEDDINGS_WAV2VEC2_NPY = EMBEDDINGS_DIR / "easycall_embeddings_wav2vec2.npy"
PARKINSONS_EMBEDDINGS_WAV2VEC2_NPY = EMBEDDINGS_DIR / "parkinsons_embeddings_wav2vec2.npy"
ITALIAN_PARKINSONS_EMBEDDINGS_WAV2VEC2_NPY = EMBEDDINGS_DIR / "italian_parkinsons_embeddings_wav2vec2.npy"

# Result tables
BASELINE_RESULTS_CSV = TABLES_DIR / "baseline_results.csv"
WAV2VEC2_RESULTS_CSV = TABLES_DIR / "wav2vec2_results.csv"
CROSS_CORPUS_RESULTS_CSV = TABLES_DIR / "cross_corpus_3x3_results.csv"


def get_layer_embedding_path(corpus: str, layer: int = 12) -> Path:
    """Returns the standardized embedding path for any corpus and layer (1, 4, 7, 12)."""
    c = corpus.lower()
    if c == "parkinsons":
        c = "italian_parkinsons"
    return EMBEDDINGS_DIR / f"{c}_embeddings_wav2vec2_layer{layer}.npy"


def resolve_project_path(path: str | Path) -> Path:
    """Return an absolute path, treating relative paths as project-relative."""
    candidate = Path(path)
    full_path = candidate if candidate.is_absolute() else PROJECT_ROOT / candidate
    if not full_path.exists():
        parts = full_path.parts
        if "data" in parts and "raw" not in parts:
            idx = parts.index("data")
            raw_path = Path(*parts[:idx + 1]) / "raw" / Path(*parts[idx + 1:])
            if raw_path.exists():
                return raw_path
    return full_path
