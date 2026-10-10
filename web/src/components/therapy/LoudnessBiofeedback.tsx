"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  MicOff,
  Flame,
  RotateCcw,
  Info,
  CheckCircle2,
  Sliders,
  Volume2,
  Loader2,
} from "lucide-react";

type FeedbackZone = "inactive" | "soft" | "optimal" | "loud";

export function LoudnessBiofeedback() {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [currentDb, setCurrentDb] = useState<number>(32);
  const [peakDb, setPeakDb] = useState<number>(32);
  const [ambientBaseline, setAmbientBaseline] = useState<number>(32);
  const [micBoostDb, setMicBoostDb] = useState<number>(0);
  // Default target is +12 to +24 dB above baseline (44–56 dB for a 32 dB quiet mic)
  const [targetMinDb, setTargetMinDb] = useState<number>(44);
  const [targetMaxDb, setTargetMaxDb] = useState<number>(58);
  const [feedbackZone, setFeedbackZone] = useState<FeedbackZone>("inactive");
  const [timeInZoneSec, setTimeInZoneSec] = useState<number>(0);
  const [challengeSuccess, setChallengeSuccess] = useState<boolean>(false);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibratedNotice, setCalibratedNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const dbHistoryRef = useRef<number[]>([]);
  const smoothedDbRef = useRef<number>(32);
  const lastUiUpdateMsRef = useRef<number>(0);
  const zoneTimerRef = useRef<number>(0);
  const currentZoneRef = useRef<FeedbackZone>("soft");
  const calibrationSamplesRef = useRef<number[] | null>(null);

  // Keep refs in sync with state so requestAnimationFrame loop reads latest thresholds
  const targetMinRef = useRef<number>(targetMinDb);
  const targetMaxRef = useRef<number>(targetMaxDb);
  const ambientBaselineRef = useRef<number>(ambientBaseline);
  const micBoostRef = useRef<number>(micBoostDb);
  const challengeSuccessRef = useRef<boolean>(challengeSuccess);
  const isCalibratingRef = useRef<boolean>(isCalibrating);
  const calibrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    targetMinRef.current = targetMinDb;
    targetMaxRef.current = targetMaxDb;
  }, [targetMinDb, targetMaxDb]);

  useEffect(() => {
    ambientBaselineRef.current = ambientBaseline;
  }, [ambientBaseline]);

  useEffect(() => {
    micBoostRef.current = micBoostDb;
  }, [micBoostDb]);

  useEffect(() => {
    challengeSuccessRef.current = challengeSuccess;
  }, [challengeSuccess]);

  useEffect(() => {
    isCalibratingRef.current = isCalibrating;
  }, [isCalibrating]);

  const resetChallengeProgress = useCallback(() => {
    zoneTimerRef.current = 0;
    challengeSuccessRef.current = false;
    setTimeInZoneSec(0);
    setChallengeSuccess(false);
  }, []);

  const stopListening = useCallback(() => {
    if (calibrationTimeoutRef.current) {
      clearTimeout(calibrationTimeoutRef.current);
      calibrationTimeoutRef.current = null;
    }
    calibrationSamplesRef.current = null;
    isCalibratingRef.current = false;
    setIsCalibrating(false);

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsListening(false);
    setFeedbackZone("inactive");
  }, []);

  // Stop listening when unmounted
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  const drawCanvasHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const history = dbHistoryRef.current;
    if (history.length < 2) return;

    const minThresh = targetMinRef.current;
    const maxThresh = targetMaxRef.current;
    const step = canvas.width / (80 - 1);

    // Draw Target Zone Band
    const minNormY =
      canvas.height - ((minThresh - 25) / (95 - 25)) * canvas.height;
    const maxNormY =
      canvas.height - ((maxThresh - 25) / (95 - 25)) * canvas.height;

    ctx.fillStyle = "rgba(16, 185, 129, 0.16)";
    ctx.fillRect(0, maxNormY, canvas.width, minNormY - maxNormY);

    // Target line boundaries
    ctx.strokeStyle = "rgba(16, 185, 129, 0.45)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, minNormY);
    ctx.lineTo(canvas.width, minNormY);
    ctx.moveTo(0, maxNormY);
    ctx.lineTo(canvas.width, maxNormY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Smooth History Line
    ctx.beginPath();
    ctx.lineWidth = 2.5;

    for (let i = 0; i < history.length; i++) {
      const val = history[i];
      const x = i * step;
      const y = canvas.height - ((val - 25) / (95 - 25)) * canvas.height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    const lastVal = history[history.length - 1];
    const isTarget = lastVal >= minThresh && lastVal <= maxThresh;
    ctx.strokeStyle = isTarget
      ? "#D2F800"
      : lastVal > maxThresh
      ? "#EF4444"
      : "#0284C7";
    ctx.stroke();
  }, []);

  const triggerRoomTare = useCallback(
    (durationMs = 1600, isAutoOnStart = false) => {
      if (calibrationTimeoutRef.current) {
        clearTimeout(calibrationTimeoutRef.current);
      }
      // Always wipe any challenge progress before & after taring so background noise never counts
      resetChallengeProgress();
      setIsCalibrating(true);
      isCalibratingRef.current = true;
      setCalibratedNotice(null);
      calibrationSamplesRef.current = null;

      // Wait for microphone hardware driver warm-up (900ms on initial start) or mouse-click decay (300ms on manual Tare)
      // so initial 25 dB silence frames or button-click pops never enter the baseline calculation
      const warmupMs = isAutoOnStart ? 900 : 300;

      calibrationTimeoutRef.current = setTimeout(() => {
        calibrationSamplesRef.current = [];

        calibrationTimeoutRef.current = setTimeout(() => {
          const rawSamples = calibrationSamplesRef.current || [];
          calibrationSamplesRef.current = null;
          setIsCalibrating(false);
          isCalibratingRef.current = false;

          // Filter out any dead hardware frames (<= 26 dB) if non-silent frames exist
          const nonZeroSamples = rawSamples.filter((v) => v > 26.5);
          const activeSamples =
            nonZeroSamples.length >= 5 ? nonZeroSamples : rawSamples;

          let settledFloor = Math.round(smoothedDbRef.current);
          if (activeSamples.length > 0) {
            const sorted = [...activeSamples].sort((a, b) => a - b);
            // Trim bottom 25% (startup dips/dropouts) and top 10% (transient pops)
            const startIdx = Math.floor(sorted.length * 0.25);
            const endIdx = Math.max(
              startIdx + 1,
              Math.ceil(sorted.length * 0.9)
            );
            const trimmed = sorted.slice(startIdx, endIdx);
            // Use the 75th percentile of the settled band so normal room noise stays below the target zone
            const p75 =
              trimmed[Math.min(trimmed.length - 1, Math.floor(trimmed.length * 0.75))];
            settledFloor = Math.round(
              Math.max(p75, smoothedDbRef.current)
            );
          }

          const clampedFloor = Math.max(28, Math.min(72, settledFloor));
          smoothedDbRef.current = clampedFloor;
          ambientBaselineRef.current = clampedFloor;
          setCurrentDb(clampedFloor);
          setAmbientBaseline(clampedFloor);
          setPeakDb(clampedFloor);
          dbHistoryRef.current = [clampedFloor, clampedFloor];

          // Relative target calibration (+10 to +22 dB above settled ambient floor)
          const newMin = Math.min(78, clampedFloor + 10);
          const newMax = Math.min(92, clampedFloor + 22);
          targetMinRef.current = newMin;
          targetMaxRef.current = newMax;
          setTargetMinDb(newMin);
          setTargetMaxDb(newMax);

          // Reset challenge timer & zone again once new baseline is locked
          currentZoneRef.current = "soft";
          setFeedbackZone("soft");
          resetChallengeProgress();
          drawCanvasHistory();

          setCalibratedNotice(
            isAutoOnStart
              ? `Auto-calibrated settled room baseline at ${clampedFloor} dB → Target Zone set to ${newMin}–${newMax} dB (+10 dB above room).`
              : `Tare complete! Settled baseline locked at ${clampedFloor} dB → Target Zone set to ${newMin}–${newMax} dB & 5s Challenge reset.`
          );
        }, durationMs);
      }, warmupMs);
    },
    [resetChallengeProgress, drawCanvasHistory]
  );

  const startListening = async () => {
    setErrorMessage(null);
    resetChallengeProgress();
    dbHistoryRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.85;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      setIsListening(true);
      setFeedbackZone("soft");
      currentZoneRef.current = "soft";

      // Automatically tare the room's ambient noise after 900ms mic warm-up + 1.5s settled sampling
      triggerRoomTare(1500, true);

      const bufferLength = analyser.fftSize;
      const dataArray = new Float32Array(bufferLength);

      let lastFrameTime = performance.now();
      lastUiUpdateMsRef.current = performance.now();
      let warmupFramesRemaining = 25; // ~400ms of non-zero audio frames before EMA locks in

      const updateLoudness = () => {
        animFrameRef.current = requestAnimationFrame(updateLoudness);
        analyser.getFloatTimeDomainData(dataArray);

        // Compute Root Mean Square (RMS) of audio waveform
        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
          sumSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSquares / bufferLength);

        // Convert RMS to calibrated dB SPL with optional user microphone gain boost
        const rawDb =
          20 * Math.log10(Math.max(rms, 0.00001)) + 92 + micBoostRef.current;
        const clampedInstantDb = Math.max(25, Math.min(95, rawDb));

        // During initial microphone hardware warm-up, snap faster to real signal so 25 dB zeros don't drag down EMA
        if (rms > 0.00005 && warmupFramesRemaining > 0) {
          warmupFramesRemaining--;
          smoothedDbRef.current =
            smoothedDbRef.current * 0.5 + clampedInstantDb * 0.5;
        } else if (rms > 0.00002) {
          // Heavy Exponential Moving Average (EMA) to prevent rapid jitter
          smoothedDbRef.current =
            smoothedDbRef.current * 0.88 + clampedInstantDb * 0.12;
        }
        const smoothDbRounded = Math.round(smoothedDbRef.current);

        // Collect settled samples if Room Tare sampling window is active
        if (calibrationSamplesRef.current !== null && rms > 0.00002) {
          calibrationSamplesRef.current.push(clampedInstantDb);
        }

        const now = performance.now();
        const deltaSec = (now - lastFrameTime) / 1000;
        lastFrameTime = now;

        const minT = targetMinRef.current;
        const maxT = targetMaxRef.current;
        const baseT = ambientBaselineRef.current;

        // While calibrating, keep zone in 'soft' and freeze the 5s challenge timer at 0
        if (isCalibratingRef.current) {
          currentZoneRef.current = "soft";
          zoneTimerRef.current = 0;
        } else {
          // Require genuine vocal projection (+9 dB above ambient baseline AND >= minT)
          const effectiveMinT = Math.max(minT, baseT + 9);

          // Hysteresis (+/- 1.5 dB) so the status badge never flickers at boundary edges
          let nextZone = currentZoneRef.current;
          if (nextZone === "optimal") {
            if (smoothedDbRef.current < effectiveMinT - 1.5) nextZone = "soft";
            else if (smoothedDbRef.current > maxT + 1.5) nextZone = "loud";
          } else if (nextZone === "soft") {
            if (
              smoothedDbRef.current >= effectiveMinT + 0.5 &&
              smoothedDbRef.current <= maxT
            ) {
              nextZone = "optimal";
            } else if (smoothedDbRef.current > maxT + 1.0) {
              nextZone = "loud";
            }
          } else if (nextZone === "loud") {
            if (
              smoothedDbRef.current <= maxT - 0.5 &&
              smoothedDbRef.current >= effectiveMinT
            ) {
              nextZone = "optimal";
            } else if (smoothedDbRef.current < effectiveMinT - 1.0) {
              nextZone = "soft";
            }
          }
          currentZoneRef.current = nextZone;

          // Accumulate 5-second hold timer ONLY when genuinely projecting above ambient baseline inside target zone
          if (
            smoothedDbRef.current >= effectiveMinT - 1.0 &&
            smoothedDbRef.current <= maxT + 2.0
          ) {
            zoneTimerRef.current = Math.min(
              5.0,
              zoneTimerRef.current + deltaSec
            );
            if (zoneTimerRef.current >= 5.0 && !challengeSuccessRef.current) {
              challengeSuccessRef.current = true;
              setChallengeSuccess(true);
            }
          } else if (zoneTimerRef.current > 0 && !challengeSuccessRef.current) {
            zoneTimerRef.current = Math.max(
              0,
              zoneTimerRef.current - deltaSec * 0.35
            );
          }
        }

        // Throttle UI state & canvas updates to once every 260ms (~3.8 FPS) so numbers are readable and calm
        if (now - lastUiUpdateMsRef.current >= 260) {
          lastUiUpdateMsRef.current = now;
          setCurrentDb(smoothDbRounded);
          setPeakDb((prev) => Math.max(prev, smoothDbRounded));
          setFeedbackZone(currentZoneRef.current);
          setTimeInZoneSec(Math.round(zoneTimerRef.current * 10) / 10);

          dbHistoryRef.current.push(smoothDbRounded);
          if (dbHistoryRef.current.length > 80) {
            dbHistoryRef.current.shift();
          }
          drawCanvasHistory();
        }
      };

      updateLoudness();
    } catch {
      setErrorMessage(
        "Microphone access was denied. Please grant microphone permissions to use visual biofeedback."
      );
      setIsListening(false);
    }
  };

  // True 1.5-second Averaged Ambient Room & Microphone Baseline Tare
  const calibrateAmbientRoom = () => {
    if (!isListening || isCalibrating) return;
    triggerRoomTare(1400, false);
  };

  const applyLowVolumeHeadsetPreset = () => {
    setMicBoostDb(15);
    micBoostRef.current = 15;
    setAmbientBaseline(32);
    ambientBaselineRef.current = 32;
    setTargetMinDb(44);
    targetMinRef.current = 44;
    setTargetMaxDb(58);
    targetMaxRef.current = 58;
    resetChallengeProgress();
    setCalibratedNotice(
      "Low-Volume Headset Mic Preset applied (+15 dB sensitivity boost, 44–58 dB target zone) & Challenge reset."
    );
  };

  const isOptimal = feedbackZone === "optimal";
  const isTooLoud = feedbackZone === "loud";
  const relativeGainAboveBaseline = Math.max(0, currentDb - ambientBaseline);

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-md space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Sensory Biofeedback (High-Effort Vocal Projection)
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
            Real-Time Visual Decibel (dB SPL) Meter
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Stabilized, mic-calibrated loudness meter. Automatically adapts target thresholds
            to your microphone&apos;s baseline volume and room acoustics.
          </p>
        </div>

        {/* Start / Stop Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {!isListening ? (
            <button
              type="button"
              onClick={startListening}
              className="flex items-center gap-2 bg-[#14171A] hover:bg-black text-vitality px-5 py-2.5 rounded-full text-xs font-extrabold shadow-soft-sm hover:shadow-glow-vitality transition-all hover:scale-105 cursor-pointer"
            >
              <Mic className="h-4 w-4 text-vitality" />
              <span>Activate Biofeedback</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopListening}
              className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 rounded-full text-xs font-extrabold shadow-soft-sm transition-all cursor-pointer"
            >
              <MicOff className="h-4 w-4" />
              <span>Stop Biofeedback</span>
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl">
          {errorMessage}
        </div>
      )}

      {calibratedNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            {calibratedNotice}
          </span>
          <button
            type="button"
            onClick={() => setCalibratedNotice(null)}
            className="text-[11px] font-bold text-emerald-700 hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Biofeedback Visual Grid — Locked heights prevent any UI jumping */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Large Decibel Gauge & Target Zone Card */}
        <div className="lg:col-span-7 bg-[#14171A] rounded-3xl p-6 sm:p-8 text-white flex flex-col justify-between shadow-soft-lg relative overflow-hidden">
          {/* Ambient Glow matching state */}
          <div
            className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-colors duration-700 ${
              isOptimal
                ? "bg-emerald-500/25"
                : isTooLoud
                ? "bg-rose-500/25"
                : "bg-clinical-cyan/20"
            }`}
          ></div>

          {/* Top Bar with fixed height badge so layout never shifts */}
          <div className="relative z-10 flex items-center justify-between gap-2 h-8">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 truncate">
              Smoothed Vocal Level
            </span>
            <span
              className={`h-7 inline-flex items-center text-[11px] font-bold px-3 rounded-full border whitespace-nowrap shrink-0 transition-colors duration-300 ${
                !isListening
                  ? "bg-white/5 border-white/10 text-slate-400"
                  : isCalibrating
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                  : isOptimal
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                  : isTooLoud
                  ? "bg-rose-500/20 border-rose-500/50 text-rose-300"
                  : "bg-sky-500/20 border-sky-500/50 text-sky-300"
              }`}
            >
              {!isListening
                ? "Sensor Inactive"
                : isCalibrating
                ? "CALIBRATING ROOM BASELINE..."
                : isOptimal
                ? "IN TARGET VOCAL ZONE"
                : isTooLoud
                ? "TOO LOUD / STRAIN"
                : `SPEAK LOUDER (NEED ${targetMinDb}+ dB)`}
            </span>
          </div>

          {/* Huge Number Display + Relative Gain Over Baseline */}
          <div className="relative z-10 my-4 flex flex-wrap items-baseline justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <span className="text-6xl sm:text-7xl font-black font-mono tracking-tight text-white tabular-nums">
                {isListening ? currentDb : "--"}
              </span>
              <div className="flex flex-col">
                <span className="text-xl sm:text-2xl font-black text-vitality font-mono">
                  dB SPL
                </span>
                <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                  Peak: {isListening ? `${peakDb} dB` : "--"}
                </span>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-right">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">
                Gain Over Baseline ({ambientBaseline} dB)
              </span>
              <span className="text-lg font-black font-mono text-emerald-400 tabular-nums">
                {isListening ? `+${relativeGainAboveBaseline} dB` : "+0 dB"}
              </span>
              <span className="text-[10px] text-slate-400 block">
                Goal: +12 to +25 dB above room
              </span>
            </div>
          </div>

          {/* Horizontal Level Bar with Green Zone Marker */}
          <div className="relative z-10 space-y-2 my-2">
            <div className="relative h-6 w-full bg-white/10 rounded-full overflow-hidden p-1 border border-white/10">
              {/* Highlight Target Green Zone segment */}
              <div
                className="absolute top-0 bottom-0 bg-emerald-500/30 border-x border-emerald-400/60 transition-all duration-300"
                style={{
                  left: `${((targetMinDb - 25) / (95 - 25)) * 100}%`,
                  width: `${((targetMaxDb - targetMinDb) / (95 - 25)) * 100}%`,
                }}
              ></div>

              {/* Live Active Level */}
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${
                  isOptimal
                    ? "bg-vitality shadow-glow-vitality"
                    : isTooLoud
                    ? "bg-rose-500"
                    : "bg-clinical-cyan"
                }`}
                style={{
                  width: `${Math.max(
                    4,
                    Math.min(100, ((currentDb - 25) / (95 - 25)) * 100)
                  )}%`,
                }}
              ></div>
            </div>

            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>Baseline: {ambientBaseline} dB</span>
              <span className="text-emerald-400 font-bold">
                Target Green Zone: {targetMinDb}–{targetMaxDb} dB
              </span>
              <span>95 dB (Max)</span>
            </div>
          </div>

          {/* Rolling Loudness Stability Canvas */}
          <div className="relative z-10 mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-slate-400 font-mono">
                Smoothed Loudness Trajectory
              </span>
              <button
                type="button"
                onClick={() => setPeakDb(currentDb)}
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset Peak</span>
              </button>
            </div>
            <div className="h-16 w-full bg-black/40 rounded-xl overflow-hidden border border-white/5">
              <canvas
                ref={canvasRef}
                width={380}
                height={64}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>

        {/* Right: Phonation Challenge & True Room/Mic Calibration Controls */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          {/* Phonation Challenge Card */}
          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-vitality-hover fill-vitality" />
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                  5-Second Vocal Hold Challenge
                </h3>
              </div>
              <button
                type="button"
                onClick={resetChallengeProgress}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Sustain a steady <strong>&ldquo;Ahhhh&rdquo;</strong> inside the
              calibrated green zone (
              <strong>
                {targetMinDb}–{targetMaxDb} dB
              </strong>
              ) for 5 seconds.
            </p>

            {/* Target Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono font-bold">
                <span className="text-slate-600">Sustained Time:</span>
                <span className="text-slate-900 tabular-nums">
                  {timeInZoneSec.toFixed(1)} / 5.0 s
                </span>
              </div>
              <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    challengeSuccess
                      ? "bg-emerald-500 shadow-glow-vitality"
                      : "bg-[#14171A]"
                  }`}
                  style={{ width: `${(timeInZoneSec / 5.0) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Fixed-height status banner so the card below NEVER shifts */}
            <div className="h-10 flex items-center">
              {isCalibrating ? (
                <div className="w-full flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl font-bold">
                  <Loader2 className="h-4 w-4 text-amber-600 animate-spin shrink-0" />
                  <span>Calibrating room noise floor — stay silent...</span>
                </div>
              ) : challengeSuccess ? (
                <div className="w-full flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Challenge Completed! Steady vocal projection achieved!</span>
                </div>
              ) : (
                <div className="w-full flex items-center justify-between text-[11px] text-slate-500 px-1">
                  <span>Hold voice in green band to fill bar</span>
                  <span className="font-mono font-semibold">
                    {Math.round((timeInZoneSec / 5.0) * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* True Ambient Room & Low-Volume Microphone Calibration */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-clinical-cyan" />
                Room &amp; Microphone Tare Calibration
              </span>
              <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                Floor: {ambientBaseline} dB
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Using a low-volume headset mic (30 dB) or sitting in a noisy room (60 dB)?
              Click <strong>Tare Baseline</strong> while silent to lock your mic&apos;s floor
              and set the target zone to <strong>+12 dB above baseline</strong>.
            </p>

            {/* Mic Gain Boost Slider for quiet microphones */}
            <div className="space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Volume2 className="h-3.5 w-3.5 text-clinical-cyan" />
                  Mic Sensitivity Gain Boost:
                </span>
                <span className="font-mono font-bold text-slate-900">
                  +{micBoostDb} dB
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={25}
                step={1}
                value={micBoostDb}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMicBoostDb(val);
                  micBoostRef.current = val;
                  resetChallengeProgress();
                }}
                className="w-full accent-slate-900 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0 dB (Standard Mic)</span>
                <span>+15 dB (Quiet Headset)</span>
                <span>+25 dB (Very Quiet Mic)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={calibrateAmbientRoom}
                disabled={!isListening || isCalibrating}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-full bg-[#14171A] hover:bg-black text-white transition-colors disabled:opacity-40 cursor-pointer"
              >
                {isCalibrating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-vitality" />
                    <span>Sampling 1.5s...</span>
                  </>
                ) : (
                  <span>Tare Baseline (1.5s)</span>
                )}
              </button>

              <button
                type="button"
                onClick={applyLowVolumeHeadsetPreset}
                className="w-full text-xs font-bold px-3.5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors cursor-pointer"
              >
                Quiet Headset Preset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Clinical Notes Card */}
      <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 flex items-start gap-3 text-xs text-emerald-950">
        <Info className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">
            Relative dB Calibration &amp; Vocal Projection Rationale:{" "}
          </span>
          Consumer headset microphones and laptop arrays differ in pre-amplifier gain by up to
          25 dB. By taring the ambient baseline first and measuring{" "}
          <strong>relative vocal gain (+12 to +25 dB above room baseline)</strong>, patients
          receive accurate biofeedback regardless of whether their microphone records softly at
          30 dB or loudly at 60 dB.
        </div>
      </div>
    </div>
  );
}
