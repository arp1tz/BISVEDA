from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CanonicalIntent(str, Enum):
    """The 14 canonical intents defined in BISVEDA V8 Architecture §8 / Canonical Spec §3.1."""
    STANDARD_LOOKUP = "standard_lookup"
    PRODUCT_MATCH = "product_match"
    TECHNICAL_QA = "technical_qa"
    QCO_CHECK = "qco_check"
    CERTIFICATION_GUIDANCE = "certification_guidance"
    HALLMARKING = "hallmarking"
    LAB_SEARCH = "lab_search"
    AHC_SEARCH = "ahc_search"
    CONSUMER_VERIFICATION = "consumer_verification"
    CONSUMER_COMPLAINT = "consumer_complaint"
    COMPARISON = "comparison"
    EDUCATION_TRAINING = "education_training"
    FORM_PREPARATION = "form_preparation"
    DOCUMENT_REVIEW = "document_review"


class RouteType(str, Enum):
    EXACT_SHORTCUT = "exact_shortcut"
    FAQ_DIRECT = "faq_direct"
    GIBBERISH_REJECT = "gibberish_reject"
    OFF_TOPIC_REFUSAL = "off_topic_refusal"
    STANDARD_PIPELINE = "standard_pipeline"


class RoutingDecision(BaseModel):
    query: str
    route_type: RouteType
    intent: CanonicalIntent = CanonicalIntent.PRODUCT_MATCH
    is_exact: bool = False
    exact_standard: Optional[str] = None
    standard_record: Optional[Dict[str, Any]] = None
    faq_match: Optional[Dict[str, Any]] = None
    entities: Dict[str, Any] = Field(default_factory=dict)
    missing_attributes: List[str] = Field(default_factory=list)
    rejection_reason: Optional[str] = None
    clarification_prompt: Optional[str] = None
    latency_ms: float = 0.0
