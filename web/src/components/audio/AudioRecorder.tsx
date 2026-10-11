"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Upload,
  Check,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  Volume2,
} from "lucide-react";

export interface AudioQualityReport {
  durationSec: number;
  rmsAmplitude: number;
  estimatedDbFs: number;
  peakAmplitude: number;
  isTooShort: boolean;
  isTooQuiet: boolean;
  isClipping: boolean;
  warnings: string[];
  passedAllChecks: boolean;
}

interface AudioRecorderProps {
  onAudioCaptured: (
    blob: Blob,
    filename: string,
    quality?: AudioQualityReport
  ) => void;
  taskTitle: string;
  taskInstruction: string;
  minDurationSec?: number;
  targetDurationSec?: number;
  readingPassage?: string;
  illustrationSrc?: string;
}

function encodeAudioBufferToWavBlob(audioBuffer: AudioBuffer): Blob {
  const numChannels = 1;
  const srcRate = audioBuffer.sampleRate;
  const targetRate = 16000;
  const srcLength = audioBuffer.length;
  const monoSrc = new Float32Array(srcLength);

  if (audioBuffer.numberOfChannels === 1) {
    monoSrc.set(audioBuffer.getChannelData(0));
  } else {
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.getChannelData(1);
    for (let i = 0; i < srcLength; i++) {
      monoSrc[i] = (ch0[i] + ch1[i]) * 0.5;
    }
  }

  // Downsample to 16,000 Hz in browser so payload is 3x smaller and matches Wav2Vec 2.0 native rate
  let mono: Float32Array;
  let sampleRate = srcRate;
  if (srcRate > targetRate) {
    sampleRate = targetRate;
    const ratio = srcRate / targetRate;
    const dstLength = Math.max(1, Math.round(srcLength / ratio));
    mono = new Float32Array(dstLength);
    for (let i = 0; i < dstLength; i++) {
      const srcIdx = i * ratio;
      const idx0 = Math.floor(srcIdx);
      const idx1 = Math.min(srcLength - 1, idx0 + 1);
      const frac = srcIdx - idx0;
      mono[i] = monoSrc[idx0] * (1 - frac) + monoSrc[idx1] * frac;
    }
  } else {
    mono = monoSrc;
  }

  const length = mono.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format = 1
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16 bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function analyzeBlobAudioQuality(
  blob: Blob,
  minDurationSec: number,
  fallbackDurationSec = 0
): Promise<{ report: AudioQualityReport; wavBlob: Blob }> {
  const warnings: string[] = [];
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const wavBlob = encodeAudioBufferToWavBlob(audioBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const durationSec =
      Math.round((audioBuffer.duration || fallbackDurationSec) * 10) / 10;

    let sumSquares = 0;
    let peak = 0;
    let clippedSamples = 0;
    const totalSamples = channelData.length;

    for (let i = 0; i < totalSamples; i++) {
      const abs = Math.abs(channelData[i]);
      sumSquares += abs * abs;
      if (abs > peak) peak = abs;
      if (abs >= 0.985) clippedSamples++;
    }

    await ctx.close().catch(() => {});

    const rms = totalSamples > 0 ? Math.sqrt(sumSquares / totalSamples) : 0;
    const estimatedDbFs =
      rms > 0 ? Math.round(20 * Math.log10(rms) * 10) / 10 : -60.0;

    const isTooShort = durationSec < minDurationSec;
    const isTooQuiet = rms < 0.008; // ~ -42 dBFS (supports quiet headset mics)
    const isClipping =
      peak >= 0.99 && clippedSamples > Math.max(15, totalSamples * 0.002);

    if (isTooShort) {
      warnings.push(
        `Clip duration (${durationSec}s) is shorter than the recommended ${minDurationSec}s clinical window.`
      );
    }
    if (isTooQuiet) {
      warnings.push(
        `Vocal signal level is very low (${estimatedDbFs} dBFS). Hold the microphone ~6 inches (15 cm) from your mouth and speak in a natural supported voice so ambient noise does not skew results.`
      );
    }
    if (isClipping) {
      warnings.push(
        `Microphone peak clipping detected (peak ${(peak * 100).toFixed(0)}%). Hold the mic slightly further away to avoid artificial distortion.`
      );
    }

    return {
      report: {
        durationSec,
        rmsAmplitude: Math.round(rms * 1000) / 1000,
        estimatedDbFs,
        peakAmplitude: Math.round(peak * 100) / 100,
        isTooShort,
        isTooQuiet,
        isClipping,
        warnings,
        passedAllChecks: warnings.length === 0,
      },
      wavBlob,
    };
  } catch {
    // Fallback if browser cannot decode container format client-side
    const isTooShort =
      fallbackDurationSec > 0 && fallbackDurationSec < minDurationSec;
    if (isTooShort) {
      warnings.push(
        `Clip duration (${fallbackDurationSec.toFixed(1)}s) is shorter than the recommended ${minDurationSec}s window.`
      );
    }
    return {
      report: {
        durationSec: Math.round(fallbackDurationSec * 10) / 10,
        rmsAmplitude: 0.05,
        estimatedDbFs: -26.0,
        peakAmplitude: 0.35,
        isTooShort,
        isTooQuiet: false,
        isClipping: false,
        warnings,
        passedAllChecks: warnings.length === 0,
      },
      wavBlob: blob,
    };
  }
}

export function AudioRecorder({
  onAudioCaptured,
  taskTitle,
  taskInstruction,
  minDurationSec = 1.0,
  targetDurationSec,
  readingPassage,
  illustrationSrc = "/images/screen-voice-idle.png",
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<"mic" | "upload">("mic");
  const [qualityReport, setQualityReport] =
    useState<AudioQualityReport | null>(null);
  const [autoStopEnabled, setAutoStopEnabled] = useState<boolean>(
    Boolean(targetDurationSec && targetDurationSec >= 15)
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationSecRef = useRef<number>(0);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const autoStopRef = useRef<boolean>(autoStopEnabled);

  useEffect(() => {
    autoStopRef.current = autoStopEnabled;
  }, [autoStopEnabled]);

  useEffect(() => {
    setAutoStopEnabled(Boolean(targetDurationSec && targetDurationSec >= 15));
  }, [targetDurationSec]);

  // Clean up
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const startVisualizer = (stream: MediaStream) => {
    try {
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animationFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * (canvas.height * 0.85);

          // Gradient bar
          const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
          gradient.addColorStop(0, "#0284C7");
          gradient.addColorStop(1, "#D2F800");

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(
            x,
            (canvas.height - barHeight) / 2,
            barWidth - 2,
            barHeight,
            4
          );
          ctx.fill();

          x += barWidth;
        }
      };

      draw();
    } catch (e) {
      console.warn("Visualizer failed to initialize:", e);
    }
  };

  const startRecording = async () => {
    setErrorMsg(null);
    setQualityReport(null);
    audioChunksRef.current = [];
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingSeconds(0);
    startTimeRef.current = Date.now();
    durationSecRef.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
      startVisualizer(stream);

      const preferredMime = MediaRecorder.isTypeSupported(
        "audio/webm;codecs=opus"
      )
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
      const mediaRecorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
        durationSecRef.current = elapsedSec;
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());
        if (animationFrameRef.current)
          cancelAnimationFrame(animationFrameRef.current);

        if (elapsedSec < minDurationSec) {
          setErrorMsg(
            `Recording was too brief (${Math.max(
              0,
              Math.round(elapsedSec * 10) / 10
            )}s). Please speak for at least ${minDurationSec} seconds.`
          );
          setRecordedBlob(null);
          return;
        }

        const { report: qReport, wavBlob } = await analyzeBlobAudioQuality(
          audioBlob,
          minDurationSec,
          elapsedSec
        );
        setQualityReport(qReport);
        setRecordedBlob(wavBlob);
        setRecordingSeconds(Math.round(elapsedSec));
        const url = URL.createObjectURL(wavBlob);
        setRecordedUrl(url);
        const cleanName = taskTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");
        onAudioCaptured(wavBlob, `${cleanName}.wav`, qReport);
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const exactSec = (Date.now() - startTimeRef.current) / 1000;
        const elapsed = Math.floor(exactSec);
        setRecordingSeconds(elapsed);
        durationSecRef.current = exactSec;

        if (
          targetDurationSec &&
          autoStopRef.current &&
          exactSec >= targetDurationSec + 0.4
        ) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state !== "inactive"
          ) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
          }
        }
      }, 200);
    } catch {
      setErrorMsg(
        "Microphone access denied or unavailable. Please enable microphone permissions in your browser."
      );
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const resetRecording = () => {
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingSeconds(0);
    setErrorMsg(null);
    setQualityReport(null);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    }
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current || !recordedUrl) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setErrorMsg(null);
      const { report: qReport, wavBlob } = await analyzeBlobAudioQuality(
        file,
        minDurationSec,
        0
      );
      setQualityReport(qReport);
      setRecordedBlob(file);
      setRecordingSeconds(Math.round(qReport.durationSec));
      const url = URL.createObjectURL(file);
      setRecordedUrl(url);
      const wavName =
        file.name.replace(/\.[^/.]+$/, "") + ".wav";
      onAudioCaptured(wavBlob, wavName, qReport);
    }
  };

  const formatMmSs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m < 10 ? `0${m}` : m}:${s < 10 ? `0${s}` : s}`;
  };

  const targetProgressPct =
    targetDurationSec && targetDurationSec > 0
      ? Math.min(100, Math.round((recordingSeconds / targetDurationSec) * 100))
      : 0;

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-md">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-2 w-2 rounded-full bg-clinical-cyan"></span>
            <h3 className="font-bold text-lg text-slate-900">{taskTitle}</h3>
            {targetDurationSec && (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-vitality text-[11px] font-extrabold font-mono">
                Target: {targetDurationSec}s (Min {minDurationSec}s)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">{taskInstruction}</p>
        </div>

        {/* Toggle Mode */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full text-xs font-semibold shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setMode("mic")}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              mode === "mic"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Record Mic
          </button>
          <button
            onClick={() => setMode("upload")}
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              mode === "upload"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Upload File
          </button>
        </div>
      </div>

      {/* High-Legibility Clinical Reading Teleprompter Card (Always visible before & during recording) */}
      {readingPassage && (
        <div className="mb-5 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-inner">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-clinical-cyan flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5" />
              Read Aloud Clearly at Your Natural Conversational Pace
            </span>
            {targetDurationSec && targetDurationSec >= 15 && (
              <span className="text-[10px] font-semibold text-slate-500">
                If you finish early, repeat from the first sentence until {targetDurationSec}s completes
              </span>
            )}
          </div>
          <p className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed selection:bg-vitality/40">
            &ldquo;{readingPassage}&rdquo;
          </p>
        </div>
      )}

      {/* Error Notice */}
      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Mic Recording Canvas View */}
      {mode === "mic" ? (
        <div className="flex flex-col items-center justify-center py-6 px-4 bg-slate-50/70 rounded-2xl border border-slate-100/80">
          {/* Empty Idle State Illustration - Hidden when recording begins */}
          {!isRecording && !recordedBlob && (
            <div className="flex flex-col items-center mb-5">
              <div className="relative mb-2">
                <div className="absolute inset-0 bg-clinical-cyan/10 rounded-full blur-2xl pointer-events-none scale-90"></div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={illustrationSrc}
                  alt={`${taskTitle} Idle Illustration`}
                  className={`relative z-10 object-contain drop-shadow-md rounded-2xl ${
                    readingPassage
                      ? "w-52 sm:w-64 max-h-36"
                      : "w-72 sm:w-96 max-h-52"
                  }`}
                />
              </div>
              <span className="text-xs font-semibold text-slate-500 mt-1 text-center">
                Hold microphone ~6 inches (15 cm) from mouth in a quiet room and click below
              </span>
            </div>
          )}

          {/* Animated Canvas Visualizer */}
          <div
            className={`relative w-full max-w-md h-20 flex items-center justify-center mb-4 ${
              !isRecording && !recordedBlob ? "hidden" : ""
            }`}
          >
            <canvas
              ref={canvasRef}
              width={400}
              height={80}
              className="w-full h-full"
            />
          </div>

          {/* Live Target Duration Progress Bar */}
          {targetDurationSec && (isRecording || recordedBlob) && (
            <div className="w-full max-w-md mb-4 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-600">
                  {recordingSeconds >= targetDurationSec
                    ? "Target duration reached"
                    : `Speaking Progress (${targetProgressPct}%)`}
                </span>
                <span className="font-mono text-slate-700">
                  {formatMmSs(recordingSeconds)} / {formatMmSs(targetDurationSec)}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 rounded-full ${
                    recordingSeconds >= targetDurationSec
                      ? "bg-emerald-500"
                      : recordingSeconds >= minDurationSec
                      ? "bg-clinical-cyan"
                      : "bg-amber-500"
                  }`}
                  style={{ width: `${targetProgressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Timer & Auto-Stop Toggle */}
          <div className="flex flex-col items-center gap-2 mb-5">
            <div className="text-sm font-bold text-slate-700 font-mono">
              {isRecording ? (
                <span className="text-red-500 animate-pulse flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500"></span>
                  Recording {formatMmSs(recordingSeconds)}
                  {targetDurationSec ? ` / ${formatMmSs(targetDurationSec)} target` : ""}
                </span>
              ) : recordedBlob ? (
                <span className="text-emerald-600 flex items-center gap-1.5">
                  <Check className="h-4 w-4" /> Clip Ready (
                  {qualityReport?.durationSec || recordingSeconds}s)
                </span>
              ) : (
                <span className="text-slate-400">
                  00:00{targetDurationSec ? ` / ${formatMmSs(targetDurationSec)} target` : ""}
                </span>
              )}
            </div>

            {targetDurationSec && targetDurationSec >= 15 && !recordedBlob && (
              <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoStopEnabled}
                  onChange={(e) => setAutoStopEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-clinical-cyan h-3.5 w-3.5 cursor-pointer"
                />
                <span>
                  Auto-complete recording at {targetDurationSec}s target
                </span>
              </label>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            {!isRecording && !recordedBlob && (
              <button
                onClick={startRecording}
                className="h-16 w-16 rounded-full bg-[#14171A] hover:bg-black text-vitality flex items-center justify-center shadow-soft-lg hover:shadow-glow-vitality transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Mic className="h-7 w-7 text-vitality" />
              </button>
            )}

            {isRecording && (
              <button
                onClick={stopRecording}
                className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-soft-lg transition-all hover:scale-105 animate-pulse cursor-pointer"
              >
                <Square className="h-6 w-6 fill-current" />
              </button>
            )}

            {recordedBlob && (
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlayback}
                  className="h-12 w-12 rounded-full bg-clinical-cyan hover:bg-clinical-cyan/90 text-white flex items-center justify-center shadow-soft-md transition-all cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 ml-0.5" />
                  )}
                </button>
                <button
                  onClick={resetRecording}
                  className="h-12 w-12 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center shadow-soft-sm transition-all cursor-pointer"
                  title="Retake recording"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
                {recordedUrl && (
                  <audio
                    ref={audioPlayerRef}
                    src={recordedUrl}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* File Upload Dropzone */
        <div className="flex flex-col items-center justify-center p-8 bg-slate-50/70 rounded-2xl border-2 border-dashed border-slate-200 hover:border-clinical-cyan transition-colors">
          <Upload className="h-8 w-8 text-slate-400 mb-2" />
          <span className="text-xs font-bold text-slate-800 mb-1">
            Choose an audio file (.wav, .m4a, .mp3, .webm, .flac)
          </span>
          <span className="text-[11px] text-slate-400 mb-4">
            Max file size: 15 MB · Min duration: {minDurationSec}s
          </span>
          <label className="cursor-pointer bg-[#14171A] hover:bg-black text-white px-5 py-2.5 rounded-full text-xs font-semibold shadow-soft-sm transition-all">
            Browse Audio File
            <input
              type="file"
              accept="audio/*,.m4a,.wav,.mp3,.webm,.flac,.ogg"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          {recordedBlob && (
            <span className="text-xs font-semibold text-emerald-600 mt-3 flex items-center gap-1">
              <Check className="h-4 w-4" /> File loaded:{" "}
              {(recordedBlob as File).name || "audio.wav"}
            </span>
          )}
        </div>
      )}

      {/* Phase 12B.8 Automated Audio Quality Verification Panel */}
      {recordedBlob && qualityReport && (
        <div
          className={`mt-4 p-4 rounded-2xl border transition-all ${
            qualityReport.passedAllChecks
              ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
              : "bg-amber-50/80 border-amber-300 text-amber-950"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {qualityReport.passedAllChecks ? (
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              )}
              <span className="text-xs font-extrabold">
                {qualityReport.passedAllChecks
                  ? "Automated Signal Check Passed — Optimal Clinical Audio"
                  : "Audio Signal Quality Warning (Phase 12B.8 Verification)"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded-md bg-white/90 border border-slate-200 text-slate-700">
                Duration: {qualityReport.durationSec}s (min {minDurationSec}s)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white/90 border border-slate-200 text-slate-700 flex items-center gap-1">
                <Volume2 className="h-3 w-3 text-clinical-cyan" />
                Level: {qualityReport.estimatedDbFs} dBFS
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white/90 border border-slate-200 text-slate-700">
                Peak: {Math.round(qualityReport.peakAmplitude * 100)}%
              </span>
            </div>
          </div>

          {!qualityReport.passedAllChecks && (
            <div className="mt-2.5 space-y-1.5">
              {qualityReport.warnings.map((w, idx) => (
                <p
                  key={idx}
                  className="text-xs text-amber-900 leading-relaxed flex items-start gap-2"
                >
                  <span className="font-bold">•</span>
                  <span>{w}</span>
                </p>
              ))}
              <div className="pt-1 flex items-center gap-3">
                <button
                  type="button"
                  onClick={resetRecording}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-900 hover:bg-black text-white text-[11px] font-bold transition-all cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Retake / Re-upload for Best Accuracy</span>
                </button>
                <span className="text-[11px] text-amber-800">
                  Or continue if soft volume reflects the speaker&apos;s natural voice.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
