import sys
from pathlib import Path

api_root = str(Path(__file__).resolve().parent.parent.parent)
if api_root not in sys.path:
    sys.path.insert(0, api_root)

import pytest
from bisveda.retrieval.fts_engine import FTSRetrievalEngine
from bisveda.language.normalizer import (
    canonicalize_is_number,
    extract_is_digits,
    extract_is_numbers,
    normalize_text,
    DisambiguationRouter,
)


def test_normalizer_is_canonicalization():
    assert canonicalize_is_number("IS 2347") == "IS 2347"
    assert canonicalize_is_number("IS:2347") == "IS 2347"
    assert canonicalize_is_number("IS-2347") == "IS 2347"
    assert canonicalize_is_number("is2347") == "IS 2347"
    assert canonicalize_is_number("IS 456:2000") == "IS 456:2000"
    assert extract_is_digits("IS:2347") == "2347"
    assert extract_is_digits("IS 456") == "456"


def test_polysemy_disambiguation_trap():
    router = DisambiguationRouter()

    # Generic polysemous queries should be trapped
    trap_cooker = router.check_ambiguity("cooker")
    assert trap_cooker["is_ambiguous"] is True
    assert trap_cooker["term"] == "cooker"
    assert len(trap_cooker["options"]) >= 3

    trap_bottle = router.check_ambiguity("water bottle")
    assert trap_bottle["is_ambiguous"] is True
    assert trap_bottle["term"] == "water bottle"

    trap_cement = router.check_ambiguity("cement")
    assert trap_cement["is_ambiguous"] is True

    # Disambiguated queries should NOT be trapped
    resolved_cooker = router.check_ambiguity("domestic pressure cookers stainless steel")
    assert resolved_cooker["is_ambiguous"] is False

    is_query = router.check_ambiguity("IS 2347")
    assert is_query["is_ambiguous"] is False


def test_fts_exact_first_boost():
    engine = FTSRetrievalEngine()

    # Exact IS number should get 1.0 relevance
    results = engine.search("IS 2347", limit=5)
    assert len(results) > 0
    top = results[0]
    assert top["standard_number"] == "IS 2347"
    assert top["relevance_score"] == 1.0
    assert "exact_is" in top["search_channels"]


def test_fts_bm25_clause_chunks_search():
    engine = FTSRetrievalEngine()

    # Natural language query matching domestic pressure cookers
    results = engine.search("domestic pressure cookers stainless steel", limit=5)
    assert len(results) > 0
    top = results[0]
    assert top["standard_number"] == "IS 2347"
    assert top["relevance_score"] >= 0.95
    # Should have matched clause chunks from FTS5
    assert "matched_clauses" in top
    assert len(top["matched_clauses"]) > 0
    clause_texts = " ".join(c["content"] for c in top["matched_clauses"]).lower()
    assert "pressure" in clause_texts or "proof" in clause_texts or "valve" in clause_texts


def test_fts_out_of_corpus_floor():
    engine = FTSRetrievalEngine()

    # Random out-of-corpus query
    results = engine.search("quantum teleportation interstellar spacecraft plasma engine", limit=5)
    if results:
        # Top score should be below or near the 0.45 safety floor
        assert results[0]["relevance_score"] < 0.45
