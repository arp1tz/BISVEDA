/**
 * BISVEDA — Stage: Conversational Understanding (lib/pipeline/understand.ts, P3.2 + P11.1)
 *
 * Turns the raw turn (message + history + optional image summary + form
 * state) into a structured intent using the Groq fast model in JSON mode.
 *
 * Multilingual (P11.1): the LLM pass also identifies the user's language and
 * script and returns an English translation (`english_query`). Everything
 * deterministic (smalltalk / identifier / out-of-scope routing, canonical FAQs,
 * retrieval) runs on that English text; the answer is written back in the
 * user's language. When the text is clearly plain English the deterministic
 * fast paths run first and the LLM is only used for real questions, exactly as
 * before. If the LLM is unavailable, a lexicon-based fallback (normalize.ts)
 * still classifies language and handles the common phrases.
 *
 * This stage must never crash the turn, and must never invent an intent it
 * isn't confident about (it can always fall back to `kb_question` and let
 * retrieval/trust decide).
 */

import { groqChatJson } from "../llm";
import { routeQuery } from "./route";
import {
  normalizeQuery,
  cleanText,
  detectLanguageInfo,
  extractCanonicalStandards,
  toAsciiDigits,
  LanguageInfo,
} from "./normalize";
import { coerceLanguageTag, baseLanguage, tStatic, translateTo } from "../i18n";
import { parseFormInputsFromText, getFormISchema } from "../tools/form_i";

const CENTRE_RE = /\b(?:hallmark\w*|assay\w*)\s*(?:and\s*hallmarking\s*)?(?:cent(?:re|er)s?|kendra)\b|\bAHCs?\b/i;
const FIND_RE = /\b(?:show|find|list|near(?:est|by)?|where|locate|in\s+[A-Z][a-z]+|kaha(?:n)?|paas|kidhar|around)\b/i;
const ABOUT_STANDARD_RE = /\b(?:requirements?|competence|criteria|IS\s*15820|must\s+(?:meet|have)|what\s+(?:does|do|is|are)\s+(?:a|an|the)?\s*(?:hallmarking|assaying))\b/i;

/**
 * The router model sometimes swaps "show hallmarking centres in Jaipur" (directory) with "what are the
 * competence requirements for a hallmarking centre" (IS 15820 question). Both are easy to tell apart by words.
 */
export function correctDirectoryIntent(intent: Intent, text: string): Intent {
  // "Where can I get X tested", "labs near me", "test kahan karwaye": the lab finder.
  if (
    intent === "kb_question" &&
    /\b(?:test\w*|labs?|laborator\w*|jaanch|janch|chachni)\b/i.test(text) &&
    (/\b(?:where|kaha|kahan|kuthe|near(?:est|by)?|find|list|show|locate)\b/i.test(text) || /\b(?:in|near)\s+(?!IS\b)[A-Z][a-z]+/.test(text))
  ) {
    return "find_labs";
  }
  if (!CENTRE_RE.test(text)) return intent;
  if (ABOUT_STANDARD_RE.test(text)) return intent === "find_ahc" ? "kb_question" : intent;
  if (FIND_RE.test(text) && intent !== "form_i") return "find_ahc";
  return intent;
}

const WANTS_TO_REGISTER_RE =
  /\b(?:i\s+want|i\s+would\s+like|help\s+me|want\s+to|register\s+my|apply\s+for|draft|fill|start|mujhe|karna\s+hai|karni\s+hai|chahta|chahti|banana\s+hai)\b/i;

/** An information question about Form I (what/which/how ...) rather than a request to draft it. */
function isQuestionAboutForm(message: string): boolean {
  const m = message.trim();
  const asks = /^(?:what|which|how|why|when|who|is|are|does|do|can|kya|kaun|kaise|kitne)\b/i.test(m) || /\?\s*$/.test(m);
  return asks && !WANTS_TO_REGISTER_RE.test(m);
}

