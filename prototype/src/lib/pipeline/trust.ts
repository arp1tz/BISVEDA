/**
 * BISVEDA — Trust Gate (lib/pipeline/trust.ts, P3.4)
 *
 * Deterministic line-by-line filter over the generated markdown answer:
 *  1. Normalizes bracket variants (【S1】, ［S1］) to [S1].
 *  2. Strips any [S#] that doesn't resolve to a real source in the package.
 *  3. A line that states a number (with or without a unit) or an IS number
 *     must cite a source whose text actually contains that value — dropped
 *     otherwise.
 *  4. A line with no digits and no IS reference passes through unchanged
 *     (ordinary conversational prose needs no citation).
 *  5. If every citation-requiring line gets dropped, the caller
 *     (orchestrator) treats this as `allDropped` and returns an honest
 *     refusal rather than an empty or evidence-free answer.
 */

import { EvidencePackage, Source } from "./package";
import { toAsciiDigits } from "./normalize";

/** Collapses all Unicode space variants (regular, non-breaking, narrow no-break, etc.) to a plain space. LLM output sometimes uses typographic spaces (e.g. U+202F before a unit) that don't byte-match the source text's plain spaces. */
function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, " ");
}

function cleanNumber(n: string): string {
  return n.replace(/[,\s]/g, "").toLowerCase();
}

function extractNumbersWithUnits(text: string): string[] {
  const regex = /\b\d+(?:[.,]\d+)?(?:\s*(?:%|mm|cm|m|kg|g|N|°C|days|months|years|Rs|₹|K|karat))?\b/gi;
  return (text.match(regex) || []).map((m) => m.trim());
}

export function normalizeCitationBrackets(text: string): string {
  return text.replace(/[【［〔『]\s*S(\d+)\s*[】］〕』]/g, "[S$1]").replace(/\[\s*S(\d+)\s*\]/g, "[S$1]");
}

interface LineCheck {
  valid: boolean;
  reason?: string;
  sanitized: string;
  needsCitation: boolean;
}

function checkLine(line: string, pkg: EvidencePackage, sourceMap: Map<string, Source>): LineCheck {
  // Digits from any script (e.g. Devanagari ४१५१) are checked as ASCII, so a non-English answer can't slip a figure past the gate.
  const normalized = toAsciiDigits(normalizeCitationBrackets(line)).trim();
  if (!normalized) return { valid: true, sanitized: "", needsCitation: false };

  const citationMatches = normalized.match(/\[S\d+\]/g) || [];
  const validCitations = citationMatches.filter((c) => sourceMap.has(c.replace(/[\[\]]/g, "")));

  // Strip any unresolved citation marker even if the line is otherwise kept.
  const strippedUnresolved = normalized.replace(/\[S\d+\]/g, (m) =>
    sourceMap.has(m.replace(/[\[\]]/g, "")) ? m : ""
  ).replace(/\s+([.,])/g, "$1").trim();

  const hasIsNumber = /\bIS\s*[:\-]?\s*\d{1,5}\b/i.test(normalized);
  // Strip a leading list/step marker ("1.", "- ", "Step 2:") before extracting
  // numbers, so the marker itself never counts as a "fact" needing a citation.
  const withoutListMarker = normalized.replace(/^(?:[-*]\s+|\d{1,2}[.):]\s+|Step\s+\d+\s*[:.]?\s*)/i, "");
  // IS numbers are validated separately (against the allowed-standards set,
  // not against source text) — strip them here so e.g. the "4151" in
  // "IS 4151" isn't ALSO treated as a bare technical figure that must
  // literally appear in a cited source's text.
  const withoutIsRefs = withoutListMarker.replace(/\bIS\s*[:\-]?\s*\d{1,5}(?:\s*\(Part\s*\d+\))?\b/gi, "");
  const meaningfulNumbers = extractNumbersWithUnits(withoutIsRefs);

  // A sentence that names only the already-adjudicated primary standard, with
  // no other technical figures, is restating an identity fact the pipeline
  // already verified before generation ever ran — it doesn't need its own
  // citation the way a specific clause/number claim does.
  const primaryCleanId = pkg.primary_standard?.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const mentionedIsIds = (normalized.match(/\bIS\s*[:\-]?\s*\d{1,5}(?:\s*\(Part\s*\d+\))?\b/gi) || []).map((m) =>
    m.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
  );
  const onlyMentionsPrimaryIdentity =
    hasIsNumber &&
    meaningfulNumbers.length === 0 &&
    primaryCleanId !== undefined &&
    mentionedIsIds.every((id) => id === primaryCleanId);

  const needsCitation = (hasIsNumber || meaningfulNumbers.length > 0) && !onlyMentionsPrimaryIdentity;

  if (!needsCitation) {
    return { valid: true, sanitized: strippedUnresolved, needsCitation: false };
  }

  if (validCitations.length === 0) {
    return { valid: false, reason: "missing_valid_citation", sanitized: strippedUnresolved, needsCitation: true };
  }

  // Every mentioned IS number must belong to the adjudicated standard set.
  const allowedStdIds = new Set(pkg.standards.map((s) => s.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()));
  if (pkg.primary_standard) allowedStdIds.add(pkg.primary_standard.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase());

  const isMatches = normalized.match(/\bIS\s*[:\-]?\s*\d{1,5}(?:\s*\(Part\s*\d+\))?\b/gi) || [];
  for (const raw of isMatches) {
    const cleanIs = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const allowed = Array.from(allowedStdIds).some((a) => a === cleanIs || a.includes(cleanIs) || cleanIs.includes(a));
    if (!allowed) {
      return { valid: false, reason: `unauthorized_standard_${raw}`, sanitized: strippedUnresolved, needsCitation: true };
    }
  }

  // Every other number must appear in the text of a cited source.
  const citedText = normalizeSpaces(
    validCitations
      .map((c) => sourceMap.get(c.replace(/[\[\]]/g, ""))?.text || "")
      .join(" ")
      .toLowerCase()
  );

  for (const num of meaningfulNumbers) {
    const cNum = cleanNumber(num);
    const digits = cNum.replace(/\D/g, "");
    // These BIS standards are often ISO-derived and some use a decimal comma
    // ("4,5 kg" = 4.5 kg) — check both the raw form and a comma-as-decimal
    // form against the source text, not just the comma-stripped one. Spaces
    // are normalized because the model sometimes emits a typographic space
    // (e.g. U+202F narrow no-break space before a unit) that won't otherwise
    // byte-match the source's plain space.
    const rawLower = normalizeSpaces(num.trim().toLowerCase());
    const commaAsDecimal = rawLower.replace(",", ".");
    if (digits && citedText.includes(digits)) continue;
    if (citedText.includes(cNum)) continue;
    if (citedText.includes(rawLower)) continue;
    if (citedText.includes(commaAsDecimal)) continue;
    return { valid: false, reason: `unsupported_number_${num}`, sanitized: strippedUnresolved, needsCitation: true };
  }

  return { valid: true, sanitized: strippedUnresolved, needsCitation: true };
}

