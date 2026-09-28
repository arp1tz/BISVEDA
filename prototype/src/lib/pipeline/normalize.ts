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
  /** BCP-47-ish tag: "en", "hi", "mr", "ta" (native script) or "hi-Latn", "mr-Latn" (romanized). */
  detectedLanguage: string;
  canonicalStandards: CanonicalIsNumber[];
}

export type ScriptKind = "native" | "roman";

export interface LanguageInfo {
  /** ISO 639-1 base code ("en", "hi", "mr", "ta"...). */
  language: string;
  script: ScriptKind;
  /** language + "-Latn" when an Indic language is written in Roman letters. */
  tag: string;
  /** True when we have positive evidence of a non-English language (Indic script or lexicon hits). */
  indicEvidence: boolean;
  /** True when the text is clearly plain English, so the LLM language pass can be skipped. */
  confidentEnglish: boolean;
}

/** Splits "mr-Latn" into { language: "mr", script: "roman" }. */
export function parseLanguageTag(tag: string | undefined): { language: string; script: ScriptKind } {
  const t = (tag || "en").trim();
  const [base, sub] = t.split("-");
  return { language: (base || "en").toLowerCase(), script: sub && /^latn$/i.test(sub) ? "roman" : "native" };
}

export function makeLanguageTag(language: string, script: ScriptKind): string {
  const base = (language || "en").toLowerCase();
  return base !== "en" && script === "roman" ? `${base}-Latn` : base;
}

/** Converts digits from any Unicode script (Devanagari, Bengali, Tamil...) to ASCII 0-9. */
const DIGIT_ZEROS = [0x0660, 0x06f0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0xff10];

export function toAsciiDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹०-९০-৯੦-੯૦-૯୦-୯௦-௯౦-౯೦-೯൦-൯０-９]/g, (d) => {
    const cp = d.charCodeAt(0);
    const zero = DIGIT_ZEROS.find((z) => cp >= z && cp <= z + 9)!;
    return String(cp - zero);
  });
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

/** Unicode blocks -> language (Devanagari is refined to Marathi below when Marathi markers appear). */
const SCRIPT_BLOCKS: Array<{ re: RegExp; language: string }> = [
  { re: /[\u0900-\u097F]/g, language: "hi" },
  { re: /[\u0980-\u09FF]/g, language: "bn" },
  { re: /[\u0A00-\u0A7F]/g, language: "pa" },
  { re: /[\u0A80-\u0AFF]/g, language: "gu" },
  { re: /[\u0B00-\u0B7F]/g, language: "or" },
  { re: /[\u0B80-\u0BFF]/g, language: "ta" },
  { re: /[\u0C00-\u0C7F]/g, language: "te" },
  { re: /[\u0C80-\u0CFF]/g, language: "kn" },
  { re: /[\u0D00-\u0D7F]/g, language: "ml" },
  { re: /[\u0600-\u06FF]/g, language: "ur" },
];

const MARATHI_DEVANAGARI = /(?:\u0906\u0939\u0947|\u0906\u0939\u0947\u0924|\u0915\u093E\u092F|\u092E\u0932\u093E|\u0924\u0941\u092E\u094D\u0939\u0940|\u0924\u0942|\u0936\u0915\u0924\u094B|\u0936\u0915\u0924\u093E|\u0936\u0915\u0924\u094B\u0938|\u0915\u0930\u0942|\u0928\u093E\u0939\u0940|\u0915\u0938\u0947|\u0915\u0938\u093E|\u0915\u094B\u0923\u0924\u093E|\u0915\u094B\u0923\u0924\u0947|\u092A\u093E\u0939\u093F\u091C\u0947|\u0939\u0935\u0947|\u092E\u0927\u094D\u092F\u0947|\u0938\u093E\u0920\u0940|\u0906\u0923\u093F)/;

/** Distinctive romanized Hindi words (no clash with common English words). */
const HINDI_ROMAN = new Set(
  ("kya hai hain chahiye chahie kaise kaun kaunsa kaunse kaunsi batao bataiye bataao mujhe mera meri aap tum tumhare tumhari " +
    "karo karna karni karein kare sakte sakta sakti milega milta lagta lagega lagti wala wali hoga hogi hota hoti banane banana " +
    "liye kahan kahaan kitna kitne kitni kab kyun kyu nahin nahi abhi lekin aur yeh woh isme isko usko mein se ko ki ke " +
    "dikhao dikha samjhao samjhaiye jaankari batana chaahiye zaroori zaruri sahi galat kripya dhanyavaad shukriya").split(" ")
);

/** Distinctive romanized Marathi words. */
const MARATHI_ROMAN = new Set(
  ("karu shaktos shakto shakta shaktes shaktat kay kaay kase kasa kashi ahe aahe ahet aahet mala tumhi tumhala tula pahije " +
    "pahijet lagte lagtat konta konti kontya kuthe kuthun kiti kadhi mhanje sang sanga sangaa karaycha karayche karaychi " +
    "ghyaycha ghyayche asto aste asate hote mazi majhi majha maza mhanun ani mag ithe tithe dakhava dakhav aapan aamhi").split(" ")
);

/** Words that are Hindi AND Marathi (or ambiguous) \u2014 they alone can't pick the language but do signal "not English". */
const INDIC_AMBIGUOUS = new Set(["ka", "tu", "nako"]);

