"""
Phase 11 & Phase 12B.5 — Report Generation Agent Service.
Converts raw DysarthriaNet-XC model outputs into audience-tailored plain-language reports:
1. 'health_worker': Community Health Worker / Clinician Screening Report (Phase 11)
2. 'caregiver': Warm, reassuring Family & Caregiver Report clarifying motor control vs. cognition (Phase 12B.5)

Grounded in deterministic N-DAT & Freed (2020) clinical rules.
"""

import os
from typing import Any, Dict, List, Optional


def _build_task_summary_lines(utterances: List[Dict[str, Any]], mode: str) -> List[str]:
    lines: List[str] = []
    for idx, u in enumerate(utterances, 1):
        t_raw = str(u.get("task_name", "speech_task")).lower()
        prob_pct = round(float(u.get("dysarthria_probability", 0.0)) * 100)
        sev = str(u.get("predicted_severity", "normal")).upper()
        flagged = bool(u.get("is_dysarthric", False))
        aq = u.get("audio_quality") or {}
        dur_sec = aq.get("duration_seconds") if isinstance(aq, dict) else None
        dur_str = f" | {dur_sec:.1f}s" if isinstance(dur_sec, (int, float)) and dur_sec > 0 else ""

        if "vowel" in t_raw:
            if mode == "caregiver":
                desc = (
                    f"Steady 'Ahhh' Voice Hold ({prob_pct}% risk signal{dur_str}): "
                    + (
                        "Showed some voice tremor or breathiness, meaning the vocal cords and breath support worked harder to keep a steady tone."
                        if flagged
                        else "Sounded steady and well-supported with healthy breath control."
                    )
                )
            else:
                desc = (
                    f"Sustained Vowel Phonation /a/ ({prob_pct}% probability, {sev}{dur_str}): "
                    + (
                        "Elevated phonatory instability (jitter/shimmer or reduced respiratory-laryngeal efficiency per N-DAT MPT criteria)."
                        if flagged
                        else "Within expected phonatory stability and glottal closure boundaries."
                    )
                )
        elif "ddk" in t_raw or "pataka" in t_raw:
            if mode == "caregiver":
                desc = (
                    f"Quick 'Pa-Ta-Ka' Syllable Rhythm ({prob_pct}% risk signal{dur_str}): "
                    + (
                        "Showed slowed or blurred transitions between lip, tongue-tip, and back-of-tongue movements."
                        if flagged
                        else "Showed crisp, well-coordinated lip and tongue movement speed."
                    )
                )
            else:
                desc = (
                    f"Diadochokinetic (DDK) SMR /pa-ta-ka/ ({prob_pct}% probability, {sev}{dur_str}): "
                    + (
                        "Reduced alternating/sequential articulatory velocity or timing irregularity across bilabial-alveolar-velar transitions."
                        if flagged
                        else "Intact sequential motor rate and articulatory precision."
                    )
                )
        elif "statement" in t_raw:
            trial_num = u.get("utterance_index") or idx
            if mode == "caregiver":
                desc = (
                    f"Extended Statement Reading - Trial #{trial_num} ({prob_pct}% risk signal{dur_str}): "
                    + (
                        "Showed motor fatigue, slowed syllable cadence, or softened consonant clarity across sustained multi-sentence reading."
                        if flagged
                        else "Maintained steady conversational rhythm, clear consonant articulation, and consistent vocal stamina across the full statement window."
                    )
                )
            else:
                desc = (
                    f"Extended Clinical Statement Trial #{trial_num} ({prob_pct}% probability, {sev}{dur_str}): "
                    + (
                        "Multi-window Wav2Vec 2.0 & cadence analysis detected bradylalic syllable rate decay, spectral consonant flattening, or prosodic fatigue across sustained statement reading."
                        if flagged
                        else "Preserved multi-sentence syllable cadence (>=2.4 Hz), consonant spectral crispness, and respiratory-prosodic endurance."
                    )
                )
        else:
            if mode == "caregiver":
                desc = (
                    f"Full Sentence Reading ({prob_pct}% risk signal{dur_str}): "
                    + (
                        "Showed mild slurring or vocal fatigue across longer connected phrases, where slowing down and pausing between words can help."
                        if flagged
                        else "Clear conversational pacing, natural melody, and strong word clarity."
                    )
                )
            else:
                desc = (
                    f"Connected Speech Passage ({prob_pct}% probability, {sev}{dur_str}): "
                    + (
                        "Acoustic markers indicate articulatory slurring or prosodic decay across multi-word connected speech."
                        if flagged
                        else "Preserved connected-speech intelligibility and prosodic modulation."
                    )
                )
        lines.append(desc)
    return lines


