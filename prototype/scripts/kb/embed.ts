/**
 * BISVEDA — KB build, Stage 3: Embeddings (P1.4)
 *
 * Calls Gemini's `gemini-embedding-001` for 768-dim vectors, cached by the
 * chunk text's sha256 in data/kb/.embcache.json (gitignored). No fallback:
 * a failure after retries throws. A missing embedding is honest; a hash
 * vector pretending to be one is not — see CLAUDE.md.
 */

import fs from "fs";
import path from "path";

const PROTOTYPE_ROOT = path.resolve(__dirname, "../..");
const CACHE_PATH = path.join(PROTOTYPE_ROOT, "data", "kb", ".embcache.json");
const EMBEDDING_DIMENSION = 768;
const MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";

type Cache = Record<string, number[]>;

let cache: Cache | null = null;

function loadCache(): Cache {
  if (cache) return cache;
  if (fs.existsSync(CACHE_PATH)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
      return cache!;
    } catch {
      // corrupt cache file — start fresh rather than fail the whole build
    }
  }
  cache = {};
  return cache;
}

function saveCache() {
  if (!cache) return;
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf-8");
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(text: string, taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT"): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Embeddings require it — there is no fallback.");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${MODEL}`,
        content: { parts: [{ text: text.slice(0, 8000) }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSION,
      }),
      signal: AbortSignal.timeout(20000),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Gemini embed HTTP ${res.status}: ${body.slice(0, 300)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const values: number[] | undefined = data?.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSION) {
    throw new Error(`Gemini embed returned an unexpected shape: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return values;
}

/**
 * Embeds `text`, retrying up to 3 times with backoff. Throws if all retries
 * fail — callers must not substitute a placeholder vector.
 */
export async function embedText(
  text: string,
  taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT",
  opts: { cacheKey?: string } = {}
): Promise<number[]> {
  const store = loadCache();
  const key = opts.cacheKey;
  if (key && store[key]) return store[key];

  let lastErr: unknown;
  const MAX_ATTEMPTS = 6;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const vec = await callGemini(text, taskType);
      if (key) {
        store[key] = vec;
        saveCache();
      }
      return vec;
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      if (attempt < MAX_ATTEMPTS) {
        // 429 = per-minute quota; wait it out rather than hammer the API.
        const waitMs = status === 429 ? 20000 : 500 * attempt;
        await sleep(waitMs);
      }
    }
  }
  throw new Error(`embedText failed after ${MAX_ATTEMPTS} attempts: ${(lastErr as Error)?.message || lastErr}`);
}

/** Embeds a chunk's indexing string ("{standard_id} {clause_title}\n{text}"), cached by sha256. */
export async function embedChunk(standardId: string, clauseTitle: string, text: string, sha256: string): Promise<number[]> {
  const indexed = `${standardId} ${clauseTitle}\n${text}`;
  return embedText(indexed, "RETRIEVAL_DOCUMENT", { cacheKey: sha256 });
}
