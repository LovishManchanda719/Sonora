import { SessionDiagnosticResponse, SessionUtterance } from "@/lib/api-client";

export type AudienceReportMode = "health_worker" | "caregiver";

export interface AgentReportPayload {
  audience_mode: AudienceReportMode;
  headline: string;
  overview_paragraph: string;
  task_takeaways: string[];
  reassurance_or_protocol_note: string;
  next_steps_paragraph: string;
  generated_by: string;
}

function buildTaskTakeaways(
  utterances: SessionUtterance[],
  mode: AudienceReportMode
): string[] {
  return (utterances || []).map((u) => {
    const tRaw = (u.task_name || "speech_task").toLowerCase();
    const probPct = Math.round((u.dysarthria_probability || 0) * 100);
    const sev = (u.predicted_severity || "normal").toUpperCase();
    const flagged = Boolean(u.is_dysarthric);

    if (tRaw.includes("vowel")) {
      if (mode === "caregiver") {
        return (
          `Steady "Ahhh" Voice Hold (${probPct}% risk signal): ` +
          (flagged
            ? "Showed some voice tremor or breathiness, meaning the vocal cords and breath support worked harder to hold a steady tone."
            : "Sounded steady and well-supported with healthy breath control.")
        );
      }
      return (
        `Sustained Vowel Phonation /a/ (${probPct}% probability, ${sev}): ` +
        (flagged
          ? "Elevated phonatory instability (jitter/shimmer or reduced respiratory-laryngeal efficiency per N-DAT MPT criteria)."
          : "Within expected phonatory stability and glottal closure boundaries.")
      );
    }

    if (tRaw.includes("ddk") || tRaw.includes("pataka")) {
      if (mode === "caregiver") {
        return (
          `Quick "Pa-Ta-Ka" Syllable Rhythm (${probPct}% risk signal): ` +
          (flagged
            ? "Showed slowed or blurred transitions between lip, tongue-tip, and back-of-tongue movements."
            : "Showed crisp, well-coordinated lip and tongue movement speed.")
        );
      }
      return (
        `Diadochokinetic (DDK) SMR /pa-ta-ka/ (${probPct}% probability, ${sev}): ` +
        (flagged
          ? "Reduced alternating/sequential articulatory velocity or timing irregularity across bilabial-alveolar-velar transitions."
          : "Intact sequential motor rate and articulatory precision.")
      );
    }

    if (mode === "caregiver") {
      return (
        `Full Sentence Reading (${probPct}% risk signal): ` +
        (flagged
          ? "Showed mild slurring or vocal fatigue across longer connected phrases, where slowing down and pausing between words can help."
          : "Clear conversational pacing, natural melody, and strong word clarity.")
      );
    }
    return (
      `Connected Speech Passage (${probPct}% probability, ${sev}): ` +
      (flagged
        ? "Acoustic markers indicate articulatory slurring or prosodic decay across multi-word connected speech."
        : "Preserved connected-speech intelligibility and prosodic modulation.")
    );
  });
}

/**
 * Generates an audience-tailored Phase 11 (Clinician / Health Worker) or
 * Phase 12B.5 (Family & Caregiver) report from a SessionDiagnosticResponse.
 */
