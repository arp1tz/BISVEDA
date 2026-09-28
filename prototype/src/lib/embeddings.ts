/**
 * BISVEDA Vector Embeddings Service
 * Google Gemini embedding model (768 dimensions). No fallback: a failure
 * throws so the caller can decide how to degrade (e.g. `kb/bm25.ts`'s
 * `denseSearch` catches this and returns no dense results for that turn,
 * rather than ever returning a fake vector dressed up as a real one).
 */

const EMBEDDING_DIMENSION = 768;
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";

/**
 * Generates a 768-dimensional embedding vector for a given text.
 * Uses RETRIEVAL_QUERY by default for query-time search, or RETRIEVAL_DOCUMENT at ingestion.
 * Throws if GEMINI_API_KEY is unset, the request fails, or the response
 * doesn't have the expected shape.
 */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callEmbed(apiKey: string, cleanText: string, taskType: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text: cleanText }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSION,
      }),
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Gemini embed HTTP ${res.status}: ${body.slice(0, 200)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const values: number[] = data.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSION) {
    throw new Error("Gemini embed returned an unexpected shape.");
  }
  return values;
}

/**
 * Generates a 768-dim embedding. Throws if GEMINI_API_KEY is unset, the
 * request fails after retries, or the response is malformed. A 429 (the
 * free tier's per-minute quota) gets 2 short retries — worth it for a
 * live query the user is waiting on — before giving up; callers (e.g.
 * `kb/bm25.ts`'s denseSearch) catch the throw and degrade gracefully
 * rather than substitute a fake vector.
 */
export async function generateEmbedding(
  text: string,
  taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT" = "RETRIEVAL_QUERY"
): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  const cleanText = text.slice(0, 8000).trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set — cannot generate a real embedding.");
  if (!cleanText) throw new Error("generateEmbedding called with empty text.");

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await callEmbed(apiKey, cleanText, taskType);
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      if (status === 429 && attempt < 3) {
        await sleep(1200 * attempt);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Batch generate embeddings for multiple texts. Used only by admin/ingestion
 * tooling now (the KB build itself uses scripts/kb/embed.ts, which has its
 * own retry/rate-limit pacing).
 */
export async function generateBatchEmbeddings(
  texts: string[],
  concurrency = 5
): Promise<number[][]> {
  const results: number[][] = new Array(texts.length);
  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    const batchPromises = batch.map((t) => generateEmbedding(t, "RETRIEVAL_DOCUMENT"));
    const batchResults = await Promise.all(batchPromises);
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j];
    }
  }
  return results;
}
