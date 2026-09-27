/**
 * BISVEDA Layer 1 — Language Gateway (V7 §6.5 & V8 §6.5)
 * Handles Language Identification, Hinglish Code-Mixed Normalization,
 * Statutory Terminology Locking, and Cross-Lingual Adjudication.
 */

export type SupportedLanguage = "en" | "hi";

export interface LanguageDetectionResult {
  detectedLanguage: SupportedLanguage;
  isCodeMixed: boolean;
  confidence: number;
  canonicalEnglishQuery: string;
  lockedTerms: string[];
}

// Regex to capture statutory tokens that must never be altered or translated
const STATUTORY_TERM_PATTERNS = [
  /\bIS\s*\d+(?:\s*(?:\([^)]+\)|Part\s*\d+))?(?::\d{4})?\b/gi,
  /\bCM\/L[- ]?\d{7,8}\b/gi,
  /\bHUID\b/gi,
  /\bQCO\b/gi,
  /\bBIS\b/gi,
  /\bISI\b/gi,
  /\bCRS\b/gi,
  /\bFMCS\b/gi,
  /\bNABL\b/gi,
  /\bARAI\b/gi,
  /\bICAT\b/gi,
  /\bCIRT\b/gi,
  /\b\d+\s*(?:mm|kN|kPa|bar|g|kg|°C|dioptres|litres?)\b/gi,
];

// Common Hinglish intent keywords mapped to canonical regulatory terms
const HINGLISH_TERM_MAPPINGS: Record<string, string> = {
  "kaise": "how to",
  "kare": "apply",
  "karna hai": "need to",
  "chahiye": "required",
  "hoga": "is it",
  "kya": "",
  "batao": "tell me",
  "bataye": "explain",
  "ke liye": "for",
  "ka": "of",
  "ki": "of",
  "mein": "in",
  "par": "on",
  "aur": "and",
  "nahi": "not",
  "nakli": "counterfeit fake",
  "asli": "genuine authentic",
  "pata": "address location",
  "fees": "fee concession",
  "paisa": "fee",
  "kharidna": "purchase",
  "bechna": "sell",
  "banane": "manufacture",
  "banaye": "manufacture",
};

/**
 * Detects language, isolates statutory terms, and normalizes code-mixed queries.
 */
export function processLanguageGateway(rawQuery: string): LanguageDetectionResult {
  const query = rawQuery.trim();

  // 1. Lock statutory terms
  const lockedTerms: string[] = [];
  STATUTORY_TERM_PATTERNS.forEach((pat) => {
    const matches = query.match(pat);
    if (matches) {
      matches.forEach((m) => lockedTerms.push(m.trim()));
    }
  });

  // 2. Detect Devanagari script
  const devanagariPattern = /[\u0900-\u097F]/;
  const hasDevanagari = devanagariPattern.test(query);

  // 3. Detect Hinglish markers
  const lowerWords = query.toLowerCase().split(/\s+/);
  const hinglishHits = lowerWords.filter((w) => w in HINGLISH_TERM_MAPPINGS);
  const isCodeMixed = hinglishHits.length >= 2 || (hinglishHits.length >= 1 && lockedTerms.length >= 1);

  let detectedLanguage: SupportedLanguage = "en";
  if (hasDevanagari) {
    detectedLanguage = "hi";
  } else if (isCodeMixed) {
    detectedLanguage = "hi";
  }

  // 4. Normalize Hinglish to Canonical English for hybrid retrieval
  let canonicalEnglish = query;
  if (isCodeMixed) {
    const tokens = query.split(/\s+/).map((tok) => {
      const lower = tok.toLowerCase();
      // Keep locked terms exact
      if (lockedTerms.some((lt) => lt.toLowerCase() === lower)) return tok;
      if (lower in HINGLISH_TERM_MAPPINGS) {
        return HINGLISH_TERM_MAPPINGS[lower];
      }
      return tok;
    });
    canonicalEnglish = tokens.filter(Boolean).join(" ");
  }

  return {
    detectedLanguage,
    isCodeMixed,
    confidence: hasDevanagari ? 0.98 : isCodeMixed ? 0.88 : 0.95,
    canonicalEnglishQuery: canonicalEnglish,
    lockedTerms,
  };
}

/**
 * Translates core regulatory synthesized slot sections to Hindi while keeping statutory terms strictly intact.
 */
export function formatStatutoryNoticeBilingual(
  qcoTitle: string,
  standardNumber: string,
  isMandatory: boolean,
  lang: SupportedLanguage = "en"
): string {
  if (lang === "hi") {
    return isMandatory
      ? `🚨 **अनिवार्य गुणवत्ता नियंत्रण आदेश (QCO) चेतावनी**\nयह उत्पाद **${qcoTitle}** के तहत विनियमित है। **${standardNumber}** के अनुसार वैध बीआईएस मानक चिह्न (ISI Mark) के बिना इस उत्पाद का निर्माण, भंडारण या बिक्री बीआईएस अधिनियम, 2016 की धारा 29 के तहत एक दंडनीय अपराध है।`
      : `यह मानक **${standardNumber}** वर्तमान में स्वैच्छिक प्रमाणन योजना के अंतर्गत आता है।`;
  }

  return isMandatory
    ? `🚨 **Mandatory Quality Control Order (QCO) Notice**\nThis product is regulated under **${qcoTitle}**. Manufacturing, importing, distributing, or selling this item without an authentic BIS Standard Mark (ISI Mark) under **${standardNumber}** is a punishable criminal offense under Section 29 of the BIS Act, 2016.`
    : `Compliance with **${standardNumber}** is currently covered under the voluntary certification scheme.`;
}
