import os
import sys
from pathlib import Path

# Ensure services/api is on the python search path
api_root = str(Path(__file__).resolve().parent.parent.parent)
if api_root not in sys.path:
    sys.path.insert(0, api_root)

try:
    import pytest
except ImportError:
    pytest = None
from bisveda.contracts.slots import SlotSchema
from bisveda.contracts.adjudication import (
    Adjudication,
    ApplicabilityClass,
    CandidateAdjudication,
    CandidateCoverage,
    ConfidenceLabel,
    DimensionCoverage,
    GroundingState,
    KnowledgeTier,
)
from bisveda.contracts.evidence import (
    CitableEvidenceItem,
    EvidenceClass,
    EvidencePackage,
)
from bisveda.contracts.dossier import ComplianceDossier

def test_slot_schema_contains_no_decision_fields():
    """
    NON-NEGOTIABLE RULE 2:
    Adjudicate before generating. The generation SlotSchema must NOT contain
    fields for regulatory determinations (applicability, grounding, confidence,
    QCO status, eligibility, IS numbers list).
    """
    fields = set(SlotSchema.model_fields.keys())
    forbidden_field_substrings = [
        "applicability",
        "grounding",
        "confidence",
        "qco",
        "eligibility",
        "mandatory",
        "is_number",
        "citation_target",
    ]
    
    for field in fields:
        for forbidden in forbidden_field_substrings:
            assert forbidden not in field.lower(), (
                f"Violation of Rule 2: SlotSchema has forbidden decision field '{field}' containing '{forbidden}'"
            )

def test_adjudication_model_validates():
    adj = Adjudication(
        grounding_state=GroundingState.VERIFIED,
        confidence_label=ConfidenceLabel.VERIFIED_EVIDENCE,
        relevance_top1=0.95,
        relevance_floor=0.45,
        out_of_corpus=False,
        candidates=[
            CandidateAdjudication(
                standard_id="is-2347-2017",
                is_number="IS 2347:2017",
                applicability=ApplicabilityClass.DIRECTLY_APPLICABLE,
                coverage=CandidateCoverage(
                    product=DimensionCoverage.COVERED,
                    material=DimensionCoverage.COVERED,
                    intended_use=DimensionCoverage.COVERED,
                ),
                tier=KnowledgeTier.TIER_B,
                claim_policy=["identity", "description", "why", "paragraph"],
            )
        ]
    )
    assert adj.grounding_state == GroundingState.VERIFIED
    assert adj.candidates[0].applicability == ApplicabilityClass.DIRECTLY_APPLICABLE

def test_evidence_package_model_validates():
    adj = Adjudication(
        grounding_state=GroundingState.SUPPORTED_INFERENCE,
        confidence_label=ConfidenceLabel.PARTIALLY_SUPPORTED,
        relevance_top1=0.88,
        relevance_floor=0.45,
    )
    pkg = EvidencePackage(
        query_id="q-12345",
        canonical_query="domestic pressure cookers stainless steel",
        original_query="cooker",
        intent="product_match",
        adjudication=adj,
        citable_evidence=[
            CitableEvidenceItem(
                sid="S1",
                tier=KnowledgeTier.TIER_B,
                kind="clause_text",
                locator="IS 2347:2017 Cl. 7.1",
                snippet="Hydrostatic test at 200 kPa for 60s without rupture.",
                retrieved_at="2026-09-23T00:00:00Z",
            )
        ]
    )
    assert pkg.citable_evidence[0].sid == "S1"
    assert pkg.citable_evidence[0].evidence_class == EvidenceClass.OFFICIAL_SOURCE

if __name__ == "__main__":
    test_slot_schema_contains_no_decision_fields()
    test_adjudication_model_validates()
    test_evidence_package_model_validates()
    print("All contract assertions passed successfully!")
