"""Pydantic request and response schemas for clinical speech screening."""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., example="HEALTHY")
    version: str = Field(..., example="1.0.0")
    project: str = Field(..., example="DysarthriaNet-XC")
    model_loaded: bool = Field(..., example=True)
    device: str = Field(..., example="cuda")
    supported_tasks: List[str] = Field(
        ...,
        example=["binary_screening", "clinical_severity", "session_consensus"]
    )


class AudioQualityMetrics(BaseModel):
    duration_seconds: float = Field(..., description="Duration in seconds")
    sample_rate: int = Field(..., description="Original sampling rate")
    channels: int = Field(..., description="Original audio channel count")
    peak_amplitude: float = Field(..., description="Maximum absolute amplitude [0, 1]")
    is_clipping: bool = Field(..., description="Flag if audio exceeds digital threshold")
    snr_db: Optional[float] = Field(None, description="Estimated SNR in dB")
    input_rms_db: Optional[float] = Field(None, description="Pre-normalization RMS level in dBFS")



class SeverityProbabilities(BaseModel):
    mild: float = Field(..., description="Probability of mild dysarthria [0, 1]")
    moderate: float = Field(..., description="Probability of moderate dysarthria [0, 1]")
    severe: float = Field(..., description="Probability of severe dysarthria [0, 1]")


class ClipScreeningResponse(BaseModel):
    clip_id: str = Field(..., description="Unique clip tracking identifier")
    filename: str = Field(..., description="Uploaded audio filename")
    is_dysarthric: bool = Field(..., description="Binary screening outcome")
    dysarthria_probability: float = Field(..., description="Calibrated dysarthria probability [0, 1]")
    confidence_level: str = Field(..., description="Confidence rating: High, Moderate, Low")
    predicted_severity: str = Field(..., description="Normal, Mild, Moderate, or Severe")
    severity_probabilities: SeverityProbabilities
    audio_quality: AudioQualityMetrics
    clinical_note: str = Field(..., description="Plain-English clinical interpretation")


class SessionUtteranceResult(BaseModel):
    utterance_index: int
    task_name: str = Field(..., description="e.g. sustained_vowel, ddk_pataka, sentence_reading, statement_passage_1")
    filename: str
    is_dysarthric: bool
    dysarthria_probability: float
    predicted_severity: str
    audio_quality: Optional[AudioQualityMetrics] = None
    clinical_note: Optional[str] = None


class AgentReportPayload(BaseModel):
    audience_mode: str = Field(..., description="'health_worker' or 'caregiver'")
    headline: str
    overview_paragraph: str
    task_takeaways: List[str]
    reassurance_or_protocol_note: str
    next_steps_paragraph: str
    generated_by: str


class ReportAgentRequest(BaseModel):
    audience_mode: str = Field("health_worker", description="'health_worker' or 'caregiver'")
    is_dysarthric: bool
    consensus_probability: float
    consensus_severity: str
    confidence_rating: str = "Moderate"
    dysarthria_vote_ratio: str = "0/3"
    utterances: List[SessionUtteranceResult] = []


class SessionConsensusResponse(BaseModel):
    session_id: str
    timestamp: str
    total_utterances: int
    consensus_diagnosis: str = Field(..., description="Dysarthria Detected vs Speech Within Normal Limits")
    is_dysarthric: bool
    consensus_probability: float
    consensus_severity: str
    confidence_rating: str
    dysarthria_vote_ratio: str
    clinical_recommendation: str
    utterances: List[SessionUtteranceResult]
    agent_reports: Optional[Dict[str, AgentReportPayload]] = None