/** "in Jaipur", "near Navi Mumbai", "Jaipur mein", "Pune madhye": a place name for the lab/centre finders. */
function extractCity(text: string): string | undefined {
  const m =
    text.match(/\b(?:in|near|at|around|nearby)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/) ||
    text.match(/\b([A-Z][a-zA-Z]+)\s+(?:mein|me|mai|madhe|madhye|jawal|ke\s+paas|paas)\b/i);
  const city = m?.[1]?.trim();
  if (!city || /^(?:India|Indian|IS|BIS|The|My|Our|Which|What)$/i.test(city)) return undefined;
  return city;
}

/** A draft has started (some fields) but required items are still missing. */
function isFormIIncomplete(formState?: Record<string, unknown>): boolean {
  if (!formState || Object.keys(formState).length === 0) return false;
  return getFormISchema().some((f) => f.required && !(typeof formState[f.key] === "string" && (formState[f.key] as string).trim()));
}

export type Intent =
  | "kb_question"
  | "find_labs"
  | "find_ahc"
  | "hallmark"
  | "mark_check"
  | "form_i"
  | "smalltalk"
  | "out_of_scope"
  | "clarify"
  | "gibberish"
  | "identifier";

export interface ConversationTurnSummary {
  role: "user" | "assistant";
  text: string; // for assistant turns, a short summary of what was answered, not the full prose
}

export interface UnderstandInput {
  message: string;
  history?: ConversationTurnSummary[]; // last few turns, already trimmed by the caller
  imageSummary?: string; // e.g. "Photo shows a motorcycle helmet, IS 4151 visible on the label"
  formState?: Record<string, unknown>;
  /**
   * P12.4: the interface language chosen in the language picker (a base code like "mr", "ta",
   * no "-Latn" suffix). Only takes effect when the message itself is in English — a message
   * already typed in another language keeps replying in that language, as before.
   */
  preferredLanguage?: string;
}

export interface UnderstandResult {
  intent: Intent;
  standalone_query: string; // the query rewritten to stand alone, in English, for retrieval
  /** The current message alone, translated to English (equal to the message when it is already English). */
  english_query: string;
  standards: string[]; // canonical IS ids mentioned or implied
  product?: string;
  city?: string;
  form_updates?: Record<string, unknown>;
  clarify?: { prompt: string; options: Array<{ label: string; value: string }> };
  /** Set only for smalltalk/gibberish/out_of_scope — the reply text, already in the user's language. */
  fastReply?: string;
  /** Language tag: "en", "hi", "mr", "ta"... or "hi-Latn"/"mr-Latn" for Roman-letter typing. */
  language: string;
  usedFallback: boolean;
}

interface LlmParsed {
  intent?: string;
  standalone_query?: string;
  english_query?: string;
  language?: string;
  script?: string;
  standards?: unknown;
  product?: unknown;
  city?: unknown;
  form_updates?: Record<string, unknown> | null;
}

