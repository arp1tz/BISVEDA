/**
 * BISVEDA Vector Embeddings Service
 * Uses Google Gemini embedding models (768 dimensions) with deterministic fallback.
 */

const EMBEDDING_DIMENSION = 768;

/**
 * Generates a 768-dimensional embedding vector for a given text.
 * Uses RETRIEVAL_QUERY by default for query-time search, or RETRIEVAL_DOCUMENT at ingestion.
 */
export async function generateEmbedding(
  text: string,
  taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT" = "RETRIEVAL_QUERY"
): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  const cleanText = text.slice(0, 8000).trim();

  if (apiKey && cleanText.length > 0) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text: cleanText }] },
            taskType,
            outputDimensionality: EMBEDDING_DIMENSION,
          }),
          signal: AbortSignal.timeout(10000),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const values: number[] = data.embedding?.values;
        if (Array.isArray(values) && values.length === EMBEDDING_DIMENSION) {
          return values;
        }
      }
    } catch {
      // Fall through to deterministic fallback
    }
  }

  return generateDeterministicFallback(cleanText);
}

/**
 * Batch generate embeddings for multiple texts at ingestion time.
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

/**
 * Deterministic pseudo-embedding generator ensuring 768 dimensions with unit norm.
 */
function generateDeterministicFallback(text: string): number[] {
  const vec = new Array(EMBEDDING_DIMENSION).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
    const idx = Math.abs(hash) % EMBEDDING_DIMENSION;
    vec[idx] += 1.0;
  }

  // Normalize to unit length
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm) || 1.0;
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    vec[i] = vec[i] / norm;
  }

  return vec;
}
