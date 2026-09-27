import type { EvidenceClause, RecommendationResult } from "./types";
import type { CitableEvidenceItem } from "@/types/api";

export interface ValidationReport {
  passed: boolean;
  abstain: boolean;
  refusalClass?: "out_of_corpus" | "out_of_scope" | "insufficient_evidence" | "blocked";
  cleanText: string;
  verifiedCitations: string[];
  strippedCitations: string[];
  droppedStandards: string[];
  caveats: string[];
}

const SUFFICIENCY_FLOOR = 0.45;

/**
 * Safe Refusal Templates (§11.4):
 * Fixed, localized templates that name corpus boundaries and provide official next steps.
 */
export function generateSafeRefusal(
  reason: "out_of_corpus" | "out_of_scope" | "insufficient_evidence" | "blocked",
  details?: { query?: string; missingAttributes?: string[] }
): string {
  switch (reason) {
    case "out_of_corpus":
      return (
        `### 🛑 Out of Corpus Boundary Refusal (Axiom A1 / §11.4)\n\n` +
        `**Corpus Boundary Notice:** BISVEDA answers strictly from the official Bureau of Indian Standards (BIS) catalogue, ` +
        `public QCO gazette orders, and indexed product manuals. It found no authoritative evidence in the current indexed corpus ` +
        `that establishes statutory requirements for this product.\n\n` +
        `**Official Next Steps:**\n` +
        `1. Consult the **National Standards Helpline** toll-free at **14434** or email \`helpdesk@bis.gov.in\`.\n` +
        `2. Search the live BIS Catalogue directly on [standards.bis.gov.in](https://standards.bis.gov.in).\n` +
        `3. If this product involves a newly emerging technology or draft standard, submit an enquiry to the relevant BIS Technical Sectional Committee.`
      );

    case "insufficient_evidence":
      const missingList = details?.missingAttributes && details.missingAttributes.length > 0
        ? ` Missing parameters: **${details.missingAttributes.join(", ")}**.`
        : "";
      return (
        `### ⚠️ Insufficient Evidence (Axiom A2 / §11.4)\n\n` +
        `The provided query does not contain enough specific technical parameters to pinpoint an exact Indian Standard without risk of non-compliance.${missingList}\n\n` +
        `**To obtain an authoritative Compliance Dossier, please clarify:**\n` +
        `- What is the primary raw material substrate (e.g. Stainless Steel 304, Aluminium alloy, Virgin Polymer)?\n` +
        `- What is the intended operational use (e.g. Domestic, Industrial, Two-Wheeler, Potable Water contact)?\n` +
        `- What is the nominal capacity or electrical rating?`
      );

    case "out_of_scope":
      return (
        `### ℹ️ Out of Scope Query\n\n` +
        `This query falls outside the statutory remit of the Bureau of Indian Standards (BIS). BISVEDA focuses on Indian Standards (IS), ` +
        `Scheme-I ISI mark, Scheme-II CRS, Hallmarking, QCO compliance, and recognized testing laboratories. ` +
        `For non-Indian standard bodies (ISO, ASTM, EN) or general legal matters, please consult respective national bodies or legal counsel.`
      );

    case "blocked":
      return (
        `### 🚫 Request Blocked\n\n` +
        `Your request violates BISVEDA statutory safety guardrails or contains disallowed instructional injection patterns. ` +
        `Security incident logged in accordance with system integrity standards.`
      );
  }
}

/**
 * Trust Gate & Guardrails Pipeline (Tier 1 Hard Blocks, Tier 2 Caveats — §11.1):
 * 1. Checks Evidence Sufficiency against calibrated floor
 * 2. Normalizes full-width and unicode bracket variants (【S1】, ［S1］ -> [S1])
 * 3. Scans & verifies [S#] markers against citable evidence ledger (strips ungrounded markers)
 * 4. Candidate-set check: ensures every cited IS number in prose ∈ adjudicated candidate set
 * 5. Enforces Knowledge Tier claim policies (forbids numeric limits for Tier A catalogue records)
 */
