"""Unit tests for Wav2Vec 2.0 layer extraction and batched extraction parity."""

import unittest
import torch
import numpy as np
import pandas as pd
from transformers import Wav2Vec2Model, Wav2Vec2Processor

from src.project_paths import PARKINSONS_METADATA_CSV
from src.data_loading import load_and_preprocess_audio


class TestWav2Vec2Embeddings(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.device = "cuda" if torch.cuda.is_available() else "cpu"
        cls.model_name = "facebook/wav2vec2-base"
        cls.processor = Wav2Vec2Processor.from_pretrained(cls.model_name)
        cls.model = Wav2Vec2Model.from_pretrained(cls.model_name, use_safetensors=True).to(cls.device)
        cls.model.eval()

        # Load 3 sample audio paths
        df = pd.read_csv(PARKINSONS_METADATA_CSV)
        cls.sample_paths = df["file_path"].iloc[:3].tolist()

    def test_layer_12_matches_last_hidden_state(self):
        """Verify hidden_states[12] is numerically identical to last_hidden_state."""
        y, _ = load_and_preprocess_audio(self.sample_paths[0], target_sr=16000)
        inputs = self.processor(y[:16000 * 3], sampling_rate=16000, return_tensors="pt").input_values.to(self.device)

        with torch.no_grad():
            outputs = self.model(inputs, output_hidden_states=True)
            last_hs = outputs.last_hidden_state.mean(dim=1).squeeze(0).cpu().numpy()
            layer12_hs = outputs.hidden_states[12].mean(dim=1).squeeze(0).cpu().numpy()

        diff = float(np.max(np.abs(last_hs - layer12_hs)))
        self.assertLess(diff, 1e-6, f"Layer 12 mismatch with last_hidden_state: {diff}")
        self.assertEqual(last_hs.shape[0], 768)

    def test_batched_vs_sequential_parity(self):
        """Verify batched inference matches sequential single-item inference across layers."""
        waveforms = []
        lens = []
        for p in self.sample_paths:
            y, _ = load_and_preprocess_audio(p, target_sr=16000)
            y = y[:16000 * 3]
            waveforms.append(y)
            lens.append(len(y))

        # 1. Sequential
        single_res = {l: [] for l in [1, 4, 7, 12]}
        for y in waveforms:
            inp = self.processor(y, sampling_rate=16000, return_tensors="pt").input_values.to(self.device)
            with torch.no_grad():
                out = self.model(inp, output_hidden_states=True)
                for l in [1, 4, 7, 12]:
                    single_res[l].append(out.hidden_states[l].mean(dim=1).squeeze(0).cpu().numpy())

        # 2. Batched with padding
        batch_inputs = self.processor(
            waveforms, sampling_rate=16000, padding=True, return_attention_mask=True, return_tensors="pt"
        )
        input_values = batch_inputs.input_values.to(self.device)
        attention_mask = batch_inputs.attention_mask.to(self.device)

        batched_res = {l: [] for l in [1, 4, 7, 12]}
        with torch.no_grad():
            out = self.model(input_values, attention_mask=attention_mask, output_hidden_states=True)
            for idx, orig_len in enumerate(lens):
                num_frames = orig_len // 320
                for l in [1, 4, 7, 12]:
                    pooled = out.hidden_states[l][idx, :num_frames].mean(dim=0).cpu().numpy()
                    batched_res[l].append(pooled)

        for l in [1, 4, 7, 12]:
            max_diff = float(np.max([np.max(np.abs(s - b)) for s, b in zip(single_res[l], batched_res[l])]))
            self.assertLess(max_diff, 1e-3, f"Layer {l} batched disparity exceeded tolerance: {max_diff}")


if __name__ == "__main__":
    unittest.main()
