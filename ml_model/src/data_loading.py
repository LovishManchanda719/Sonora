import librosa
import numpy as np
import pandas as pd
import soundfile as sf

from src.project_paths import (
    resolve_project_path,
    METADATA_CSV as TORGO_METADATA_CSV,
    EASYCALL_METADATA_CSV,
    WAV2VEC2_EMBEDDINGS_NPY as TORGO_EMBEDDINGS_NPY,
    EASYCALL_EMBEDDINGS_WAV2VEC2_NPY as EASYCALL_EMBEDDINGS_NPY,
)

SEV_MAP = {"mild": 0, "moderate": 1, "severe": 2}
REV_MAP = {0: "mild", 1: "moderate", 2: "severe"}


def get_audio_info(file_path):
    """
    Fast metadata reader for audio files without loading the full waveform into memory.
    Returns duration in seconds, sample rate, and channel count.
    """
    info = sf.info(resolve_project_path(file_path))
    return {
        "duration": float(info.duration),
        "samplerate": int(info.samplerate),
        "channels": int(info.channels),
        "frames": int(info.frames),
    }


def load_and_preprocess_audio(file_path, target_sr=16000, top_db=30):
    """
    Loads an audio file, resamples to target_sr mono, trims silence, and normalizes amplitude.

    Parameters:
    - target_sr: Target sample rate (default 16000 Hz)
    - top_db: Threshold below reference for silence trimming (default 30 dB).
              30 dB protects quiet dysarthric speech/fricatives better than aggressive 20 dB.
    """
    resolved_path = resolve_project_path(file_path)
    y, sr = librosa.load(resolved_path, sr=target_sr, mono=True)

    # Safety check 1: If the file is completely empty/corrupted
    if len(y) == 0:
        return np.zeros(target_sr, dtype=np.float32), target_sr

    # Trim leading and trailing silence
    y_trimmed, _ = librosa.effects.trim(y, top_db=top_db)

    # Safety check 2: If trimming removed everything (file was just background noise)
    if len(y_trimmed) == 0:
        y_trimmed = y

    # Robust amplitude normalization:
    # Scale relative to 99.9th percentile to prevent a single microphone pop/click
    # from crushing the dynamic range of the rest of the speech.
    peak = float(np.percentile(np.abs(y_trimmed), 99.9))
    if peak > 0:
        y_normalized = np.clip(y_trimmed, -peak, peak) / peak
    else:
        max_amplitude = float(np.max(np.abs(y_trimmed)))
        y_normalized = y_trimmed / max_amplitude if max_amplitude > 0 else y_trimmed

    return y_normalized.astype(np.float32), target_sr


def load_severity_data():
    """Load and align Wav2Vec 2.0 embeddings with 3-class severity labels (TORGO & EasyCall)."""
    # 1. TORGO
    df_t = pd.read_csv(TORGO_METADATA_CSV)
    emb_t_full = np.load(TORGO_EMBEDDINGS_NPY)
    mask_t = (df_t["label"] == "dysarthric") & (df_t["severity_3class"].isin(["mild", "moderate", "severe"]))
    idx_t = df_t[mask_t].index.values
    meta_t = df_t[mask_t].copy().reset_index(drop=True)
    X_t = emb_t_full[idx_t]
    y_t = np.asarray(meta_t["severity_3class"].map(SEV_MAP).to_numpy(), dtype=np.int64)
    groups_t = np.asarray(meta_t["speaker_id"].to_numpy())

    # 2. EasyCall (excluding f04 with NaN severity)
    df_e = pd.read_csv(EASYCALL_METADATA_CSV)
    emb_e_full = np.load(EASYCALL_EMBEDDINGS_NPY)
    mask_e = (df_e["label"] == "dysarthric") & (df_e["severity_3class"].isin(["mild", "moderate", "severe"]))
    idx_e = df_e[mask_e].index.values
    meta_e = df_e[mask_e].copy().reset_index(drop=True)
    X_e = emb_e_full[idx_e]
    y_e = np.asarray(meta_e["severity_3class"].map(SEV_MAP).to_numpy(), dtype=np.int64)
    groups_e = np.asarray(meta_e["speaker_id"].to_numpy())

    return (X_t, y_t, groups_t, meta_t), (X_e, y_e, groups_e, meta_e)