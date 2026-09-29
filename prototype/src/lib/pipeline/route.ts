/**
 * BISVEDA V9 — Stage 2: Route (lib/pipeline/route.ts)
 * 
 * Rules-first deterministic intent classifier.
 * Outputs one of:
 *  - 'identifier': exact IS / CM/L / HUID pattern (Speed Gate direct facts, no LLM)
 *  - 'smalltalk': greetings, pleasantries (fixed template, no retrieval)
 *  - 'gibberish': unparseable or random strings (fixed template)
 *  - 'out_of_scope': not about products, standards, certification, testing, hallmarking
 *  - 'needs_clarification': asking for standards/certification/labs but naming no product
 *  - 'question': specific product or regulatory inquiry (flows to retrieval)
 */

import { NormalizedInput } from "./normalize";

export type RouteOutcome =
  | { kind: "identifier"; identifier: string; norm: string }
  | { kind: "smalltalk"; reply: string; lang: string }
  | { kind: "gibberish"; message: string }
  | { kind: "out_of_scope"; topic: string; message: string }
  | { kind: "needs_clarification"; prompt: string; options: Array<{ label: string; value: string }> }
  | { kind: "question"; workingQuery: string };

/**
 * Checks for gibberish using vowel ratio and consonant clusters.
 */
function isGibberish(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  const letters = words.join("");
  if (letters.length < 5) return false;

  const vowels = letters.replace(/[^aeiou]/g, "").length;
  const vowelRatio = vowels / letters.length;
  if (vowelRatio < 0.10 && letters.length > 6) return true;

  // Everything below is checked per word, not on the space-stripped whole
  // string — otherwise a legitimate multi-word query like "toy ... and
  // physical properties" can fuse across a word boundary ("...andphysical..."
  // -> "ndphys", 6 consonants in a row) and false-trigger.
  if (words.some((w) => /[bcdfghjklmnpqrstvwxyz]{6,}/i.test(w))) return true;

  // A "word-shaped" token (length >= 4) with too few vowels for its length
  // reads as keyboard-mash rather than a real word (e.g. "asdkjh", "zzkk").
  // Short words (< 6 letters) are only flagged if they have literally zero
  // vowels — plenty of real short words ("which", "chahiye") sit close to
  // a raw ratio cutoff and shouldn't be flagged. If at least half of the
  // query's word-shaped tokens look fake, call the whole thing gibberish.
  const qualifying = words.filter((w) => w.length >= 4);
  if (qualifying.length > 0) {
    const suspicious = qualifying.filter((w) => {
      const v = (w.match(/[aeiou]/g) || []).length;
      return w.length >= 6 ? v / w.length < 0.2 : v === 0;
    });
    if (suspicious.length / qualifying.length >= 0.5) return true;
  }
  return false;
}

/**
 * Product groups the knowledge base actually covers (8 standards from the
 * employee-uploaded PDFs: helmets, toys, gold hallmarking). Never list a
 * domain here that we hold no document for — see CLAUDE.md.
 */
const CLARIFICATION_CHIPS = [
  { label: "Helmets", value: "helmet" },
  { label: "Toys", value: "toys" },
  { label: "Gold Jewellery & Hallmarking", value: "gold jewellery" },
];

export interface RouteOptions {
  /** Skip the keyboard-mash detector — set when the text is (or is being treated as) a real non-English language. */
  skipGibberish?: boolean;
}

/**
 * Routes ENGLISH working text (the caller passes the English translation for non-English turns).
 * Reply strings here are English; the caller localizes them into the user's language.
 */