const SYSTEM_PROMPT = `You are the intent router for BISVEDA, a BIS (Bureau of Indian Standards) assistant whose knowledge base covers exactly 8 standards: IS 4151 & IS 2925 (helmets), IS 15644 & IS 9873 Part 1 & Part 3 (toys), IS 1417, IS 1418 & IS 15820 (gold hallmarking), plus a Form I (jeweller hallmarking registration) template.

Users write in any Indian language — Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam, Punjabi, Odia, Urdu, Assamese — in native script OR typed in Roman letters (e.g. "tu ka karu shaktos" is Marathi for "what can you do?", "helmet cha standard konta ahe" is Marathi for "which standard applies to helmets", "sone ka hallmark kaise check kare" is Hindi). Code-mixed text is common. Understand the meaning first, then route. When translating, use the product words BIS covers: khilone / khelne / khelnyache / bomma = toys; sone / sona / sonyache = gold; gahne / dagine = jewellery; topi (for riding) = helmet.

Given the user's message, the recent conversation, and an optional image summary, output strict JSON:
{
  "language": "ISO 639-1 code of the message language (en, hi, mr, ta, te, bn, gu, kn, ml, pa, or, ur, as)",
  "script": "native" or "roman" (roman = an Indian language typed in Roman letters; English is "roman"),
  "english_query": "faithful English translation of the CURRENT message alone (copy it unchanged if already English). Keep IS numbers and product names.",
  "intent": "kb_question" | "find_labs" | "find_ahc" | "hallmark" | "mark_check" | "form_i" | "smalltalk" | "out_of_scope" | "clarify" | "gibberish",
  "standalone_query": "the question rewritten in ENGLISH so it stands alone: resolve every pronoun/reference (it, this, that, the same one) using recent_conversation and name the product or IS number explicitly. Example: recent 'tell me about IS 4151' + message 'what impact test does it need?' -> 'What impact test does IS 4151 require?'",
  "standards": ["IS 4151"],
  "product": "helmet" or null,
  "city": "Pune" or null,
  "form_updates": { "name_of_jeweller": "...", "outlet_address": "..." } or null
}

Rules:
- "find_labs": user asks where to get something tested, or for testing labs.
- "find_ahc": user asks for hallmarking / assaying centres.
- "hallmark": user asks about gold purity, HUID, or hallmark marks specifically.
- "mark_check": user asks to verify an ISI mark or CM/L licence number.
- "form_i": user wants to register as a jeweller, draft Form I, or is providing registration details (name, address, constitution, turnover, contact).
- "smalltalk": greetings, thanks, pure chit-chat, or asking what you can do / who you are.
- "out_of_scope": genuinely unrelated to products, standards, or certification — weather, sports, recipes, entertainment, general trivia. BIS certifies a huge range of everyday products, so a real product/safety/certification question is presumptively "kb_question" even if it's a product we don't happen to hold a document for (retrieval will honestly report that separately) — do NOT classify a plausible product-safety or certification question as "out_of_scope" just because it isn't one of the 8 standards above.
- "clarify": the product is too ambiguous to search (e.g. bare "helmet" with no other context and no prior turn already established which kind).
- "gibberish": only when the text is not meaningful in ANY language (random keys). Romanized Indian-language text is NOT gibberish.
- Otherwise "kb_question".
- If the user provides business details like name or address while a Form I application is in progress or implied, populate "form_updates" with corresponding keys and choose "form_i".
- If the current message doesn't name a product/standard but the conversation clearly continues one, carry it into "standalone_query" and "standards".
- Never invent a standard id. Only use ids from the 8 above, or one explicitly given in the message.`;

function trimHistory(history: ConversationTurnSummary[] = [], maxTurns = 6): ConversationTurnSummary[] {
  return history.slice(-maxTurns);
}

const VALID_INTENTS: Intent[] = [
  "kb_question",
  "find_labs",
  "find_ahc",
  "hallmark",
  "mark_check",
  "form_i",
  "smalltalk",
  "out_of_scope",
  "clarify",
  "gibberish",
];

