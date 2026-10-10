"""Unit tests for src.evaluation."""

import unittest
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedGroupKFold

from src.evaluation import evaluate_speaker_independent


class TestEvaluation(unittest.TestCase):
    def setUp(self):
        rng = np.random.default_rng(42)
        # 10 speakers, 10 samples each = 100 samples
        self.groups = np.repeat([f"spk_{i}" for i in range(10)], 10)
        # Half control, half dysarthric
        self.y = np.repeat([0, 1] * 5, 10)
        self.X = rng.normal(0, 1, size=(100, 15))

    def test_speaker_group_zero_leakage(self):
        """Verify strict zero speaker overlap between train and test splits."""
        sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
        for train_idx, test_idx in sgkf.split(self.X, self.y, groups=self.groups):
            train_speakers = set(self.groups[train_idx])
            test_speakers = set(self.groups[test_idx])
            overlap = train_speakers.intersection(test_speakers)
            self.assertEqual(len(overlap), 0, f"Speaker leakage detected: {overlap}")

    def test_evaluate_speaker_independent_metrics(self):
        """Verify output dictionary structure and valid score ranges."""
        clf = LogisticRegression()
        results = evaluate_speaker_independent(clf, self.X, self.y, self.groups, n_splits=5)
        self.assertIn("accuracy", results)
        self.assertIn("macro_f1", results)
        self.assertIn("fold_accuracies", results)
        self.assertIn("confusion_matrix", results)
        self.assertEqual(len(results["fold_accuracies"]), 5)
        self.assertGreaterEqual(results["accuracy"], 0.0)
        self.assertLessEqual(results["accuracy"], 1.0)


if __name__ == "__main__":
    unittest.main()
