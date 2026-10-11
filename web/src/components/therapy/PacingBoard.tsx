"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Square,
  RotateCcw,
  Volume2,
  VolumeX,
  Gauge,
  AudioLines,
  Info,
  TrendingUp,
  HelpCircle,
} from "lucide-react";

const SAMPLE_SENTENCES = [
  "The grandfather walked in the garden.",
  "I would like a fresh glass of water.",
  "Please speak clearly and steadily today.",
  "The morning sun warms the quiet room.",
  "Take a deep breath before every phrase.",
  "Consistent rhythm brings motor speech progress.",
];

const PROGRESSION_STAGES = [
  {
    stage: "Stage 1: Foundation",
    bpm: 60,
    rateLabel: "1.0 word / sec",
    desc: "Lower BPM (Slower). Isolate every word so tongue & lips make 100% crisp contact.",
  },
  {
    stage: "Stage 2: Intermediate",
    bpm: 85,
    rateLabel: "1.4 words / sec",
    desc: "Moderate BPM. Connect words smoothly in a steady rhythm without dropping consonants.",
  },
  {
    stage: "Stage 3: Conversational Goal",
    bpm: 110,
    rateLabel: "1.8 words / sec",
    desc: "Higher BPM (Faster). Natural conversational pacing while maintaining full clarity.",
  },
];

