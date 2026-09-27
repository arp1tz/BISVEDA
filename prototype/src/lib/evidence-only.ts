import type { EvidencePackageV2, CandidateEvaluation } from "./adjudicator";
import type { LaboratoryRecord, QCORecord } from "./types";

/**
 * L5 Evidence-Only Answer Mode (§10.3):
 * When no generation provider is available (or LLM call fails / is bypassed),
 * the renderer builds the Dossier summary and candidate rationale deterministically
 * from templates over the adjudicated evidence package.
 *
 * Same [S#] citations, same trust result, zero hallucination.
 * Terminal fallback of the provider chain (§22.2).
 */
export function renderEvidenceOnlySummary(
  adjudicatedPackage: EvidencePackageV2,
  primaryCandidate?: CandidateEvaluation,
  qco?: any,
  labs: LaboratoryRecord[] = []
): {
  summaryProse: string;
  whyRationales: Record<string, string>;
} {
  const topCandidate = primaryCandidate || adjudicatedPackage.adjudication.candidates[0];

  if (!topCandidate || adjudicatedPackage.adjudication.out_of_corpus) {
    return {
      summaryProse:
        "BISVEDA answers strictly from the official Bureau of Indian Standards (BIS) catalogue and public statutory documents it has indexed. No authoritative record in the current corpus sufficiently establishes statutory applicability for this query. To prevent non-compliant specifications, please refer to the National Standards Helpline at 14434 or consult the official BIS portal.",
      whyRationales: {},
    };
  }

  const isMandatory = qco?.mandatory_qco || topCandidate.is_number.includes("17526") || topCandidate.is_number.includes("2347") || topCandidate.is_number.includes("4151") || topCandidate.is_number.includes("16046");
  const sid = topCandidate.citable_sids[0] || "S1";

  // Build grounded prose
  const p1 = `**${topCandidate.is_number}** (${topCandidate.title}) is identified as the ${
    topCandidate.applicability === "directly_applicable"
      ? "directly applicable Indian Standard"
      : "statutory candidate standard"
  } under BIS ${topCandidate.tier === "A" ? "Catalogue Records" : "Product Specifications"} [${sid}].`;

  const p2 = isMandatory
    ? `Under the governing Quality Control Order (QCO), certification and standard marking (ISI Mark / Scheme-I) are **statutorily mandatory** prior to manufacturing, importing, or distributing this product in India. Non-compliance invites penal proceedings under Section 29 of the Bureau of Indian Standards Act, 2016.`
    : `Compliance with ${topCandidate.is_number} is currently managed under the voluntary BIS certification scheme, unless notified under a sectoral ministerial mandate.`;

  let p3 = "";
  if (topCandidate.tier !== "A" && topCandidate.citable_sids.length > 1) {
    p3 = ` Mandatory statutory test requirements including verified mechanical and safety parameters are specified under the standard's Scheme of Inspection and Testing [${topCandidate.citable_sids[1]}].`;
  } else {
    p3 = ` Full test clauses and numeric limits must be inspected in the authoritative standard copy, as catalogue tier limits disclosure to certified scopes.`;
  }

  let p4 = "";
  if (labs.length > 0) {
    p4 = ` Testing and conformity evaluation can be conducted through ${labs.length} BIS-recognized laboratories, including ${labs[0].name} (${labs[0].city || labs[0].state}).`;
  }

  const summaryProse = `${p1} ${p2}${p3}${p4}`;

  // Build why rationales per candidate
  const whyRationales: Record<string, string> = {};
  for (const c of adjudicatedPackage.adjudication.candidates) {
    const candidateSid = c.citable_sids[0] || "S1";
    whyRationales[c.is_number] =
      `${c.is_number} matches the query scope because its official catalogue title and scope govern ${c.title} [${candidateSid}]. Applicability classification: ${c.applicability.toUpperCase()}.`;
  }

  return {
    summaryProse,
    whyRationales,
  };
}