export interface TrustGateReport {
  text: string;
  droppedLines: Array<{ line: string; reason: string }>;
  allDropped: boolean; // true when every citation-requiring line was dropped — caller should refuse
  isGeneralQuery?: boolean;
}

/**
 * Trust Gate Layer for General / Conversational Queries:
 * Verifies and sanitizes LLM-generated general capability and guidance responses.
 * Unlike standard clause checks that require [S#] citations from retrieval packages:
 * 1. Strips any hallucinated [S#] citations.
 * 2. Validates that any mentioned IS standards are well-formed Indian Standards.
 * 3. Preserves structured bullet points, numbered capability lists, and guidance text without citation requirements.
 * 4. Ensures output is non-empty, well-formatted markdown.
 */
export function runTrustGateForGeneralQuery(rawText: string, language?: string): TrustGateReport {
  if (!rawText || !rawText.trim()) {
    return {
      text: "",
      droppedLines: [{ line: "", reason: "empty_response" }],
      allDropped: true,
      isGeneralQuery: true,
    };
  }

  const normalizedBrackets = toAsciiDigits(normalizeCitationBrackets(rawText));
  const lines = normalizedBrackets.split("\n");
  const kept: string[] = [];
  const dropped: Array<{ line: string; reason: string }> = [];

  // Allowed standards for general guidance
  const validIsPattern = /\bIS\s*[:\-]?\s*(\d{1,5})(?:\s*[\-:]?\s*(?:\((?:Part|Pt)\s*\d+\)|(?:Part|Pt)\s*[\-:]?\s*\d+))?(?::\d{4})?\b/gi;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      kept.push("");
      continue;
    }

    // Strip any hallucinated [S#] brackets
    let sanitized = trimmed.replace(/\[S\d+\]/g, "").replace(/\s+([.,;:])/g, "$1").trim();

    // Check for any bizarre or malformed standards
    const matches = sanitized.match(validIsPattern);
    let lineValid = true;
    if (matches) {
      for (const m of matches) {
        // e.g. IS 9999999 is invalid
        const digits = m.replace(/\D/g, "");
        if (digits.length > 5) {
          lineValid = false;
          dropped.push({ line: rawLine, reason: `unrecognized_standard_${m}` });
          break;
        }
      }
    }

    if (lineValid) {
      kept.push(sanitized);
    }
  }

  const cleanedText = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const allDropped = cleanedText.length === 0;

  return {
    text: cleanedText,
    droppedLines: dropped,
    allDropped,
    isGeneralQuery: true,
  };
}

export function runTrustGate(
  rawText: string,
  pkg?: EvidencePackage,
  options?: { isGeneralQuery?: boolean; language?: string }
): TrustGateReport {
  if (options?.isGeneralQuery || !pkg) {
    return runTrustGateForGeneralQuery(rawText, options?.language);
  }

  const sourceMap = new Map(pkg.sources.map((s) => [s.label, s]));
  const dropped: Array<{ line: string; reason: string }> = [];

  const lines = rawText.split("\n");
  const kept: string[] = [];
  let citationRequiringLines = 0;
  let citationRequiringKept = 0;

  for (const line of lines) {
    const check = checkLine(line, pkg, sourceMap);
    if (check.needsCitation) citationRequiringLines++;
    if (check.valid) {
      kept.push(check.sanitized);
      if (check.needsCitation) citationRequiringKept++;
    } else {
      dropped.push({ line, reason: check.reason || "invalid" });
    }
  }

  const allDropped = citationRequiringLines > 0 && citationRequiringKept === 0;

  return {
    text: kept.join("\n").trim(),
    droppedLines: dropped,
    allDropped,
    isGeneralQuery: false,
  };
}

