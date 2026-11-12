/**
 * BISVEDA — ingestion worker (R2.2, ARCHITECTURE.md §6).
 *
 *   npm run worker:ingest            poll the queue forever
 *   npm run worker:ingest -- --once  process at most one job, then exit
 *
 * Claims one queued job at a time with FOR UPDATE SKIP LOCKED, so several
 * workers can run side by side. Steps: parsing → chunking → embedding →
 * staged. A staged version is NOT searchable until an officer publishes it
 * (R2.7). Any failure marks the job and version failed with the step name.
 */

import fs from "fs";
import path from "path";
import { closePool, getPool, query, tx } from "../../src/lib/db/client";
import { EMBED_MODEL_TAG, generateBatchEmbeddings } from "../../src/lib/embeddings";
import { STORAGE_ROOT } from "../../src/lib/ingest/upload";
import { chunkDocument } from "../kb/chunk";
import type { SourceDoc } from "../kb/types";
import { parseOriginal } from "./parse-original";

const POLL_MS = 2000;
const EMBED_BATCH_LOG_EVERY = 25;
const once = process.argv.includes("--once");

interface ClaimedJob {
  id: string;
  version_id: string;
  attempts: number;
}

interface VersionRow {
  version_id: string;
  document_id: string;
  title: string;
  file_path: string;
  file_sha256: string;
  edition_label: string | null;
  edition_year: number | null;
  extracted_meta: { domain?: string; doc_class?: string } | null;
}

async function log(jobId: string, level: "info" | "error", step: string, message: string, data?: unknown) {
  console.log(`[worker] ${level} ${step}: ${message}`);
  await query(`INSERT INTO job_logs (job_id, level, step, message, data) VALUES ($1, $2, $3, $4, $5)`, [
    jobId,
    level,
    step,
    message,
    data === undefined ? null : JSON.stringify(data),
  ]);
}

async function setStep(jobId: string, step: string) {
  await query(`UPDATE ingestion_jobs SET step = $2 WHERE id = $1`, [jobId, step]);
}

async function claim(): Promise<ClaimedJob | null> {
  const res = await getPool().query<ClaimedJob>(
    `UPDATE ingestion_jobs
        SET state = 'running', started_at = now(), attempts = attempts + 1,
            lease_until = now() + interval '30 minutes', step = 'claimed'
      WHERE id = (
        SELECT id FROM ingestion_jobs
         WHERE state = 'queued'
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1
      )
      RETURNING id, version_id, attempts`,
  );
  return res.rows[0] ?? null;
}

/** Clause kind from the heading label produced by the chunker. */
function clauseKind(label: string): "front_matter" | "annex" | "table" | "figure" | "clause" {
  if (label === "0") return "front_matter";
  if (/^ANNEX\s/i.test(label)) return "annex";
  if (/^Table\s/i.test(label)) return "table";
  if (/^Figure\s/i.test(label)) return "figure";
  return "clause";
}

/** Parent of "3.1.2" is the nearest earlier clause numbered "3.1", then "3". */
function parentNumber(number: string): string | null {
  const i = number.lastIndexOf(".");
  return i > 0 ? number.slice(0, i) : null;
}

