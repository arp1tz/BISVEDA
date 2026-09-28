/**
 * BISVEDA — Knowledge base build orchestrator (P1.7)
 *
 * Runs the whole KB pipeline end to end: registry check -> parse -> chunk ->
 * embed -> standards.json -> graph.json. Idempotent (raw parses and
 * embeddings are cached; re-running is fast and safe).
 *
 * Usage: npm run kb:build          (from prototype/)
 *        npm run kb:build -- --force-parse   (ignore the raw-parse cache)
 */

import fs from "fs";
import path from "path";
import { loadEnv } from "./env";
loadEnv();

import { DOCS_DIR, EXCLUDED, SOURCES } from "./sources";
import { parseSource, contentPages } from "./parse";
import { chunkDocument } from "./chunk";
import { embedChunk } from "./embed";
import { buildStandardRecord } from "./standards";
import { buildGraph } from "./graph";
import type { KbChunk, RawPage } from "./types";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const PROTOTYPE_ROOT = path.resolve(__dirname, "../..");
const KB_DIR = path.join(PROTOTYPE_ROOT, "data", "kb");
const FORCE_PARSE = process.argv.includes("--force-parse");

function assertRegistryCoversFolder() {
  const dir = path.join(REPO_ROOT, DOCS_DIR);
  const filesOnDisk = fs.readdirSync(dir).filter((f) => !fs.statSync(path.join(dir, f)).isDirectory());
  const known = new Set([...SOURCES.map((s) => s.file), ...EXCLUDED.map((e) => e.file)]);
  const unregistered = filesOnDisk.filter((f) => !known.has(f));
  if (unregistered.length > 0) {
    throw new Error(
      `Files in "${DOCS_DIR}" are not registered in scripts/kb/sources.ts (SOURCES or EXCLUDED): ${unregistered.join(", ")}\n` +
        `Every file must be explicitly included or explicitly excluded with a reason — nothing enters the knowledge base silently.`
    );
  }
}

/**
 * Embeds sequentially (the local bge-m3 model instance isn't safe to call
 * concurrently from one process). No rate-limit pacing needed — this is
 * on-CPU local inference, not a metered API. Cache hits (already-embedded
 * chunks from a prior run) return near-instantly.
 */
async function embedAll(chunks: KbChunk[]) {
  let done = 0;
  for (const c of chunks) {
    c.embedding = await embedChunk(c.standard_id, c.clause_title, c.text, c.sha256);
    done++;
    process.stdout.write(`\r  embedding: ${done}/${chunks.length}`);
  }
  process.stdout.write("\n");
}

async function main() {
  console.log("=".repeat(70));
  console.log("BISVEDA — Knowledge Base Build");
  console.log("=".repeat(70));

  assertRegistryCoversFolder();
  console.log(`Registry OK: ${SOURCES.length} sources, ${EXCLUDED.length} excluded.\n`);

  fs.mkdirSync(KB_DIR, { recursive: true });

  const allChunks: KbChunk[] = [];
  const pagesByDoc = new Map<string, RawPage[]>();
  for (const doc of SOURCES) {
    process.stdout.write(`[${doc.doc_id}] parsing...`);
    const raw = parseSource(doc, { force: FORCE_PARSE });
    const pages = contentPages(raw);
    pagesByDoc.set(doc.doc_id, pages);
    const stripped = raw.strippedPages.length;
    process.stdout.write(` ${raw.totalPages} pages (${stripped} stripped), ${raw.totalChars} chars. chunking...`);
    const chunks = chunkDocument(doc, pages);
    process.stdout.write(` ${chunks.length} chunks.\n`);
    allChunks.push(...chunks);
  }

  console.log(`\nTotal chunks: ${allChunks.length}. Embedding (local bge-m3, cached by sha256 — first call loads the model)...`);
  await embedAll(allChunks);

  const missingEmbeddings = allChunks.filter((c) => !c.embedding || c.embedding.length === 0);
  if (missingEmbeddings.length > 0) {
    throw new Error(`${missingEmbeddings.length} chunks have no embedding after the embed stage — this should be impossible (embedChunk throws on failure).`);
  }

  console.log("\nBuilding standards.json...");
  const standards = SOURCES.filter((s) => s.domain !== "forms").map((doc) =>
    buildStandardRecord(doc, allChunks, pagesByDoc.get(doc.doc_id) || [])
  );

  console.log("Building graph.json...");
  const graph = buildGraph(SOURCES, standards, allChunks);

  // Runtime-safe doc registry (doc_id -> real PDF filename), so /api/docs/[docId]
  // can serve the source PDF without importing scripts/ into the Next.js build.
  const docs = SOURCES.map((s) => ({
    doc_id: s.doc_id,
    standard_id: s.standard_id,
    title: s.title,
    domain: s.domain,
    file: s.file,
    source_url: s.source_url,
  }));

  fs.writeFileSync(path.join(KB_DIR, "standards.json"), JSON.stringify(standards, null, 2), "utf-8");
  fs.writeFileSync(path.join(KB_DIR, "chunks.json"), JSON.stringify(allChunks, null, 2), "utf-8");
  fs.writeFileSync(path.join(KB_DIR, "graph.json"), JSON.stringify(graph, null, 2), "utf-8");
  fs.writeFileSync(path.join(KB_DIR, "docs.json"), JSON.stringify(docs, null, 2), "utf-8");

  console.log("\n" + "=".repeat(70));
  console.log("DONE");
  console.log("=".repeat(70));
  console.log(`Standards:    ${standards.length}`);
  console.log(`Chunks:       ${allChunks.length}`);
  console.log(`Graph nodes:  ${graph.nodes.length}`);
  console.log(`Graph edges:  ${graph.edges.length}`);
  for (const std of standards) {
    console.log(`  ${std.id.padEnd(20)} ${std.chunk_count} chunks  (${std.title.slice(0, 50)})`);
  }
}

main().catch((err) => {
  console.error("\nKB BUILD FAILED:", err.message || err);
  process.exit(1);
});
