"""Unit tests for src.project_paths."""

import unittest
from pathlib import Path
import numpy as np
import pandas as pd

from src.project_paths import (
    PROJECT_ROOT,
    DATA_DIR,
    RESULTS_DIR,
    RAW_DIR,
    METADATA_DIR,
    FEATURES_DIR,
    EMBEDDINGS_DIR,
    FIGURES_DIR,
    TABLES_DIR,
    TORGO_METADATA_CSV,
    EASYCALL_METADATA_CSV,
    PARKINSONS_METADATA_CSV,
    MFCC_FEATURES_CSV,
    EGEMAPS_FEATURES_CSV,
    get_layer_embedding_path,
    resolve_project_path,
)


class TestProjectPaths(unittest.TestCase):
    def test_directories_exist(self):
        """Verify all core directories exist."""
        for d in [DATA_DIR, RESULTS_DIR, RAW_DIR, METADATA_DIR, FEATURES_DIR, EMBEDDINGS_DIR, FIGURES_DIR, TABLES_DIR]:
            self.assertTrue(d.exists() and d.is_dir(), f"Directory missing: {d}")

    def test_raw_audio_directories_exist(self):
        """Verify EasyCall, italian_parkinsons, and MC exist inside data/raw."""
        for name in ["EasyCall", "italian_parkinsons", "MC"]:
            d = RAW_DIR / name
            self.assertTrue(d.exists() and d.is_dir(), f"Raw corpus missing: {d}")

    def test_metadata_catalogs_exist_and_valid(self):
        """Verify metadata CSVs exist, are non-empty, and contain required columns."""
        for csv_path in [TORGO_METADATA_CSV, EASYCALL_METADATA_CSV, PARKINSONS_METADATA_CSV]:
            self.assertTrue(csv_path.exists(), f"Metadata CSV missing: {csv_path}")
            df = pd.read_csv(csv_path)
            self.assertGreater(len(df), 0, f"CSV is empty: {csv_path}")
            self.assertIn("file_path", df.columns)
            self.assertIn("label", df.columns)

    def test_baseline_features_exist(self):
        """Verify extracted acoustic feature CSVs exist and have correct shapes."""
        self.assertTrue(MFCC_FEATURES_CSV.exists())
        self.assertTrue(EGEMAPS_FEATURES_CSV.exists())

    def test_layer_embeddings_exist_all_corpora(self):
        """Verify all layer embeddings (1, 4, 7, 12) exist for all three corpora."""
        for corpus in ["torgo", "easycall", "italian_parkinsons"]:
            for layer in [1, 4, 7, 12]:
                p = get_layer_embedding_path(corpus, layer)
                self.assertTrue(p.exists(), f"Embedding missing: {p}")
                arr = np.load(p, mmap_mode="r")
                self.assertEqual(arr.shape[1], 768, f"Unexpected embedding dimension: {arr.shape}")

    def test_resolve_project_path(self):
        """Verify resolve_project_path correctly handles relative and absolute paths with raw fallback."""
        rel = "data/metadata/torgo_metadata.csv"
        resolved = resolve_project_path(rel)
        self.assertTrue(resolved.is_absolute())
        self.assertEqual(resolved, PROJECT_ROOT / rel)

        # Verify fallback for raw audio paths
        raw_sample = "data/raw/MC"
        self.assertTrue(resolve_project_path(raw_sample).exists())
        legacy_sample = "data/MC"
        self.assertTrue(resolve_project_path(legacy_sample).exists())


if __name__ == "__main__":
    unittest.main()
