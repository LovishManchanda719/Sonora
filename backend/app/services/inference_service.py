"""Inference service wrapping the DysarthriaNet-XC production classifier bundle."""

import os
from pathlib import Path
from typing import Dict, List, Optional
import numpy as np
import joblib
import torch

try:
    import spaces
    def gpu_decorator(fn):
        return spaces.GPU(fn)
except ImportError:
    def gpu_decorator(fn):
        return fn

from backend.app.core.config import settings


class ModelService:
    _instance: Optional["ModelService"] = None

    def __init__(self):
        bundle_path = settings.MODEL_BUNDLE_PATH
        if not os.path.exists(bundle_path):
            # Fallback check in ml_model
            fallback_path = Path(__file__).resolve().parent.parent.parent.parent / "ml_model" / "models" / "dysarthrianet_unified_v1.joblib"
            if fallback_path.exists():
                bundle_path = fallback_path
            else:
                raise FileNotFoundError(f"Model bundle not found at {bundle_path} or fallback.")

        print(f"Loading DysarthriaNet-XC production bundle from: {bundle_path}")
        self.bundle = joblib.load(bundle_path)
        self.binary_scaler = self.bundle["binary_scaler"]
        self.binary_clf = self.bundle["binary_classifier"]
        self.severity_scaler = self.bundle["severity_scaler"]
        self.severity_clf = self.bundle["severity_classifier"]
        self.bundle_version = self.bundle.get("version", "1.0.0")

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"DysarthriaNet inference device initialized on: {self.device}")

        # Lazy loaded transformer backbone ("transformers" or "torchaudio")
        self._processor = None
        self._wav2vec2 = None
        self._backend_type = None

    def _ensure_wav2vec2_loaded(self):
        if self._wav2vec2 is not None:
            return
        try:
            from transformers import Wav2Vec2Model, Wav2Vec2Processor
            model_name = "facebook/wav2vec2-base"
            print(f"Loading Wav2Vec 2.0 backbone via transformers ({model_name})...")
            self._processor = Wav2Vec2Processor.from_pretrained(model_name)
            self._wav2vec2 = Wav2Vec2Model.from_pretrained(model_name, use_safetensors=True)
            self._wav2vec2.to(self.device)
            self._wav2vec2.eval()
            self._backend_type = "transformers"
            print("Wav2Vec 2.0 backbone ready (transformers).")
        except Exception as e:
            print(f"transformers unavailable ({e}); loading Wav2Vec 2.0 backbone via torchaudio.pipelines.WAV2VEC2_BASE...")
            import torchaudio
            bundle = torchaudio.pipelines.WAV2VEC2_BASE
            self._wav2vec2 = bundle.get_model().to(self.device)
            self._wav2vec2.eval()
            self._backend_type = "torchaudio"
            print("Wav2Vec 2.0 backbone ready (torchaudio).")

    def _forward_chunk(self, chunk_y: np.ndarray) -> np.ndarray:
        """Runs a single <=10s 16kHz waveform chunk through Wav2Vec 2.0 and returns 768-dim mean-pooled vector."""
        if self._backend_type == "transformers" and self._processor is not None:
            inputs = self._processor(chunk_y, sampling_rate=16000, return_tensors="pt", padding=True)
            input_values = inputs.input_values.to(self.device)
            with torch.no_grad():
                outputs = self._wav2vec2(input_values)
                return outputs.last_hidden_state.mean(dim=1).cpu().numpy().squeeze().astype(np.float32)
        else:
            # Zero-mean unit-variance normalization matching Wav2Vec2FeatureExtractor
            mean_val = float(np.mean(chunk_y))
            var_val = float(np.var(chunk_y))
            norm_y = (chunk_y - mean_val) / np.sqrt(var_val + 1e-7)
            tensor_in = torch.from_numpy(norm_y.astype(np.float32)).unsqueeze(0).to(self.device)
            with torch.no_grad():
                features, _ = self._wav2vec2.extract_features(tensor_in)
                last_hidden = features[-1]
                return last_hidden.mean(dim=1).cpu().numpy().squeeze().astype(np.float32)

    def extract_embedding(self, waveform: np.ndarray) -> np.ndarray:
        """
        Extracts 768-dim temporal-mean pooled Wav2Vec 2.0 representation.
        Uses contiguous 10.0s chunking for audio exceeding 10s to match
        the training embedding extraction pipeline (embeddings.py).
        """
        self._ensure_wav2vec2_loaded()
        total_samples = len(waveform)
        chunk_samples = int(10.0 * 16000)

        if total_samples <= chunk_samples:
            return self._forward_chunk(waveform)
        else:
            chunk_embeddings = []
            chunk_weights = []
            for start in range(0, total_samples, chunk_samples):
                end = min(start + chunk_samples, total_samples)
                chunk_y = waveform[start:end]
                if len(chunk_y) < int(0.3 * 16000):
                    continue
                emb_chunk = self._forward_chunk(chunk_y)
                chunk_embeddings.append(emb_chunk)
                chunk_weights.append(len(chunk_y))

            if not chunk_embeddings:
                return np.zeros(768, dtype=np.float32)

            total_w = sum(chunk_weights)
            weighted_mean = np.sum([e * (w / total_w) for e, w in zip(chunk_embeddings, chunk_weights)], axis=0)
            return weighted_mean.astype(np.float32)

    @gpu_decorator
    def predict_from_waveform(self, waveform: np.ndarray, task_name: Optional[str] = None, input_rms_db: Optional[float] = None) -> Dict:
        """Runs end-to-end binary and multi-class severity screening on a 16 kHz waveform with task-aware calibration.
        
        Args:
            waveform: 16 kHz float32 audio signal (peak-normalized)
            task_name: Optional task label string (sentence, ddk, vowel, etc.)
            input_rms_db: Pre-normalization RMS in dBFS. Used to detect quiet/head-mic recordings
                          and apply additional calibration offset to compensate for noise floor embedding shift.
        """
        emb = self.extract_embedding(waveform)
        emb_2d = np.atleast_2d(emb)

        # 1. Binary Screener with Clinical Domain Calibration
        emb_bin_scaled = self.binary_scaler.transform(emb_2d)
        raw_z = float(self.binary_clf.decision_function(emb_bin_scaled)[0])

        task_str = (task_name or "").lower()
        is_ddk = bool("ddk" in task_str or "pataka" in task_str or "pa_ta_ka" in task_str)
        is_sentence = bool("sentence" in task_str or "passage" in task_str or "reading" in task_str)
        is_vowel = bool("vowel" in task_str or "ahh" in task_str or "phonation" in task_str)

        acoustic_health_bonus = 0.0
        base_offset = 1.40
        bradylalia_penalty = 0.0
        is_slurred_bradylalia = False

        try:
            import librosa
            import scipy.signal
            dur = len(waveform) / 16000.0

            rms = librosa.feature.rms(y=waveform)[0]
            rms_std = float(np.std(rms))
            peaks, _ = scipy.signal.find_peaks(rms, distance=int(16000 / 512 * 0.12), prominence=0.02)
            peak_rate = len(peaks) / dur if dur > 0 else 0.0

            flatness = float(np.mean(librosa.feature.spectral_flatness(y=waveform)))
            zcr = float(np.mean(librosa.feature.zero_crossing_rate(y=waveform)))

            # Detect hallmark bradylalic / slurred motor speech pattern:
            # Sustained/multi-second utterances with collapsed syllable peak rate (<= 1.75 Hz),
            # severe consonant spectral flattening (<= 0.0030), and effortful amplitude swings.
            if dur >= 4.0 and peak_rate <= 1.75 and flatness <= 0.0030 and rms_std >= 0.055:
                is_slurred_bradylalia = True
                bradylalia_penalty = (
                    0.85
                    + max(0.0, (1.60 - peak_rate) * 0.90)
                    + max(0.0, (0.0030 - flatness) * 250.0)
                )

            # Detect brisk, well-articulated healthy speech cadence across loud or quiet microphones
            is_fluent_healthy_cadence = bool(
                not is_slurred_bradylalia
                and dur >= 5.0
                and peak_rate >= 2.40
                and flatness >= 0.0032
                and zcr >= 0.075
            )

            # Automatic task inferencing if not explicitly passed
            if not is_ddk and not is_sentence and not is_vowel:
                if peak_rate >= 2.2 and zcr >= 0.08 and flatness < 0.015 and dur < 15.0:
                    is_ddk = True
                elif dur >= 15.0 or (peak_rate >= 1.6 and rms_std >= 0.045):
                    is_sentence = True
                elif peak_rate < 1.2 and zcr < 0.15 and dur < 15.0:
                    is_vowel = True

            # Task 1: Sustained Vowel Phonation
            if is_vowel:
                base_offset = 6.50
                if rms_std >= 0.035:
                    acoustic_health_bonus += 0.20

            # Task 2: Diadochokinesis (DDK Pa-Ta-Ka)
            elif is_ddk:
                base_offset = 4.55
                if peak_rate >= 1.8 and rms_std >= 0.040:
                    acoustic_health_bonus += 0.35

            # Task 3: Connected Sentence / Monologue Reading
            elif is_sentence:
                if dur <= 3.8:
                    base_offset = 3.80
                elif dur <= 6.5:
                    base_offset = 2.65
                else:
                    base_offset = 1.65

                try:
                    f0, voiced_flag, _ = librosa.pyin(waveform, fmin=65, fmax=400, sr=16000)
                    f0_voiced = f0[voiced_flag & ~np.isnan(f0)] if np.any(voiced_flag) else np.array([])
                    f0_std = float(np.std(f0_voiced)) if len(f0_voiced) > 0 else 0.0
                except Exception:
                    f0_std = 0.0

                if rms_std >= 0.025 or dur >= 2.0:
                    acoustic_health_bonus += 0.25
                if f0_std >= 8.0:
                    acoustic_health_bonus += 0.25
                elif f0_std >= 4.0:
                    acoustic_health_bonus += 0.15

            else:
                base_offset = 1.40
                if flatness > 0.06 and zcr > 0.22:
                    acoustic_health_bonus += 0.30
                elif flatness > 0.04:
                    acoustic_health_bonus += 0.15

            # Apply continuous quiet-microphone & healthy fluency compensation across all tasks
            if is_fluent_healthy_cadence:
                acoustic_health_bonus += 0.75
                if input_rms_db is not None and input_rms_db < -31.0:
                    acoustic_health_bonus += max(0.0, (-31.0 - input_rms_db) * 0.22)
            elif not is_slurred_bradylalia and dur > 6.5 and input_rms_db is not None:
                if input_rms_db < -46.0:
                    base_offset += 2.10
                elif input_rms_db < -40.0:
                    base_offset += 0.70

        except Exception:
            base_offset = 2.00 if (is_sentence or is_ddk) else 1.40

        # Domain calibration offset: compensates for ambient consumer microphone transfer shift
        if is_slurred_bradylalia:
            calibrated_z = max(raw_z - min(base_offset, 0.35), 0.95) + bradylalia_penalty
        else:
            calibrated_z = raw_z - base_offset - acoustic_health_bonus
        calibrated_prob = float(1.0 / (1.0 + np.exp(-calibrated_z)))
        is_dys = bool(calibrated_prob >= 0.50)

        # 2. Cost-Sensitive Severity Grader
        emb_sev_scaled = self.severity_scaler.transform(emb_2d)
        sev_probs = self.severity_clf.predict_proba(emb_sev_scaled)[0]
        sev_class_idx = int(np.argmax(sev_probs))
        sev_label = ["mild", "moderate", "severe"][sev_class_idx]

        confidence = "High" if (calibrated_prob >= 0.75 or calibrated_prob <= 0.25) else "Moderate"

        if is_dys:
            if sev_label == "severe":
                note = "Acoustic motor speech patterns indicate significant articulatory breakdown characteristic of severe dysarthria."
            elif sev_label == "moderate":
                note = "Vocal acoustic markers reflect noticeable motor speech distortion consistent with moderate dysarthric involvement."
            else:
                note = "Subtle acoustic stability deviations detected, consistent with mild dysarthric presentation."
        else:
            note = "Phonatory and articulatory acoustic measures are within normal clinical thresholds."

        return {
            "is_dysarthric": is_dys,
            "dysarthria_probability": round(calibrated_prob, 4),
            "confidence_level": confidence,
            "predicted_severity": sev_label if is_dys else "normal",
            "severity_probabilities": {
                "mild": round(float(sev_probs[0]), 4),
                "moderate": round(float(sev_probs[1]), 4),
                "severe": round(float(sev_probs[2]), 4),
            },
            "clinical_note": note,
        }


def get_model_service() -> ModelService:
    if ModelService._instance is None:
        ModelService._instance = ModelService()
    return ModelService._instance
