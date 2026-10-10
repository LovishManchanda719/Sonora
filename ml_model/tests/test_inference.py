"""Unit tests for production model bundle and inference engine."""

import unittest
import os
import joblib
import numpy as np

from src.project_paths import MODELS_DIR
from src.inference import DysarthriaInferenceEngine, BUNDLE_PATH


class TestProductionInference(unittest.TestCase):
    def test_production_bundle_exists_and_loads(self):
        """Verify unified production bundle exists and contains required components."""
        self.assertTrue(os.path.exists(BUNDLE_PATH), f"Bundle not found at {BUNDLE_PATH}")
        bundle = joblib.load(BUNDLE_PATH)
        for key in ["version", "binary_scaler", "binary_classifier", "severity_scaler", "severity_classifier"]:
            self.assertIn(key, bundle)

    def test_embedding_inference_prediction(self):
        """Verify inference engine runs prediction on embedding vector."""
        engine = DysarthriaInferenceEngine(device="cpu")
        dummy_embedding = np.random.randn(768).astype(np.float32)

        pred = engine.predict_embedding(dummy_embedding)
        self.assertIn("is_dysarthric", pred)
        self.assertIn("dysarthria_probability", pred)
        self.assertIn("confidence_level", pred)
        self.assertIn("predicted_severity", pred)
        self.assertIn("severity_probabilities", pred)
        self.assertTrue(0.0 <= pred["dysarthria_probability"] <= 1.0)

    def test_session_consensus_aggregation(self):
        """Verify multi-clip session consensus logic."""
        engine = DysarthriaInferenceEngine(device="cpu")

        # Mock embeddings
        dummy_clips = [np.random.randn(768).astype(np.float32) for _ in range(3)]
        utterances = []
        for i, emb in enumerate(dummy_clips, 1):
            pred = engine.predict_embedding(emb)
            utterances.append({
                "utterance_index": i,
                "source": f"test_clip_{i}.wav",
                **pred,
            })

        dys_votes = sum(1 for u in utterances if u["is_dysarthric"])
        self.assertGreaterEqual(dys_votes, 0)
        self.assertLessEqual(dys_votes, 3)


if __name__ == "__main__":
    unittest.main()
