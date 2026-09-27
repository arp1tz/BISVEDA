import sys
from pathlib import Path

api_root = str(Path(__file__).resolve().parent.parent.parent)
if api_root not in sys.path:
    sys.path.insert(0, api_root)

from bisveda.adjudication.adjudicator import EvidenceAdjudicator
from bisveda.generation.evidence_only import EvidenceOnlySynthesizer
from bisveda.trust.trust_gate import TrustGate
from bisveda.orchestration.dossier_builder import DossierBuilder
from bisveda.contracts.dossier import ComplianceDossier

def test_evidence_only_synthesis_flagship():
    adjudicator = EvidenceAdjudicator()
    synthesizer = EvidenceOnlySynthesizer()
    gate = TrustGate()
    builder = DossierBuilder()

    candidates = [
        {
            "standard_id": "BIS-STD-002",
            "standard_number": "IS 2347",
            "full_title": "Domestic Pressure Cookers - Specification",
            "relevance_score": 0.95,
            "materials": ["Stainless Steel", "Aluminium Alloy"],
            "scope": "Specification for domestic pressure cookers of stainless steel or aluminium.",
            "key_testing_parameters": ["Hydrostatic pressure test at 200 kPa for 60 seconds", "Thermal shock test"],
            "scheme": "Scheme-I",
            "mandatory_qco": True,
        }
    ]

    pkg = adjudicator.adjudicate(
        query_id="q-synth-1",
        query="domestic pressure cooker stainless steel",
        intent="product_match",
        candidates=candidates,
        entities={"product": "pressure cooker", "material": "stainless steel"},
    )

    # 1. Synthesize prose
    raw_text = synthesizer.synthesize(pkg)
    assert "IS 2347" in raw_text
    assert "[S1]" in raw_text
    assert "80% concession" in raw_text

    # 2. Verify with TrustGate
    trust_res = gate.verify(raw_text, pkg)
    assert trust_res.passed is True
    assert "S1" in trust_res.verified_citations
    assert len(trust_res.stripped_citations) == 0

    # 3. Assemble Dossier
    dossier = builder.build(pkg, trust_res, user_type="msme")
    assert isinstance(dossier, ComplianceDossier)
    assert dossier.standards[0].is_number == "IS 2347"
    assert dossier.certification_route.indicative_fee["msme_subsidy_percentage"] == 80
    assert dossier.certification_route.indicative_fee["application_fee_inr"] == 200
    assert len(dossier.evidence_ledger) >= 1
    assert "IS 2347" in dossier.summary

def test_evidence_only_abstention():
    adjudicator = EvidenceAdjudicator()
    synthesizer = EvidenceOnlySynthesizer()
    gate = TrustGate()
    builder = DossierBuilder()

    pkg = adjudicator.adjudicate(
        query_id="q-synth-2",
        query="cryptocurrency mining legal standards",
        intent="product_match",
        candidates=[],
    )

    raw_text = synthesizer.synthesize(pkg)
    assert "14434" in raw_text
    assert "abstained" in raw_text.lower() or "safety gate" in raw_text.lower()

    trust_res = gate.verify(raw_text, pkg)
    assert trust_res.passed is True
    assert len(trust_res.verified_citations) == 0

    dossier = builder.build(pkg, trust_res)
    assert dossier.trust.grounding_state.value == "insufficient_evidence"

if __name__ == "__main__":
    test_evidence_only_synthesis_flagship()
    test_evidence_only_abstention()
    print("All EvidenceOnly and DossierBuilder unit tests passed successfully!")
