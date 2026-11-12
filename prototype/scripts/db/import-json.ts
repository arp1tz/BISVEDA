/**
 * BISVEDA — import the JSON knowledge base into PostgreSQL (R1.2, ARCHITECTURE.md §15).
 *
 * Reads data/kb/{docs,standards,chunks,graph}.json and data/directory/{labs,ahc}.json
 * and writes documents, one published edition per document (with the original
 * PDF copied to storage/originals/{sha256}.pdf), clauses, chunks WITH THEIR
 * EXISTING VECTORS (no re-embedding), the graph verbatim, labs and AHCs.
 * Truncate-and-reload in ONE transaction, so it is idempotent.
 *
 * Refuses to run if the database holds ingestion jobs (i.e. documents uploaded
 * through the real pipeline), so it can never wipe staff uploads.
 *
 * Usage (from prototype/):
 *   npm run db:import              import
 *   npm run db:import -- --verify  import, then read everything back through
 *                                  lib/kb/store (db mode) and compare with the JSON files
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { loadEnv } from "../kb/env";
loadEnv();
import { closePool, getPool, query, toVectorLiteral, parseVector } from "../../src/lib/db/client";
import { loadDbSources, loadJsonSources, PATH_SEP, type StoreData } from "../../src/lib/kb/store";
import { EMBED_MODEL_TAG } from "../../src/lib/embeddings";
import type { KbChunk } from "../../src/lib/kb/types";

const PROTOTYPE_ROOT = path.resolve(__dirname, "../..");
const REPO_ROOT = path.resolve(PROTOTYPE_ROOT, "..");
const DOCS_DIR = path.join(REPO_ROOT, "example docs uploaded by employees");
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(PROTOTYPE_ROOT, "storage");
const RAW_DIR = path.join(PROTOTYPE_ROOT, "data", "kb", "raw");

function clauseKind(label: string): string {
  if (label === "0") return "front_matter";
  if (/^ANNEX/i.test(label)) return "annex";
  if (/^Table/i.test(label)) return "table";
  if (/^Fig/i.test(label)) return "figure";
  return "clause";
}

function clauseDepth(label: string): number {
  if (label === "0") return 0;
  if (/^\d+(\.\d+)*$/.test(label)) return label.split(".").length;
  return 1;
}

function parseIsId(id: string): { base: string | null; part: string | null } {
  const m = id.match(/^IS\s*(\d+)(?:\s*\(Part\s*(\d+)\))?/i);
  return m ? { base: m[1], part: m[2] ?? null } : { base: null, part: null };
}

async function importAll(src: StoreData) {
  const pool = getPool();
  const jobs = await query<{ n: string }>("SELECT count(*) AS n FROM ingestion_jobs");
  if (Number(jobs[0].n) > 0) {
    throw new Error("The database contains ingestion jobs (real uploads). Refusing to truncate. Use db:reset deliberately if you really want a clean slate.");
  }

  const stdById = new Map(src.standards.map((s) => [s.id, s]));
  fs.mkdirSync(path.join(STORAGE_DIR, "originals"), { recursive: true });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "TRUNCATE documents, document_versions, clauses, chunks, edges, graph_nodes, labs, ahcs, ingestion_jobs, job_logs RESTART IDENTITY CASCADE"
    );

    // Documents + one published edition each (registry order = display order).
    const versionByDocId = new Map<string, string>(); // legacy doc_id -> version uuid
    for (const [i, d] of src.docs.entries()) {
      const std = stdById.get(d.standard_id);
      const { base, part } = parseIsId(d.standard_id);
      await client.query(
        `INSERT INTO documents (id, legacy_doc_id, doc_type, base_number, part, title, domain, scope_text, display_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [d.standard_id, d.doc_id, d.domain === "forms" ? "form" : "standard", base, part, d.title, d.domain, std?.scope_text ?? null, i]
      );

      const pdfPath = path.join(DOCS_DIR, d.file);
      if (!fs.existsSync(pdfPath)) throw new Error(`Source PDF missing for ${d.doc_id}: ${pdfPath}`);
      const bytes = fs.readFileSync(pdfPath);
      const sha = crypto.createHash("sha256").update(bytes).digest("hex");
      const stored = path.join(STORAGE_DIR, "originals", `${sha}.pdf`);
      if (!fs.existsSync(stored)) fs.copyFileSync(pdfPath, stored);

      let pageCount: number | null = null;
      const rawFile = path.join(RAW_DIR, `${d.doc_id}.json`);
      if (fs.existsSync(rawFile)) {
        try {
          pageCount = JSON.parse(fs.readFileSync(rawFile, "utf-8")).totalPages ?? null;
        } catch {
          /* page count is informational only */
        }
      }
      const editionLabel = d.title.match(/\(([^()]*Revision)\)/i)?.[1] ?? null;

      const v = await client.query<{ id: string }>(
        `INSERT INTO document_versions (document_id, kind, edition_label, edition_year, status, file_sha256, file_path, file_name,
                                        file_bytes, page_count, source_url, embed_model, published_at)
         VALUES ($1,'edition',$2,$3,'published',$4,$5,$6,$7,$8,$9,$10, now()) RETURNING id`,
        [d.standard_id, editionLabel, std?.year ?? null, sha, path.relative(PROTOTYPE_ROOT, stored).replace(/\\/g, "/"), d.file,
         bytes.length, pageCount, d.source_url ?? null, EMBED_MODEL_TAG]
      );
      versionByDocId.set(d.doc_id, v.rows[0].id);
    }

    // Clauses: one row per distinct (clause label, clause title, breadcrumb) in each document, first-occurrence order.
    const clauseKey = (c: KbChunk) => `${c.doc_id}\u0000${c.clause}\u0000${c.clause_title}\u0000${c.breadcrumb.join(PATH_SEP)}`;
    const groups = new Map<string, KbChunk[]>();
    for (const c of src.chunks) {
      for (const b of c.breadcrumb) {
        if (b.includes(PATH_SEP)) throw new Error(`breadcrumb element contains the path separator: ${c.chunk_id}`);
      }
      const k = clauseKey(c);
      const list = groups.get(k) ?? [];
      list.push(c);
      groups.set(k, list);
    }
    const clauseIdByKey = new Map<string, string>();
    const ordByDoc = new Map<string, number>();
    const numberIndex = new Map<string, Map<string, string>>(); // doc_id -> clause number -> first clause uuid
    for (const [k, list] of groups) {
      const first = list[0];
      const versionId = versionByDocId.get(first.doc_id);
      if (!versionId) throw new Error(`chunk ${first.chunk_id} references unknown doc ${first.doc_id}`);
      const ord = ordByDoc.get(first.doc_id) ?? 0;
      ordByDoc.set(first.doc_id, ord + 1);

      // Parent: nearest ancestor number already seen in this document ("6.2.1" -> "6.2" -> "6").
      const nums = numberIndex.get(first.doc_id) ?? new Map<string, string>();
      numberIndex.set(first.doc_id, nums);
      let parentId: string | null = null;
      if (/^\d+(\.\d+)+$/.test(first.clause)) {
        const parts = first.clause.split(".");
        for (let n = parts.length - 1; n >= 1 && !parentId; n--) parentId = nums.get(parts.slice(0, n).join(".")) ?? null;
      }

      const r = await client.query<{ id: string }>(
        `INSERT INTO clauses (version_id, parent_id, kind, number, title, path, ord, depth, page_start, page_end, text)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [versionId, parentId, clauseKind(first.clause), first.clause, first.clause_title || null, first.breadcrumb.join(PATH_SEP), ord,
         clauseDepth(first.clause), Math.min(...list.map((c) => c.page_start)), Math.max(...list.map((c) => c.page_end)),
         list.map((c) => c.text).join("\n")]
      );
      clauseIdByKey.set(k, r.rows[0].id);
      if (!nums.has(first.clause)) nums.set(first.clause, r.rows[0].id);
    }

    // Chunks with their existing vectors; seq = position in chunks.json (the store reads ORDER BY seq).
    for (const [seq, c] of src.chunks.entries()) {
      if (!c.embedding || c.embedding.length !== 1024) throw new Error(`chunk ${c.chunk_id} has no 1024-d embedding`);
      await client.query(
        `INSERT INTO chunks (legacy_id, version_id, clause_id, seq, page_start, page_end, text, embed_text, tokens, sha256, embedding)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::vector)`,
        [c.chunk_id, versionByDocId.get(c.doc_id), clauseIdByKey.get(clauseKey(c)), seq, c.page_start, c.page_end, c.text,
         `${c.standard_id} ${c.clause_title}\n${c.text}`, c.tokens, c.sha256, toVectorLiteral(c.embedding)]
      );
    }

    // Graph verbatim (R2 rebuilds it from the clause tree).
    const kindOf = (id: string) => id.split(":")[0];
    for (const [i, n] of src.graph.nodes.entries()) {
      await client.query(`INSERT INTO graph_nodes (id, ord, type, label, props) VALUES ($1,$2,$3,$4,$5)`, [n.id, i, n.type, n.label, n.props ?? null]);
    }
    for (const e of src.graph.edges) {
      await client.query(
        `INSERT INTO edges (src_kind, src_id, dst_kind, dst_id, type, weight, evidence) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [kindOf(e.src), e.src, kindOf(e.dst), e.dst, e.type, e.weight ?? null, e.source ?? null]
      );
    }

    for (const [i, l] of src.labs.entries()) {
      await client.query(
        `INSERT INTO labs (id, ord, name, city, state, lat, lng, geocode, status, valid_upto, standards_in_scope, scope, source_url, retrieved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [l.id, i, l.name, l.city ?? null, l.state ?? null, l.lat ?? null, l.lng ?? null, l.geocode, l.current_status ?? null,
         l.recognition_valid_upto ?? null, l.standards_in_scope, JSON.stringify(l.scope), l.source_url, l.retrieved_at]
      );
    }
    for (const [i, a] of src.ahcs.entries()) {
      await client.query(
        `INSERT INTO ahcs (recognition_no, ord, name, address, district, state, pin, metals, contact, status, validity, lat, lng, geocode, source_url, retrieved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [a.recognition_no, i, a.name, a.address ?? null, a.district ?? null, a.state ?? null, a.pin ?? null, a.metals ?? null,
         a.contact ?? null, a.status, a.validity ?? null, a.lat, a.lng, a.geocode, a.source_url, a.retrieved_at]
      );
    }

    await client.query("UPDATE index_state SET version = version + 1, changed_at = now() WHERE id = 1");
    await client.query("COMMIT");
    console.log(
      `Imported: ${src.docs.length} documents/versions, ${groups.size} clauses, ${src.chunks.length} chunks, ` +
        `${src.graph.nodes.length} graph nodes, ${src.graph.edges.length} edges, ${src.labs.length} labs, ${src.ahcs.length} AHCs.`
    );
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Order-preserving for arrays, key-order-insensitive for objects, undefined === missing. */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      const x = (v as Record<string, unknown>)[k];
      if (x !== undefined) out[k] = canon(x);
    }
    return out;
  }
  return v;
}

