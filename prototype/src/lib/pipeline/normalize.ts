/**
 * BISVEDA V9 — Stage 1: Normalize (lib/pipeline/normalize.ts)
 * 
 * Functions:
 *  - NFC unicode normalization, whitespace collapsing, trim.
 *  - Language detection (English, Hindi, Hinglish).
 *  - Canonicalization of Indian Standard (IS) numbers across variants:
 *    "IS456", "is 456 : 2000", "IS-456(Part 1)", "IS 9873 (Pt 1)", "IS:4151-1993"
 */

export interface CanonicalIsNumber {
  id: string;              // e.g. "IS 456", "IS 9873 (Part 1)"
  norm: string;            // e.g. "IS456", "IS9873P1"
  part: number | null;     // e.g. 1
  year: number | null;     // e.g. 2000
  originalMatch: string;
}

export interface NormalizedInput {
  originalText: string;
  normalizedText: string;
  workingEnglishText: string;
  detectedLanguage: string; // "en" | "hi" | "hinglish"
  canonicalStandards: CanonicalIsNumber[];
}

/**
 * Normalizes text: NFC, collapses whitespace, trims.
 */
export function cleanText(input: string): string {
  if (!input) return "";
  return input
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width spaces
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detects whether text is Hindi (Devanagari), Hinglish, or English.
 */
export function detectLanguage(text: string): "hi" | "hinglish" | "en" {
  // Check for Devanagari script range: \u0900-\u097F
  const devanagariCount = (text.match(/[\u0900-\u097F]/g) || []).length;
  if (devanagariCount > 2) return "hi";

  // Check common Hinglish markers
  const hinglishTokens = [
    /\b(?:kya|hai|chahiye|ke\s*liye|kaise|milega|hoga|banane|karna|kab|kitna|lagta|wala|wali)\b/i,
  ];
  if (hinglishTokens.some((r) => r.test(text))) return "hinglish";

  return "en";
}

/**
 * Extracts and canonicalizes Indian Standard numbers.
 * Supports variants like:
 *   - "IS 4151"
 *   - "is4151"
 *   - "IS 456:2000"
 *   - "is 456 : 2000"
 *   - "IS-456"
 *   - "IS 9873 (Part 1)"
 *   - "IS 9873 (Pt 1)"
 *   - "IS 9873 Part-1"
 *   - "IS 16046 (Part 2):2018"
 *   - "IS:4151-1993"
 */
export function canonicalizeIsNumber(raw: string): CanonicalIsNumber | null {
  const clean = cleanText(raw);
  // Match IS followed by number, optional part, optional year
  const isRegex = /\bIS\s*[:\-]?\s*(\d{1,5})(?:\s*[\-:]?\s*(?:\((?:Part|Pt)\s*(\d+)\)|(?:Part|Pt)\s*[\-:]?\s*(\d+)))?(?:\s*[:\-]\s*(\d{4}))?/i;
  const m = clean.match(isRegex);
  if (!m) return null;

  const baseNum = m[1];
  const partNum = m[2] || m[3] ? parseInt(m[2] || m[3], 10) : null;
  const yearNum = m[4] ? parseInt(m[4], 10) : null;

  let id = `IS ${baseNum}`;
  let norm = `IS${baseNum}`;

  if (partNum !== null) {
    id += ` (Part ${partNum})`;
    norm += `P${partNum}`;
  }

  return {
    id,
    norm,
    part: partNum,
    year: yearNum,
    originalMatch: m[0],
  };
}

/**
 * Extracts all canonical IS numbers present in a text string.
 */
export function extractCanonicalStandards(text: string): CanonicalIsNumber[] {
  const results: CanonicalIsNumber[] = [];
  const globalRegex = /\bIS\s*[:\-]?\s*(\d{1,5})(?:\s*[\-:]?\s*(?:\((?:Part|Pt)\s*(\d+)\)|(?:Part|Pt)\s*[\-:]?\s*(\d+)))?(?:\s*[:\-]\s*(\d{4}))?/gi;
  let match;

  while ((match = globalRegex.exec(text)) !== null) {
    const canonical = canonicalizeIsNumber(match[0]);
    if (canonical) {
      if (!results.some((r) => r.norm === canonical.norm)) {
        results.push(canonical);
      }
    }
  }

  return results;
}

/**
 * Full Stage 1 normalization pipeline.
 */
export function normalizeQuery(query: string): NormalizedInput {
  const rawClean = cleanText(query);
  // Strip bracketed attachment prefixes like "[Attachment: helmet.jpg] " so file extensions don't create false consonant clusters
  const normalizedText = rawClean.replace(/^\[(?:Attachment|Photo|File):\s*[^\]]+\]\s*/i, "") || rawClean;
  const detectedLanguage = detectLanguage(normalizedText);
  const canonicalStandards = extractCanonicalStandards(normalizedText);

  // Simple Hinglish / transliteration word replacements for working text
  let workingEnglish = normalizedText;
  if (detectedLanguage === "hinglish") {
    workingEnglish = workingEnglish
      .replace(/\bhelmet\s*banane\s*ke\s*liye\b/gi, "for making helmets")
      .replace(/\bBIS\s*license\s*chahiye\s*kya\b/gi, "is BIS license mandatory")
      .replace(/\bsariya\s*ka\s*standard\s*kya\s*hai\b/gi, "what is standard for sariya steel reinforcement bars")
      .replace(/\bchahiye\s*kya\b/gi, "is required")
      .replace(/\bke\s*liye\b/gi, "for")
      .replace(/\bka\s*standard\b/gi, "standard for");
  } else if (detectedLanguage === "hi") {
    workingEnglish = workingEnglish
      .replace(/हेलमेट\s*के\s*लिए\s*कौन\s*सा\s*मानक\s*है\??/g, "which standard for helmet")
      .replace(/हेलमेट/g, "helmet")
      .replace(/मानक/g, "standard")
      .replace(/अनिवार्य/g, "mandatory");
  }

  return {
    originalText: query,
    normalizedText,
    workingEnglishText: workingEnglish,
    detectedLanguage,
    canonicalStandards,
  };
}
