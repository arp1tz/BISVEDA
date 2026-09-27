import time
from typing import Any, Dict, Optional

from bisveda.routing.contracts import CanonicalIntent, RouteType, RoutingDecision
from bisveda.routing.stage1_rules import ExactISMatcher, FAQMatcher, GibberishDetector, OffTopicDetector
from bisveda.routing.stage2_classifier import IntentClassifier


class IntentRouter:
    """
    Two-Stage Query Intelligence & Routing Engine (Canonical Spec §3.1).
    Stage 1: Deterministic rules (Speed Gate exact IS, FAQ match, Gibberish reject, Off-topic refusal).
    Stage 2: 14 Canonical Intents classification and entity/attribute extraction.
    """

    def __init__(self):
        self.exact_matcher = ExactISMatcher()
        self.faq_matcher = FAQMatcher()
        self.gibberish_detector = GibberishDetector()
        self.off_topic_detector = OffTopicDetector()
        self.classifier = IntentClassifier()

    def route(self, query: str, language: str = "en") -> RoutingDecision:
        t0 = time.perf_counter()
        clean_q = query.strip()

        # Step 1: Gibberish Detection
        is_gib, gib_reason = self.gibberish_detector.is_gibberish(clean_q)
        if is_gib:
            lat = (time.perf_counter() - t0) * 1000
            return RoutingDecision(
                query=query,
                route_type=RouteType.GIBBERISH_REJECT,
                intent=CanonicalIntent.PRODUCT_MATCH,
                rejection_reason=gib_reason or "Input appears to be invalid or random text.",
                clarification_prompt="Please enter a valid product name, Indian Standard number (e.g., 'IS 2347'), or BIS compliance question.",
                latency_ms=round(lat, 2),
            )

        # Step 2: Off-Topic / Out of Domain Detection
        is_off, off_reason = self.off_topic_detector.is_off_topic(clean_q)
        if is_off:
            lat = (time.perf_counter() - t0) * 1000
            return RoutingDecision(
                query=query,
                route_type=RouteType.OFF_TOPIC_REFUSAL,
                intent=CanonicalIntent.PRODUCT_MATCH,
                rejection_reason=off_reason,
                clarification_prompt="Please ask a question related to Indian Standards, ISI certification, QCO regulations, or BIS testing.",
                latency_ms=round(lat, 2),
            )

        # Step 3: Exact IS Matcher (Speed Gate: < 150 ms)
        exact_res = self.exact_matcher.match(clean_q)
        if exact_res:
            canonical_is, record = exact_res
            entities, missing_attrs = self.classifier.extract_entities(clean_q)
            entities["standard_number"] = canonical_is
            lat = (time.perf_counter() - t0) * 1000
            return RoutingDecision(
                query=query,
                route_type=RouteType.EXACT_SHORTCUT,
                intent=CanonicalIntent.STANDARD_LOOKUP,
                is_exact=True,
                exact_standard=canonical_is,
                standard_record=record,
                entities=entities,
                missing_attributes=missing_attrs,
                latency_ms=round(lat, 2),
            )

        # Step 4: Verbatim FAQ Direct Match (< 200 ms)
        faq_res = self.faq_matcher.match(clean_q)
        if faq_res:
            entities, missing_attrs = self.classifier.extract_entities(clean_q)
            lat = (time.perf_counter() - t0) * 1000
            return RoutingDecision(
                query=query,
                route_type=RouteType.FAQ_DIRECT,
                intent=CanonicalIntent.CERTIFICATION_GUIDANCE,
                faq_match=faq_res,
                entities=entities,
                missing_attributes=missing_attrs,
                latency_ms=round(lat, 2),
            )

        # Step 5: Stage 2 Canonical Intent & Entity Classification
        intent = self.classifier.classify(clean_q)
        entities, missing_attrs = self.classifier.extract_entities(clean_q)
        lat = (time.perf_counter() - t0) * 1000

        return RoutingDecision(
            query=query,
            route_type=RouteType.STANDARD_PIPELINE,
            intent=intent,
            entities=entities,
            missing_attributes=missing_attrs,
            latency_ms=round(lat, 2),
        )
