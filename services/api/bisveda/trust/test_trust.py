import sys
from pathlib import Path

api_root = str(Path(__file__).resolve().parent.parent.parent)
if api_root not in sys.path:
    sys.path.insert(0, api_root)

from bisveda.trust.trust_gate import TrustGate
from bisveda.contracts.adjudication import (
    Adjudication,
    ApplicabilityClass,
    CandidateAdjudication,
    CandidateCoverage,
    ConfidenceLabel,
    GroundingState,
    KnowledgeTier,
)
from bisveda.contracts.evidence import (
    CitableEvidenceItem,
    EvidenceClass,
    EvidencePackage,
)

def test_bracket_normalisation_and_citation_verification():
    gate = TrustGate(strict_tier_enforcement=True)
    
    adj = Adjudication(
        grounding_state=GroundingState.VERIFIED,
        confidence_label=ConfidenceLabel.VERIFIED_EVIDENCE,
        relevance_top1=0.95,
    )
    pkg = EvidencePackage(
        query_id="q-trust-1",
        canonical_query="pressure cooker",
        original_query="cooker",
        intent="product_match",
        adjudication=adj,
        citable_evidence=[
            CitableEvidenceItem(
                sid="S1",
                tier=KnowledgeTier.TIER_C,
                kind="clause_text",
                locator="IS 2347 Cl. 7.1",
                snippet="Pressure test 200 kPa",
                retrieved_at="2026-09-23T00:00:00Z",
            )
        ]
    )

    raw_text = "According to 【S1】, domestic pressure cookers must be tested under hydrostatic pressure."
    result = gate.verify(raw_text, pkg)
    
    assert result.passed is True
    assert "[S1]" in result.clean_text
    assert "【S1】" not in result.clean_text
    assert "S1" in result.verified_citations
    assert len(result.stripped_citations) == 0

def test_hallucinated_citation_stripped():
    gate = TrustGate(strict_tier_enforcement=True)
    adj = Adjudication(
        grounding_state=GroundingState.VERIFIED,
        confidence_label=ConfidenceLabel.VERIFIED_EVIDENCE,
        relevance_top1=0.95,
    )
    pkg = EvidencePackage(
        query_id="q-trust-2",
        canonical_query="pressure cooker",
        original_query="cooker",
        intent="product_match",
        adjudication=adj,
        citable_evidence=[
            CitableEvidenceItem(
                sid="S1",
                tier=KnowledgeTier.TIER_C,
                kind="clause_text",
                locator="IS 2347 Cl. 7.1",
                snippet="Hydrostatic test",
                retrieved_at="2026-09-23T00:00:00Z",
            )
        ]
    )

    raw_text = "Pressure cookers require IS 2347 [S1]. Also see ungrounded rule [S99]."
    result = gate.verify(raw_text, pkg)
    
    assert "[S1]" in result.clean_text
    assert "[S99]" not in result.clean_text
    assert "S99" in result.stripped_citations
    assert result.checks[0].check_name == "citation_integrity"
    assert result.checks[0].passed is False

def test_tier_a_honesty_check():
    gate = TrustGate(strict_tier_enforcement=True)
    adj = Adjudication(
        grounding_state=GroundingState.SUPPORTED_INFERENCE,
        confidence_label=ConfidenceLabel.PARTIALLY_SUPPORTED,
        relevance_top1=0.80,
        candidates=[
            CandidateAdjudication(
                standard_id="is-tier-a",
                is_number="IS 9999",
                applicability=ApplicabilityClass.DIRECTLY_APPLICABLE,
                coverage=CandidateCoverage(),
                tier=KnowledgeTier.TIER_A,
            )
        ]
    )
    pkg = EvidencePackage(
        query_id="q-trust-3",
        canonical_query="test",
        original_query="test",
        intent="product_match",
        adjudication=adj,
        citable_evidence=[
            CitableEvidenceItem(
                sid="S1",
                tier=KnowledgeTier.TIER_A,
                kind="catalogue_record",
                locator="IS 9999",
                snippet="Metadata only",
                retrieved_at="2026-09-23T00:00:00Z",
            )
        ]
    )

    # Raw text claiming numeric limits on a Tier A standard
    raw_text = "Under IS 9999 [S1], the wall thickness must be exactly 15 mm."
    result = gate.verify(raw_text, pkg)
    
    assert any("Tier A Notice" in c for c in result.caveats)
    assert any(c.check_name == "tier_honesty" and c.passed is False for c in result.checks)

if __name__ == "__main__":
    test_bracket_normalisation_and_citation_verification()
    test_hallucinated_citation_stripped()
    test_tier_a_honesty_check()
    print("All TrustGate unit tests passed successfully!")
