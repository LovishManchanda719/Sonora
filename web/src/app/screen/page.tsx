"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Lock,
  Mic,
  VolumeX,
  Ruler,
  UserCheck,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  FileText,
  Layers,
} from "lucide-react";
import {
  AudioRecorder,
  AudioQualityReport,
} from "@/components/audio/AudioRecorder";
import { screenSession } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { saveScreeningResult } from "@/lib/firestore";

interface CapturedTask {
  blob: Blob;
  filename: string;
  quality?: AudioQualityReport;
}

interface ScreeningTaskItem {
  id: string;
  title: string;
  instruction: string;
  hint: string;
  minSec: number;
  targetSec?: number;
  readingPassage?: string;
  illustration: string;
}

const STANDARD_TASKS: ScreeningTaskItem[] = [
  {
    id: "sustained_vowel",
    title: "Task 1: Sustained Vowel Phonation",
    instruction:
      "Take a deep breath and vocalize a steady 'Ahhh' sound for 4 to 5 seconds at a comfortable pitch.",
    hint: "Keep loudness and pitch as steady as possible.",
    minSec: 2.0,
    targetSec: 5,
    illustration: "/images/screen-voice-idle.png",
  },
  {
    id: "ddk_pataka",
    title: "Task 2: Diadochokinesis (DDK)",
    instruction:
      "Repeat the syllables 'Pa-Ta-Ka' rapidly and clearly as many times as possible in 5 seconds.",
    hint: "Focus on articulating each syllable crisply.",
    minSec: 2.5,
    targetSec: 5,
    illustration: "/images/task2-ddk-headphones.png",
  },
  {
    id: "sentence_passage",
    title: "Task 3: Connected Sentence Reading",
    instruction:
      "Read the clinical sentence below aloud clearly at your natural conversational pace.",
    hint: "Speak at your natural conversational pacing.",
    minSec: 3.0,
    targetSec: 5,
    readingPassage: "The quick brown fox jumps over the lazy dog.",
    illustration: "/images/task3-reading-studio.png",
  },
];

function getAdvancedStatementTasks(
  durationSec: 15 | 30 | 45
): ScreeningTaskItem[] {
  const minSec = durationSec === 15 ? 10.0 : durationSec === 30 ? 20.0 : 30.0;
  return [
    {
      id: "statement_passage_1",
      title: `Trial 1: Extended Statement Reading (${durationSec}s)`,
      instruction: `Read the multi-sentence clinical passage below aloud continuously for ${durationSec} seconds. Take natural breaths between sentences.`,
      hint: `Evaluates multi-window Wav2Vec 2.0 representations, conversational syllable cadence, and vowel-consonant transitions over ${durationSec}s.`,
      minSec,
      targetSec: durationSec,
      readingPassage:
        "When sunlight strikes raindrops in the air, they act as a prism and form a rainbow. The rainbow is a division of white light into many beautiful colors. These take the shape of a long round arch, with its path high above, and its two ends apparently beyond the horizon. People often look for the pot of gold at the end of the rainbow, but nobody ever finds it. Every morning I enjoy taking a calm walk outside, breathing fresh air, and speaking clearly with my family and friends at a steady, comfortable pace.",
      illustration: "/images/task3-reading-studio.png",
    },
    {
      id: "statement_passage_2",
      title: `Trial 2: Motor Coordination Statement (${durationSec}s)`,
      instruction: `Read this second clinical statement passage aloud at a steady, natural pace for ${durationSec} seconds to verify articulatory consistency.`,
      hint: `Measures bilabial, alveolar, and velar consonant crispness (spectral flatness & zero-crossing rate) across sustained multi-sentence speech.`,
      minSec,
      targetSec: durationSec,
      readingPassage:
        "You wished to know all about my grandfather. Well, he is nearly ninety-three years old, yet he still thinks as swiftly as ever. He dresses himself in an ancient black frock coat, usually minus several buttons. A long flowing beard clings to his chin, giving those who observe him a pronounced feeling of the utmost respect. When he speaks, his voice is just a bit cracked and quivers a trifle, yet steady breath support and deliberate pacing keep every single sentence clear.",
      illustration: "/images/task2-ddk-headphones.png",
    },
    {
      id: "statement_passage_3",
      title: `Trial 3: Prosodic Endurance Statement (${durationSec}s)`,
      instruction: `Complete your third ${durationSec}-second statement reading below so the model can compute a high-precision 3-trial consensus.`,
      hint: `Detects late-onset vocal fatigue, bradylalic syllable slowdown, or volume decay across the final ${durationSec}-second endurance window.`,
      minSec,
      targetSec: durationSec,
      readingPassage:
        "Clear communication depends on steady breathing, crisp consonant movements, and a relaxed rhythm. Please bring seven fresh red apples, three yellow lemons, and a warm cup of tea to the kitchen table before dinner begins. Around the rugged rocks, the persistence of steady speech shines through when we pause between phrases. Whether speaking in a quiet room or a busy clinic, taking a full breath before each sentence keeps our voice strong, resonant, and easy for everyone to understand.",
      illustration: "/images/screen-voice-idle.png",
    },
  ];
}

