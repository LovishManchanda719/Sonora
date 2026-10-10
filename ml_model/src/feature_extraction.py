"""Feature extraction module for classical acoustic baselines (MFCC + eGeMAPS)."""

from pathlib import Path
import librosa
import numpy as np
import opensmile
import pandas as pd

try:
    from src.data_loading import load_and_preprocess_audio
    from src.project_paths import resolve_project_path
except (ModuleNotFoundError, ImportError):
    from data_loading import load_and_preprocess_audio
    from project_paths import resolve_project_path

# Global reusable smile instance to avoid re-initializing openSMILE C++ backend
_SMILE_INSTANCE = None


def get_smile_instance():
    global _SMILE_INSTANCE
    if _SMILE_INSTANCE is None:
        _SMILE_INSTANCE = opensmile.Smile(
            feature_set=opensmile.FeatureSet.eGeMAPSv02,
            feature_level=opensmile.FeatureLevel.Functionals,
        )
    return _SMILE_INSTANCE


def extract_mfcc_features(file_path: str | Path, n_mfcc: int = 13, include_deltas: bool = True) -> dict:
    """
    Extracts comprehensive MFCC statistics across time.

    Captures both static spectral envelope and speech articulation dynamics:
    - Static MFCCs (mean and std): captures vocal tract shape and acoustic stability
    - Delta MFCCs (mean and std): captures articulation velocity / sluggish transitions
    - Delta-Delta MFCCs (mean and std): captures articulation acceleration / motor instability

    Safely handles ultra-short clips (<9 frames) by dynamically adapting delta window width.
    """
    y, sr = load_and_preprocess_audio(file_path)

    # 1. Static MFCCs
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc)
    num_frames = mfccs.shape[1]

    if num_frames > 0:
        mfcc_mean = np.mean(mfccs, axis=1)
        mfcc_std = np.std(mfccs, axis=1)
    else:
        mfcc_mean = np.zeros(n_mfcc, dtype=np.float32)
        mfcc_std = np.zeros(n_mfcc, dtype=np.float32)

    features = {}
    for i in range(n_mfcc):
        features[f"mfcc_mean_{i}"] = float(mfcc_mean[i])
        features[f"mfcc_std_{i}"] = float(mfcc_std[i])

    if include_deltas:
        # Dynamically determine odd filter width <= num_frames for ultra-short clips
        if num_frames >= 3:
            width = min(9, num_frames)
            if width % 2 == 0:
                width -= 1
            try:
                deltas = librosa.feature.delta(mfccs, width=width)
                delta_mean = np.mean(deltas, axis=1)
                delta_std = np.std(deltas, axis=1)
            except Exception:
                delta_mean = np.zeros(n_mfcc, dtype=np.float32)
                delta_std = np.zeros(n_mfcc, dtype=np.float32)

            if num_frames >= 5 and width >= 3:
                try:
                    delta2 = librosa.feature.delta(mfccs, order=2, width=width)
                    delta2_mean = np.mean(delta2, axis=1)
                    delta2_std = np.std(delta2, axis=1)
                except Exception:
                    delta2_mean = np.zeros(n_mfcc, dtype=np.float32)
                    delta2_std = np.zeros(n_mfcc, dtype=np.float32)
            else:
                delta2_mean = np.zeros(n_mfcc, dtype=np.float32)
                delta2_std = np.zeros(n_mfcc, dtype=np.float32)
        else:
            delta_mean = np.zeros(n_mfcc, dtype=np.float32)
            delta_std = np.zeros(n_mfcc, dtype=np.float32)
            delta2_mean = np.zeros(n_mfcc, dtype=np.float32)
            delta2_std = np.zeros(n_mfcc, dtype=np.float32)

        for i in range(n_mfcc):
            features[f"delta_mean_{i}"] = float(delta_mean[i])
            features[f"delta_std_{i}"] = float(delta_std[i])
            features[f"delta2_mean_{i}"] = float(delta2_mean[i])
            features[f"delta2_std_{i}"] = float(delta2_std[i])

    # Clean any NaN/inf values from empty/silent clips
    return {k: (0.0 if np.isnan(v) or np.isinf(v) else float(v)) for k, v in features.items()}


def extract_egemaps_features(file_path: str | Path) -> dict:
    """
    Extracts 88 clinical acoustic parameters from eGeMAPSv02 using openSMILE.

    Includes:
    - Pitch / F0 dynamics (mean, std, percentiles)
    - Jitter and Shimmer (micro-instability of vocal fold vibration)
    - Harmonics-to-Noise Ratio (HNR) and voice quality
    - Formant frequencies and bandwidths (F1, F2, F3)
    - Spectral balance, slope, and alpha ratio
    """
    resolved_path = str(resolve_project_path(file_path))
    smile = get_smile_instance()
    try:
        df = smile.process_file(resolved_path)
        res = df.iloc[0].to_dict()
    except Exception:
        res = {feat: 0.0 for feat in smile.feature_names}

    # Clean any NaN/inf values
    return {k: (0.0 if np.isnan(v) or np.isinf(v) else float(v)) for k, v in res.items()}
