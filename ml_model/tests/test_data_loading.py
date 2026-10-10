"""Unit tests for src.data_loading."""

import unittest
import numpy as np
import pandas as pd

from src.project_paths import PARKINSONS_METADATA_CSV
from src.data_loading import (
    load_and_preprocess_audio,
    get_audio_info,
    load_severity_data,
    SEV_MAP,
    REV_MAP,
)


class TestDataLoading(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        df = pd.read_csv(PARKINSONS_METADATA_CSV)
        cls.sample_audio_path = df["file_path"].iloc[0]

    def test_severity_maps(self):
        """Verify bijection of severity mapping dictionaries."""
        self.assertEqual(SEV_MAP["mild"], 0)
        self.assertEqual(SEV_MAP["moderate"], 1)
        self.assertEqual(SEV_MAP["severe"], 2)
        for k, v in SEV_MAP.items():
            self.assertEqual(REV_MAP[v], k)

    def test_get_audio_info(self):
        """Verify fast header inspection returns correct metadata structure."""
        info = get_audio_info(self.sample_audio_path)
        self.assertIn("duration", info)
        self.assertIn("samplerate", info)
        self.assertIn("channels", info)
        self.assertGreater(info["duration"], 0.0)
        self.assertGreater(info["samplerate"], 0)

    def test_load_and_preprocess_audio(self):
        """Verify audio preprocessing produces normalized 16kHz mono audio."""
        y, sr = load_and_preprocess_audio(self.sample_audio_path, target_sr=16000)
        self.assertEqual(sr, 16000)
        self.assertIsInstance(y, np.ndarray)
        self.assertEqual(y.ndim, 1)
        self.assertGreater(len(y), 0)
        # Peak normalization should keep values within [-1.05, 1.05]
        self.assertLessEqual(np.max(np.abs(y)), 1.05)

    def test_load_severity_data(self):
        """Verify load_severity_data returns matching shapes and valid multi-class labels."""
        (X_t, y_t, grp_t, meta_t), (X_e, y_e, grp_e, meta_e) = load_severity_data()
        self.assertEqual(len(X_t), len(y_t))
        self.assertEqual(len(X_e), len(y_e))
        self.assertEqual(X_t.shape[1], 768)
        self.assertEqual(X_e.shape[1], 768)
        self.assertTrue(set(np.unique(y_t)).issubset({0, 1, 2}))
        self.assertTrue(set(np.unique(y_e)).issubset({0, 1, 2}))


if __name__ == "__main__":
    unittest.main()