const PRE_RECORDING_CHECKS = [
  {
    id: "distance",
    title: "Hold Microphone ~6 Inches (15 cm) Away",
    desc: "Keep your phone or headset mic ~6 inches from your mouth at a slight 45° angle to prevent air-blast popping.",
    icon: Ruler,
  },
  {
    id: "quiet",
    title: "Moderate Environment Supported (Up to 60 dB)",
    desc: "Normal room noise (fans or AC up to 60 dB) is automatically filtered by our 75 Hz acoustic filter and speech VAD.",
    icon: VolumeX,
  },
  {
    id: "volume",
    title: "Avoid Speaking Too Softly or Shouting",
    desc: "Use your natural, supported conversational voice so loudness and pitch stability are measured accurately.",
    icon: Mic,
  },
  {
    id: "posture",
    title: "Sit Upright & Take a Full Breath First",
    desc: "An upright posture ensures natural subglottic respiratory support across all 3 speech tasks.",
    icon: UserCheck,
  },
];

export default function ScreenPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Dual-Mode Screening Protocol: 'standard' (3-Task Subsystem Battery) vs 'advanced' (3 × Extended Statement Trials)
  const [screeningMode, setScreeningMode] = useState<"standard" | "advanced">(
    "standard"
  );
  const [advancedDurationSec, setAdvancedDurationSec] = useState<15 | 30 | 45>(
    30
  );

  const [currentStep, setCurrentStep] = useState(0);
  const [recordedTasks, setRecordedTasks] = useState<
    Record<number, CapturedTask>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Phase 12B.8 Pre-Recording Quality Checklist & Room Noise Check state
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({
    distance: true,
    quiet: true,
    volume: true,
    posture: true,
  });
  const [isCheckingRoomNoise, setIsCheckingRoomNoise] = useState(false);
  const [roomNoiseResult, setRoomNoiseResult] = useState<{
    dbSplEq: number;
    status: "optimal" | "acceptable" | "elevated";
  } | null>(null);

  const activeTasksList =
    screeningMode === "standard"
      ? STANDARD_TASKS
      : getAdvancedStatementTasks(advancedDurationSec);

  const activeTask = activeTasksList[currentStep];
  const isCurrentTaskReady = Boolean(recordedTasks[currentStep]);
  const areAllTasksReady = activeTasksList.every((_, i) =>
    Boolean(recordedTasks[i])
  );

  const handleSelectMode = (mode: "standard" | "advanced") => {
    if (mode === screeningMode || isSubmitting) return;
    setScreeningMode(mode);
    setCurrentStep(0);
    setRecordedTasks({});
    setErrorMessage(null);
  };

  const handleSelectAdvancedDuration = (dur: 15 | 30 | 45) => {
    if (dur === advancedDurationSec || isSubmitting) return;
    setAdvancedDurationSec(dur);
    setCurrentStep(0);
    setRecordedTasks({});
    setErrorMessage(null);
  };

  const toggleCheckItem = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Live 1.8s Ambient Room Noise Floor Check via Web Audio API
  const handleRunRoomNoiseCheck = async () => {
    setIsCheckingRoomNoise(true);
    setRoomNoiseResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const data = new Float32Array(analyser.fftSize);
      const samples: number[] = [];

      await new Promise<void>((resolve) => {
        let count = 0;
        const interval = setInterval(() => {
          analyser.getFloatTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            sum += data[i] * data[i];
          }
          samples.push(Math.sqrt(sum / data.length));
          count++;
          if (count >= 12) {
            clearInterval(interval);
            resolve();
          }
        }, 120);
      });

      stream.getTracks().forEach((t) => t.stop());
      await ctx.close().catch(() => {});

      const avgRms =
        samples.reduce((acc, v) => acc + v, 0) / Math.max(1, samples.length);
      const dbFs = avgRms > 0 ? 20 * Math.log10(avgRms) : -65;
      // Map dBFS [-65, -10] to approximate room dB SPL [30, 75]
      const dbSplEq = Math.round(
        Math.min(80, Math.max(28, 85 + dbFs * 0.95))
      );
      const status: "optimal" | "acceptable" | "elevated" =
        dbSplEq <= 48 ? "optimal" : dbSplEq <= 62 ? "acceptable" : "elevated";
      setRoomNoiseResult({
        dbSplEq,
        status,
      });
    } catch {
      setErrorMessage(
        "Unable to access microphone for ambient room check. Please allow microphone permissions."
      );
    } finally {
      setIsCheckingRoomNoise(false);
    }
  };

  const handleAudioCaptured = (
    blob: Blob,
    filename: string,
    quality?: AudioQualityReport
  ) => {
    setRecordedTasks((prev) => ({
      ...prev,
      [currentStep]: { blob, filename, quality },
    }));
    setErrorMessage(null);
  };

  const handleSubmitSession = async () => {
    if (!areAllTasksReady) {
      setErrorMessage(
        "Please complete and verify recordings for all 3 clinical tasks before analyzing."
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = activeTasksList.map((task, i) => ({
        blob: recordedTasks[i].blob,
        filename: recordedTasks[i].filename,
        taskName: task.id,
      }));

      // Call live backend
      const result = await screenSession(payload);

      // Save to sessionStorage so result page can read it immediately
      sessionStorage.setItem(
        `screening_${result.session_id}`,
        JSON.stringify(result)
      );

      // Persist screening result (locally and to first-party API)
      try {
        await saveScreeningResult(
          user?.uid || "guest",
          user?.email || "anonymous",
          result
        );
      } catch (e) {
        console.warn("Screening persistence notice:", e);
      }

      router.push(`/results/${result.session_id}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to analyze speech session.";
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Top Wizard Steps Header */}
      <div className="text-center pt-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Clinical Motor Speech Assessment
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl mx-auto">
          Choose between the Standard 3-Task Subsystem Battery (~5s per task) or the Advanced Extended Statement Protocol (3 × 15s, 30s, or 45s continuous statement readings) for deeper cadence and fatigue precision.
        </p>

        {/* Dual-Mode Screening Protocol Selector */}
        <div className="mt-5 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-soft-sm text-left">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Select Screening Protocol Mode
            </span>
            <span className="text-[11px] font-bold text-clinical-cyan">
              {screeningMode === "standard"
                ? "Mode 1: Rapid 3-Subsystem Check"
                : `Mode 2: High-Precision 3 × ${advancedDurationSec}s Statement Endurance`}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Option 1: Standard 3-Task Battery */}
            <button
              type="button"
              onClick={() => handleSelectMode("standard")}
              disabled={isSubmitting}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                screeningMode === "standard"
                  ? "border-[#14171A] bg-slate-900 text-white shadow-soft-md"
                  : "border-slate-200/80 bg-slate-50/70 hover:bg-slate-100/70 text-slate-900"
              }`}
            >
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  screeningMode === "standard"
                    ? "bg-vitality text-[#14171A]"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                <Layers className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-extrabold">
                    1. Standard 3-Task Clinical Battery
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      screeningMode === "standard"
                        ? "bg-white/15 text-vitality"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    ~5s × 3 Tasks
                  </span>
                </div>
                <p
                  className={`text-[11px] mt-1 leading-relaxed ${
                    screeningMode === "standard"
                      ? "text-slate-300"
                      : "text-slate-500"
                  }`}
                >
                  Industry-standard rapid screening across Sustained Vowel (/a/), Diadochokinesis (Pa-Ta-Ka), and Sentence Reading.
                </p>
              </div>
            </button>

            {/* Option 2: Advanced Extended Statement Protocol */}
            <button
              type="button"
              onClick={() => handleSelectMode("advanced")}
              disabled={isSubmitting}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                screeningMode === "advanced"
                  ? "border-[#14171A] bg-slate-900 text-white shadow-soft-md"
                  : "border-slate-200/80 bg-slate-50/70 hover:bg-slate-100/70 text-slate-900"
              }`}
            >
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  screeningMode === "advanced"
                    ? "bg-vitality text-[#14171A]"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-extrabold">
                    2. Advanced Extended Statement Test
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      screeningMode === "advanced"
                        ? "bg-vitality text-[#14171A]"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    High Accuracy
                  </span>
                </div>
                <p
                  className={`text-[11px] mt-1 leading-relaxed ${
                    screeningMode === "advanced"
                      ? "text-slate-300"
                      : "text-slate-500"
                  }`}
                >
                  Record 3 multi-sentence statement passages (15s, 30s sweet spot, or 45s each) for deep syllable cadence &amp; vocal fatigue analysis.
                </p>
              </div>
            </button>
          </div>

          {/* Duration Selector when Advanced Extended Statement Mode is active */}
          {screeningMode === "advanced" && (
            <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <Clock className="h-4 w-4 text-clinical-cyan shrink-0" />
                <span>
                  <strong>Statement Duration (× 3 Trials):</strong>{" "}
                  <span className="text-slate-500">
                    30s is the recommended clinical sweet spot for multi-window accuracy without breath exhaustion.
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {([15, 30, 45] as const).map((dur) => {
                  const isSelected = advancedDurationSec === dur;
                  const isSweetSpot = dur === 30;
                  return (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => handleSelectAdvancedDuration(dur)}
                      disabled={isSubmitting}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-[#14171A] text-vitality shadow-soft-sm"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <span>{dur}s</span>
                      {isSweetSpot && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isSelected
                              ? "bg-vitality/20 text-vitality"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          ★ Sweet Spot
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Step Pill Indicators */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mt-6">
          {activeTasksList.map((task, idx) => {
            const captured = recordedTasks[idx];
            const isCompleted = Boolean(captured);
            const hasWarning =
              captured?.quality && !captured.quality.passedAllChecks;
            const isCurrent = currentStep === idx;
            const isUnlocked =
              idx === 0 ||
              activeTasksList
                .slice(0, idx)
                .every((_, prevIdx) => Boolean(recordedTasks[prevIdx]));

            return (
              <button
                key={task.id}
                onClick={() => {
                  if (isUnlocked && !isSubmitting) {
                    setCurrentStep(idx);
                  }
                }}
                disabled={!isUnlocked || isSubmitting}
                title={
                  !isUnlocked
                    ? "Complete preceding clinical tasks to unlock"
                    : undefined
                }
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  isCurrent
                    ? "bg-[#14171A] text-white shadow-soft-sm cursor-default"
                    : isCompleted
                    ? hasWarning
                      ? "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100/60 cursor-pointer"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100/60 cursor-pointer"
                    : isUnlocked
                    ? "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
                    : "bg-slate-100/70 text-slate-400 border border-slate-200/60 cursor-not-allowed opacity-60"
                }`}
              >
                {isCompleted ? (
                  hasWarning ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  )
                ) : !isUnlocked ? (
                  <Lock className="h-3 w-3 text-slate-400 shrink-0" />
                ) : (
                  <span className="h-4 w-4 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                )}
                <span className="hidden sm:inline">
                  {task.title.split(":")[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Phase 12B.8: Pre-Recording Quality Guidance & Ambient Room Noise Check */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-soft-sm overflow-hidden">
        <div
          onClick={() => setChecklistOpen((prev) => !prev)}
          className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-[#14171A] text-vitality flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-900">
                Pre-Recording Acoustic Quality Checklist (Phase 12B.8)
              </h2>
              <p className="text-[11px] text-slate-500">
                Ensure clinical-grade recording conditions before capturing your 3 speech tasks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {roomNoiseResult && (
              <span
                className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  roomNoiseResult.status === "elevated"
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                Room: ~{roomNoiseResult.dbSplEq} dB SPL (
                {roomNoiseResult.status === "optimal"
                  ? "Quiet"
                  : roomNoiseResult.status === "acceptable"
                  ? "Acceptable • Filtered"
                  : "Elevated Noise"}
                )
              </span>
            )}
            <button
              type="button"
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700"
              aria-label="Toggle checklist"
            >
              {checklistOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {checklistOpen && (
          <div className="px-6 pb-5 pt-2 border-t border-slate-100 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PRE_RECORDING_CHECKS.map((item) => {
                const Icon = item.icon;
                const isChecked = Boolean(checkedItems[item.id]);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleCheckItem(item.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      isChecked
                        ? "bg-slate-50/90 border-slate-200/90"
                        : "bg-white border-slate-100 opacity-75"
                    }`}
                  >
                    <div
                      className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isChecked
                          ? "bg-[#14171A] text-vitality"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs font-bold text-slate-900">
                          {item.title}
                        </h3>
                        {isChecked && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Ambient Room Noise Floor Checker Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
              <div className="text-xs text-slate-600">
                <strong className="text-slate-900">
                  Optional Ambient Room Check:
                </strong>{" "}
                {roomNoiseResult ? (
                  roomNoiseResult.status === "optimal" ? (
                    <span className="text-emerald-700 font-semibold">
                      Ambient noise is low (~{roomNoiseResult.dbSplEq} dB SPL). Optimal quiet recording conditions!
                    </span>
                  ) : roomNoiseResult.status === "acceptable" ? (
                     <span className="text-emerald-700 font-semibold">
                      Ambient room noise (~{roomNoiseResult.dbSplEq} dB SPL) is acceptable. Active 75 Hz high-pass & dynamic VAD filters are active to suppress fan/AC noise.
                    </span>
                  ) : (
                    <span className="text-amber-800 font-semibold">
                      Elevated background noise detected (~{roomNoiseResult.dbSplEq} dB SPL). Filters are active, but please speak clearly at ~6 inches (15 cm) from the mic.
                    </span>
                  )
                ) : (
                  <span>
                    Test your room&apos;s background noise floor for 1.5 seconds before speaking.
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleRunRoomNoiseCheck}
                disabled={isCheckingRoomNoise}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#14171A] hover:bg-black text-white text-xs font-bold shrink-0 transition-all cursor-pointer"
              >
                {isCheckingRoomNoise ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-vitality" />
                    <span>Sampling Room...</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5 text-vitality" />
                    <span>Test Room Quietness</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl shadow-soft-sm">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Active Audio Recorder Card */}
      <div className="relative">
        <AudioRecorder
          key={`${screeningMode}-${advancedDurationSec}-${currentStep}`}
          taskTitle={activeTask.title}
          taskInstruction={activeTask.instruction}
          minDurationSec={activeTask.minSec}
          targetDurationSec={activeTask.targetSec}
          readingPassage={activeTask.readingPassage}
          illustrationSrc={activeTask.illustration}
          onAudioCaptured={handleAudioCaptured}
        />

        {/* Clinical Hint */}
        <div className="mt-3 flex items-center gap-2 px-4 py-2 bg-sky-50/70 border border-sky-100 rounded-2xl text-[11px] text-sky-800">
          <span className="font-bold">Clinical Cue:</span>
          <span>{activeTask.hint}</span>
        </div>
      </div>

      {/* Navigation & Submit Bar */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
          disabled={currentStep === 0 || isSubmitting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-soft-sm transition-all cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Previous Task</span>
        </button>

        <div className="flex items-center gap-3">
          {currentStep < activeTasksList.length - 1 ? (
            <button
              onClick={() =>
                setCurrentStep((prev) =>
                  Math.min(activeTasksList.length - 1, prev + 1)
                )
              }
              disabled={!isCurrentTaskReady || isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold bg-[#14171A] hover:bg-black text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-soft-sm transition-all cursor-pointer"
            >
              <span>Next Task</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSubmitSession}
              disabled={!areAllTasksReady || isSubmitting}
              className="flex items-center gap-2 px-8 py-3 rounded-full text-xs font-extrabold bg-vitality hover:bg-vitality-hover text-[#14171A] shadow-soft-md hover:shadow-glow-vitality disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing Speech Foundation Model...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Analyze Complete Speech Battery</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Indian Regulatory & Informed Consent Safe-Harbor Notice */}
      <div className="p-4 rounded-2xl bg-slate-100/80 border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed flex items-start gap-2.5">
        <Lock className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <strong>Educational &amp; Research Safe-Harbor Notice (India):</strong> By recording or uploading audio, you consent to transient in-memory acoustic analysis under our{" "}
          <a href="/privacy" className="underline font-semibold text-slate-800">
            DPDP Act 2023 Privacy Policy
          </a>{" "}
          and{" "}
          <a href="/terms" className="underline font-semibold text-slate-800">
            Terms &amp; Medical Disclaimer
          </a>
          . DysarthriaNet-XC is an academic research prototype—<strong>not a certified medical device (CDSCO Rules, 2017)</strong> and <strong>not a clinical diagnosis (RCI Act, 1992)</strong>. For sudden slurred speech or emergencies, call <strong>112 / 108</strong> immediately.
        </div>
      </div>
    </div>
  );
}
