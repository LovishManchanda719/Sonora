"""Unit tests for cost-sensitive severity outputs and clinical cost calculations."""

import unittest
import os
import pandas as pd
import numpy as np

from src.project_paths import TABLES_DIR
from experiments.exp7_cost_sensitive_severity import CLINICAL_COST_MATRIX, compute_expected_clinical_cost


class TestCostSensitiveSeverity(unittest.TestCase):
    def test_task7_tables_exist(self):
        """Verify Task 7 result tables were generated properly."""
        p_cross = os.path.join(TABLES_DIR, "task7_cost_sensitive_cross_corpus.csv")
        p_within = os.path.join(TABLES_DIR, "task7_cost_sensitive_within_corpus.csv")
        self.assertTrue(os.path.exists(p_cross), f"Missing table {p_cross}")
        self.assertTrue(os.path.exists(p_within), f"Missing table {p_within}")

        df_c = pd.read_csv(p_cross)
        self.assertIn("severe_penalty_mult", df_c.columns)
        self.assertIn("clinical_cost_per_clip", df_c.columns)
        self.assertEqual(len(df_c), 14)  # 7 multipliers * 2 methods (Raw, CORAL)

        df_w = pd.read_csv(p_within)
        self.assertIn("severe_penalty_mult", df_w.columns)
        self.assertEqual(len(df_w), 7)

    def test_clinical_cost_calculation(self):
        """Verify that catastrophic misclassifications (Sev -> Mild) receive penalty 10."""
        y_true = np.array([2])  # True severe
        y_pred = np.array([0])  # Misdiagnosed as mild
        cost = compute_expected_clinical_cost(y_true, y_pred)
        self.assertEqual(cost, 10.0)

        # Perfect prediction = 0 cost
        cost_perfect = compute_expected_clinical_cost(np.array([2]), np.array([2]))
        self.assertEqual(cost_perfect, 0.0)


if __name__ == "__main__":
    unittest.main()