export function PacingBoard() {
  const [sentences, setSentences] = useState(SAMPLE_SENTENCES);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [customInput, setCustomInput] = useState("");
  const [activeSlot, setActiveSlot] = useState<number>(-1);
  const [completedSlots, setCompletedSlots] = useState<number[]>([]);
  const [mode, setMode] = useState<"manual" | "auto">("auto");
  const [therapyProfile, setTherapyProfile] = useState<"clarity" | "rate_control">("clarity");
  const [bpm, setBpm] = useState<number>(60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [calculatedWpm, setCalculatedWpm] = useState<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentSentence = sentences[sentenceIndex] || "";
  const words = currentSentence
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  // Play a soft auditory click using Web Audio API
  const playClick = useCallback(
    (frequency = 587.33) => {
      if (!soundEnabled) return;
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContextClass();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") {
          ctx.resume();
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } catch (e) {
        console.warn("Auditory click failed:", e);
      }
    },
    [soundEnabled]
  );

  // Reset progress when sentence changes
  useEffect(() => {
    resetPacing();
  }, [sentenceIndex]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const resetPacing = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
    setActiveSlot(-1);
    setCompletedSlots([]);
    setTapTimes([]);
    setCalculatedWpm(null);
  };

  // Automated Metronome rhythm loop
  useEffect(() => {
    if (mode === "auto" && isRunning) {
      const intervalMs = (60 / bpm) * 1000;
      let currentIndex = -1;

      timerRef.current = setInterval(() => {
        currentIndex += 1;
        if (currentIndex < words.length) {
          setActiveSlot(currentIndex);
          setCompletedSlots((prev) => [...prev, currentIndex]);
          playClick(currentIndex === 0 ? 880 : 587.33);
        } else {
          // Finished phrase
          if (timerRef.current) clearInterval(timerRef.current);
          setIsRunning(false);
          setActiveSlot(-1);
        }
      }, intervalMs);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [mode, isRunning, bpm, words.length, playClick]);

  // Manual Slot Click or Tap
  const handleSlotClick = (index: number) => {
    if (mode !== "manual") return;

    const now = Date.now();
    const newTimes = [...tapTimes, now];
    setTapTimes(newTimes);

    // Calculate real-time pacing WPM after 3 taps
    if (newTimes.length >= 3) {
      const elapsedMinutes =
        (newTimes[newTimes.length - 1] - newTimes[0]) / 60000;
      if (elapsedMinutes > 0) {
        const measuredWpm = Math.round((newTimes.length - 1) / elapsedMinutes);
        setCalculatedWpm(measuredWpm);
      }
    }

    setActiveSlot(index);
    if (!completedSlots.includes(index)) {
      setCompletedSlots((prev) => [...prev, index]);
    }
    playClick(index === 0 ? 880 : 587.33);
  };

  const handleCustomSentenceAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    const updated = [customInput.trim(), ...sentences];
    setSentences(updated);
    setSentenceIndex(0);
    setCustomInput("");
  };

  const wordsPerSecond = (bpm / 60).toFixed(1);
  const tempoDescription =
    bpm <= 65
      ? "Lower BPM = Slower Tempo (Deliberate Syllable Isolation)"
      : bpm <= 95
      ? "Medium BPM = Controlled Steady Rhythm"
      : "Higher BPM = Faster Tempo (Natural Conversational Goal)";

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-soft-md space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-clinical-cyan"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-clinical-cyan">
              Rhythmic Cueing &amp; Syllable Segmentation (Freed, 2020)
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
            Digital Multi-Slot Pacing Board
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Separates connected speech into distinct rhythmic beats so each word gets complete
            tongue-and-lip consonant articulation instead of slurring together.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-full text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => {
              setMode("auto");
              resetPacing();
            }}
            className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
              mode === "auto"
                ? "bg-white text-slate-900 shadow-sm font-bold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Metronome Rhythm
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("manual");
              resetPacing();
            }}
            className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
              mode === "manual"
                ? "bg-white text-slate-900 shadow-sm font-bold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Manual Finger Tap
          </button>
        </div>
      </div>

      {/* Clinical Clarification: Why Pacing & How Progression Works */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/90 p-4 sm:p-5 rounded-2xl border border-slate-200/80">
        <div
          onClick={() => {
            setTherapyProfile("clarity");
            setBpm(60);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
            therapyProfile === "clarity"
              ? "bg-white border-clinical-cyan shadow-soft-sm"
              : "bg-white/60 border-slate-200/70 opacity-80 hover:opacity-100"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-clinical-cyan" />
              1. For Slow / Slurred Speech (Spastic, Ataxic, Stroke)
            </span>
            {therapyProfile === "clarity" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-clinical-cyan border border-sky-200">
                Active Goal
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            <strong>We are NOT trying to make you slower!</strong> Tapping each slot separates slurred syllables into clean, even beats.{" "}
            <strong className="text-slate-900">
              How to Progress: Start at a LOWER BPM (60 BPM = 1 word/sec) for 100% clarity, then increase to a HIGHER BPM (85 → 110 BPM) to build faster, natural speed!
            </strong>
          </p>
        </div>

        <div
          onClick={() => {
            setTherapyProfile("rate_control");
            setBpm(85);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
            therapyProfile === "rate_control"
              ? "bg-white border-emerald-500 shadow-soft-sm"
              : "bg-white/60 border-slate-200/70 opacity-80 hover:opacity-100"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-emerald-600" />
              2. For Rushed / Blurred Speech (Parkinson&apos;s Festination)
            </span>
            {therapyProfile === "rate_control" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active Goal
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Parkinson&apos;s causes involuntary speeding up (<em>festination</em>) where words mumble together.{" "}
            <strong className="text-slate-900">
              How to Progress: Use Manual Finger Tap or lock onto a steady 80–90 BPM metronome so you pace one word per beat without rushing ahead.
            </strong>
          </p>
        </div>
      </div>

      {/* 3-Stage Progression Selector (Visible in Metronome Mode) */}
      {mode === "auto" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Metronome Progression Stages (What BPM Means: Beats / Words Per Minute)
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Click a stage to set tempo
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PROGRESSION_STAGES.map((item) => {
              const isSelected = Math.abs(bpm - item.bpm) <= 10;
              return (
                <button
                  key={item.stage}
                  type="button"
                  onClick={() => {
                    resetPacing();
                    setBpm(item.bpm);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#14171A] text-white border-black shadow-soft-sm"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-extrabold">{item.stage}</span>
                    <span
                      className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        isSelected
                          ? "bg-vitality text-[#14171A]"
                          : "bg-white text-slate-700 border border-slate-200"
                      }`}
                    >
                      {item.bpm} BPM ({item.rateLabel})
                    </span>
                  </div>
                  <p
                    className={`text-[11px] leading-relaxed ${
                      isSelected ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    {item.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sentence Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase">
            Phrase {sentenceIndex + 1}/{sentences.length}:
          </span>
          <span className="text-xs font-medium text-slate-700">
            Selected Clinical Practice Item
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setSentenceIndex((prev) =>
                prev > 0 ? prev - 1 : sentences.length - 1
              )
            }
            className="text-xs font-bold px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() =>
              setSentenceIndex((prev) => (prev + 1) % sentences.length)
            }
            className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#14171A] text-white hover:bg-black transition-colors cursor-pointer"
          >
            Next Phrase
          </button>
        </div>
      </div>

      {/* Main Interactive Pacing Slot Board */}
      <div className="bg-[#14171A] rounded-3xl p-6 sm:p-8 text-white space-y-6 shadow-soft-lg">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <AudioLines className="h-3.5 w-3.5 text-vitality" />
            {mode === "manual"
              ? "Tap each word slot one by one right as you speak it aloud to separate syllables"
              : `Speak each word aloud when its slot lights up (${bpm} BPM = ${wordsPerSecond} words/sec)`}
          </span>
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
            title="Toggle Audio Feedback"
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-vitality" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-500" />
            )}
            <span className="text-[11px] font-mono">
              {soundEnabled ? "Audio Beat ON" : "Audio Beat OFF"}
            </span>
          </button>
        </div>

        {/* The Visual Slots */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {words.map((word, idx) => {
            const isActive = activeSlot === idx;
            const isCompleted = completedSlots.includes(idx);

            return (
              <button
                key={`${word}-${idx}`}
                type="button"
                onClick={() => handleSlotClick(idx)}
                disabled={mode === "auto"}
                className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all text-center select-none ${
                  isActive
                    ? "bg-vitality text-[#14171A] border-vitality shadow-glow-vitality scale-105 ring-4 ring-vitality/30 font-black"
                    : isCompleted
                    ? "bg-white/10 text-emerald-400 border-emerald-500/40"
                    : "bg-white/5 text-slate-200 border-white/10 hover:border-white/30 hover:bg-white/10 cursor-pointer"
                }`}
              >
                <span className="text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Word #{idx + 1}
                </span>
                <span className="text-base sm:text-lg font-extrabold tracking-tight">
                  {word}
                </span>
                {isCompleted && !isActive && (
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-400"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Active Phrase Full Text */}
        <div className="pt-2 text-center">
          <p className="text-slate-300 font-medium text-sm sm:text-base italic">
            &ldquo;{currentSentence}&rdquo;
          </p>
        </div>

        {/* Metronome Controls (if auto mode) */}
        {mode === "auto" && (
          <div className="pt-4 border-t border-white/10 flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white shrink-0">
                  Tempo: {bpm} BPM
                </span>
                <span className="text-[11px] font-mono text-vitality bg-white/10 px-2.5 py-0.5 rounded-full">
                  {wordsPerSecond} words/sec
                </span>
              </div>
              <input
                type="range"
                min="45"
                max="120"
                step="5"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="w-full sm:w-48 accent-vitality cursor-pointer"
              />
              <span className="text-[11px] text-slate-300 font-medium">
                {tempoDescription}
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsRunning(!isRunning)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-soft-sm cursor-pointer ${
                  isRunning
                    ? "bg-rose-500 text-white hover:bg-rose-600"
                    : "bg-vitality text-[#14171A] hover:bg-vitality-hover shadow-glow-vitality"
                }`}
              >
                {isRunning ? (
                  <>
                    <Square className="h-3.5 w-3.5 fill-current" />
                    <span>Stop Metronome</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Start Metronome</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={resetPacing}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 transition-colors cursor-pointer"
                title="Reset Board"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Manual Tap Controls & Real-Time WPM feedback */}
        {mode === "manual" && (
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-clinical-cyan" />
                <span className="text-slate-300 font-medium">
                  Your Tapping Speed:
                </span>
                <span className="font-mono font-bold text-vitality">
                  {calculatedWpm !== null
                    ? `${calculatedWpm} BPM (${(calculatedWpm / 60).toFixed(1)} words/sec)`
                    : "Tap 3 word slots to measure"}
                </span>
              </div>
              {calculatedWpm !== null && (
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    calculatedWpm <= 125 && calculatedWpm >= 60
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  }`}
                >
                  {calculatedWpm <= 125 && calculatedWpm >= 60
                    ? "Optimal Rhythm Zone (60–125 BPM)"
                    : calculatedWpm > 125
                    ? "Too Fast: Pause Slightly Between Words"
                    : "Slow Deliberate Practice"}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={resetPacing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Board</span>
            </button>
          </div>
        )}
      </div>

      {/* Custom Sentence Form */}
      <form
        onSubmit={handleCustomSentenceAdd}
        className="flex flex-col sm:flex-row items-center gap-2 pt-2"
      >
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="Enter custom personalized sentence (e.g., 'I want to drink hot tea')..."
          className="w-full text-xs sm:text-sm px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-clinical-cyan focus:bg-white"
        />
        <button
          type="submit"
          className="w-full sm:w-auto shrink-0 bg-[#14171A] hover:bg-black text-white px-5 py-3 rounded-2xl text-xs font-bold transition-colors shadow-soft-sm cursor-pointer"
        >
          Load Custom Phrase
        </button>
      </form>

      {/* Clinical Notes Card */}
      <div className="p-4 bg-sky-50/60 rounded-2xl border border-sky-100 flex items-start gap-3 text-xs text-sky-900">
        <Info className="h-4 w-4 text-clinical-cyan shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">How Pacing Board Therapy Works: </span>
          Whether a patient speaks too rapidly (<em>hypokinetic festination</em>) or slowly with slurred consonants (<em>spastic/ataxic dysarthria</em>), giving each word a discrete rhythmic beat prevents syllables from collapsing into each other. Start at <strong>60 BPM (1 word/sec)</strong> to master clean articulation, and progress up toward <strong>110–120 BPM (2 words/sec)</strong> as articulatory coordination strengthens.
        </div>
      </div>
    </div>
  );
}
