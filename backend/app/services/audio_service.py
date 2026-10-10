"""Audio preprocessing, decoding, quality validation, and normalization service."""

import io
from typing import Tuple, Dict
import numpy as np
import soundfile as sf
import torch
import torchaudio

from backend.app.core.config import settings


class AudioValidationError(Exception):
    """Raised when uploaded audio fails clinical quality or duration checks."""
    pass


def load_and_preprocess_audio(file_bytes: bytes, filename: str) -> Tuple[np.ndarray, Dict]:
    """
    Decodes audio bytes, converts to mono, resamples to 16 kHz,
    and returns normalized float32 waveform along with quality metrics.
    """
    if len(file_bytes) > settings.MAX_FILE_SIZE_BYTES:
        raise AudioValidationError(f"File size exceeds maximum permitted limit ({settings.MAX_FILE_SIZE_BYTES / (1024*1024):.1f} MB).")

    # Read audio using soundfile (WAV, FLAC, OGG), torchaudio, or bundled imageio-ffmpeg (WebM, Opus, M4A, MP4, MP3)
    data = None
    original_sr = None

    try:
        data, original_sr = sf.read(io.BytesIO(file_bytes))
    except Exception:
        pass

    if data is None:
        try:
            tensor, original_sr = torchaudio.load(io.BytesIO(file_bytes))
            data = tensor.squeeze().numpy()
        except Exception:
            pass

    if data is None:
        try:
            import os
            import subprocess
            import tempfile
            import imageio_ffmpeg

            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            if file_bytes[:4] == b"\x1a\x45\xdf\xa3":
                ext = ".webm"
            elif b"ftyp" in file_bytes[:16]:
                ext = ".m4a"
            elif file_bytes[:4] == b"OggS":
                ext = ".ogg"
            elif file_bytes[:3] == b"ID3" or file_bytes[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
                ext = ".mp3"
            elif file_bytes[:4] == b"fLaC":
                ext = ".flac"
            elif file_bytes[:4] == b"RIFF":
                ext = ".wav"
            else:
                ext = os.path.splitext(filename or "")[1] or ".webm"
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp_in:
                tmp_in.write(file_bytes)
                tmp_in_path = tmp_in.name
            tmp_out_path = tmp_in_path + "_decoded.wav"
            try:
                subprocess.run(
                    [
                        ffmpeg_exe,
                        "-y",
                        "-i",
                        tmp_in_path,
                        "-vn",
                        "-ac",
                        "1",
                        "-ar",
                        str(settings.TARGET_SAMPLE_RATE),
                        "-f",
                        "wav",
                        tmp_out_path,
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=True,
                )
                data, original_sr = sf.read(tmp_out_path, dtype="float32")
            finally:
                for p in (tmp_in_path, tmp_out_path):
                    try:
                        if os.path.exists(p):
                            os.remove(p)
                    except OSError:
                        pass
        except Exception:
            pass

    if data is None:
        try:
            import pydub
            try:
                import imageio_ffmpeg
                pydub.AudioSegment.converter = imageio_ffmpeg.get_ffmpeg_exe()
            except Exception:
                pass
            seg = pydub.AudioSegment.from_file(io.BytesIO(file_bytes))
            original_sr = seg.frame_rate
            channels = seg.channels
            raw = np.array(seg.get_array_of_samples(), dtype=np.float32)
            max_val = float(1 << (8 * seg.sample_width - 1))
            if max_val > 0:
                raw = raw / max_val
            if channels > 1:
                raw = raw.reshape(-1, channels)
            data = raw
        except Exception:
            raise AudioValidationError(
                f"Unable to decode audio format for '{filename}'. Please provide standard 16-bit WAV, MP3, WebM, M4A, or FLAC."
            )

    # Handle stereo to mono conversion
    if data.ndim > 1:
        channels = data.shape[1] if data.shape[0] > data.shape[1] else data.shape[0]
        data = np.mean(data, axis=1 if data.shape[1] == channels else 0)
    else:
        channels = 1

    # Resample to 16,000 Hz if necessary
    if original_sr != settings.TARGET_SAMPLE_RATE:
        tensor = torch.from_numpy(data).float().unsqueeze(0)
        resampler = torchaudio.transforms.Resample(orig_freq=original_sr, new_freq=settings.TARGET_SAMPLE_RATE)
        data = resampler(tensor).squeeze(0).numpy()

    # 1. 75 Hz High-pass filter to strip microphone DC offset, pop rumble, 50/60 Hz mains hum, and fan/AC low rumble
    try:
        import scipy.signal
        sos = scipy.signal.butter(4, 75, "hp", fs=settings.TARGET_SAMPLE_RATE, output="sos")
        data = scipy.signal.sosfilt(sos, data).astype(np.float32)
    except Exception:
        pass

    # Estimate ambient noise floor vs speech level for dynamic SNR-aware VAD
    frame_len = int(0.05 * settings.TARGET_SAMPLE_RATE)
    if len(data) > frame_len * 5:
        frames = [data[i:i + frame_len] for i in range(0, len(data) - frame_len, frame_len)]
        frame_rms = [float(np.sqrt(np.mean(fr**2) + 1e-9)) for fr in frames]
        p10_rms = float(np.percentile(frame_rms, 10))
        p90_rms = float(np.percentile(frame_rms, 90))
        snr_db = float(20 * np.log10((p90_rms + 1e-9) / (p10_rms + 1e-9)))
        # Adaptive VAD top_db: when SNR is tight (e.g. 15-20 dB from 60 dB room noise),
        # clamp top_db so room noise isn't treated as speech and speech isn't clipped
        adaptive_top_db = float(np.clip(snr_db - 4.0, 14.0, 28.0))
    else:
        snr_db = 30.0
        adaptive_top_db = 25.0

    # 2. Silence trimming (VAD): Adaptive top_db matches training dataset preparation
    # Prevents dead air before/after recording from skewing Wav2Vec 2.0 temporal mean pooling
    try:
        import librosa
        trimmed, _ = librosa.effects.trim(data, top_db=adaptive_top_db)
        # Keep speech frames if trimmed signal has audible content
        if len(trimmed) >= int(settings.MIN_AUDIO_DURATION_SEC * settings.TARGET_SAMPLE_RATE):
            data = trimmed

        # For long speech utterances (> 5s), concatenate active speech intervals (remove long pauses)
        if len(data) > int(5.0 * settings.TARGET_SAMPLE_RATE):
            intervals = librosa.effects.split(data, top_db=adaptive_top_db)
            if len(intervals) > 0:
                speech_only = np.concatenate([data[s:e] for s, e in intervals])
                if len(speech_only) >= int(settings.MIN_AUDIO_DURATION_SEC * settings.TARGET_SAMPLE_RATE):
                    data = speech_only
    except Exception:
        pass

    duration_sec = len(data) / settings.TARGET_SAMPLE_RATE

    if duration_sec < settings.MIN_AUDIO_DURATION_SEC:
        raise AudioValidationError(
            f"Speech duration ({duration_sec:.2f}s) is too short for reliable motor speech evaluation. "
            f"Please speak clearly for at least {settings.MIN_AUDIO_DURATION_SEC}s."
        )

    # 3. Robust 99.9th percentile normalization (matching data_loading.py)
    peak_amp = float(np.max(np.abs(data)))
    is_clipping = bool(peak_amp >= 0.99)

    if peak_amp < 0.005:
        raise AudioValidationError(
            "Audio waveform appears nearly silent or unrecorded. Please ensure your microphone is active and speaking volume is audible."
        )

    # Measure RMS BEFORE peak normalization — used in inference to detect quiet mics
    rms_before_norm = float(np.sqrt(np.mean(data**2)))
    input_rms_db = float(20 * np.log10(rms_before_norm + 1e-10))

    p999 = float(np.percentile(np.abs(data), 99.9))
    if p999 > 0:
        data_normalized = np.clip(data, -p999, p999) / p999
    else:
        data_normalized = data / (peak_amp + 1e-8)

    quality_metrics = {
        "duration_seconds": round(float(duration_sec), 2),
        "sample_rate": int(settings.TARGET_SAMPLE_RATE),
        "channels": int(channels),
        "peak_amplitude": round(peak_amp, 4),
        "is_clipping": is_clipping,
        "snr_db": round(float(snr_db), 1),
        "input_rms_db": round(input_rms_db, 1),
    }

    return data_normalized.astype(np.float32), quality_metrics