async function callIntentLlm(input: UnderstandInput): Promise<LlmParsed | null> {
  try {
    const history = trimHistory(input.history);
    const historyText = history.map((h) => `${h.role}: ${h.text}`).join("\n");
    const userPayload = JSON.stringify({
      message: input.message,
      recent_conversation: historyText || null,
      image_summary: input.imageSummary || null,
      form_state: input.formState || null,
    });
    return await groqChatJson<LlmParsed>(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPayload },
      ],
      { model: "fast", temperature: 0, maxTokens: 600 }
    );
  } catch (err) {
    console.warn("[understand] LLM routing failed, using deterministic fallback:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Language tag: LLM answer wins, except a definite native script is never downgraded to English. */
function resolveLanguage(det: LanguageInfo, llm: LlmParsed | null): string {
  if (!llm) return det.tag;
  const fromLlm = coerceLanguageTag(llm.language, llm.script, det.tag);
  if (baseLanguage(fromLlm) === "en" && det.indicEvidence) return det.tag;
  // A native script other than Devanagari identifies the language by itself, and Marathi markers in
  // Devanagari are reliable — the LLM sometimes calls Marathi "Hindi", so the script evidence wins there.
  if (det.script === "native" && det.language !== "hi") return det.tag;
  if (det.script === "native" && !["hi", "mr"].includes(baseLanguage(fromLlm))) return det.tag;
  return fromLlm;
}

function uniqueStandards(...groups: string[][]): string[] {
  const out: string[] = [];
  for (const g of groups) for (const s of g) if (s && !out.includes(s)) out.push(s);
  return out;
}

export async function understandTurn(input: UnderstandInput): Promise<UnderstandResult> {
  const result = await understandTurnInner(input);
  // P12.4: a picked interface language only overrides the reply language for an English message
  // (a message already in some other language keeps replying in that language, as before).
  if (input.preferredLanguage && baseLanguage(input.preferredLanguage) !== "en" && baseLanguage(result.language) === "en") {
    return { ...result, language: baseLanguage(input.preferredLanguage) };
  }
  return result;
}

async function understandTurnInner(input: UnderstandInput): Promise<UnderstandResult> {
  const cleaned = cleanText(input.message).replace(/^\[(?:Attachment|Photo|File):\s*[^\]]+\]\s*/i, "");
  const det = detectLanguageInfo(cleaned);
  const hasHistory = Boolean(input.history && input.history.length > 0);

  // Non-English (or unrecognizable) text: identify language + translate first, THEN route on the English.
  let llm: LlmParsed | null = null;
  let llmTried = false;
  if (!det.confidentEnglish) {
    llm = await callIntentLlm(input);
    llmTried = true;
  }

  const lang = resolveLanguage(det, llm);
  const nonEnglish = baseLanguage(lang) !== "en";

  const llmEnglish = typeof llm?.english_query === "string" ? llm.english_query.trim() : "";
  const englishInput = llmEnglish || (det.confidentEnglish ? cleaned : normalizeQuery(cleaned).workingEnglishText);
  const normalized = normalizeQuery(englishInput);
  const originalStandards = extractCanonicalStandards(toAsciiDigits(cleaned));
  const canonical = uniqueStandards(
    normalized.canonicalStandards.map((c) => c.id),
    originalStandards.map((c) => c.id)
  );

  const localize = (text: string, key?: "greeting" | "out_of_scope" | "gibberish") =>
    nonEnglish ? (key ? tStatic(key, lang) : translateTo(text, lang)) : Promise.resolve(text);

  // Deterministic fast paths never need the LLM: identifiers, smalltalk, gibberish and out-of-scope.
  const routed = routeQuery(normalized, hasHistory, { skipGibberish: det.indicEvidence || nonEnglish });
  if (routed.kind === "identifier") {
    return {
      intent: "identifier",
      standalone_query: normalized.workingEnglishText,
      english_query: englishInput,
      standards: [routed.identifier],
      language: lang,
      usedFallback: true,
    };
  }
  if (routed.kind === "smalltalk" || routed.kind === "out_of_scope") {
    const key = routed.kind === "smalltalk" ? "greeting" : "out_of_scope";
    const reply = routed.kind === "smalltalk" ? routed.reply : routed.message;
    return {
      intent: routed.kind,
      standalone_query: normalized.workingEnglishText,
      english_query: englishInput,
      standards: [],
      language: lang,
      usedFallback: true,
      fastReply: await localize(reply, key),
    };
  }
  if (routed.kind === "gibberish") {
    return {
      intent: "gibberish",
      standalone_query: normalized.workingEnglishText,
      english_query: englishInput,
      standards: [],
      language: lang,
      usedFallback: true,
      fastReply: await localize(routed.message, "gibberish"),
    };
  }
  // The LLM already named the product for a non-English turn: don't ask "which product?" again.
  const llmNamedProduct = nonEnglish && typeof llm?.product === "string" && llm.product.trim().length > 0;
  if (routed.kind === "needs_clarification" && !llmNamedProduct) {
    const [prompt, ...labels] = nonEnglish
      ? await Promise.all([localize(routed.prompt), ...routed.options.map((o) => localize(o.label))])
      : [routed.prompt, ...routed.options.map((o) => o.label)];
    return {
      intent: "clarify",
      standalone_query: normalized.workingEnglishText,
      english_query: englishInput,
      standards: [],
      language: lang,
      usedFallback: true,
      clarify: { prompt, options: routed.options.map((o, i) => ({ label: labels[i] || o.label, value: o.value })) },
    };
  }

  // Real question: use the LLM result (call it now if the English fast paths ran first).
  if (!llm && !llmTried) llm = await callIntentLlm(input);

  const deterministicFormInputs = parseFormInputsFromText(input.message);

  if (llm) {
    let intent: Intent = VALID_INTENTS.includes(llm.intent as Intent) ? (llm.intent as Intent) : "kb_question";
    // "gibberish" from the LLM is only trusted for text we could not positively identify as English.
    if (intent === "gibberish" && det.confidentEnglish) intent = "kb_question";
    if (intent === "gibberish") {
      return {
        intent,
        standalone_query: englishInput,
        english_query: englishInput,
        standards: [],
        language: lang,
        usedFallback: false,
        fastReply: await tStatic("gibberish", lang),
      };
    }

    intent = correctDirectoryIntent(intent, `${cleaned} ${englishInput}`);
    // Asking for a standard/certification for some product is a BIS question even when we hold no document
    // for that product: the answer is "not in our documents" plus the catalogue link, not "off-topic".
    if (intent === "out_of_scope" && /\b(?:standards?|IS\s*\d+|ISI|BIS|certif\w*|licen[cs]e|specification)\b/i.test(englishInput)) {
      intent = "kb_question";
    }

    const hasFormInputs =
      Object.keys(deterministicFormInputs).length > 0 || (llm.form_updates && Object.keys(llm.form_updates).length > 0);
    // While a Form I draft is still missing required items, plain replies ("Proprietorship", "none") belong to the
    // form. A tool request, smalltalk or an actual question leaves the form so the user is never stuck in it.
    const formInProgress = isFormIIncomplete(input.formState);
    const leavesForm =
      ["find_labs", "find_ahc", "hallmark", "mark_check", "smalltalk"].includes(intent) || /\?\s*$/.test(input.message.trim());
    if ((hasFormInputs && intent !== "find_ahc" && intent !== "find_labs") || (formInProgress && !leavesForm)) {
      intent = "form_i";
    }
    // "What fields does Form I need?" asks about the form; only a request to register/draft (or an answer
    // while drafting) starts the drafting flow.
    const noFormYet = !input.formState || Object.keys(input.formState).length === 0;
    if (intent === "form_i" && noFormYet && !hasFormInputs && isQuestionAboutForm(input.message)) {
      intent = "kb_question";
    }

    const mergedFormUpdates = { ...((llm.form_updates as Record<string, unknown>) || {}), ...deterministicFormInputs };
    // The model writes ids loosely ("IS 9873 Part 1"); map each to the canonical id ("IS 9873 (Part 1)") or the
    // store lookup downstream silently drops it and retrieval loses that standard.
    const llmStandards = uniqueStandards(
      (Array.isArray(llm.standards) ? llm.standards.filter((s): s is string => typeof s === "string") : []).map(
        (s) => extractCanonicalStandards(s)[0]?.id ?? s
      )
    );

    return {
      intent,
      standalone_query:
        typeof llm.standalone_query === "string" && llm.standalone_query.trim() ? llm.standalone_query.trim() : englishInput,
      english_query: englishInput,
      standards: llmStandards.length > 0 ? llmStandards : canonical,
      product: typeof llm.product === "string" ? llm.product : undefined,
      city: typeof llm.city === "string" && llm.city.trim() ? llm.city : extractCity(cleaned),
      form_updates: Object.keys(mergedFormUpdates).length > 0 ? mergedFormUpdates : undefined,
      language: lang,
      usedFallback: false,
    };
  }

  // LLM unavailable: deterministic fallback.
  const isForm =
    Object.keys(deterministicFormInputs).length > 0 || Boolean(input.formState && Object.keys(input.formState).length > 0);
  return {
    intent: isForm ? "form_i" : correctDirectoryIntent("kb_question", `${cleaned} ${englishInput}`),
    standalone_query: englishInput,
    english_query: englishInput,
    standards: canonical,
    city: extractCity(cleaned),
    form_updates: Object.keys(deterministicFormInputs).length > 0 ? deterministicFormInputs : undefined,
    language: lang,
    usedFallback: true,
  };
}
