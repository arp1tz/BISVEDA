from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MissionStatus(str, Enum):
    DRAFT = "draft"
    EVALUATING = "evaluating"
    ACTIVE = "active"
    BLOCKED = "blocked"
    COMPLETED = "completed"


class ComplianceStep(str, Enum):
    PRODUCT_MATCHING = "product_matching"
    QCO_COMPLIANCE = "qco_compliance"
    CERTIFICATION_ROUTE = "certification_route"
    TESTING_REQUIREMENTS = "testing_requirements"
    LAB_IDENTIFICATION = "lab_identification"
    DOCUMENT_REVIEW = "document_review"
    FORM_PREPARATION = "form_preparation"


class StepEvaluationState(str, Enum):
    NOT_EVALUATED = "not_evaluated"
    CANDIDATE = "candidate"
    SUPPORTED = "supported"
    UNSUPPORTED = "unsupported"
    BLOCKED_BY_MISSING_INFO = "blocked_by_missing_info"
    SUPERSEDED = "superseded"
    EXPIRED = "expired"
    COMPLETED_EXTERNALLY = "completed_externally"


class DecisionExplainability(BaseModel):
    """
    V8 Canonical Spec §6.2 — 3-Question Explainability Model:
    1. Why? What product attribute, rule, doc, or source caused the decision?
    2. Evidence? What authoritative source supports it (citable [S#] tags)?
    3. What could change this? Which product attribute, regulatory change, or missing evidence triggers re-evaluation?
    """
    why: str = Field(..., description="Statutory rule, attribute match, or regulatory clause causing the decision")
    evidence_ids: List[str] = Field(default_factory=list, description="Authoritative [S#] citation references")
    change_triggers: List[str] = Field(
        default_factory=list,
        description="Attributes, amendments, or regulatory events that would cause re-evaluation",
    )


class StepProgress(BaseModel):
    step: ComplianceStep
    state: StepEvaluationState = StepEvaluationState.NOT_EVALUATED
    summary: Optional[str] = None
    explainability: Optional[DecisionExplainability] = None
    last_evaluated_at: Optional[str] = None


class ProductIdentity(BaseModel):
    name: str = Field(..., description="Product trade or common name, e.g. Domestic Pressure Cooker")
    category: Optional[str] = None
    material: Optional[str] = None
    grade: Optional[str] = None
    capacity_rating: Optional[str] = None
    intended_use: Optional[str] = None
    market_context: str = "domestic"  # domestic, export, import
    user_type: str = "msme"  # msme, startup, large_scale, consumer, lab
    pincode: Optional[str] = None
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    additional_attributes: Dict[str, Any] = Field(default_factory=dict)


class ComplianceMission(BaseModel):
    """
    V8 Canonical Spec §6: Persistent Compliance Mission working state.
    Converts a business question into an inspectable, persistent compliance pathway.
    """
    mission_id: str
    title: str
    status: MissionStatus = MissionStatus.DRAFT
    product_identity: ProductIdentity
    step_states: Dict[str, StepProgress] = Field(default_factory=dict)
    active_standard_numbers: List[str] = Field(default_factory=list)
    active_dossier_id: Optional[str] = None
    open_questions: List[str] = Field(default_factory=list)
    unresolved_issues: List[str] = Field(default_factory=list)
    change_impact_signals: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def update_step(
        self,
        step: ComplianceStep,
        state: StepEvaluationState,
        summary: Optional[str] = None,
        explainability: Optional[DecisionExplainability] = None,
    ) -> None:
        self.step_states[step.value] = StepProgress(
            step=step,
            state=state,
            summary=summary,
            explainability=explainability,
            last_evaluated_at=datetime.now(timezone.utc).isoformat(),
        )
        self.updated_at = datetime.now(timezone.utc).isoformat()
