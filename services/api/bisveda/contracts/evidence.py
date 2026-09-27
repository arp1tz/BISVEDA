from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from .adjudication import Adjudication, KnowledgeTier

class EvidenceClass(str, Enum):
    OFFICIAL_SOURCE = "official_source"   # Citable with [S#]
    USER_PROVIDED = "user_provided"       # Context only, never citable as BIS
    AI_INTERPRETATION = "ai_interpretation" # Summaries, clearly labelled

class CitableEvidenceItem(BaseModel):
    sid: str = Field(description="e.g. 'S1', 'S2'")
    evidence_class: EvidenceClass = EvidenceClass.OFFICIAL_SOURCE
    tier: KnowledgeTier
    kind: str  # catalogue_record, clause_text, qco_order, lab_record, fee_schedule
    standard_id: Optional[str] = None
    locator: str  # e.g. "IS 2347:2017 Cl. 7.1", "Gazette S.O. 1234(E)"
    snippet: str
    source_url: Optional[str] = None
    retrieved_at: str
    document_version: Optional[str] = None

class NonCitableContextItem(BaseModel):
    evidence_class: EvidenceClass = EvidenceClass.USER_PROVIDED
    kind: str  # business_context, upload_extract, dialogue_history
    text: str
    media_id: Optional[str] = None

class EvidencePackage(BaseModel):
    query_id: str
    canonical_query: str
    original_query: str
    language: str = "en"
    intent: str
    sub_intents: List[str] = Field(default_factory=list)
    entities: Dict[str, Any] = Field(default_factory=dict)
    missing_attributes: List[str] = Field(default_factory=list)
    adjudication: Adjudication
    citable_evidence: List[CitableEvidenceItem] = Field(default_factory=list)
    context_non_citable: List[NonCitableContextItem] = Field(default_factory=list)
    structured_data: Dict[str, Any] = Field(default_factory=dict)
    official_links: List[Dict[str, str]] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
