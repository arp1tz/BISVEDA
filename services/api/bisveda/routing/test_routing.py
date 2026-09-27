import pytest
from bisveda.routing import (
    CanonicalIntent,
    ExactISMatcher,
    FAQMatcher,
    GibberishDetector,
    IntentClassifier,
    IntentRouter,
    OffTopicDetector,
    RouteType,
)


def test_exact_is_matcher():
    matcher = ExactISMatcher()
    
    # Simple IS number
    res = matcher.match("IS 2347")
    assert res is not None
    canonical, record = res
    assert canonical == "IS 2347"
    assert "Pressure Cooker" in record.get("full_title", "")

    # Query with year
    res2 = matcher.match("specification for IS 1786:2008")
    assert res2 is not None
    assert "IS 1786" in res2[0]

    # Non-standard query
    assert matcher.match("domestic pressure cookers stainless steel") is None


def test_gibberish_detector():
    detector = GibberishDetector()

    # Clear gibberish cases
    is_gib, reason = detector.is_gibberish("asdfgh")
    assert is_gib is True
    assert reason is not None

    is_gib, _ = detector.is_gibberish("qwertyuiop")
    assert is_gib is True

    is_gib, _ = detector.is_gibberish("zzzzzzzz")
    assert is_gib is True

    # Valid queries that must NOT be flagged as gibberish
    assert detector.is_gibberish("IS 2347")[0] is False
    assert detector.is_gibberish("domestic pressure cookers")[0] is False
    assert detector.is_gibberish("packaged drinking water")[0] is False
    assert detector.is_gibberish("BIS")[0] is False


def test_off_topic_detector():
    detector = OffTopicDetector()

    # Off-topic queries
    assert detector.is_off_topic("how to cook a delicious chicken biryani")[0] is True
    assert detector.is_off_topic("write a poem about winter flowers")[0] is True
    assert detector.is_off_topic("who won the IPL match yesterday")[0] is True
    assert detector.is_off_topic("python script for quicksort")[0] is True

    # BIS relevant queries must NOT be flagged
    assert detector.is_off_topic("pressure cooker hydraulic test limit")[0] is False
    assert detector.is_off_topic("gold hallmarking center near Nagpur")[0] is False
    assert detector.is_off_topic("is ISI mark mandatory for shoes")[0] is False


def test_intent_classifier_and_entities():
    classifier = IntentClassifier()

    # Lab Search with City
    q_lab = "testing labs for pressure cookers near Nagpur"
    assert classifier.classify(q_lab) == CanonicalIntent.LAB_SEARCH
    entities, _ = classifier.extract_entities(q_lab)
    assert entities.get("city") == "Nagpur"

    # Consumer verification with CM/L
    q_cml = "verify license CM/L 8765432"
    assert classifier.classify(q_cml) == CanonicalIntent.CONSUMER_VERIFICATION
    entities, _ = classifier.extract_entities(q_cml)
    assert entities.get("cml_number") == "8765432"

    # Hallmarking with HUID
    q_huid = "check gold hallmarking HUID AB12CD"
    assert classifier.classify(q_huid) == CanonicalIntent.HALLMARKING
    entities, _ = classifier.extract_entities(q_huid)
    assert entities.get("huid") == "AB12CD"

    # QCO Check
    q_qco = "is ISI mandatory under QCO for footwear"
    assert classifier.classify(q_qco) == CanonicalIntent.QCO_CHECK

    # Comparison
    q_comp = "compare IS 1786 and IS 2062"
    assert classifier.classify(q_comp) == CanonicalIntent.COMPARISON

    # Missing attributes detection
    q_missing = "pressure cookers"
    _, missing = classifier.extract_entities(q_missing)
    assert any("material" in m for m in missing)


def test_intent_router_end_to_end():
    router = IntentRouter()

    # 1. Gibberish rejection
    d_gib = router.route("asdfgh")
    assert d_gib.route_type == RouteType.GIBBERISH_REJECT
    assert d_gib.rejection_reason is not None
    assert d_gib.clarification_prompt is not None

    # 2. Off-topic refusal
    d_off = router.route("can you give me a recipe for pasta")
    assert d_off.route_type == RouteType.OFF_TOPIC_REFUSAL
    assert "outside the BIS compliance" in d_off.rejection_reason

    # 3. Exact shortcut (<150 ms)
    d_exact = router.route("IS 2347")
    assert d_exact.route_type == RouteType.EXACT_SHORTCUT
    assert d_exact.is_exact is True
    assert d_exact.exact_standard == "IS 2347"
    assert d_exact.standard_record is not None
    assert d_exact.latency_ms < 150

    # 4. Standard pipeline
    d_std = router.route("domestic pressure cookers stainless steel in Nagpur")
    assert d_std.route_type == RouteType.STANDARD_PIPELINE
    assert d_std.intent == CanonicalIntent.PRODUCT_MATCH
    assert d_std.entities.get("material") == "stainless steel"
    assert d_std.entities.get("city") == "Nagpur"


def test_fictional_query_named_boundary_refusal():
    from bisveda.retrieval.engine import RetrievalEngine
    from bisveda.adjudication.adjudicator import EvidenceAdjudicator
    from bisveda.contracts.adjudication import GroundingState, ConfidenceLabel

    retrieval = RetrievalEngine()
    adjudicator = EvidenceAdjudicator(relevance_floor=0.45)

    query = "aquarium LED strip"
    candidates = retrieval.search(query, limit=5)
    pkg = adjudicator.adjudicate("q-fictional", query, candidates=candidates)

    assert pkg.adjudication.out_of_corpus is True
    assert pkg.adjudication.grounding_state == GroundingState.INSUFFICIENT_EVIDENCE
    assert pkg.adjudication.confidence_label == ConfidenceLabel.NO_VERIFIED_EVIDENCE
    assert len(pkg.citable_evidence) == 0
    assert pkg.structured_data.get("named_boundary_refusal") is True
    assert "BISVEDA answers from the BIS catalogue" in pkg.structured_data.get("reason", "")