async function processJob(job: ClaimedJob) {
  await log(job.id, "info", "claimed", `attempt ${job.attempts}`);
  await query(`UPDATE document_versions SET status = 'processing' WHERE id = $1`, [job.version_id]);

  let step = "parsing";
  try {
    // ── parsing ──────────────────────────────────────────────────────────
    await setStep(job.id, step);
    const [v] = await query<VersionRow>(
      `SELECT v.id AS version_id, v.document_id, d.title, v.file_path, v.file_sha256,
              v.edition_label, v.edition_year, v.extracted_meta
         FROM document_versions v JOIN documents d ON d.id = v.document_id
        WHERE v.id = $1`,
      [job.version_id],
    );
    if (!v) throw new Error("The document version no longer exists.");

    const absPath = path.join(STORAGE_ROOT, v.file_path);
    if (!fs.existsSync(absPath)) throw new Error(`The stored original is missing: ${v.file_path}`);

    const parsed = parseOriginal(absPath, v.file_sha256.slice(0, 16));
    await log(job.id, "info", "parse", `${parsed.totalPages} pages, ${parsed.ocrPages} via OCR, ${parsed.emptyPages.length} empty, ${parsed.lowQualityPages.length} low-quality`, {
      empty_pages: parsed.emptyPages,
      low_quality_pages: parsed.lowQualityPages,
      stripped_pages: parsed.strippedPages,
    });
    await query(
      `UPDATE document_versions
          SET page_count = $2, ocr_page_count = $3, parse_quality = $4,
              extracted_meta = COALESCE(extracted_meta, '{}'::jsonb) || $5::jsonb
        WHERE id = $1`,
      [
        job.version_id,
        parsed.totalPages,
        parsed.ocrPages,
        parsed.parseQuality,
        JSON.stringify({ empty_pages: parsed.emptyPages, low_quality_pages: parsed.lowQualityPages }),
      ],
    );

    // ── chunking ─────────────────────────────────────────────────────────
    step = "chunking";
    await setStep(job.id, step);
    const stripped = new Set(parsed.strippedPages);
    const contentPages = parsed.pages.filter((p) => !stripped.has(p.pageNumber));
    const sourceDoc = {
      doc_id: v.file_sha256.slice(0, 16),
      standard_id: v.document_id,
      title: v.title,
      domain: (v.extracted_meta?.domain ?? "other") as SourceDoc["domain"],
      file: v.file_path,
    } as SourceDoc;
    const chunks = chunkDocument(sourceDoc, contentPages);
    if (chunks.length === 0) throw new Error("No clauses were found in the document text.");
    await log(job.id, "info", "chunk", `${chunks.length} chunks`);

    // Group consecutive chunks with the same clause label into one clause row.
    interface ClauseGroup {
      number: string;
      title: string;
      chunks: typeof chunks;
    }
    const groups: ClauseGroup[] = [];
    for (const c of chunks) {
      const last = groups[groups.length - 1];
      if (last && last.number === c.clause) last.chunks.push(c);
      else groups.push({ number: c.clause, title: c.clause_title, chunks: [c] });
    }

    // ── embedding ────────────────────────────────────────────────────────
    step = "embedding";
    await setStep(job.id, step);
    const embedTexts = chunks.map((c) => `${v.document_id} ${c.clause_title}\n${c.text}`);
    const vectors: number[][] = [];
    for (let i = 0; i < embedTexts.length; i++) {
      vectors.push((await generateBatchEmbeddings([embedTexts[i]]))[0]);
      if ((i + 1) % EMBED_BATCH_LOG_EVERY === 0 || i + 1 === embedTexts.length) {
        await log(job.id, "info", "embed", `${i + 1}/${embedTexts.length} chunks embedded`);
      }
    }

    // ── staging (write clauses and chunks in one transaction) ────────────
    step = "staging";
    await setStep(job.id, step);
    await tx(async (client) => {
      await client.query(`DELETE FROM chunks WHERE version_id = $1`, [job.version_id]);
      await client.query(`DELETE FROM clauses WHERE version_id = $1`, [job.version_id]);

      const idByNumber = new Map<string, string>();
      let chunkSeq = 0;
      let ord = 0;
      for (const g of groups) {
        const parentId = parentNumber(g.number) ? idByNumber.get(parentNumber(g.number)!) ?? null : null;
        const clauseText = g.chunks.map((c) => c.text).join("\n");
        const pageStart = Math.min(...g.chunks.map((c) => c.page_start));
        const pageEnd = Math.max(...g.chunks.map((c) => c.page_end));
        const breadcrumb = g.chunks[0].breadcrumb.join(" › ");
        const res = await client.query<{ id: string }>(
          `INSERT INTO clauses (version_id, parent_id, kind, number, title, path, ord, depth, page_start, page_end, text)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
          [
            job.version_id,
            parentId,
            clauseKind(g.number),
            g.number === "0" ? null : g.number,
            g.title,
            breadcrumb,
            ord++,
            g.number === "0" ? 0 : g.number.split(".").length,
            pageStart,
            pageEnd,
            clauseText,
          ],
        );
        if (g.number !== "0") idByNumber.set(g.number, res.rows[0].id);

        for (const c of g.chunks) {
          const idx = chunks.indexOf(c);
          const vec = vectors[idx];
          await client.query(
            `INSERT INTO chunks (legacy_id, version_id, clause_id, seq, page_start, page_end, text, embed_text, tokens, sha256, embedding)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::vector)`,
            [
              c.chunk_id,
              job.version_id,
              res.rows[0].id,
              chunkSeq++,
              c.page_start,
              c.page_end,
              c.text,
              embedTexts[idx],
              c.tokens,
              c.sha256,
              `[${vec.join(",")}]`,
            ],
          );
        }
      }
      await client.query(
        `UPDATE document_versions SET status = 'staged', embed_model = $2 WHERE id = $1`,
        [job.version_id, EMBED_MODEL_TAG],
      );
    });

    await query(
      `UPDATE ingestion_jobs SET state = 'succeeded', step = 'staged', finished_at = now(), lease_until = NULL, error = NULL WHERE id = $1`,
      [job.id],
    );
    await log(job.id, "info", "staged", `${groups.length} clauses, ${chunks.length} chunks. Waiting for officer approval.`);
  } catch (err: any) {
    const message = String(err?.message ?? err).slice(0, 1000);
    await log(job.id, "error", step, message);
    await query(
      `UPDATE ingestion_jobs SET state = 'failed', step = $2, error = $3, finished_at = now(), lease_until = NULL WHERE id = $1`,
      [job.id, step, `${step}: ${message}`],
    );
    await query(`UPDATE document_versions SET status = 'failed' WHERE id = $1`, [job.version_id]);
  }
}

async function main() {
  console.log(`[worker] ingestion worker started${once ? " (--once)" : ""}`);
  for (;;) {
    const job = await claim();
    if (job) {
      await processJob(job);
      if (once) break;
      continue;
    }
    if (once) {
      console.log("[worker] queue is empty");
      break;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main()
  .catch((err) => {
    console.error("[worker] fatal:", err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
