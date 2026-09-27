import type { ComplianceDossier, DossierStandardItem } from "@/types/api";
import type { EvidencePackageV2 } from "./adjudicator";
import type { LaboratoryRecord, QCORecord } from "./types";
import { renderEvidenceOnlySummary } from "./evidence-only";

export interface DossierOptions {
  userType?: "msme" | "startup" | "large" | "consumer";
  market?: "domestic" | "export";
  proseSummary?: string;
  caveats?: string[];
}

/**
 * L5 Full Compliance Dossier Builder (§10.1.3, C5):
 * Assembles the full 10-section Compliance Dossier from adjudicated evidence package,
 * specialist agent findings, and deterministic scheme rules.
 */
export function buildComplianceDossier(
  evidencePackage: EvidencePackageV2,
  qco?: any,
  labs: LaboratoryRecord[] = [],
  options: DossierOptions = {}
): ComplianceDossier {
  const userType = options.userType || "msme";
  const market = options.market || "domestic";
  const isMsme = userType === "msme" || userType === "startup";
  const candidates = evidencePackage.adjudication.candidates;
  const primary = candidates[0];

  const dossierId = `DOS-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;

  // SECTION 1: Interpretation
  const interpretation = {
    product: primary?.title || evidencePackage.canonical_query || "Queried Product",
    material: primary?.coverage.material === "covered" ? "Specified Substrate" : "Standard Specification",
    intended_use: market === "export" ? "Export & Global Conformance" : "Domestic Sale (India)",
    capacity_rating: "All Commercial Capacities",
    user_type: userType,
    market: market,
  };

  // SECTION 2: Standards
  const standardsItems: DossierStandardItem[] = candidates.map((c) => ({
    standard_id: c.standard_id,
    is_number: c.is_number,
    title: c.title,
    applicability: c.applicability,
    why_coverage: c.why_coverage,
    tier: c.tier,
    status: c.status.toUpperCase(),
    official_url: c.official_url,
  }));

  // SECTION 3: Regulatory (QCO Status)
  const isMandatory = Boolean(qco?.mandatory_qco || qco?.isMandatory);

  const regulatory = {
    qco_status: isMandatory ? ("mandatory" as const) : ("voluntary" as const),
    order_reference: isMandatory
      ? qco?.order_name || qco?.orderTitle || (primary ? `Quality Control Order for ${primary.is_number}` : undefined)
      : undefined,
    enforcement_date: isMandatory
      ? qco?.enforcement_date || "Enforced under Gazette Notification"
      : "Voluntary Standard (No statutory QCO currently notified)",
    ministry: isMandatory
      ? qco?.ministry || "Ministry of Consumer Affairs / DPIIT"
      : "Bureau of Indian Standards",
    penal_provision: isMandatory
      ? qco?.penalProvision ||
        "Section 29 of the Bureau of Indian Standards Act, 2016: Imprisonment up to 2 years, or fine not less than ₹2,00,000 extending up to ₹5,00,000, or both for non-compliant manufacturing/import."
      : "Voluntary compliance; no criminal penalties under Section 16/29 apply unless the ISI mark is used without a valid BIS license.",
  };

  // SECTION 4: Certification Route
  const schemeName =
    primary?.is_number.includes("16046")
      ? "Scheme-II (Compulsory Registration Scheme - CRS)"
      : primary?.is_number.includes("1417")
      ? "Mandatory Hallmarking Scheme (6-Digit HUID)"
      : "Scheme-I (ISI Mark Certification)";

  const certificationRoute = {
    scheme_name: schemeName,
    eligibility_result: isMsme
      ? "Eligible for 30-Day MSME Simplified Fast-Track Procedure (80% Concession)"
      : "Standard Option 1 / Option 2 Conformity Assessment",
    steps: [
      "1. Verify in-house testing equipment against the Standard Test Plan (STI)",
      "2. Prepare documentation: Factory lease, plant layout, machinery inventory, calibration logs",
      "3. Submit Form-I application on Manak Online with Udyam Registration Certificate",
      "4. BIS Officers conduct factory verification audit and draw counter-samples",
      "5. Sample passes laboratory testing at a recognized BIS laboratory",
      "6. Grant of BIS License (CM/L number) and ISI mark authorization within 30 days (MSME track)",
    ],
    required_documents: [
      "Udyam MSME Registration Certificate (for 80% fee subsidy)",
      "Manufacturing premises proof (lease agreement / property tax receipt)",
      "Process flow chart from raw material intake to finished goods packaging",
      "List of installed manufacturing machinery with capacity specifications",
      "List of in-house testing equipment with valid calibration certificates",
      "Raw material test certificates from NABL/BIS-recognized laboratories",
      "Nomination of Authorized Indian Representative (if foreign manufacturer / FMCS)",
    ],
    indicative_fee: {
      application_fee_inr: isMsme ? 200 : 1000,
      inspection_charge_per_manday_inr: isMsme ? 1400 : 7000,
      minimum_marking_fee_inr: isMsme ? 10000 : 50000,
      msme_subsidy_percentage: isMsme ? 80 : 0,
      annual_renewal_basis: "Operative for 1 to 2 years with continuous surveillance",
    },
    portal_name: "Manak Online Portal",
    portal_url: "https://www.manakonline.in",
  };

  // SECTION 5: Testing (Tier-Gated, strictly scoped to primary standard)
  const isTierAOnly = primary?.tier === "A";
  const testingClauses = evidencePackage.citable_evidence
    .filter((e) => e.kind === "testing_clause" && (!e.standard_id || e.standard_id === primary?.standard_id))
    .map((e) => ({
      sid: e.sid,
      locator: e.locator,
      description: e.snippet,
    }));

  const testing = {
    tier_permits_testing: !isTierAOnly,
    notice: isTierAOnly
      ? `Full testing clauses and numeric thresholds for ${primary?.is_number} are not held in this public tier. Authoritative requirements must be read directly from the official standard copy.`
      : undefined,
    clauses: testingClauses,
  };

  // SECTION 6: Labs (Recognized Testing Facilities)
  const topLabs = labs.slice(0, 5).map((l) => ({
    name: l.name,
    city: l.city || "New Delhi",
    state: l.state || "Delhi",
    accreditation_number: l.accreditation_number || l.oslCode,
    distance_km: l.distance_km,
  }));

  // SECTION 7: Next Actions Checklist
  const nextActions = [
    `1. Procure the official copy of ${primary?.is_number || "the standard"} from the BIS Standards Portal.`,
    `2. Compare your factory test setup with the STI (Scheme of Testing and Inspection).`,
    `3. Connect with an accredited BIS lab (${topLabs[0]?.name || "Central Laboratory"}) for preliminary sample evaluation.`,
    `4. File Form-I Schedule-II application on Manak Online under Udyam MSME scheme for 80% fee subsidy.`,
    `5. Schedule the BIS pre-grant factory inspection audit.`,
  ];

  // SECTION 8: Evidence Ledger
  const evidenceLedger = evidencePackage.citable_evidence;

  // SECTION 9: Summary Prose
  let summary = options.proseSummary;
  if (!summary) {
    const evidenceOnly = renderEvidenceOnlySummary(evidencePackage, primary, qco, labs);
    summary = evidenceOnly.summaryProse;
  }

  // SECTION 10: Trust
  const trust = {
    grounding_state: evidencePackage.adjudication.grounding_state,
    confidence_label: evidencePackage.adjudication.confidence_label,
    relevance_score: evidencePackage.adjudication.relevance_top1,
    caveats: options.caveats || (isTierAOnly ? [`Tier A Catalogue Record: Numeric limits omitted.`] : []),
  };

  return {
    dossier_id: dossierId,
    created_at: new Date().toISOString(),
    query_id: evidencePackage.query_id,
    language: evidencePackage.language,
    interpretation,
    standards: standardsItems,
    regulatory,
    certification_route: certificationRoute,
    testing,
    labs: topLabs,
    next_actions: nextActions,
    evidence_ledger: evidenceLedger,
    summary,
    trust,
  };
}
