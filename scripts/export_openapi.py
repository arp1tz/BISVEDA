import json
import os
from pathlib import Path
import sys

# Ensure services/api is on python path
repo_root = Path(__file__).resolve().parent.parent
api_root = repo_root / "services" / "api"
if str(api_root) not in sys.path:
    sys.path.insert(0, str(api_root))

from bisveda.gateway.app import app

def export_openapi():
    print("Generating OpenAPI specification from FastAPI...")
    openapi_schema = app.openapi()

    out_file = api_root / "openapi.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(openapi_schema, f, indent=2)
    print(f"Exported OpenAPI schema to {out_file} ({len(json.dumps(openapi_schema))} bytes)")

    # Export TypeScript client definitions
    ts_dir = repo_root / "prototype" / "src" / "types"
    ts_dir.mkdir(parents=True, exist_ok=True)
    ts_file = ts_dir / "api.ts"

    ts_content = """// Auto-generated BISVEDA V8 API TypeScript Definitions
// Generated from FastAPI OpenAPI Schema

export type KnowledgeTier = "A" | "B" | "C";

export type ApplicabilityClass =
  | "directly_applicable"
  | "potentially_applicable"
  | "related_standard"
  | "related_material_mismatch"
  | "scope_unclear"
  | "insufficient_evidence"
  | "not_applicable";

export type GroundingState = "verified" | "supported_inference" | "insufficient_evidence";

export type ConfidenceLabel =
  | "verified_evidence"
  | "partially_supported"
  | "limited_evidence"
  | "no_verified_evidence";

export type StageName =
  | "normalize"
  | "routing"
  | "retrieval"
  | "adjudication"
  | "trust"
  | "generation"
  | "translation";

export type StageEventKind = "started" | "completed" | "failed";

export interface StageEvent {
  event_id: string;
  stage: StageName;
  event_kind: StageEventKind;
  timestamp: string;
  duration_ms?: number;
  details: Record<string, any>;
}

export interface CitableEvidenceItem {
  sid: string;
  evidence_class: "official_source" | "user_provided" | "ai_interpretation";
  tier: KnowledgeTier;
  kind: string;
  standard_id?: string;
  locator: string;
  snippet: string;
  source_url?: string;
  retrieved_at: string;
}

export interface DossierStandardItem {
  standard_id: string;
  is_number: string;
  title: string;
  applicability: ApplicabilityClass;
  why_coverage: string;
  tier: KnowledgeTier;
  status: string;
  official_url?: string;
}

export interface DossierRegulatory {
  qco_status: "mandatory" | "voluntary" | "draft" | "under_review";
  order_reference?: string;
  enforcement_date?: string;
  ministry?: string;
  penal_provision?: string;
}

export interface DossierCertificationRoute {
  scheme_name: string;
  eligibility_result: string;
  steps: string[];
  required_documents: string[];
  indicative_fee: Record<string, any>;
  portal_name: string;
  portal_url: string;
}

export interface DossierLabItem {
  name: string;
  city: string;
  state: string;
  accreditation_number?: string;
  distance_km?: number;
}

export interface DossierTrust {
  grounding_state: GroundingState;
  confidence_label: ConfidenceLabel;
  relevance_score: number;
  caveats: string[];
}

export interface ComplianceDossier {
  dossier_id: string;
  created_at: string;
  query_id: string;
  language: string;
  interpretation: {
    product?: string;
    material?: string;
    intended_use?: string;
    capacity_rating?: string;
    user_type: string;
    market: string;
  };
  standards: DossierStandardItem[];
  regulatory: DossierRegulatory;
  certification_route: DossierCertificationRoute;
  testing: {
    tier_permits_testing: boolean;
    notice?: string;
    clauses: Array<{ sid: string; locator: string; description: string }>;
  };
  labs: DossierLabItem[];
  next_actions: string[];
  evidence_ledger: CitableEvidenceItem[];
  summary: string;
  trust: DossierTrust;
}

export interface QueryRequest {
  query: string;
  user_type?: "msme" | "startup" | "large" | "consumer";
  language?: "en" | "hi";
  market?: "domestic" | "export";
  entities?: Record<string, any>;
}

export type MissionStatus = "draft" | "evaluating" | "active" | "blocked" | "completed";

export type ComplianceStep =
  | "product_matching"
  | "qco_compliance"
  | "certification_route"
  | "testing_requirements"
  | "lab_identification"
  | "document_review"
  | "form_preparation";

export type StepEvaluationState =
  | "not_evaluated"
  | "candidate"
  | "supported"
  | "unsupported"
  | "blocked_by_missing_info"
  | "superseded"
  | "expired"
  | "completed_externally";

export interface DecisionExplainability {
  why: string;
  evidence_ids: string[];
  change_triggers: string[];
}

export interface StepProgress {
  step: ComplianceStep;
  state: StepEvaluationState;
  summary?: string;
  explainability?: DecisionExplainability;
  last_evaluated_at?: string;
}

export interface ProductIdentity {
  name: string;
  category?: string;
  material?: string;
  grade?: string;
  capacity_rating?: string;
  intended_use?: string;
  market_context: string;
  user_type: string;
  pincode?: string;
  location_city?: string;
  location_state?: string;
  additional_attributes?: Record<string, any>;
}

export interface ComplianceMission {
  mission_id: string;
  title: string;
  status: MissionStatus;
  product_identity: ProductIdentity;
  step_states: Record<string, StepProgress>;
  active_standard_numbers: string[];
  active_dossier_id?: string;
  open_questions: string[];
  unresolved_issues: string[];
  change_impact_signals: Array<Record<string, any>>;
  created_at: string;
  updated_at: string;
}

export interface CreateMissionRequest {
  title: string;
  product_name: string;
  category?: string;
  material?: string;
  grade?: string;
  capacity_rating?: string;
  intended_use?: string;
  market_context?: string;
  user_type?: string;
  pincode?: string;
  location_city?: string;
  location_state?: string;
  additional_attributes?: Record<string, any>;
}

export interface UpdateStepRequest {
  step: ComplianceStep;
  state: StepEvaluationState;
  summary?: string;
  why?: string;
  evidence_ids?: string[];
  change_triggers?: string[];
}

export interface FeedbackRequest {
  turn_id: string;
  reason: string;
  comment?: string;
  rating?: number;
}
"""

    with open(ts_file, "w", encoding="utf-8") as f:
        f.write(ts_content)
    print(f"Exported TypeScript API contracts to {ts_file}")

if __name__ == "__main__":
    export_openapi()
