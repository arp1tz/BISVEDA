/**
 * BISVEDA — LLM client (P3.1)
 *
 * Model ids come from env only, with defaults that were verified against
 * the providers' real APIs before being hardcoded here (not guessed):
 *  - Groq: `GET https://api.groq.com/openai/v1/models` listed
 *    `openai/gpt-oss-120b` and `openai/gpt-oss-20b`; both were then tested
 *    with a real chat completion (120b plain text, 20b JSON mode) and both
 *    returned 200 with the expected shape.
 *  - Gemini: `GET https://generativelanguage.googleapis.com/v1beta/models`
 *    listed `gemini-3.8-flash` / `gemini-3.6-flash` (both real, current
 *    models on this account — despite an earlier, incorrect note in
 *    TODO.md claiming otherwise) and `gemini-embedding-001`, which was
 *    exercised directly via `embedContent` in P1 and returned real 768-d
 *    vectors.
 */

const GROQ_CHAT_MODEL = process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b";
const GROQ_FAST_MODEL = process.env.GROQ_FAST_MODEL || "openai/gpt-oss-20b";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqChatOptions {
  model?: "chat" | "fast";
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
}

/**
 * Calls Groq's OpenAI-compatible chat completion endpoint. Throws on any
 * failure (missing key, HTTP error, empty response) — callers decide the
 * fallback (evidence-only template, regex-based understanding, etc.).
 */
export async function groqChat(messages: ChatMessage[], opts: GroqChatOptions = {}): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set.");

  const model = opts.model === "fast" ? GROQ_FAST_MODEL : GROQ_CHAT_MODEL;
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 600,
  };
  if (opts.jsonMode) body.response_format = { type: "json_object" };
  // Both gpt-oss models "think" before answering, and that reasoning eats
  // into max_tokens — observed: gpt-oss-120b once spent its whole 500-token
  // budget reasoning and returned the single visible word "IS". Capping
  // effort to "low" leaves real budget for the actual answer.
  body.reasoning_effort = "low";

  // Free-tier Groq limits tokens per minute; on a 429 the response says how long to wait
  // ("Please try again in 562.5ms" / "5.9s"). Wait that long (capped) and retry, so a busy
  // minute degrades to a slower answer rather than a fallback answer.
  let res: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 12000),
    });
    if (res.status !== 429 || attempt === 2) break;
    const errText = await res.clone().text().catch(() => "");
    const m = errText.match(/try again in ([\d.]+)\s*(ms|s)\b/i);
    const waitMs = m ? Math.ceil(parseFloat(m[1]) * (m[2].toLowerCase() === "ms" ? 1 : 1000)) + 250 : 2000;
    if (waitMs > 9000) break;
    await new Promise((r) => setTimeout(r, waitMs));
  }

  if (!res || !res.ok) {
    const errBody = (await res?.text().catch(() => "")) ?? "";
    throw new Error(`Groq chat HTTP ${res?.status}: ${errBody.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Groq chat returned an empty response.");
  }
  return content;
}

/** Convenience: calls groqChat with jsonMode and parses the result. Throws on invalid JSON. */
export async function groqChatJson<T = unknown>(messages: ChatMessage[], opts: GroqChatOptions = {}): Promise<T> {
  const raw = await groqChat(messages, { ...opts, jsonMode: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Groq chat JSON mode returned invalid JSON: ${raw.slice(0, 200)}`);
  }
}
