"""Module for extracting and caching self-supervised foundation model embeddings (Wav2Vec 2.0)."""

from pathlib import Path
import numpy as np
import torch
from tqdm import tqdm
from transformers import Wav2Vec2Model, Wav2Vec2Processor  # pyrefly: ignore [missing-module-attribute]

try:
    from src.data_loading import load_and_preprocess_audio
    from src.project_paths import resolve_project_path
except (ModuleNotFoundError, ImportError):
    from data_loading import load_and_preprocess_audio
    from project_paths import resolve_project_path


def get_wav2vec2_extractor(model_name: str = "facebook/wav2vec2-base", device: str | None = None):
    """
    Initializes and returns the frozen Wav2Vec 2.0 backbone and processor.
    Uses safetensors for fast, secure weight loading.
    """
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    processor = Wav2Vec2Processor.from_pretrained(model_name)
    model = Wav2Vec2Model.from_pretrained(model_name, use_safetensors=True).to(device)
    model.eval()

    # Freeze all 95M backbone parameters
    for param in model.parameters():
        param.requires_grad = False

    return model, processor, device


def extract_wav2vec2_embedding_single(
    file_path: str | Path,
    model,
    processor,
    device: str,
    max_chunk_sec: float = 10.0,
):
    """
    Extracts a fixed 768-dimensional mean-pooled representation for a single audio file.
    Uses non-overlapping contiguous temporal chunking for audio exceeding max_chunk_sec
    to strictly cap GPU VRAM under ~600 MB on long clips without statistical bias.
    """
    y, sr = load_and_preprocess_audio(file_path, target_sr=16000)

    # Empty clip fallback
    if len(y) == 0 or np.all(y == 0):
        return np.zeros(768, dtype=np.float32)

    # Pad ultra-short clips (<0.10s) to minimum input length required by Wav2Vec2's 7 conv layers
    min_samples = int(0.10 * sr)  # 1600 samples at 16kHz
    if len(y) < min_samples:
        y = np.pad(y, (0, min_samples - len(y)), mode="constant")

    total_samples = len(y)
    chunk_samples = int(max_chunk_sec * sr)

    # Single pass if clip length <= max_chunk_sec
    if total_samples <= chunk_samples:
        inputs = processor(y, sampling_rate=16000, return_tensors="pt").input_values.to(device)
        with torch.no_grad():
            outputs = model(inputs)
            pooled = outputs.last_hidden_state.mean(dim=1).squeeze(0)
        return pooled.cpu().numpy().astype(np.float32)

    # Contiguous, non-overlapping chunks with exact length-weighted averaging
    chunk_embeddings = []
    chunk_weights = []
    with torch.no_grad():
        for start in range(0, total_samples, chunk_samples):
            end = min(start + chunk_samples, total_samples)
            chunk_y = y[start:end]
            if len(chunk_y) < int(0.25 * sr):
                continue
            inputs = processor(chunk_y, sampling_rate=16000, return_tensors="pt").input_values.to(device)
            outputs = model(inputs)
            emb = outputs.last_hidden_state.mean(dim=1).squeeze(0).cpu().numpy()
            chunk_embeddings.append(emb)
            chunk_weights.append(len(chunk_y))

    if not chunk_embeddings:
        return np.zeros(768, dtype=np.float32)

    total_w = sum(chunk_weights)
    weighted_mean = np.sum([e * (w / total_w) for e, w in zip(chunk_embeddings, chunk_weights)], axis=0)
    return weighted_mean.astype(np.float32)


def batch_extract_wav2vec2_embeddings(
    file_paths: list[str],
    model_name: str = "facebook/wav2vec2-base",
    output_npy_path: Path | str | None = None,
):
    """
    Extracts 768-dimensional embeddings across an entire audio dataset on GPU.
    Optionally saves the embedding matrix directly to disk as a NumPy array.
    """
    model, processor, device = get_wav2vec2_extractor(model_name)
    print(f"Extracting Wav2Vec 2.0 embeddings on: {device.upper()}")

    embeddings = []
    for path in tqdm(file_paths, desc="Extracting Wav2Vec2 embeddings"):
        emb = extract_wav2vec2_embedding_single(path, model, processor, device)
        embeddings.append(emb)

    embeddings_arr = np.array(embeddings, dtype=np.float32)

    if output_npy_path is not None:
        output_path = Path(output_npy_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        np.save(output_path, embeddings_arr)
        print(f"Saved {embeddings_arr.shape} embeddings to: {output_path}")

    return embeddings_arr
