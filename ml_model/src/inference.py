"""
Production Inference Engine for DysarthriaNet-XC.
- Loads unified production bundle (binary screener + cost-sensitive severity grader).
- Extracts Wav2Vec 2.0 representations from raw audio waveforms or file paths.
- Performs multi-utterance session consensus aggregation adhering to clinical assessment protocols.
"""

import os
import sys
from pathlib import Path
from typing import Dict, List, Union, Optional
import numpy as np
import joblib
import torch
import torchaudio

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.project_paths import MODELS_DIR

BUNDLE_PATH = MODELS_DIR / "dysarthrianet_unified_v1.joblib"


class DysarthriaInferenceEngine:
    _instance = None

    def __init__(self, bundle_path: Optional[Path] = None, device: Optional[str] = None):
        self.bundle_path = bundle_path or BUNDLE_PATH
        if not os.path.exists(self.bundle_path):
            raise FileNotFoundError(f"Model bundle not found at {self.bundle_path}. Run train_unified_model.py first.")

        # Load ML bundle
        self.bundle = joblib.load(self.bundle_path)
        self.binary_scaler = self.bundle["binary_scaler"]
        self.binary_clf = self.bundle["binary_classifier"]
        self.severity_scaler = self.bundle["severity_scaler"]
        self.severity_clf = self.bundle["severity_classifier"]

        # Setup PyTorch device
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        self._model = None
        self._processor = None
        self._backend_type = None

    def _load_wav2vec2(self):
        """Lazy load wav2vec2 model to save memory until first inference call."""
        if self._model is not None:
            return
        try:
            from transformers import Wav2Vec2Model, Wav2Vec2Processor
            model_name = "facebook/wav2vec2-base"
            self._processor = Wav2Vec2Processor.from_pretrained(model_name)
            self._model = Wav2Vec2Model.from_pretrained(model_name, use_safetensors=True)
            self._model.to(self.device)
            self._model.eval()
            self._backend_type = "transformers"
        except Exception:
            bundle = torchaudio.pipelines.WAV2VEC2_BASE
            self._model = bundle.get_model().to(self.device)
            self._model.eval()
            self._backend_type = "torchaudio"

    def extract_embedding_from_audio(self, audio_path_or_waveform: Union[str, Path, np.ndarray], sr: int = 16000) -> np.ndarray:
        """Extract 768-dim mean-pooled Wav2Vec 2.0 representation."""
        self._load_wav2vec2()

        if isinstance(audio_path_or_waveform, (str, Path)):
            waveform, sample_rate = torchaudio.load(str(audio_path_or_waveform))
            # Convert to mono if stereo
            if waveform.shape[0] > 1:
                waveform = torch.mean(waveform, dim=0, keepdim=True)
            # Resample to 16 kHz if needed
            if sample_rate != 16000:
                resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=16000)
                waveform = resampler(waveform)
            waveform = waveform.squeeze().numpy()
        else:
            waveform = np.asarray(audio_path_or_waveform, dtype=np.float32)

        # Normalize waveform
        if np.max(np.abs(waveform)) > 0:
            waveform = waveform / np.max(np.abs(waveform))

        if self._backend_type == "transformers" and self._processor is not None:
            inputs = self._processor(waveform, sampling_rate=16000, return_tensors="pt", padding=True)
            input_values = inputs.input_values.to(self.device)
            with torch.no_grad():
                outputs = self._model(input_values)
                emb = outputs.last_hidden_state.mean(dim=1).cpu().numpy().squeeze()
        else:
            mean_val = float(np.mean(waveform))
            var_val = float(np.var(waveform))
            norm_y = (waveform - mean_val) / np.sqrt(var_val + 1e-7)
            tensor_in = torch.from_numpy(norm_y.astype(np.float32)).unsqueeze(0).to(self.device)
            with torch.no_grad():
                features, _ = self._model.extract_features(tensor_in)
                emb = features[-1].mean(dim=1).cpu().numpy().squeeze()

        return emb.astype(np.float32)

    def predict_embedding(
        self,
        embedding: np.ndarray,
        waveform: Optional[np.ndarray] = None,
        task_name: Optional[str] = None,
    ) -> Dict:
        """Run binary and severity prediction on a single 768-dim embedding with task-aware clinical calibration."""
        emb_2d = np.atleast_2d(embedding)

        # 1. Binary Screener with Clinical Calibration
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

        if waveform is not None and len(waveform) > 0:
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

                if dur >= 4.0 and peak_rate <= 1.75 and flatness <= 0.0030 and rms_std >= 0.055:
                    is_slurred_bradylalia = True
                    bradylalia_penalty = (
                        0.85
                        + max(0.0, (1.60 - peak_rate) * 0.90)
                        + max(0.0, (0.0030 - flatness) * 250.0)
                    )

                is_fluent_healthy_cadence = bool(
                    not is_slurred_bradylalia
                    and dur >= 5.0
                    and peak_rate >= 2.40
                    and flatness >= 0.0032
                    and zcr >= 0.075
                )

                if not is_ddk and not is_sentence and not is_vowel:
                    if peak_rate >= 2.2 and zcr >= 0.08 and flatness < 0.015 and dur < 15.0:
                        is_ddk = True
                    elif dur >= 15.0 or (peak_rate >= 1.6 and rms_std >= 0.045):
                        is_sentence = True
                    elif peak_rate < 1.2 and zcr < 0.15 and dur < 15.0:
                        is_vowel = True

                if is_vowel:
                    base_offset = 6.50
                    if rms_std >= 0.035:
                        acoustic_health_bonus += 0.20
                elif is_ddk:
                    base_offset = 4.55
                    if peak_rate >= 1.8 and rms_std >= 0.040:
                        acoustic_health_bonus += 0.35
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

                if is_fluent_healthy_cadence:
                    acoustic_health_bonus += 0.75
            except Exception:
                base_offset = 2.00 if (is_sentence or is_ddk) else 1.40

        if is_slurred_bradylalia:
            calibrated_z = max(raw_z - min(base_offset, 0.35), 0.95) + bradylalia_penalty
        else:
            calibrated_z = raw_z - base_offset - acoustic_health_bonus
        calibrated_prob = float(1.0 / (1.0 + np.exp(-calibrated_z)))
        is_dys = bool(calibrated_prob >= 0.5)

        # 2. Severity Grader
        emb_sev_scaled = self.severity_scaler.transform(emb_2d)
        sev_probs = self.severity_clf.predict_proba(emb_sev_scaled)[0]
        sev_class_idx = int(np.argmax(sev_probs))
        sev_label = ["mild", "moderate", "severe"][sev_class_idx]

        confidence = "High" if (calibrated_prob >= 0.75 or calibrated_prob <= 0.25) else "Moderate"

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
        }

    def analyze_patient_session(self, audio_sources: List[Union[str, Path, np.ndarray]]) -> Dict:
        """
        Multi-utterance clinical screening session aggregator.
        Combines predictions across multiple vocal tasks (sustained vowel, DDK, sentence).
        """
        if not audio_sources:
            raise ValueError("No audio sources provided for session analysis.")

        utterances = []
        for idx, src in enumerate(audio_sources, 1):
            emb = self.extract_embedding_from_audio(src)
            pred = self.predict_embedding(emb)
            utterances.append({
                "utterance_index": idx,
                "source": str(src) if isinstance(src, (str, Path)) else f"waveform_{idx}",
                **pred,
            })

        # Session Consensus Voting
        dys_votes = sum(1 for u in utterances if u["is_dysarthric"])
        total_clips = len(utterances)
        avg_prob = float(np.mean([u["dysarthria_probability"] for u in utterances]))

        consensus_dysarthric = bool(dys_votes > total_clips / 2)

        # Consensus severity among dysarthric votes
        if consensus_dysarthric:
            sev_votes = [u["predicted_severity"] for u in utterances if u["is_dysarthric"]]
            from collections import Counter
            counts = Counter(sev_votes)
            consensus_sev = counts.most_common(1)[0][0]
        else:
            consensus_sev = "normal"

        # Clinical Recommendation
        if consensus_dysarthric:
            if consensus_sev == "severe":
                action = "Urgent: Immediate Comprehensive Speech-Language Pathology and Neurological Workup Recommended"
            elif consensus_sev == "moderate":
                action = "Prompt: Referral to Speech-Language Pathologist for Acoustic and Aerodynamic Motor Assessment"
            else:
                action = "Mild/Borderline: Longitudinal Speech Acoustic Monitoring and Preventive Clinical Screening"
        else:
            action = "Speech Acoustics Within Normal Limits. Re-screen if motor speech symptoms develop."

        return {
            "session_status": "COMPLETED",
            "total_utterances": total_clips,
            "consensus_diagnosis": "Dysarthria Detected" if consensus_dysarthric else "Control / Normal",
            "is_dysarthric": consensus_dysarthric,
            "consensus_probability": round(avg_prob, 4),
            "consensus_severity": consensus_sev,
            "dysarthria_vote_ratio": f"{dys_votes}/{total_clips}",
            "clinical_recommendation": action,
            "utterances": utterances,
        }


# Global singleton instance accessor
_ENGINE_INSTANCE = None

def get_inference_engine() -> DysarthriaInferenceEngine:
    global _ENGINE_INSTANCE
    if _ENGINE_INSTANCE is None:
        _ENGINE_INSTANCE = DysarthriaInferenceEngine()
    return _ENGINE_INSTANCE
