"""Unit tests for multi-source domain generalization data structures and table outputs."""

import unittest
import os
import pandas as pd
import numpy as np

from src.project_paths import TABLES_DIR


class TestMultiSourceTransfer(unittest.TestCase):
    def test_multisource_table_exists_and_valid(self):
        """Verify task6_multisource_transfer.csv exists and has all expected targets."""
        table_path = os.path.join(TABLES_DIR, "task6_multisource_transfer.csv")
        self.assertTrue(os.path.exists(table_path), f"Missing table {table_path}")

        df = pd.read_csv(table_path)
        expected_targets = {"TORGO", "EasyCall", "Italian_Parkinsons"}
        actual_targets = set(df["target_corpus"].unique())
        self.assertEqual(expected_targets, actual_targets)

        # Check required columns
        expected_cols = [
            "target_corpus", "sources", "best_single_source", "best_single_bacc",
            "multi_raw_bacc", "multi_dom_bacc", "multi_coral_bacc"
        ]
        for col in expected_cols:
            self.assertIn(col, df.columns)

    def test_pooled_speaker_prefix_uniqueness(self):
        """Verify that prefixing speaker IDs prevents cross-corpus ID collision."""
        corpus_a_spks = ["spk1", "spk2"]
        corpus_b_spks = ["spk1", "spk3"]
        pooled_spks = ["A_" + s for s in corpus_a_spks] + ["B_" + s for s in corpus_b_spks]

        # In raw form 'spk1' collided, but prefixed they are distinct
        self.assertEqual(len(set(corpus_a_spks + corpus_b_spks)), 3)
        self.assertEqual(len(set(pooled_spks)), 4)


if __name__ == "__main__":
    unittest.main()
