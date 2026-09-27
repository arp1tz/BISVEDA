import sys
from pathlib import Path

api_root = str(Path(__file__).resolve().parent.parent.parent)
if api_root not in sys.path:
    sys.path.insert(0, api_root)

from bisveda.adjudication.adjudicator import EvidenceAdjudicator
from bisveda.contracts.adjudication import (
    ApplicabilityClass,
    DimensionCoverage,
    GroundingState,
    ConfidenceLabel,
    KnowledgeTier,
)
from bisveda.contracts.evidence import EvidenceClass

def test_flagship_pressure_cooker_adjudication():
    adjudicator = EvidenceAdjudicator(relevance_floor=0.45)
    candidates = [
        {
            "standard_id": "BIS-STD-002",
            "standard_number": "IS 2347",
            "full_title": "Domestic Pressure Cookers - Specification",
            "relevance_score": 0.96,
            "materials": ["Stainless Steel", "Aluminium Alloy"],
            "scope": "Specification for domestic pressure cookers of stainless steel or aluminium.",
            "key_testing_parameters": ["Hydrostatic pressure test at 200 kPa", "Thermal shock test"],
            "scheme": "Scheme-I",
            "mandatory_qco": True,
        }
    ]
    pkg = adjudicator.adjudicate(
        query_id="q-test-001",
        query="domestic pressure cookers stainless steel",
        intent="product_match",
        candidates=candidates,
        entities={"product": "pressure cooker", "material": "stainless steel"},
    )
    
    assert pkg.adjudication.out_of_corpus is False
    assert pkg.adjudication.grounding_state == GroundingState.VERIFIED
    assert pkg.adjudication.confidence_label == ConfidenceLabel.VERIFIED_EVIDENCE
    assert pkg.adjudication.relevance_top1 == 0.96
    
    cand = pkg.adjudication.candidates[0]
    assert cand.is_number == "IS 2347"
    assert cand.applicability == ApplicabilityClass.DIRECTLY_APPLICABLE
    assert cand.coverage.product == DimensionCoverage.COVERED
    assert cand.coverage.material == DimensionCoverage.COVERED
    assert cand.tier == KnowledgeTier.TIER_C
    
    # Assert citable evidence properties
    assert len(pkg.citable_evidence) >= 1
    assert pkg.citable_evidence[0].sid == "S1"
    assert pkg.citable_evidence[0].evidence_class == EvidenceClass.OFFICIAL_SOURCE

def test_material_mismatch_adjudication():
    adjudicator = EvidenceAdjudicator(relevance_floor=0.45)
    # Candidate standard strictly specifies Stainless Steel
    candidates = [
        {
            "standard_id": "BIS-STD-SS",
            "standard_number": "IS 17526",
            "full_title": "Stainless Steel Vacuum Flasks and Bottles",
            "relevance_score": 0.82,
            "materials": ["Stainless Steel"],
            "scope": "Vacuum insulated stainless steel flasks.",
            "key_testing_parameters": ["Thermal retention test"],
            "scheme": "Scheme-I",
        }
    ]
    # User query specifically requests aluminium
    pkg = adjudicator.adjudicate(
        query_id="q-test-002",
        query="aluminium water bottle",
        intent="product_match",
        candidates=candidates,
        entities={"product": "water bottle", "material": "aluminium"},
    )
    
    cand = pkg.adjudication.candidates[0]
    assert cand.applicability == ApplicabilityClass.RELATED_MATERIAL_MISMATCH
    assert cand.coverage.material == DimensionCoverage.NOT_COVERED

def test_relevance_floor_abstention():
    adjudicator = EvidenceAdjudicator(relevance_floor=0.45)
    # Low relevance candidates simulating unrelated query
    candidates = [
        {
            "standard_id": "BIS-STD-999",
            "standard_number": "IS 9999",
            "full_title": "Unrelated industrial machinery specification",
            "relevance_score": 0.38,
            "materials": [],
        }
    ]
    pkg = adjudicator.adjudicate(
        query_id="q-test-003",
        query="cryptocurrency mining legal standards",
        intent="product_match",
        candidates=candidates,
    )
    
    assert pkg.adjudication.out_of_corpus is True
    assert pkg.adjudication.grounding_state == GroundingState.INSUFFICIENT_EVIDENCE
    assert pkg.adjudication.confidence_label == ConfidenceLabel.NO_VERIFIED_EVIDENCE
    assert len(pkg.citable_evidence) == 0
    assert pkg.structured_data.get("status") == "abstained"

if __name__ == "__main__":
    test_flagship_pressure_cooker_adjudication()
    test_material_mismatch_adjudication()
    test_relevance_floor_abstention()
    print("All EvidenceAdjudicator unit tests passed successfully!")