def generate_deterministic_report(
    prediction_data: Dict[str, Any],
    audience_mode: str = "health_worker",
) -> Dict[str, Any]:
    """
    Generates a structured, clinically grounded Phase 11 / Phase 12B.5 report
    for either 'health_worker' or 'caregiver' mode.
    """
    is_dys = bool(prediction_data.get("is_dysarthric", False))
    prob = float(prediction_data.get("consensus_probability", 0.0))
    prob_pct = round(prob * 100)
    severity = str(prediction_data.get("consensus_severity", "normal")).lower()
    confidence = str(prediction_data.get("confidence_rating", "Moderate"))
    vote_ratio = str(prediction_data.get("dysarthria_vote_ratio", "0/3"))
    utterances = prediction_data.get("utterances", []) or []

    task_Takeaways = _build_task_summary_lines(utterances, audience_mode)

    if audience_mode == "caregiver":
        if is_dys:
            headline = f"Family & Caregiver Summary: {severity.capitalize()} Motor Speech Signal ({prob_pct}%)"
            overview = (
                f"This 3-step voice screening detected a {severity} motor-speech signal "
                f"(overall score: {prob_pct}%, with {vote_ratio} speech tasks flagged and {confidence.lower()} confidence). "
                "Most importantly, please be reassured that dysarthria is strictly a physical muscle-coordination condition affecting the lips, tongue, vocal cords, or breath support — "
                "it does NOT affect intelligence, thinking, memory, or your loved one's ability to understand you."
            )
            if severity == "severe":
                next_steps = (
                    "We recommend scheduling an in-person evaluation with a certified Speech-Language Pathologist (SLP) and consulting your neurologist soon. "
                    "At home, speak face-to-face in a quiet room with the TV or fan turned down, encourage slower phrase-by-phrase pacing, and never rush or finish their sentences unless they ask."
                )
            elif severity == "moderate":
                next_steps = (
                    "We recommend booking a follow-up visit with a registered Speech-Language Pathologist (SLP) to confirm these screening findings and tailor home exercises. "
                    "Practicing deliberate rate control (using the Pacing Board) and speaking with a slightly louder, supported breath ('Think Loud') can noticeably improve everyday clarity."
                )
            else:
                next_steps = (
                    "Because this signal is mild, it is a great time for proactive monitoring and gentle daily speech practice. "
                    "Consider sharing this summary at your next routine clinic visit, and repeat this voice check every 2 to 4 weeks to see if speech clarity stays steady."
                )
        else:
            headline = f"Family & Caregiver Summary: Speech Within Normal Limits ({prob_pct}%)"
            overview = (
                f"Good news: across the 3-step voice check, overall speech clarity and vocal steadiness fell within normal reference limits "
                f"(risk score: {prob_pct}%, {vote_ratio} tasks flagged, {confidence.lower()} confidence). "
                "Remember that this tool is a supportive screening check, and dysarthria only relates to physical speech-muscle movement — never thinking or intelligence."
            )
            next_steps = (
                "No urgent speech intervention is indicated by this recording. If you or your family notice voice fatigue later in the day, softer volume, or changes in medication timing, "
                "you can re-run a screening session anytime to compare before-and-after results side-by-side."
            )

        reassurance_note = (
            "Crucial Family Reassurance (Motor Control vs. Cognition): Dysarthria is a mechanical motor-speech condition caused by weakened or slowed speech muscles. "
            "The person knows exactly what they want to say; their mind, intellect, and comprehension remain intact."
        )
    else:
        # Phase 11: Community Health Worker / Clinician View
        if is_dys:
            headline = f"Health Worker & Clinical Triage Report: {severity.upper()} Dysarthria Signal ({prob_pct}%)"
            overview = (
                f"SCREENING SIGNAL NOTICE: Automated multi-prompt acoustic analysis (Wav2Vec 2.0 + CORAL cross-corpus calibration) "
                f"flagged {vote_ratio} speech tasks with a consensus dysarthria probability of {prob_pct}% "
                f"(Predicted Severity: {severity.upper()}, Confidence: {confidence}). "
                "This result represents an objective acoustic screening signal — NOT a standalone medical diagnosis — and warrants clinical correlation."
            )
            if severity == "severe":
                next_steps = (
                    "Triage Action: Priority referral to an RCI/ISHA-certified Speech-Language Pathologist (SLP) and neurologist for comprehensive motor speech examination "
                    "(per Newcastle Dysarthria Assessment Tool [N-DAT] & Freed [2020] protocols), oral-motor cranial nerve screening, and swallowing/airway safety check."
                )
            elif severity == "moderate":
                next_steps = (
                    "Triage Action: Recommend formal SLP referral for perceptual and instrumental assessment of respiration, phonation (MPT), diadochokinetic rate (AMR/SMR), and connected-speech intelligibility. "
                    "Initiate behavioral rate-reduction (pacing board) and vocal loudness calibration trials."
                )
            else:
                next_steps = (
                    "Triage Action: Borderline/mild acoustic deviation detected. Recommend baseline SLP consultation if symptomatic, verify ambient recording quality, "
                    "and schedule longitudinal re-screening in 2–4 weeks to track subsystem progression."
                )
        else:
            headline = f"Health Worker & Clinical Triage Report: Within Normal Limits ({prob_pct}%)"
            overview = (
                f"SCREENING SIGNAL NOTICE: Multi-utterance acoustic screening yielded a low consensus probability of {prob_pct}% "
                f"({vote_ratio} tasks flagged; Confidence: {confidence}), consistent with preserved phonatory stability, diadochokinetic regularity, and connected-speech prosody."
            )
            next_steps = (
                "Triage Action: No immediate SLP referral required based on acoustic screening alone. Retain this session as the patient's longitudinal baseline; "
                "re-evaluate if clinical history or patient self-report indicates emerging bulbar or motor-speech fatigue."
            )

        reassurance_note = (
            "Clinical Protocol Note: Evaluated across 3 speech subsystems (Sustained Vowel /a/ for respiratory-phonatory stability, "
            "DDK /pa-ta-ka/ for articulatory velocity, and Connected Reading for prosodic endurance). Corroborate with in-person perceptual exam."
        )

    return {
        "audience_mode": audience_mode,
        "headline": headline,
        "overview_paragraph": overview,
        "task_takeaways": task_Takeaways,
        "reassurance_or_protocol_note": reassurance_note,
        "next_steps_paragraph": next_steps,
        "generated_by": "DysarthriaNet-XC Clinical Report Agent (N-DAT / Freed Grounded)",
    }


def generate_agent_report(
    prediction_data: Dict[str, Any],
    audience_mode: str = "health_worker",
) -> Dict[str, Any]:
    """
    Phase 11 & Phase 12B.5 Report Generation Agent.
    Uses the deterministic N-DAT & Freed (2020) clinical synthesis engine.
    """
    mode = "caregiver" if audience_mode == "caregiver" else "health_worker"
    return generate_deterministic_report(prediction_data, mode)
