/**
 * BISVEDA — KB build, Stage 3: Embeddings (P1.4)
 *
 * Delegates to the same local bge-m3 embedder used at query time
 * (src/lib/embeddings.ts) so the offline build and the runtime dense
 * search are always the same model, same dimension, same vector space.
 * Cached by the chunk text's sha256 (namespaced by model id, so switching
 * EMBED_MODEL can't silently mix vectors of two different dimensions) in
 * data/kb/.embcache.json (gitignored). No fallback: a failure throws — a
 * missing embedding is honest; a placeholder vector pretending to be one
 * is not (see CLAUDE.md).
 */

import fs from "fs";
import path from "path";
import { generateEmbedding } from "../../src/lib/embeddings";

const PROTOTYPE_ROOT = path.resolve(__dirname, "../..");
const CACHE_PATH = path.join(PROTOTYPE_ROOT, "data", "kb", ".embcache.json");
const MODEL_ID = process.env.EMBED_MODEL || "Xenova/bge-m3";

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

/**
 * Embeds `text` via the local bge-m3 model, cached by `${MODEL_ID}:${cacheKey}`.
 * Throws on failure — callers must not substitute a placeholder vector.
 */
export async function embedText(
  text: string,
  taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT",
  opts: { cacheKey?: string } = {}
): Promise<number[]> {
  const store = loadCache();
  const key = opts.cacheKey ? `${MODEL_ID}:${opts.cacheKey}` : undefined;
  if (key && store[key]) return store[key];

  const vec = await generateEmbedding(text, taskType);
  if (key) {
    store[key] = vec;
    saveCache();
  }
  return vec;
}

/** Embeds a chunk's indexing string ("{standard_id} {clause_title}\n{text}"), cached by sha256. */
export async function embedChunk(standardId: string, clauseTitle: string, text: string, sha256: string): Promise<number[]> {
  const indexed = `${standardId} ${clauseTitle}\n${text}`;
  return embedText(indexed, "RETRIEVAL_DOCUMENT", { cacheKey: sha256 });
}