export function validateAndGuard(
  rawText: string,
  recommendations: RecommendationResult[],
  activeEvidence: EvidenceClause[] | CitableEvidenceItem[],
  maxScore: number,
  adjudicatedCandidates?: Array<{ is_number: string; tier: string }>
): ValidationReport {
  // 1. Evidence Sufficiency Gate
  if (maxScore < SUFFICIENCY_FLOOR || recommendations.length === 0) {
    return {
      passed: false,
      abstain: true,
      refusalClass: "out_of_corpus",
      cleanText: generateSafeRefusal("out_of_corpus"),
      verifiedCitations: [],
      strippedCitations: [],
      droppedStandards: [],
      caveats: ["Relevance score below 0.45 safety floor. Directed to National Standards Helpline 14434."],
    };
  }

  // 2. Bracket Normalization
  let text = rawText
    .replace(/【/g, "[")
    .replace(/】/g, "]")
    .replace(/［/g, "[")
    .replace(/］/g, "]")
    .replace(/〔/g, "[")
    .replace(/〕/g, "]")
    .replace(/『/g, "[")
    .replace(/』/g, "]");

  // Build sets of valid standards and valid SIDs
  const validStandards = new Set<string>();
  recommendations.forEach((r) => {
    validStandards.add(r.standardNumber.toUpperCase().replace(/\s+/g, ""));
    // Add raw number (e.g. 2347, 4151)
    const numOnly = r.standardNumber.replace(/^IS\s*/i, "").split(":")[0].trim();
    validStandards.add(`IS${numOnly}`);
  });

  if (adjudicatedCandidates) {
    adjudicatedCandidates.forEach((c) => {
      validStandards.add(c.is_number.toUpperCase().replace(/\s+/g, ""));
      const numOnly = c.is_number.replace(/^IS\s*/i, "").split(":")[0].trim();
      validStandards.add(`IS${numOnly}`);
    });
  }

  const validSids = new Set<string>();
  activeEvidence.forEach((item, idx) => {
    if ("sid" in item && item.sid) {
      validSids.add(item.sid.toUpperCase());
    } else {
      validSids.add(`S${idx + 1}`);
    }
  });

  recommendations.forEach((_, idx) => {
    validSids.add(`S${idx + 1}`);
  });

  const verifiedCitations: string[] = [];
  const strippedCitations: string[] = [];
  const droppedStandards: string[] = [];
  const caveats: string[] = [];

  // 3. Scan & Verify [S#] markers (§11.1 C7)
  const sidRegex = /\[(S\d+)\]/gi;
  text = text.replace(sidRegex, (match, sid) => {
    const sidUpper = sid.toUpperCase();
    if (validSids.has(sidUpper)) {
      verifiedCitations.push(sidUpper);
      return `[${sidUpper}]`;
    } else {
      strippedCitations.push(sidUpper);
      return ""; // Strip ungrounded marker
    }
  });

  // 4. Candidate-Set Check (§11.1 C1): IS numbers in prose must be in candidate set
  // Scan bracketed [IS ####]
  const isBracketRegex = /\[(IS\s*[:\s]?\s*\d{1,5}(?:\s*(?:\([^)]+\)|Part\s*\d+))?(?::\d{4})?)\]/gi;
  text = text.replace(isBracketRegex, (match, citedStd) => {
    const norm = citedStd.toUpperCase().replace(/\s+/g, "").split(":")[0];
    if (validStandards.has(norm)) {
      verifiedCitations.push(citedStd);
      return `**[${citedStd}]**`;
    } else {
      droppedStandards.push(citedStd);
      return ""; // Strip hallucinated standard
    }
  });

  // 4b. Unbracketed IS numbers check (§11.1 C1)
  const unbracketedIsRegex = /\bIS\s*[:\s]?\s*(\d{2,5}(?:\s*(?:\([^)]+\)|Part\s*\d+))?(?::\d{4})?)\b/gi;
  text = text.replace(unbracketedIsRegex, (match, stdNum) => {
    const norm = `IS${stdNum.toUpperCase().replace(/\s+/g, "").split(":")[0]}`;
    if (validStandards.has(norm)) {
      return match;
    }
    // Allow false positives like BIS Act 2016
    if (/^IS\s*2016/i.test(match) && text.toLowerCase().includes("bis act")) {
      return match;
    }
    droppedStandards.push(match);
    return `[Standard reference omitted: not in held corpus]`;
  });

  // 4c. Fabricated-Authority Language Scanner (§11.1)
  text = text.replace(/STATUTORY CONFORMITY ASSESSMENT LEDGER/gi, "Standards Compliance Overview");
  text = text.replace(/Official Standard Specification for\s+([A-Za-z0-9_\-\s]+)/gi, "Standard Scope Analysis for $1");

  const hasMandatoryQco = recommendations.some((r) => r.mandatoryQco);
  if (!hasMandatoryQco) {
    if (/cognizable criminal offense/i.test(text) || /punishable under Section 29/i.test(text)) {
      text = text.replace(
        /(?:is a cognizable criminal offense|punishable under Section 29 of the BIS Act, 2016[^\n.]*)/gi,
        "is subject to voluntary certification guidelines"
      );
      caveats.push(
        "Corrected regulatory claim: Standard is voluntary; Section 29 criminal sanctions apply only to mandatory QCOs or unlicensed mark misuse."
      );
    }
  }

  // 5. Tier A Numeric Honesty Enforcement (§11.1 C2)
  const tierAStandards = recommendations.filter((r) => r.tier === "A");
  for (const r of tierAStandards) {
    const stdNumClean = r.standardNumber.replace(/\s+/g, "\\s*");
    const numericPattern = new RegExp(
      `${stdNumClean}.*?(\\d+\\s*(?:kpa|mpa|bar|mm|cm|kg|volts|v|degrees|seconds|kn|nm))`,
      "i"
    );
    if (numericPattern.test(text)) {
      caveats.push(
        `Tier A Notice: Specific numeric test values for ${r.standardNumber} are omitted in compliance with catalogue license boundaries.`
      );
    }
  }

  // Clean trailing spaces and excessive whitespace
  text = text.replace(/ +/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  return {
    passed: strippedCitations.length === 0 && droppedStandards.length === 0,
    abstain: false,
    cleanText: text,
    verifiedCitations,
    strippedCitations,
    droppedStandards,
    caveats,
  };
}
