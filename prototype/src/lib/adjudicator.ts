import type {
  StandardRecord,
  EvidenceClause,
  LaboratoryRecord,
  QCORecord,
} from "./types";
import type {
  ApplicabilityClass,
  GroundingState,
  ConfidenceLabel,
  KnowledgeTier,
  CitableEvidenceItem,
} from "@/types/api";

export interface CandidateEvaluation {
  standard_id: string;
  is_number: string;
  title: string;
  title_hi?: string;
  year?: number | string;
  tier: KnowledgeTier;
  status: "current" | "amended" | "superseded" | "withdrawn" | "unknown";
  raw_score: number;
  aggregated_score: number;
  applicability: ApplicabilityClass;
  why_coverage: string;
  coverage: {
    product: "covered" | "not_covered" | "unknown";
    material: "covered" | "not_covered" | "unknown";
    intended_use: "covered" | "not_covered" | "unknown";
    capacity_rating: "covered" | "not_covered" | "unknown";
    testing: "covered" | "not_covered" | "unknown";
    certification: "covered" | "not_covered" | "unknown";
    identifier: "covered" | "not_covered" | "unknown";
  };
  claim_policy: string[];
  citable_sids: string[];
  official_url: string;
}

export interface AdjudicatedConflict {
  type: "superseded_edition" | "edition_discrepancy" | "qco_mismatch" | "material_conflict";
  severity: "high" | "medium" | "low";
  description: string;
  operatives: string[];
  resolution_rule: string;
}

export interface AdjudicationReport {
  turn_id: string;
  query: string;
  canonical_query: string;
  relevance_top1: number;
  relevance_floor: number;
  out_of_corpus: boolean;
  grounding_state: GroundingState;
  confidence_label: ConfidenceLabel;
  candidates: CandidateEvaluation[];
  conflicts: AdjudicatedConflict[];
  citable_evidence: CitableEvidenceItem[];
  claim_policy_map: Record<string, string[]>;
}

export interface EvidencePackageV2 {
  query_id: string;
  canonical_query: string;
  original_query: string;
  language: "en" | "hi";
  intent: string;
  sub_intents: string[];
  entities: Record<string, string>;
  missing_attributes: string[];
  adjudication: AdjudicationReport;
  citable_evidence: CitableEvidenceItem[];
  context_non_citable: Array<{
    class: "user_provided" | "untrusted_extraction";
    kind: string;
    text: string;
  }>;
  structured: {
    qco?: QCORecord | null;
    labs: LaboratoryRecord[];
  };
}

const CALIBRATED_RELEVANCE_FLOOR = 0.45;

/**
 * L4 Evidence Adjudicator (Axiom A1, §9.8, C1):
 * Deterministic 9-step module that converts ranked search hits into authoritative decisions.
 * Runs BEFORE any LLM generation. No model can override these statutory decisions.
 */
