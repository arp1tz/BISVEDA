/**
 * BISVEDA V9 — Stage 11: Trust Gate (lib/pipeline/trust.ts)
 * 
 * Deterministic truth and hallucination filter:
 *  1. Normalizes bracket variants (【S1】, ［S1］) to [S1].
 *  2. Drops any sentence citing standards NOT in package.standards.
 *  3. Number Support Check: Drops sentences containing numbers/percentages
 *     unsupported by the cited source text. (Fixes B6)
 *  4. Enforces valid source citations on every factual sentence.
 *  5. Reverts to evidence-only fallback if headline or >50% sentences are dropped.
 */

import { EvidencePackage, Source } from "./package";
import { GeneratedProse, generateEvidenceOnlyProse } from "./generate";

export interface TrustGateReport {
  passed: boolean;
  droppedSentences: Array<{ sentence: string; reason: string }>;
  sanitizedProse: GeneratedProse;
}

function cleanNumber(n: string): string {
  return n.replace(/[,\s]/g, "").toLowerCase();
}

function extractNumbersWithUnits(text: string): string[] {
  const regex = /\b\d+(?:[.,]\d+)?(?:\s*(?:%|mm|cm|m|kg|g|N|°C|days|months|years|Rs|₹))?\b/gi;
  const matches = text.match(regex);
  return matches ? matches.map((m) => m.trim()) : [];
}

export function normalizeCitationBrackets(text: string): string {
  return text
    .replace(/[【［〔『]\s*S(\d+)\s*[】］〕』]/g, "[S$1]")
    .replace(/\[\s*S(\d+)\s*\]/g, "[S$1]");
}

export function validateAndSanitizeSentence(
  sentence: string,
  pkg: EvidencePackage,
  sourceMap: Map<string, Source>
): { valid: boolean; reason?: string; sanitized: string } {
  const normalized = normalizeCitationBrackets(sentence).trim();
  if (!normalized) return { valid: false, reason: "empty", sanitized: "" };

  // 1. Extract citations [S1], [S2]
  const citationMatches = normalized.match(/\[S\d+\]/g) || [];
  const validCitations = citationMatches.filter((c) => {
    const label = c.replace(/[\[\]]/g, "");
    return sourceMap.has(label);
  });

  // If factual sentence has no valid citation, drop
  if (validCitations.length === 0) {
    return { valid: false, reason: "missing_valid_citation", sanitized: normalized };
  }

  // 2. Prohibited IS numbers check
  const allowedStdNumbers = new Set(
    pkg.standards.map((s) => s.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())
  );
  if (pkg.primary_standard) {
    allowedStdNumbers.add(pkg.primary_standard.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase());
  }

  const isMatches = normalized.match(/\bIS\s*[:\-]?\s*(\d{1,5})\b/gi) || [];
  for (const rawIs of isMatches) {
    const cleanIs = rawIs.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const isAllowed = Array.from(allowedStdNumbers).some(
      (allowed) => allowed === cleanIs || allowed.includes(cleanIs) || cleanIs.includes(allowed)
    );
    if (!isAllowed) {
      return {
        valid: false,
        reason: `unauthorized_standard_${rawIs}`,
        sanitized: normalized,
      };
    }
  }

  // 3. Number support check
  const numbers = extractNumbersWithUnits(normalized);
  if (numbers.length > 0) {
    // Gather text from cited sources in this sentence (include title, text, and url)
    const citedSourcesText = validCitations
      .map((c) => {
        const label = c.replace(/[\[\]]/g, "");
        const s = sourceMap.get(label);
        return `${s?.title || ""} ${s?.text || ""} ${s?.url || ""}`.toLowerCase();
      })
      .join(" ");

    for (const num of numbers) {
      const cNum = cleanNumber(num);
      // Allow single-digit list index if at beginning of sentence like "1." or "Step 1:"
      if (/^(?:1|2|3|4)\.?$/i.test(num) && /^(?:Step\s*\d|\d\.)/i.test(normalized)) {
        continue;
      }
      // A standard number is supported only if it appears in cited sources text/title for this sentence,
      // or if it matches the primary standard and S1 is cited
      const isPrimaryStd = pkg.primary_standard && cleanNumber(pkg.primary_standard.id).includes(cNum);
      const citesS1 = validCitations.some((c) => c === "[S1]");
      if (isPrimaryStd && citesS1) continue;

      // Extract raw digits
      const digits = cNum.replace(/\D/g, "");
      if (digits && (citedSourcesText.includes(digits) || citedSourcesText.includes(cNum))) continue;

      if (!citedSourcesText.includes(cNum)) {
        return {
          valid: false,
          reason: `unsupported_number_${num}`,
          sanitized: normalized,
        };
      }
    }
  }

  return { valid: true, sanitized: normalized };
}

export function runTrustGate(
  prose: GeneratedProse,
  pkg: EvidencePackage,
  language: string = "en"
): TrustGateReport {
  const sourceMap = new Map<string, Source>();
  for (const s of pkg.sources) {
    sourceMap.set(s.label, s);
  }

  const dropped: Array<{ sentence: string; reason: string }> = [];

  // 1. Check Headline
  const headlineCheck = validateAndSanitizeSentence(prose.headline, pkg, sourceMap);
  let cleanHeadline = headlineCheck.valid ? headlineCheck.sanitized : "";
  if (!headlineCheck.valid) {
    dropped.push({ sentence: prose.headline, reason: headlineCheck.reason || "headline_invalid" });
  }

  // 2. Check Points
  const cleanPoints: string[] = [];
  for (const p of prose.points) {
    const check = validateAndSanitizeSentence(p, pkg, sourceMap);
    if (check.valid) {
      cleanPoints.push(check.sanitized);
    } else {
      dropped.push({ sentence: p, reason: check.reason || "point_invalid" });
    }
  }

  // 3. Check Next Steps
  const cleanSteps: string[] = [];
  for (const st of prose.next_steps) {
    const check = validateAndSanitizeSentence(st, pkg, sourceMap);
    if (check.valid) {
      cleanSteps.push(check.sanitized);
    } else {
      dropped.push({ sentence: st, reason: check.reason || "step_invalid" });
    }
  }

  // Fallback to evidence-only template if headline failed or points fell below 1
  const totalSentences = 1 + prose.points.length;
  if (!cleanHeadline || cleanPoints.length === 0 || dropped.length >= totalSentences / 2) {
    const fallback = generateEvidenceOnlyProse(pkg, language);
    return {
      passed: false,
      droppedSentences: dropped,
      sanitizedProse: fallback,
    };
  }

  return {
    passed: dropped.length === 0,
    droppedSentences: dropped,
    sanitizedProse: {
      headline: cleanHeadline,
      points: cleanPoints,
      next_steps: cleanSteps,
    },
  };
}
