from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class StageName(str, Enum):
    UNDERSTAND = "understand"
    CLARIFY = "clarify"
    RETRIEVE = "retrieve"
    RERANK = "rerank"
    ADJUDICATE = "adjudicate"
    QCO = "qco"
    CERTIFICATION = "certification"
    LABS = "labs"
    TESTING = "testing"
    GENERATE = "generate"
    TRUST = "trust"
    TRANSLATE = "translate"

class StageEventKind(str, Enum):
    TURN_ACCEPTED = "turn.accepted"
    STAGE_STARTED = "stage.started"
    STAGE_COMPLETED = "stage.completed"
    CLARIFICATION_REQUIRED = "clarification.required"
    SECTION_READY = "section.ready"
    ANSWER_DELTA = "answer.delta"
    TRUST_RESULT = "trust.result"
    TURN_COMPLETED = "turn.completed"
    TURN_FAILED = "turn.failed"

class StageEvent(BaseModel):
    event: StageEventKind
    turn_id: str
    stage: Optional[StageName] = None
    duration_ms: Optional[int] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    timestamp: str

class IngestionStepName(str, Enum):
    UPLOAD = "upload"
    MALWARE_SCAN = "malware_scan"
    IDENTITY = "identity"
    CATALOGUE_MATCH = "catalogue_match"
    PARSE = "parse"
    OCR = "ocr"
    CHUNK = "chunk"
    ENRICH = "enrich"
    EMBED = "embed"
    OUTDATED_REFS = "outdated_refs"
    STAGING_INDEX = "staging_index"
    REVIEW = "review"
    PUBLISH = "publish"

class JobEvent(BaseModel):
    job_id: str
    step: IngestionStepName
    status: str  # started, completed, failed, quarantined
    duration_ms: Optional[int] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    timestamp: str