export function buildAgentReportForSession(
  report: SessionDiagnosticResponse,
  mode: AudienceReportMode
): AgentReportPayload {
  // Use pre-computed backend agent report if present on the session object
  const precomputed = report.agent_reports?.[mode];
  if (precomputed && precomputed.overview_paragraph) {
    return precomputed;
  }

  const isDys = Boolean(report.is_dysarthric);
  const probPct = Math.round((report.consensus_probability || 0) * 100);
  const severity = (report.consensus_severity || "normal").toLowerCase();
  const confidence = report.confidence_rating || "Moderate";
  const voteRatio = report.dysarthria_vote_ratio || "0/3";
  const taskTakeaways = buildTaskTakeaways(report.utterances || [], mode);

  if (mode === "caregiver") {
    let headline = "";
    let overview = "";
    let nextSteps = "";

    if (isDys) {
      const capSev = severity.charAt(0).toUpperCase() + severity.slice(1);
      headline = `Family & Caregiver Summary: ${capSev} Motor Speech Signal (${probPct}%)`;
      overview =
        `This 3-step voice screening detected a ${severity} motor-speech signal ` +
        `(overall score: ${probPct}%, with ${voteRatio} speech tasks flagged and ${confidence.toLowerCase()} confidence). ` +
        `Most importantly, please be reassured that dysarthria is strictly a physical muscle-coordination condition affecting the lips, tongue, vocal cords, or breath support — ` +
        `it does NOT affect intelligence, thinking, memory, or your loved one's ability to understand you.`;

      if (severity === "severe") {
        nextSteps =
          "We recommend scheduling an in-person evaluation with a certified Speech-Language Pathologist (SLP) and consulting your neurologist soon. " +
          "At home, speak face-to-face in a quiet room with background noise turned down, encourage slower phrase-by-phrase pacing, and allow extra time without finishing their sentences.";
      } else if (severity === "moderate") {
        nextSteps =
          "We recommend booking a follow-up visit with a registered Speech-Language Pathologist (SLP) to confirm these screening findings and tailor home exercises. " +
          "Practicing deliberate rate control (using the interactive Pacing Board) and speaking with a supported breath ('Think Loud') can noticeably improve everyday clarity.";
      } else {
        nextSteps =
          "Because this signal is mild, this is a helpful time for proactive monitoring and gentle daily speech practice. " +
          "Share this summary at your next routine clinic visit, and repeat this voice check every 2 to 4 weeks to compare before-and-after results.";
      }
    } else {
      headline = `Family & Caregiver Summary: Speech Within Normal Limits (${probPct}%)`;
      overview =
        `Good news: across the 3-step voice check, overall speech clarity and vocal steadiness fell within normal reference limits ` +
        `(risk score: ${probPct}%, ${voteRatio} tasks flagged, ${confidence.toLowerCase()} confidence). ` +
        `Remember that this tool is a supportive screening check, and dysarthria only relates to physical speech-muscle movement — never thinking or intelligence.`;
      nextSteps =
        "No urgent speech intervention is indicated by this recording. If you or your family notice voice fatigue later in the day, softer volume, or changes around medication timing, " +
        "you can run another screening session anytime to compare before-and-after results side-by-side.";
    }

    return {
      audience_mode: "caregiver",
      headline,
      overview_paragraph: overview,
      task_takeaways: taskTakeaways,
      reassurance_or_protocol_note:
        "Crucial Family Reassurance (Motor Control vs. Cognition): Dysarthria is a mechanical motor-speech condition caused by weakened or slowed speech muscles. The person knows exactly what they want to say; their mind, intellect, and comprehension remain completely intact.",
      next_steps_paragraph: nextSteps,
      generated_by: "DysarthriaNet-XC Caregiver Report Agent (Phase 12B.5)",
    };
  }

  // Mode: 'health_worker' (Phase 11)
  let headline = "";
  let overview = "";
  let nextSteps = "";

  if (isDys) {
    headline = `Health Worker & Clinical Triage Report: ${severity.toUpperCase()} Dysarthria Signal (${probPct}%)`;
    overview =
      `SCREENING SIGNAL NOTICE: Automated multi-prompt acoustic analysis (Wav2Vec 2.0 + CORAL cross-corpus calibration) ` +
      `flagged ${voteRatio} speech tasks with a consensus dysarthria probability of ${probPct}% ` +
      `(Predicted Severity: ${severity.toUpperCase()}, Confidence: ${confidence}). ` +
      `This result represents an objective acoustic screening signal — NOT a standalone medical diagnosis — and warrants clinical correlation.`;

    if (severity === "severe") {
      nextSteps =
        "Triage Action: Priority referral to an RCI/ISHA-certified Speech-Language Pathologist (SLP) and neurologist for comprehensive motor speech examination " +
        "(per Newcastle Dysarthria Assessment Tool [N-DAT] & Freed [2020] protocols), oral-motor cranial nerve screening, and swallowing/airway safety check.";
    } else if (severity === "moderate") {
      nextSteps =
        "Triage Action: Recommend formal SLP referral for perceptual and instrumental assessment of respiration, phonation (MPT), diadochokinetic rate (AMR/SMR), and connected-speech intelligibility. " +
        "Initiate behavioral rate-reduction (pacing board) and vocal loudness calibration trials.";
    } else {
      nextSteps =
        "Triage Action: Borderline/mild acoustic deviation detected. Recommend baseline SLP consultation if symptomatic, verify ambient recording quality, " +
        "and schedule longitudinal re-screening in 2–4 weeks to track subsystem progression.";
    }
  } else {
    headline = `Health Worker & Clinical Triage Report: Within Normal Limits (${probPct}%)`;
    overview =
      `SCREENING SIGNAL NOTICE: Multi-utterance acoustic screening yielded a low consensus probability of ${probPct}% ` +
      `(${voteRatio} tasks flagged; Confidence: ${confidence}), consistent with preserved phonatory stability, diadochokinetic regularity, and connected-speech prosody.`;
    nextSteps =
      "Triage Action: No immediate SLP referral required based on acoustic screening alone. Retain this session as the patient's longitudinal baseline; " +
      "re-evaluate if clinical history or patient self-report indicates emerging bulbar or motor-speech fatigue.";
  }

  return {
    audience_mode: "health_worker",
    headline,
    overview_paragraph: overview,
    task_takeaways: taskTakeaways,
    reassurance_or_protocol_note:
      "Clinical Protocol Note: Evaluated across 3 speech subsystems (Sustained Vowel /a/ for respiratory-phonatory stability, DDK /pa-ta-ka/ for articulatory velocity, and Connected Reading for prosodic endurance). Corroborate with in-person perceptual exam.",
    next_steps_paragraph: nextSteps,
    generated_by: "DysarthriaNet-XC Clinical Triage Report Agent (Phase 11)",
  };
}
