/**
 * BISVEDA — Stage: Conversational Understanding (lib/pipeline/understand.ts, P3.2)
 *
 * Turns the raw turn (message + history + optional image summary + form
 * state) into a structured intent using the Groq fast model in JSON mode.
 * Falls back to the deterministic regexes in route.ts if the LLM call
 * fails or returns something unusable — this stage must never crash the
 * turn, and must never invent an intent it isn't confident about (it can
 * always fall back to `kb_question` and let retrieval/trust decide).
 *
 * `find_labs` / `find_ahc` / `hallmark` / `mark_check` / `form_i` are real
 * intents in the contract (P5 builds their tools). Until P5 lands, the
 * orchestrator treats them as `kb_question` — an honest "search what we
 * have" rather than a broken feature.
 */

import { groqChatJson } from "../llm";
import { routeQuery, RouteOutcome } from "./route";
import { normalizeQuery } from "./normalize";

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
}

export interface UnderstandResult {
  intent: Intent;
  standalone_query: string; // the query rewritten to stand alone, for retrieval
  standards: string[]; // canonical IS ids mentioned or implied
  product?: string;
  city?: string;
  form_updates?: Record<string, unknown>;
  clarify?: { prompt: string; options: Array<{ label: string; value: string }> };
  /** Set only for smalltalk/gibberish/out_of_scope — the deterministic reply text from route.ts, so the orchestrator doesn't need to recompute it. */
  fastReply?: string;
  language: string;
  usedFallback: boolean;
}

import { parseFormInputsFromText } from "../tools/form_i";

const SYSTEM_PROMPT = `You are the intent router for BISVEDA, a BIS (Bureau of Indian Standards) assistant whose knowledge base covers exactly 8 standards: IS 4151 & IS 2925 (helmets), IS 15644 & IS 9873 Part 1 & Part 3 (toys), IS 1417, IS 1418 & IS 15820 (gold hallmarking), plus a Form I (jeweller hallmarking registration) template.

Given the user's message, the recent conversation, and an optional image summary, output strict JSON:
{
  "intent": "kb_question" | "find_labs" | "find_ahc" | "hallmark" | "mark_check" | "form_i" | "smalltalk" | "out_of_scope" | "clarify",
  "standalone_query": "the question rewritten to stand alone without needing the conversation history",
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
- "smalltalk": greetings, thanks, pure chit-chat.
- "out_of_scope": genuinely unrelated to products, standards, or certification — weather, sports, recipes, entertainment, general trivia. BIS certifies a huge range of everyday products, so a real product/safety/certification question is presumptively "kb_question" even if it's a product we don't happen to hold a document for (retrieval will honestly report that separately) — do NOT classify a plausible product-safety or certification question as "out_of_scope" just because it isn't one of the 8 standards above.
- "clarify": the product is too ambiguous to search (e.g. bare "helmet" with no other context and no prior turn already established which kind).
- Otherwise "kb_question".
- If the user provides business details like name or address while a Form I application is in progress or implied, populate "form_updates" with corresponding keys and choose "form_i".
- If the current message doesn't name a product/standard but the conversation clearly continues one, carry it into "standalone_query" and "standards".
- Never invent a standard id. Only use ids from the 8 above, or one explicitly given in the message.`;

function trimHistory(history: ConversationTurnSummary[] = [], maxTurns = 6): ConversationTurnSummary[] {
  return history.slice(-maxTurns);
}

export async function understandTurn(input: UnderstandInput): Promise<UnderstandResult> {
  const normalized = normalizeQuery(input.message);

  // Deterministic fast paths never go through the LLM: identifiers, smalltalk,
  // gibberish and out-of-scope are cheap and reliable to catch with regex.
  const routed = routeQuery(normalized, Boolean(input.history && input.history.length > 0));
  if (routed.kind === "identifier") {
    return {
      intent: "identifier",
      standalone_query: normalized.workingEnglishText,
      standards: [routed.identifier],
      language: normalized.detectedLanguage,
      usedFallback: true,
    };
  }
  if (routed.kind === "smalltalk" || routed.kind === "gibberish" || routed.kind === "out_of_scope") {
    return {
      intent: routed.kind,
      standalone_query: normalized.workingEnglishText,
      standards: [],
      language: routed.kind === "smalltalk" ? routed.lang : normalized.detectedLanguage,
      usedFallback: true,
      fastReply: routed.kind === "smalltalk" ? routed.reply : routed.message,
    };
  }
  if (routed.kind === "needs_clarification") {
    return {
      intent: "clarify",
      standalone_query: normalized.workingEnglishText,
      standards: [],
      language: normalized.detectedLanguage,
      usedFallback: true,
      clarify: { prompt: routed.prompt, options: routed.options },
    };
  }

  try {
    const history = trimHistory(input.history);
    const historyText = history.map((h) => `${h.role}: ${h.text}`).join("\n");
    const userPayload = JSON.stringify({
      message: input.message,
      recent_conversation: historyText || null,
      image_summary: input.imageSummary || null,
      form_state: input.formState || null,
    });

    const parsed = await groqChatJson<Partial<UnderstandResult> & { intent?: string }>(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPayload },
      ],
      { model: "fast", temperature: 0, maxTokens: 500 }
    );

    const deterministicFormInputs = parseFormInputsFromText(input.message);

    const validIntents: Intent[] = [
      "kb_question",
      "find_labs",
      "find_ahc",
      "hallmark",
      "mark_check",
      "form_i",
      "smalltalk",
      "out_of_scope",
      "clarify",
    ];
    let intent: Intent = validIntents.includes(parsed.intent as Intent) ? (parsed.intent as Intent) : "kb_question";

    // If deterministic form fields were found or formState is actively being drafted, keep in form_i
    const hasFormInputs =
      Object.keys(deterministicFormInputs).length > 0 ||
      (parsed.form_updates && Object.keys(parsed.form_updates).length > 0);

    if (hasFormInputs || (input.formState && Object.keys(input.formState).length > 0 && intent !== "smalltalk")) {
      intent = "form_i";
    }

    const mergedFormUpdates = {
      ...((parsed.form_updates as Record<string, unknown>) || {}),
      ...deterministicFormInputs,
    };

    return {
      intent,
      standalone_query:
        typeof parsed.standalone_query === "string" && parsed.standalone_query.trim()
          ? parsed.standalone_query.trim()
          : normalized.workingEnglishText,
      standards: Array.isArray(parsed.standards) ? parsed.standards.filter((s) => typeof s === "string") : normalized.canonicalStandards.map((c) => c.id),
      product: typeof parsed.product === "string" ? parsed.product : undefined,
      city: typeof parsed.city === "string" ? parsed.city : undefined,
      form_updates: Object.keys(mergedFormUpdates).length > 0 ? mergedFormUpdates : undefined,
      language: normalized.detectedLanguage,
      usedFallback: false,
    };
  } catch (err) {
    console.warn("[understand] LLM routing failed, falling back to kb_question:", err instanceof Error ? err.message : err);
    const deterministicFormInputs = parseFormInputsFromText(input.message);
    const isForm =
      Object.keys(deterministicFormInputs).length > 0 ||
      Boolean(input.formState && Object.keys(input.formState).length > 0);

    return {
      intent: isForm ? "form_i" : "kb_question",
      standalone_query: normalized.workingEnglishText,
      standards: normalized.canonicalStandards.map((c) => c.id),
      form_updates: Object.keys(deterministicFormInputs).length > 0 ? deterministicFormInputs : undefined,
      language: normalized.detectedLanguage,
      usedFallback: true,
    };
  }
}
