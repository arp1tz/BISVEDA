from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

class KnowledgeTier(str, Enum):
    TIER_A = "A"  # Catalogue metadata only
    TIER_B = "B"  # Public official text (QCO, Schemes, FAQs)
    TIER_C = "C"  # Licensed full text (Technical clauses, numeric values)

class ApplicabilityClass(str, Enum):
    DIRECTLY_APPLICABLE = "directly_applicable"
    POTENTIALLY_APPLICABLE = "potentially_applicable"
    RELATED_STANDARD = "related_standard"
    RELATED_MATERIAL_MISMATCH = "related_material_mismatch"
    SCOPE_UNCLEAR = "scope_unclear"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    NOT_APPLICABLE = "not_applicable"

class GroundingState(str, Enum):
    VERIFIED = "verified"
    SUPPORTED_INFERENCE = "supported_inference"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"

class ConfidenceLabel(str, Enum):
    VERIFIED_EVIDENCE = "verified_evidence"
    PARTIALLY_SUPPORTED = "partially_supported"
    LIMITED_EVIDENCE = "limited_evidence"
    NO_VERIFIED_EVIDENCE = "no_verified_evidence"

class DimensionCoverage(str, Enum):
    COVERED = "covered"
    NOT_COVERED = "not_covered"
    UNKNOWN = "unknown"

class CandidateCoverage(BaseModel):
    product: DimensionCoverage = DimensionCoverage.UNKNOWN
    material: DimensionCoverage = DimensionCoverage.UNKNOWN
    intended_use: DimensionCoverage = DimensionCoverage.UNKNOWN
    capacity_rating: DimensionCoverage = DimensionCoverage.UNKNOWN
    testing: DimensionCoverage = DimensionCoverage.UNKNOWN
    certification: DimensionCoverage = DimensionCoverage.UNKNOWN
    identifier: DimensionCoverage = DimensionCoverage.UNKNOWN

class CandidateAdjudication(BaseModel):
    standard_id: str
    is_number: str
    applicability: ApplicabilityClass
    coverage: CandidateCoverage
    tier: KnowledgeTier
    claim_policy: List[str] = Field(
        default_factory=list,
        description="Allowed claim types: identity, description, why, paragraph, clause, numeric"
    )

class ConflictRecord(BaseModel):
    type: str  # multiple_editions, supersession, conflicting_values, qco_mismatch
    standard_number: str
    description: str
    resolution_path: Optional[str] = None

class Adjudication(BaseModel):
    grounding_state: GroundingState
    confidence_label: ConfidenceLabel
    relevance_top1: float = Field(ge=0.0, le=1.0)
    relevance_floor: float = Field(default=0.45, ge=0.0, le=1.0)
    out_of_corpus: bool = False
    candidates: List[CandidateAdjudication] = Field(default_factory=list)
    conflicts: List[ConflictRecord] = Field(default_factory=list)