const ENGLISH_WORDS = new Set(
  ("a about above after again all also am an and any are as at be because been before being below between both but by can " +
    "could did do does doing down during each few for from further get give had has have having he her here hers him his how i if " +
    "in into is it its just like make may me more most must my need no nor not now of off on once only or other our out over own " +
    "same she should so some such than that the their them then there these they this those through to too under until up us " +
    "very want was we were what when where which while who whom why will with would you your yours " +
    "hello hi hey thanks thank please help tell explain describe define meaning apply applies applicable required requirement " +
    "requirements need needs mandatory compulsory certify certified certification certificate license licence licenses register " +
    "registration renew process procedure steps step documents document fee fees cost price time validity valid invalid " +
    "standard standards indian bis isi hallmark hallmarks hallmarking hallmarked huid qco qcos scheme manak online care app " +
    "helmet helmets motorcycle motorbike two wheeler industrial safety toy toys children child mechanical physical chemical " +
    "gold silver jewellery jewelry jeweller jeweler purity carat karat fineness assay assaying centre center ahc lab labs " +
    "laboratory laboratories test tests testing near nearest nearby find locate list show verify check genuine fake mark marks " +
    "form draft product products manufacturer manufacture manufacturing making sell selling import export india new old best " +
    "difference between kind type types clause clauses requirement scope part parts section what's it's i'm don't can't " +
    "call helpline number phone contact talk speak voice image photo picture upload attach file pdf").split(" ")
);

function latinTokens(text: string): string[] {
  return text.toLowerCase().normalize("NFC").match(/[a-z][a-z']*|\d+/g) || [];
}

/**
 * Deterministic language + script detection. Handles every major Indic script by Unicode block, and
 * romanized Hindi/Marathi by lexicon. Anything else that isn't clearly English is flagged
 * (`confidentEnglish: false`) so the LLM pass can identify it.
 */
export function detectLanguageInfo(text: string): LanguageInfo {
  // 1. Native scripts
  let best: { language: string; count: number } | null = null;
  for (const b of SCRIPT_BLOCKS) {
    const count = (text.match(b.re) || []).length;
    if (count > 0 && (!best || count > best.count)) best = { language: b.language, count };
  }
  if (best && best.count >= 2) {
    let language = best.language;
    if (language === "hi" && MARATHI_DEVANAGARI.test(text)) language = "mr";
    return { language, script: "native", tag: language, indicEvidence: true, confidentEnglish: false };
  }

  // 2. Romanized Indic (lexicon)
  const tokens = latinTokens(text);
  let hi = 0;
  let mr = 0;
  let ambiguous = 0;
  let english = 0;
  for (const t of tokens) {
    if (MARATHI_ROMAN.has(t)) mr++;
    else if (HINDI_ROMAN.has(t)) hi++;
    else if (INDIC_AMBIGUOUS.has(t)) ambiguous++;
    else if (ENGLISH_WORDS.has(t) || /^\d+$/.test(t) || /\d/.test(t)) english++;
  }
  if (mr + hi > 0 || (ambiguous > 0 && english < tokens.length)) {
    const language = mr > hi ? "mr" : "hi";
    return { language, script: "roman", tag: `${language}-Latn`, indicEvidence: true, confidentEnglish: false };
  }

  // 3. English or something unknown
  const ratio = tokens.length === 0 ? 1 : english / tokens.length;
  const confidentEnglish = ratio >= 0.6;
  return { language: "en", script: "roman", tag: "en", indicEvidence: false, confidentEnglish };
}

/** Back-compat wrapper: returns the language tag. */
export function detectLanguage(text: string): string {
  return detectLanguageInfo(text).tag;
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
  const canonicalStandards = extractCanonicalStandards(toAsciiDigits(normalizedText));

  // Deterministic word-level fallback (used only when the LLM translation pass is unavailable).
  let workingEnglish = normalizedText;
  if (detectedLanguage === "hi-Latn" || detectedLanguage === "mr-Latn") {
    workingEnglish = workingEnglish
      .replace(/\bhelmet\s*banane\s*ke\s*liye\b/gi, "for making helmets")
      .replace(/\bBIS\s*license\s*chahiye\s*kya\b/gi, "is BIS license mandatory")
      .replace(/\bsariya\s*ka\s*standard\s*kya\s*hai\b/gi, "what is standard for sariya steel reinforcement bars")
      .replace(/\bchahiye\s*kya\b/gi, "is required")
      .replace(/\bke\s*liye\b/gi, "for")
      .replace(/\bka\s*standard\b/gi, "standard for")
      .replace(/\b(?:tu|tum|tumhi|aap)\s+(?:ka|kay|kya)\s+(?:karu|kar)\s+(?:shakt\w+|sakt\w+)\b/gi, "what can you do")
      .replace(/\b(?:kya|kay)\s+(?:karu|kar)\s+(?:shakt\w+|sakt\w+)\b/gi, "what can you do")
      .replace(/\bstandard\s+konta\s+ahe\b/gi, "which standard is applicable")
      .replace(/\b(?:cha|ka|ke)\s+standard\b/gi, "standard for")
      .replace(/\b(?:konta|kaunsa|kaunse)\b/gi, "which")
      .replace(/\b(?:kase|kaise|kasa)\b/gi, "how")
      .replace(/\b(?:pahije|chahiye)\b/gi, "required");
  } else if (detectedLanguage === "hi" || detectedLanguage === "mr") {
    workingEnglish = workingEnglish
      .replace(/(?:तू|तुम्ही|तुम|आप)\s*(?:काय|क्या)\s*(?:करू|कर)\s*(?:शकतोस|शकता|शकतो|सकते|सकता|सकती)(?:\s*(?:हो|हैं|आहेस))?\??/g, "what can you do")
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