async function verify(json: StoreData): Promise<boolean> {
  const db = await loadDbSources();
  let ok = true;
  const cmp = (label: string, a: unknown[], b: unknown[]) => {
    const sa = (a as unknown[]).map((x) => JSON.stringify(canon(x)));
    const sb = (b as unknown[]).map((x) => JSON.stringify(canon(x)));
    const diffs = sa.reduce((n, s, i) => n + (s === sb[i] ? 0 : 1), 0) + Math.abs(sa.length - sb.length);
    console.log(`  ${diffs === 0 ? "✓" : "✗"} ${label}: json ${sa.length}, db ${sb.length}, differing ${diffs}`);
    if (diffs) {
      ok = false;
      const i = sa.findIndex((s, k) => s !== sb[k]);
      if (i >= 0) console.log(`      first diff at ${i}:\n      json ${sa[i].slice(0, 300)}\n      db   ${(sb[i] ?? "<missing>").slice(0, 300)}`);
    }
  };
  cmp("chunks (text, metadata; vectors checked below)", json.chunks.map((c) => ({ ...c, embedding: null })), db.chunks);
  cmp("standards", json.standards, db.standards);
  cmp("docs", json.docs, db.docs);
  cmp("graph nodes", json.graph.nodes, db.graph.nodes);
  cmp("graph edges", json.graph.edges, db.graph.edges);
  // labs.json is itself inconsistent about unknown cities (4 records `"city": null`, 2 with no key); a column can't
  // keep that distinction and every consumer treats both alike (truthiness / `||`), so compare them as equal.
  const dropNulls = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null));
  cmp("labs (null == missing)", json.labs.map(dropNulls), db.labs.map(dropNulls));
  cmp("ahcs", json.ahcs, db.ahcs);

  const vecRows = await query<{ embedding: string }>("SELECT embedding::text FROM chunks ORDER BY seq");
  let maxDiff = 0;
  vecRows.forEach((r, i) => {
    const v = parseVector(r.embedding)!;
    const j = json.chunks[i].embedding!;
    for (let k = 0; k < 1024; k++) maxDiff = Math.max(maxDiff, Math.abs(v[k] - j[k]));
  });
  const vecOk = vecRows.length === json.chunks.length && maxDiff < 1e-6;
  console.log(`  ${vecOk ? "✓" : "✗"} vectors: ${vecRows.length} rows, max |db - json| = ${maxDiff.toExponential(2)} (pgvector stores float32)`);
  return ok && vecOk;
}

async function main() {
  const json = loadJsonSources();
  if (json.chunks.length === 0) throw new Error("data/kb/chunks.json is empty or missing; run `npm run kb:build` first.");
  await importAll(json);
  if (process.argv.includes("--verify")) {
    console.log("Verifying DB read-back against the JSON files...");
    const ok = await verify(json);
    console.log(ok ? "PARITY OK" : "PARITY FAILED");
    if (!ok) process.exitCode = 1;
  }
  await closePool();
}

main().catch(async (err) => {
  console.error("IMPORT FAILED:", err instanceof Error ? err.message : err);
  await closePool();
  process.exit(1);
});