export function adjudicateEvidence(
  query: string,
  rawHits: Array<{
    standard: StandardRecord;
    chunkScores: number[];
    maxScore: number;
    matchedClauses?: EvidenceClause[];
  }>,
  extractedEntities: Record<string, string> = {},
  language: "en" | "hi" = "en"
): EvidencePackageV2 {
  const qLower = query.toLowerCase();
  const queryId = `ADJ-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;

  // STEP 1: Aggregation (Chunk-volume bias resistance)
  // A standard with 10 weak chunks cannot outrank a standard with 1 highly precise chunk.
  const aggregatedCandidates = rawHits.map((hit) => {
    const scores = hit.chunkScores && hit.chunkScores.length > 0 ? hit.chunkScores : [hit.maxScore];
    const topScore = Math.max(...scores);
    const sorted = [...scores].sort((a, b) => b - a);
    const top3 = sorted.slice(0, 3);
    const meanTop3 = top3.reduce((acc, s) => acc + s, 0) / top3.length;
    // Weighted formula: 70% best chunk + 30% top-3 depth
    const aggregatedScore = Math.min(1.0, topScore * 0.7 + meanTop3 * 0.3);

    return {
      hit,
      aggregatedScore,
    };
  });

  aggregatedCandidates.sort((a, b) => b.aggregatedScore - a.aggregatedScore);

  // Top candidate aggregated score
  const top1Score = aggregatedCandidates[0]?.aggregatedScore || 0;

  // Global Evidence Ledger
  const citableEvidence: CitableEvidenceItem[] = [];
  let sidCounter = 1;

  // STEP 2 & STEP 3: Coverage Analysis & Applicability Class Assignment
  const candidates: CandidateEvaluation[] = aggregatedCandidates.map(({ hit, aggregatedScore }, idx) => {
    const std = hit.standard;
    const stdNum = std.standard_number.toUpperCase();
    const title = std.full_title.toLowerCase();
    const scope = (std.scope || "").toLowerCase();
    const materials = (std.materials || []).map((m) => m.toLowerCase());
    const keywords = (std.keywords || []).map((k) => k.toLowerCase());

function termsMatch(termA: string, termB: string): boolean {
  const a = termA.toLowerCase().trim();
  const b = termB.toLowerCase().trim();
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  // Normalize plurals (e.g. helmet vs helmets, bottle vs bottles)
  const aSingular = a.endsWith("s") && a.length > 3 ? a.slice(0, -1) : a;
  const bSingular = b.endsWith("s") && b.length > 3 ? b.slice(0, -1) : b;
  if (aSingular === bSingular) return true;
  if (aSingular.length >= 4 && bSingular.length >= 4) {
    if (aSingular.startsWith(bSingular) || bSingular.startsWith(aSingular)) return true;
  }
  return false;
}

    // 7-Dimension Coverage Analysis
    const qTokens = qLower
      .split(/[\s,.:;()/\-]+/)
      .filter((w) => w.length > 2 && !["what", "about", "tell", "need", "standard", "standards", "requirement", "requirements", "specification", "specifications"].includes(w));

    const titleWords = title
      .split(/[\s,.:;()/\-]+/)
      .filter((w) => w.length > 3 && !["part", "specification", "requirements", "safety", "standard", "indian", "method", "guide", "general"].includes(w));

    const hasProductTerm =
      keywords.some((k) => Boolean(k && k.trim().length > 2 && (qLower.includes(k.trim()) || qTokens.some((tok) => termsMatch(tok, k))))) ||
      Boolean(std.short_title && std.short_title.trim().length > 2 && (qLower.includes(std.short_title.toLowerCase().trim()) || qTokens.some((tok) => termsMatch(tok, std.short_title!)))) ||
      titleWords.some((tw) => qTokens.some((tok) => termsMatch(tok, tw))) ||
      titleWords.some((tw) => qLower.includes(tw));

    const queryHasSteel = qLower.includes("stainless steel") || qLower.includes("ss ") || qLower.includes("steel");
    const queryHasAlum = qLower.includes("aluminium") || qLower.includes("aluminum");
    const queryHasPlastic = qLower.includes("plastic") || qLower.includes("polymer") || qLower.includes("pet");

    const stdIsSteel = title.includes("steel") || materials.some((m) => m.includes("steel"));
    const stdIsAlum = title.includes("aluminium") || materials.some((m) => m.includes("aluminium"));
    const stdIsPlastic = title.includes("plastic") || title.includes("poly") || materials.some((m) => m.includes("plastic"));

    let materialCoverage: "covered" | "not_covered" | "unknown" = "unknown";
    if (queryHasSteel || queryHasAlum || queryHasPlastic) {
      if (
        (queryHasSteel && stdIsSteel) ||
        (queryHasAlum && stdIsAlum) ||
        (queryHasPlastic && stdIsPlastic)
      ) {
        materialCoverage = "covered";
      } else {
        materialCoverage = "not_covered";
      }
    }

    const intendedUseCoverage: "covered" | "not_covered" | "unknown" =
      qLower.includes("potable") || qLower.includes("food") || qLower.includes("industrial") || qLower.includes("rider")
        ? scope.includes("potable") || scope.includes("food") || scope.includes("industrial") || scope.includes("two wheeler")
          ? "covered"
          : "not_covered"
        : "unknown";

    const hasIdentifierInQuery =
      qLower.includes(stdNum.toLowerCase()) ||
      stdNum.replace(/\s+/g, "").toLowerCase() === qLower.replace(/\s+/g, "");

    const coverage = {
      product: hasProductTerm ? ("covered" as const) : ("not_covered" as const),
      material: materialCoverage,
      intended_use: intendedUseCoverage,
      capacity_rating: "unknown" as const,
      testing: (std.key_testing_parameters && std.key_testing_parameters.length > 0) ? ("covered" as const) : ("not_covered" as const),
      certification: std.scheme ? ("covered" as const) : ("not_covered" as const),
      identifier: hasIdentifierInQuery ? ("covered" as const) : ("not_covered" as const),
    };

    // Step 3: Applicability Classification (7 classes)
    let applicability: ApplicabilityClass = "related_standard";
    let whyCoverage = "";

    // Check material mismatch first
    if (materialCoverage === "not_covered" && (queryHasSteel || queryHasAlum || queryHasPlastic)) {
      applicability = "related_material_mismatch";
      whyCoverage = `Product material mismatch: Query requests ${
        queryHasSteel ? "Stainless Steel" : queryHasAlum ? "Aluminium" : "Plastic"
      }, whereas ${std.standard_number} strictly governs ${
        stdIsSteel ? "Steel" : stdIsAlum ? "Aluminium" : "Plastics"
      }.`;
    } else if (hasIdentifierInQuery) {
      applicability = "directly_applicable";
      whyCoverage = `Exact identifier match: ${std.standard_number} directly cited in query specification.`;
    } else if (coverage.product === "covered" && (coverage.material === "covered" || coverage.material === "unknown") && aggregatedScore >= 0.70) {
      applicability = "directly_applicable";
      whyCoverage = `Direct product and scope coverage: Governs primary manufacturing and safety requirements for ${std.full_title}.`;
    } else if (aggregatedScore >= 0.50 && coverage.product === "covered") {
      applicability = "potentially_applicable";
      whyCoverage = `Substantial product overlap; candidate standard for variant specifications under ${std.product_category}.`;
    } else if (aggregatedScore >= 0.45 && (coverage.product === "covered" || coverage.identifier === "covered")) {
      applicability = "related_standard";
      whyCoverage = `Referenced allied standard establishing testing methodologies or raw material specifications.`;
    } else if (aggregatedScore >= 0.30 && (coverage.product === "covered" || coverage.identifier === "covered")) {
      applicability = "scope_unclear";
      whyCoverage = `Marginal relevance; standard scope may not encompass query requirements without further product details.`;
    } else {
      applicability = "not_applicable";
      whyCoverage = `Does not meet statutory relevance threshold for this product query.`;
    }

    // Step 8 & Step 9: Knowledge Tier & Claim Policy
    // Tier determination (Catalogue = A, Product Manual = B, Full Text Clause = C)
    const tier: KnowledgeTier = std.source_type === "PRODUCT_MANUAL" ? "B" : std.source_type === "FULL_TEXT" ? "C" : "A";

    let claimPolicy: string[];
    if (tier === "C") {
      claimPolicy = ["identity", "description", "why", "scope_paragraphs", "procedural_steps", "clause_quotes", "numeric_limits"];
    } else if (tier === "B") {
      claimPolicy = ["identity", "description", "why", "scope_paragraphs", "procedural_steps"];
    } else {
      claimPolicy = ["identity", "description", "why"]; // Tier A never allows numeric limits
    }

    // Assign citable evidence SIDs
    const citableSids: string[] = [];

    // S# for standard catalogue entry
    const catSid = `S${sidCounter++}`;
    citableSids.push(catSid);
    citableEvidence.push({
      sid: catSid,
      evidence_class: "official_source",
      tier,
      kind: "catalogue_record",
      standard_id: std.standard_id,
      locator: `${std.standard_number} Catalogue Record`,
      snippet: `${std.full_title}. Scope: ${std.scope || "Prescribed by BIS catalogue"}`,
      source_url: std.source_url || std.document_url,
      retrieved_at: new Date().toISOString(),
    });

    // S# for each testing clause/parameter (strictly for primary standard to prevent cross-contamination)
    if (idx === 0 && std.key_testing_parameters && std.key_testing_parameters.length > 0 && tier !== "A") {
      for (const param of std.key_testing_parameters.slice(0, 3)) {
        const paramSid = `S${sidCounter++}`;
        citableSids.push(paramSid);
        citableEvidence.push({
          sid: paramSid,
          evidence_class: "official_source",
          tier,
          kind: "testing_clause",
          standard_id: std.standard_id,
          locator: param.split(":")[0]?.trim() || `${std.standard_number} Clause`,
          snippet: param,
          source_url: std.document_url,
          retrieved_at: new Date().toISOString(),
        });
      }
    }

    const stdStatus = (std.status || "CURRENT").toLowerCase() as any;

    return {
      standard_id: std.standard_id,
      is_number: std.standard_number,
      title: std.full_title,
      title_hi: undefined,
      year: std.year,
      tier,
      status: stdStatus,
      raw_score: hit.maxScore,
      aggregated_score: aggregatedScore,
      applicability,
      why_coverage: whyCoverage,
      coverage,
      claim_policy: claimPolicy,
      citable_sids: citableSids,
      official_url: std.document_url,
    };
  });

  // STEP 5: Calibrated Relevance Floor & Coverage Check (§9.8 C1)
  const hasAnyCovered = candidates.some(
    (c) =>
      c.applicability !== "not_applicable" &&
      (c.coverage.product === "covered" || c.coverage.identifier === "covered")
  );
  const outOfCorpus =
    top1Score < CALIBRATED_RELEVANCE_FLOOR ||
    candidates.length === 0 ||
    !hasAnyCovered;

  // STEP 4: Conflict Detection
  const conflicts: AdjudicatedConflict[] = [];

  // Check for superseded standards among candidates
  for (const c of candidates) {
    if (c.status === "superseded" || c.status === "withdrawn") {
      conflicts.push({
        type: "superseded_edition",
        severity: "high",
        description: `${c.is_number} is ${c.status.toUpperCase()} in the BIS National Standards Register.`,
        operatives: candidates.filter((other) => other.status === "current").map((o) => o.is_number),
        resolution_rule: "Enforce latest current operative edition; cite superseded edition only with explicit historical warning.",
      });
    }
  }

  // Check for competing materials in candidates
  const steelCandidates = candidates.filter((c) => c.title.toLowerCase().includes("steel"));
  const alumCandidates = candidates.filter((c) => c.title.toLowerCase().includes("aluminium"));
  if (steelCandidates.length > 0 && alumCandidates.length > 0) {
    conflicts.push({
      type: "material_conflict",
      severity: "medium",
      description: `Multiple standards found governing differing materials (${steelCandidates[0].is_number} for Steel vs ${alumCandidates[0].is_number} for Aluminium).`,
      operatives: [steelCandidates[0].is_number, alumCandidates[0].is_number],
      resolution_rule: "Segregate recommendations by raw material substrate. Request explicit manufacturing material confirmation.",
    });
  }

  // STEP 6: Grounding State
  let groundingState: GroundingState = "insufficient_evidence";
  if (!outOfCorpus && candidates.length > 0) {
    const topCandidate = candidates[0];
    if (
      topCandidate.applicability === "directly_applicable" &&
      topCandidate.aggregated_score >= 0.70
    ) {
      groundingState = "verified";
    } else if (
      topCandidate.applicability === "potentially_applicable" ||
      topCandidate.applicability === "related_standard" ||
      topCandidate.aggregated_score >= 0.45
    ) {
      groundingState = "supported_inference";
    }
  }

  // STEP 7: Confidence Label (4 levels)
  let confidenceLabel: ConfidenceLabel = "no_verified_evidence";
  if (groundingState === "verified") {
    confidenceLabel = "verified_evidence";
  } else if (groundingState === "supported_inference") {
    confidenceLabel = candidates[0]?.tier === "A" ? "partially_supported" : "partially_supported";
  } else if (top1Score >= 0.35) {
    confidenceLabel = "limited_evidence";
  }

  const claimPolicyMap: Record<string, string[]> = {};
  for (const c of candidates) {
    claimPolicyMap[c.is_number] = c.claim_policy;
  }

  const effectiveTop1 = outOfCorpus ? Math.min(top1Score, 0.30) : top1Score;

  const adjudicationReport: AdjudicationReport = {
    turn_id: queryId,
    query,
    canonical_query: query,
    relevance_top1: effectiveTop1,
    relevance_floor: CALIBRATED_RELEVANCE_FLOOR,
    out_of_corpus: outOfCorpus,
    grounding_state: groundingState,
    confidence_label: confidenceLabel,
    candidates: outOfCorpus ? [] : candidates,
    conflicts,
    citable_evidence: outOfCorpus ? [] : citableEvidence,
    claim_policy_map: claimPolicyMap,
  };

  return {
    query_id: queryId,
    canonical_query: query,
    original_query: query,
    language,
    intent: "product_match",
    sub_intents: ["qco_check", "certification_guidance"],
    entities: extractedEntities,
    missing_attributes: [],
    adjudication: adjudicationReport,
    citable_evidence: citableEvidence,
    context_non_citable: [
      {
        class: "user_provided",
        kind: "query_input",
        text: query,
      },
    ],
    structured: {
      labs: [],
    },
  };
}