export function routeQuery(
  input: NormalizedInput,
  hasActiveProductInContext: boolean = false,
  opts: RouteOptions = {}
): RouteOutcome {
  const q = input.normalizedText;
  const qLower = q.toLowerCase();

  // 1. Exact Identifier Match (Speed Gate)
  // e.g. "IS 4151", "is4151:2015", "CM/L-1234567", "HUID ABC123"
  const exactIsMatch = q.match(/^IS\s*[:\-]?\s*(\d{1,5}(?:\s*[\-:]?\s*(?:\((?:Part|Pt)\s*\d+\)|(?:Part|Pt)\s*[\-:]?\s*\d+))?)(?::\d{4})?$/i);
  if (exactIsMatch || (input.canonicalStandards.length === 1 && q.length < 25 && !/\b(?:how|what|why|where|can|is|who|which)\b/i.test(qLower))) {
    const std = input.canonicalStandards[0] || { id: q.toUpperCase(), norm: q.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() };
    return {
      kind: "identifier",
      identifier: std.id,
      norm: std.norm,
    };
  }

  // 2. Smalltalk & Greetings
  const greetingsRegex = /^(?:hi|hello|hey|namaste|namaskar|नमस्ते|नमस्कार|good\s*(?:morning|afternoon|evening)|pranam|sup|hlo)(?:\b|\s|$|[!?.,])/iu;
  if (greetingsRegex.test(qLower) && q.split(/\s+/).length <= 3) {
    return {
      kind: "smalltalk",
      lang: input.detectedLanguage,
      reply:
        "Hello! I am BISVEDA. I can help you find Indian Standards, check if BIS certification is mandatory, and locate recognized testing laboratories. Which product are you asking about?",
    };
  }

  // 3. Gibberish Detection
  if (!opts.skipGibberish && isGibberish(q)) {
    return {
      kind: "gibberish",
      message: "The entered text does not appear to be a recognizable query. Please ask about a product, standard, or BIS certification service.",
    };
  }

  // 4. Out-of-Scope Queries (Recipes, weather, entertainment, non-standards)
  const oosPatterns = [
    /\b(?:frappuccino|starbucks|recipe|cook\s*pasta|bake\s*cake|pizza\s*dough)\b/i,
    /\b(?:weather\s*(?:in|today|forecast)|temperature\s*in|will\s*it\s*rain)\b/i,
    /\b(?:cricket\s*score|football\s*match|movie\s*ticket|stock\s*price|horoscope)\b/i,
    /\b(?:quantum\s*teleportation|time\s*travel|warp\s*drive)\b/i,
    // Romanised Hindi / Marathi small talk that must not reach retrieval when the router model is unavailable.
    /\b(?:mausam|havaman|hawaman|baarish|barish|paus\s*padel|tapman|cricket\s*match|match\s*ka\s*score|picture\s*dekh|gaana|khana\s*kaise\s*banaye|recipe\s*bata)\b/i,
  ];
  for (const r of oosPatterns) {
    if (r.test(qLower)) {
      return {
        kind: "out_of_scope",
        topic: q,
        message: "This inquiry is outside the scope of the Bureau of Indian Standards (BIS) and Indian Standards. BISVEDA answers questions on Indian Standards for helmets, toys and gold hallmarking, and finds BIS-recognised labs and hallmarking centres.",
      };
    }
  }

  // 5. Needs Clarification Trap (Fixes B3 & Ambiguous Product Disambiguation)
  if (qLower === "helmet" || qLower === "helmets") {
    return {
      kind: "needs_clarification",
      prompt: "Which type of helmet are you inquiring about?",
      options: [
        { label: "Motorcycle & Two-Wheeler Riders (IS 4151)", value: "motorcycle rider helmet IS 4151" },
        { label: "Industrial & Construction Safety (IS 2925)", value: "industrial safety helmet IS 2925" },
      ],
    };
  }

  // Queries asking for standards/certification/licence but naming NO product, and no active product in conversation
  const isGenericRegulatoryQuery =
    /\b(?:applicable\s*indian\s*standards|applicable\s*standards|which\s*standards?|what\s*standards?|which\s*certification|how\s*to\s*get\s*license|apply\s*for\s*license|bis\s*certificate)\b/i.test(qLower);

  const mentionsManufacturingOrGeneral =
    /\b(?:for\s*manufacturing|for\s*production|for\s*my\s*product|do\s*i\s*need|to\s*sell|in\s*india)\b/i.test(qLower);

  const hasSpecificProduct =
    /\b(?:helmets?|toys?|gold|jewellery|jewelry|hallmark\w*)\b/i.test(qLower) ||
    input.canonicalStandards.length > 0;

  if (isGenericRegulatoryQuery && !hasSpecificProduct && !hasActiveProductInContext) {
    return {
      kind: "needs_clarification",
      prompt: "Which product are you asking about? Please select a product category below or specify your product name:",
      options: CLARIFICATION_CHIPS,
    };
  }

  // 6. Otherwise regular Question
  return {
    kind: "question",
    workingQuery: input.workingEnglishText,
  };
}
