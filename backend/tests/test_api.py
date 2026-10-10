"""Integration tests for FastAPI endpoints using TestClient."""

import io
import unittest
import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

from backend.app.main import app


def create_test_wav_bytes(duration_sec: float = 1.0, freq: float = 440.0, sr: int = 16000) -> bytes:
    """Generate in-memory WAV audio bytes for testing."""
    t = np.linspace(0, duration_sec, int(sr * duration_sec), endpoint=False)
    # Sine wave with audible amplitude
    waveform = 0.5 * np.sin(2 * np.pi * freq * t)
    buf = io.BytesIO()
    sf.write(buf, waveform.astype(np.float32), sr, format="WAV")
    buf.seek(0)
    return buf.read()


class TestAPIEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_root_ping(self):
        """Verify root health check returns 200."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "HEALTHY")

    def test_v1_health_status(self):
        """Verify API v1 health endpoint reports model loaded and tasks."""
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "HEALTHY")
        self.assertTrue(data["model_loaded"])
        self.assertIn("binary_dysarthria_screening", data["supported_tasks"])

    def test_screen_single_clip_endpoint(self):
        """Verify single audio upload returns full clinical diagnostic payload."""
        wav_bytes = create_test_wav_bytes(duration_sec=1.5, freq=220.0)
        files = {"file": ("test_patient_voice.wav", wav_bytes, "audio/wav")}

        response = self.client.post("/api/v1/screen/clip", files=files)
        self.assertEqual(response.status_code, 200, f"Error: {response.text}")
        data = response.json()

        self.assertIn("clip_id", data)
        self.assertIn("is_dysarthric", data)
        self.assertIn("dysarthria_probability", data)
        self.assertIn("confidence_level", data)
        self.assertIn("predicted_severity", data)
        self.assertIn("severity_probabilities", data)
        self.assertIn("audio_quality", data)
        self.assertIn("clinical_note", data)
        self.assertTrue(0.0 <= data["dysarthria_probability"] <= 1.0)
        self.assertGreater(data["audio_quality"]["duration_seconds"], 1.0)

    def test_screen_multi_utterance_session(self):
        """Verify clinical battery session endpoint combines multiple clips into consensus."""
        clip1 = create_test_wav_bytes(duration_sec=1.2, freq=220.0)
        clip2 = create_test_wav_bytes(duration_sec=1.5, freq=330.0)

        files = [
            ("files", ("sustained_vowel.wav", clip1, "audio/wav")),
            ("files", ("ddk_repetition.wav", clip2, "audio/wav")),
        ]
        data_payload = {"task_labels": "sustained_vowel,ddk_repetition"}

        response = self.client.post("/api/v1/screen/session", files=files, data=data_payload)
        self.assertEqual(response.status_code, 200, f"Error: {response.text}")
        data = response.json()

        self.assertIn("session_id", data)
        self.assertIn("consensus_diagnosis", data)
        self.assertIn("is_dysarthric", data)
        self.assertIn("consensus_probability", data)
        self.assertIn("clinical_recommendation", data)
        self.assertEqual(data["total_utterances"], 2)
        self.assertEqual(len(data["utterances"]), 2)

    def test_too_short_audio_rejection(self):
        """Verify audio under minimum threshold (< 0.4s) is rejected with 422."""
        short_bytes = create_test_wav_bytes(duration_sec=0.1, freq=440.0)
        files = {"file": ("too_short.wav", short_bytes, "audio/wav")}

        response = self.client.post("/api/v1/screen/clip", files=files)
        self.assertEqual(response.status_code, 422)
        self.assertIn("too short", response.json()["detail"].lower())


if __name__ == "__main__":
    unittest.main()
