/**
 * BISVEDA Vector Embeddings Service
 *
 * Local BAAI/bge-m3 (1024-dim, multilingual) via transformers.js — this is
 * the embedding model the architecture doc actually specifies (D6 in
 * docs/DECISIONS.md: "bge-m3 ... Best multilingual dense+sparse. 1024-dim.
 * Cross-lingual. Open source", served locally, not a hosted API). Runs
 * on-CPU after the ONNX weights are cached once from the Hugging Face Hub
 * on first use — no API key, no request quota, no fallback vector.
 *
 * bge-m3, unlike earlier BGE versions, needs no "query:"/"passage:"
 * instruction prefix for retrieval — the query/document text is embedded
 * as-is (per BAAI's own usage guidance for this model).
 */

import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

const EMBEDDING_DIMENSION = 1024;
const MODEL_ID = process.env.EMBED_MODEL || "Xenova/bge-m3";

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL_ID) as unknown as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

/**
 * Generates a 1024-dim bge-m3 embedding. Throws if the model fails to load
 * or the text is empty — callers must not substitute a placeholder vector
 * (see kb/bm25.ts's denseSearch, which catches this and skips dense search
 * for that turn rather than faking a result).
 */
export async function generateEmbedding(
  text: string,
  _taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT" = "RETRIEVAL_QUERY"
): Promise<number[]> {
  const cleanText = text.slice(0, 8000).trim();
  if (!cleanText) throw new Error("generateEmbedding called with empty text.");

  const extractor = await getExtractor();
  const output = await extractor(cleanText, { pooling: "mean", normalize: true });
  const values = Array.from(output.data as unknown as ArrayLike<number>);
  if (values.length !== EMBEDDING_DIMENSION) {
    throw new Error(`bge-m3 returned an unexpected shape: ${values.length} dims (expected ${EMBEDDING_DIMENSION}).`);
  }
  return values;
}

/**
 * Batch generate embeddings for multiple texts. Local compute has no
 * per-minute quota to pace against — this just runs them in sequence
 * (the model itself is single-instance and not thread-safe to call
 * concurrently from one process).
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const t of texts) results.push(await generateEmbedding(t, "RETRIEVAL_DOCUMENT"));
  return results;
}
