"""Clinical speech screening endpoints for single clips and multi-utterance sessions."""

import uuid
import time
from typing import List, Optional
from collections import Counter
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status

from backend.app.schemas.screening import (
    ClipScreeningResponse,
    SessionConsensusResponse,
    SessionUtteranceResult,
    SeverityProbabilities,
    AudioQualityMetrics,
    AgentReportPayload,
    ReportAgentRequest,
)
from backend.app.services.audio_service import load_and_preprocess_audio, AudioValidationError
from backend.app.services.inference_service import get_model_service
from backend.app.services.report_agent_service import generate_agent_report

router = APIRouter()


@router.post("/clip", response_model=ClipScreeningResponse, summary="Screen Single Audio Utterance")
async def screen_single_clip(
    file: UploadFile = File(..., description="Audio file (.wav, .mp3, .ogg, .flac)"),
    task_name: Optional[str] = Form(None, description="Task label: sustained_vowel, ddk_pataka, sentence_passage")
):
    """
    Process a single speech audio clip, extracting foundation representations
    and predicting dysarthria presence, calibrated probability, and clinical severity.
    """
    try:
        content = await file.read()
        waveform, quality = load_and_preprocess_audio(content, file.filename or "recording.wav")
    except AudioValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to process audio: {str(e)}")

    service = get_model_service()
    pred = service.predict_from_waveform(waveform, task_name=task_name or file.filename, input_rms_db=quality.get("input_rms_db"))

    return ClipScreeningResponse(
        clip_id=f"clip_{uuid.uuid4().hex[:10]}",
        filename=file.filename or "recording.wav",
        is_dysarthric=pred["is_dysarthric"],
        dysarthria_probability=pred["dysarthria_probability"],
        confidence_level=pred["confidence_level"],
        predicted_severity=pred["predicted_severity"],
        severity_probabilities=SeverityProbabilities(**pred["severity_probabilities"]),
        audio_quality=AudioQualityMetrics(**quality),
        clinical_note=pred["clinical_note"],
    )


@router.post("/session", response_model=SessionConsensusResponse, summary="Multi-Utterance Clinical Battery Screening")
async def screen_clinical_session(
    files: List[UploadFile] = File(..., description="List of 2 to 5 clinical audio clips"),
    task_labels: Optional[str] = Form(
        None,
        description="Comma-separated labels for tasks, e.g. 'sustained_vowel,ddk_pataka,sentence'"
    ),
):
    """
    Aggregates multi-task vocal screening battery (vowel phonation, DDK repetition, and sentence reading)
    into a consensus clinical diagnostic report adhering to clinical motor speech examination standards.
    """
    if len(files) < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one audio clip is required for session screening.")

    labels = [lbl.strip() for lbl in task_labels.split(",")] if task_labels else []
    service = get_model_service()

    utterance_results = []
    probabilities = []
    dys_votes = 0

    for idx, f in enumerate(files, 1):
        task_name = labels[idx - 1] if idx - 1 < len(labels) else f"task_{idx}"
        try:
            content = await f.read()
            waveform, quality_clip = load_and_preprocess_audio(content, f.filename or f"clip_{idx}.wav")
        except AudioValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Error in clip #{idx} ({f.filename}): {str(e)}"
            )

        pred = service.predict_from_waveform(waveform, task_name=task_name, input_rms_db=quality_clip.get("input_rms_db"))
        probabilities.append(pred["dysarthria_probability"])
        if pred["is_dysarthric"]:
            dys_votes += 1

        utterance_results.append(SessionUtteranceResult(
            utterance_index=idx,
            task_name=task_name,
            filename=f.filename or f"clip_{idx}.wav",
            is_dysarthric=pred["is_dysarthric"],
            dysarthria_probability=pred["dysarthria_probability"],
            predicted_severity=pred["predicted_severity"],
            audio_quality=AudioQualityMetrics(**quality_clip),
            clinical_note=pred.get("clinical_note"),
        ))

    total = len(utterance_results)
    avg_prob = float(np.mean(probabilities))
    is_consensus_dys = bool(dys_votes >= (total / 2.0))

    if is_consensus_dys:
        # Determine consensus severity
        sev_counts = Counter([u.predicted_severity for u in utterance_results if u.is_dysarthric])
        consensus_sev = sev_counts.most_common(1)[0][0] if sev_counts else "mild"
        diag_str = "Dysarthria Detected"
        
        if consensus_sev == "severe":
            action = "Urgent: Immediate Comprehensive Speech-Language Pathology and Neurological Workup Recommended"
        elif consensus_sev == "moderate":
            action = "Prompt: Referral to Speech-Language Pathologist for Instrumental Acoustic and Aerodynamic Motor Assessment"
        else:
            action = "Mild/Borderline: Longitudinal Speech Acoustic Monitoring and Preventive Clinical Screening"
    else:
        consensus_sev = "normal"
        diag_str = "Speech Within Normal Limits"
        action = "Motor speech acoustics within standard physiological boundaries. Re-screen if patient reports speech fatigue or change."

    conf_rating = "High" if (avg_prob >= 0.80 or avg_prob <= 0.20) else "Moderate"

    raw_summary = {
        "is_dysarthric": is_consensus_dys,
        "consensus_probability": round(avg_prob, 4),
        "consensus_severity": consensus_sev,
        "confidence_rating": conf_rating,
        "dysarthria_vote_ratio": f"{dys_votes}/{total}",
        "utterances": [u.model_dump() if hasattr(u, "model_dump") else u.dict() for u in utterance_results],
    }

    hw_report = generate_agent_report(raw_summary, audience_mode="health_worker")
    cg_report = generate_agent_report(raw_summary, audience_mode="caregiver")

    return SessionConsensusResponse(
        session_id=f"sess_{uuid.uuid4().hex[:12]}",
        timestamp=time.strftime("%Y-%m-%d %H:%M:%SZ", time.gmtime()),
        total_utterances=total,
        consensus_diagnosis=diag_str,
        is_dysarthric=is_consensus_dys,
        consensus_probability=round(avg_prob, 4),
        consensus_severity=consensus_sev,
        confidence_rating=conf_rating,
        dysarthria_vote_ratio=f"{dys_votes}/{total}",
        clinical_recommendation=action,
        utterances=utterance_results,
        agent_reports={
            "health_worker": AgentReportPayload(**hw_report),
            "caregiver": AgentReportPayload(**cg_report),
        },
    )


@router.post("/report-agent", response_model=AgentReportPayload, summary="Phase 11 & 12B.5 Report Generation Agent")
async def generate_audience_report(req: ReportAgentRequest):
    """
    Generates an audience-tailored plain-language screening report:
    - 'health_worker': Community Health Worker / Clinician Triage view (Phase 11)
    - 'caregiver': Family & Caregiver reassuring view clarifying motor control vs. cognition (Phase 12B.5)
    """
    payload_dict = {
        "is_dysarthric": req.is_dysarthric,
        "consensus_probability": req.consensus_probability,
        "consensus_severity": req.consensus_severity,
        "confidence_rating": req.confidence_rating,
        "dysarthria_vote_ratio": req.dysarthria_vote_ratio,
        "utterances": [u.model_dump() if hasattr(u, "model_dump") else u.dict() for u in req.utterances],
    }
    report = generate_agent_report(payload_dict, audience_mode=req.audience_mode)
    return AgentReportPayload(**report)
