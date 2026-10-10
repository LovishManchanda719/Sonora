"""Unit tests for src.models."""

import unittest
import numpy as np
from sklearn.linear_model import LogisticRegression

from src.models import (
    PyTorchMLPClassifier,
    SoftVotingEnsemble,
    get_champion_detector_pipeline,
    predict_patient_session,
)


class TestModels(unittest.TestCase):
    def setUp(self):
        rng = np.random.default_rng(42)
        self.X_train = rng.normal(0, 1, size=(60, 20))
        self.y_train = np.array([0] * 30 + [1] * 30)
        self.X_test = rng.normal(0, 1, size=(10, 20))

    def test_champion_detector_pipeline(self):
        """Verify champion pipeline builds, fits, and predicts probabilities."""
        pipe = get_champion_detector_pipeline(k_features=10, C=0.5)
        pipe.fit(self.X_train, self.y_train)
        preds = pipe.predict(self.X_test)
        probs = pipe.predict_proba(self.X_test)
        self.assertEqual(len(preds), 10)
        self.assertEqual(probs.shape, (10, 2))
        np.testing.assert_allclose(np.sum(probs, axis=1), 1.0, atol=1e-5)

    def test_soft_voting_ensemble(self):
        """Verify soft voting ensemble aggregates probability distributions."""
        clf1 = LogisticRegression(random_state=42)
        clf2 = LogisticRegression(random_state=123)
        ensemble = SoftVotingEnsemble([("m1", clf1), ("m2", clf2)], weights=[0.5, 0.5])
        ensemble.fit(self.X_train, self.y_train)
        probs = ensemble.predict_proba(self.X_test)
        preds = ensemble.predict(self.X_test)
        self.assertEqual(probs.shape, (10, 2))
        self.assertEqual(len(preds), 10)

    def test_predict_patient_session(self):
        """Verify patient session screening consensus logic and thresholds."""
        clf = LogisticRegression()
        clf.fit(self.X_train, self.y_train)

        # High risk session (simulated high probabilities)
        X_session = self.X_train[self.y_train == 1][:5]
        res = predict_patient_session(clf, X_session, screening_threshold=0.35, diagnostic_threshold=0.50)
        self.assertEqual(res["num_clips"], 5)
        self.assertIn("mean_dysarthric_probability", res)
        self.assertIn("clinical_status", res)
        self.assertIn("recommendation", res)

    def test_pytorch_mlp_classifier(self):
        """Verify PyTorch MLP scikit-learn wrapper fits and produces probabilities."""
        mlp = PyTorchMLPClassifier(hidden_dims=(32, 16), epochs=5, batch_size=16, random_state=42)
        mlp.fit(self.X_train, self.y_train)
        probs = mlp.predict_proba(self.X_test)
        preds = mlp.predict(self.X_test)
        self.assertEqual(probs.shape, (10, 2))
        self.assertEqual(len(preds), 10)
        np.testing.assert_allclose(np.sum(probs, axis=1), 1.0, atol=1e-4)


if __name__ == "__main__":
    unittest.main()
