from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from .adjudication import ApplicabilityClass, ConfidenceLabel, GroundingState, KnowledgeTier
from .evidence import CitableEvidenceItem

class DossierInterpretation(BaseModel):
    product: Optional[str] = None
    material: Optional[str] = None
    intended_use: Optional[str] = None
    capacity_rating: Optional[str] = None
    user_type: str = "msme"  # msme, large, consumer, lab
    market: str = "domestic"

class DossierStandardItem(BaseModel):
    standard_id: str
    is_number: str
    title: str
    applicability: ApplicabilityClass
    why_coverage: str
    tier: KnowledgeTier
    status: str
    official_url: Optional[str] = None

class DossierRegulatory(BaseModel):
    qco_status: str  # mandatory, voluntary, draft, under_review
    order_reference: Optional[str] = None
    enforcement_date: Optional[str] = None
    ministry: Optional[str] = None
    penal_provision: Optional[str] = None

class DossierCertificationRoute(BaseModel):
    scheme_name: str
    eligibility_result: str
    steps: List[str] = Field(default_factory=list)
    required_documents: List[str] = Field(default_factory=list)
    indicative_fee: Dict[str, Any] = Field(default_factory=dict)
    portal_name: str
    portal_url: str

class DossierTesting(BaseModel):
    tier_permits_testing: bool
    notice: Optional[str] = None
    clauses: List[Dict[str, Any]] = Field(default_factory=list)

class DossierLabItem(BaseModel):
    name: str
    city: str
    state: str
    accreditation_number: Optional[str] = None
    distance_km: Optional[float] = None

class DossierTrust(BaseModel):
    grounding_state: GroundingState
    confidence_label: ConfidenceLabel
    relevance_score: float
    caveats: List[str] = Field(default_factory=list)

class ComplianceDossier(BaseModel):
    dossier_id: str
    created_at: str
    query_id: str
    language: str = "en"
    interpretation: DossierInterpretation
    standards: List[DossierStandardItem] = Field(default_factory=list)
    regulatory: DossierRegulatory
    certification_route: DossierCertificationRoute
    testing: DossierTesting
    labs: List[DossierLabItem] = Field(default_factory=list)
    next_actions: List[str] = Field(default_factory=list)
    evidence_ledger: List[CitableEvidenceItem] = Field(default_factory=list)
    summary: str
    trust: DossierTrust
