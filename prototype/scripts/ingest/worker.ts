/**
 * BISVEDA — ingestion worker (R2.2, ARCHITECTURE.md §6).
 *
 *   npm run worker:ingest            poll the queue forever
 *   npm run worker:ingest -- --once  process at most one job, then exit
 *
 * Claims one queued job at a time (FOR UPDATE SKIP LOCKED, respecting run_after),
 * so several workers can run side by side. Steps:
 *   parsing → structuring (clause tree, metadata, links) → embedding → staging.
 * A staged version is NOT searchable until an officer publishes it (R2.7).
 * Transient failures are retried with backoff (30 s, 60 s, ...) up to max_attempts;
 * a corrupt file or a document with no readable text fails at once.
 * A job whose worker died (lease expired) is put back on the queue.
 * The worker writes a heartbeat so the admin page can say whether it is running.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { closePool, getPool, query, tx } from "../../src/lib/db/client";
import { EMBED_MODEL_TAG, generateEmbedding } from "../../src/lib/embeddings";
import { slugForId } from "../../src/lib/ingest/ids";
import { buildGraphFragment, findClauseLinks } from "../../src/lib/ingest/links";
import { compareMetadata, detectMetadata } from "../../src/lib/ingest/metadata";
import { buildAmendmentStructure, buildStructure, STRUCT_PATH_SEP, type Structure } from "../../src/lib/ingest/structure";
import { STORAGE_ROOT } from "../../src/lib/ingest/upload";
import { parseOriginal, PermanentError } from "./parse-original";

const POLL_MS = 2000;
const LEASE = "30 minutes";
const BACKOFF_BASE_S = 30;
const EMBED_LOG_EVERY = 25;
const WORKER_ID = `${os.hostname()}:${process.pid}`;
const once = process.argv.includes("--once");

interface ClaimedJob {
  id: string;
  version_id: string;
  type: string;
  attempts: number;
  max_attempts: number;
}

interface VersionRow {
  version_id: string;
  document_id: string;
  legacy_doc_id: string | null;
  title: string;
  kind: "edition" | "amendment";
  amendment_no: number | null;
  file_path: string;
  file_sha256: string;
  edition_year: number | null;
  extracted_meta: Record<string, any> | null;
}

async function heartbeat(currentJob: string | null) {
  await query(
    `INSERT INTO worker_heartbeats (worker_id, seen_at, current_job) VALUES ($1, now(), $2)
     ON CONFLICT (worker_id) DO UPDATE SET seen_at = now(), current_job = $2`,
    [WORKER_ID, currentJob],
  );
}

async function log(jobId: string, level: "info" | "warn" | "error", step: string, message: string, data?: unknown) {
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
  await query(`UPDATE ingestion_jobs SET step = $2, lease_until = now() + interval '${LEASE}' WHERE id = $1`, [jobId, step]);
  await heartbeat(jobId);
}

/** Jobs whose worker stopped mid-run go back on the queue. */
async function reclaimExpired() {
  const res = await query<{ id: string; version_id: string }>(
    `UPDATE ingestion_jobs SET state = 'queued', step = NULL, lease_until = NULL, run_after = now()
      WHERE state = 'running' AND lease_until < now()
      RETURNING id, version_id`,
  );
  for (const r of res) {
    await query(`UPDATE document_versions SET status = 'uploaded' WHERE id = $1 AND status = 'processing'`, [r.version_id]);
    await log(r.id, "warn", "lease", "The previous worker stopped during this job; it was put back on the queue.");
  }
}

async function claim(): Promise<ClaimedJob | null> {
  const res = await getPool().query<ClaimedJob>(
    `UPDATE ingestion_jobs
        SET state = 'running', started_at = now(), attempts = attempts + 1,
            lease_until = now() + interval '${LEASE}', step = 'claimed', error = NULL
      WHERE id = (
        SELECT id FROM ingestion_jobs
         WHERE state = 'queued' AND run_after <= now()
         ORDER BY run_after, created_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1
      )
      RETURNING id, version_id, type, attempts, max_attempts`,
  );
  return res.rows[0] ?? null;
}

async function processJob(job: ClaimedJob) {
  await log(job.id, "info", "claimed", `${job.type}, attempt ${job.attempts} of ${job.max_attempts} (worker ${WORKER_ID})`);
  await query(`UPDATE document_versions SET status = 'processing' WHERE id = $1`, [job.version_id]);

  let step = "parsing";
  try {
    // ── parsing ──────────────────────────────────────────────────────────
    await setStep(job.id, step);
    const [v] = await query<VersionRow>(
      `SELECT v.id AS version_id, v.document_id, d.legacy_doc_id, d.title, v.kind, v.amendment_no,
              v.file_path, v.file_sha256, v.edition_year, v.extracted_meta
         FROM document_versions v JOIN documents d ON d.id = v.document_id
        WHERE v.id = $1`,
      [job.version_id],
    );
    if (!v) throw new PermanentError("The document version no longer exists.");
    const versionTitle: string = v.extracted_meta?.submitted_title || v.title;

    const absPath = path.join(STORAGE_ROOT, v.file_path);
    if (!fs.existsSync(absPath)) throw new PermanentError(`The stored original is missing: ${v.file_path}`);

    const parsed = parseOriginal(absPath, v.file_sha256.slice(0, 16));
    await log(
      job.id,
      "info",
      "parse",
      `${parsed.totalPages} pages: ${parsed.ocrPages.length} read with OCR, ${parsed.twoColumnPages.length} two-column (${parsed.reorderedPages.length} reordered), ${parsed.emptyPages.length} empty, ${parsed.lowQualityPages.length} low-quality`,
      {
        ocr_pages: parsed.ocrPages,
        ocr_reasons: parsed.ocrReasons,
        two_column_pages: parsed.twoColumnPages,
        reordered_pages: parsed.reorderedPages,
        empty_pages: parsed.emptyPages,
        low_quality_pages: parsed.lowQualityPages,
        stripped_pages: parsed.strippedPages,
      },
    );

    // ── structuring ──────────────────────────────────────────────────────
    step = "structuring";
    await setStep(job.id, step);
    const stripped = new Set(parsed.strippedPages);
    const contentPages = parsed.pages.filter((p) => !stripped.has(p.pageNumber));
    if (contentPages.length === 0) throw new PermanentError("No page has readable text (all pages are empty or cover pages).");

    let structure: Structure;
    let affected: string[] = [];
    if (v.kind === "amendment") {
      const amd = buildAmendmentStructure(contentPages, `${v.document_id} Amendment No. ${v.amendment_no}`, v.amendment_no ?? 0);
      structure = amd;
      affected = amd.affected;
    } else {
      structure = buildStructure(contentPages, versionTitle);
    }
    if (structure.chunks.length === 0) throw new PermanentError("No text could be read from the document.");

    const firstPagesText = parsed.pages.slice(0, 4).map((p) => p.text).join("\n");
    const allText = contentPages.map((p) => p.text).join("\n");
    const detected = detectMetadata({
      parserStandard: parsed.parser.standard,
      parserTitle: parsed.parser.title,
      parserYear: parsed.parser.year,
      firstPagesText,
      allText,
      nodes: structure.nodes,
      ownId: v.document_id,
    });
    const mismatches = compareMetadata(
      {
        standard_id: v.document_id,
        title: versionTitle,
        edition_year: v.edition_year,
        kind: v.kind,
        amendment_no: v.amendment_no,
      },
      detected,
    );
    const links = v.kind === "edition" ? findClauseLinks(structure.nodes, v.document_id) : [];
    const fragment = v.kind === "edition" ? buildGraphFragment(structure.nodes, v.document_id) : null;
    await log(
      job.id,
      "info",
      "structure",
      `${structure.stats.clauses} clauses (${structure.stats.untitledClauses} untitled), ${structure.stats.annexes} annexes, ${structure.stats.tables} tables, ${structure.stats.figures} figures, ${structure.chunks.length} chunks, ${links.length} links` +
        (v.kind === "amendment" ? `; changes ${affected.length ? affected.join(", ") : "no clause it could identify"}` : ""),
      { stats: structure.stats, mismatches },
    );
    if (mismatches.length) {
      await log(job.id, "warn", "metadata", mismatches.map((m) => `${m.field}: uploaded "${m.uploaded}", PDF says "${m.detected}"`).join("; "));
    }

    // ── embedding ────────────────────────────────────────────────────────
    step = "embedding";
    await setStep(job.id, step);
    const nodeByKey = new Map(structure.nodes.map((n) => [n.key, n]));
    const embedTexts = structure.chunks.map((c) => {
      const n = nodeByKey.get(c.nodeKey)!;
      return `${v.document_id} ${n.path.slice(1).join(STRUCT_PATH_SEP)}\n${c.text}`;
    });
    const vectors: number[][] = [];
    for (let i = 0; i < embedTexts.length; i++) {
      vectors.push(await generateEmbedding(embedTexts[i], "RETRIEVAL_DOCUMENT"));
      if ((i + 1) % EMBED_LOG_EVERY === 0 || i + 1 === embedTexts.length) {
        await log(job.id, "info", "embed", `${i + 1}/${embedTexts.length} chunks embedded`);
        await setStep(job.id, step);
      }
    }

    // ── staging (clauses, chunks and links in one transaction) ───────────
    step = "staging";
    await setStep(job.id, step);
    const slug = v.legacy_doc_id || slugForId(v.document_id);
    await tx(async (client) => {
      await client.query(`DELETE FROM edges WHERE version_id = $1`, [job.version_id]);
      await client.query(`DELETE FROM chunks WHERE version_id = $1`, [job.version_id]);
      await client.query(`DELETE FROM clauses WHERE version_id = $1`, [job.version_id]);

      const idByKey = new Map<string, string>();
      for (const n of structure.nodes) {
        const res = await client.query<{ id: string }>(
          `INSERT INTO clauses (version_id, parent_id, kind, number, title, path, ord, depth, page_start, page_end, text)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
          [
            job.version_id,
            n.parentKey ? idByKey.get(n.parentKey) ?? null : null,
            n.kind,
            n.number,
            n.title,
            n.path.join(STRUCT_PATH_SEP),
            n.ord,
            n.depth,
            n.pageStart,
            n.pageEnd,
            n.text,
          ],
        );
        idByKey.set(n.key, res.rows[0].id);
      }

      const perNode = new Map<string, number>();
      for (let i = 0; i < structure.chunks.length; i++) {
        const c = structure.chunks[i];
        const k = perNode.get(c.nodeKey) ?? 0;
        perNode.set(c.nodeKey, k + 1);
        await client.query(
          `INSERT INTO chunks (legacy_id, version_id, clause_id, seq, page_start, page_end, text, embed_text, tokens, sha256, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, encode(sha256(convert_to($7, 'UTF8')), 'hex'), $10::vector)`,
          [
            `${slug}${v.kind === "amendment" ? `-amd${v.amendment_no}` : ""}-${c.nodeKey.replace(/\s+/g, "_")}-${k}`,
            job.version_id,
            idByKey.get(c.nodeKey),
            i,
            c.pageStart,
            c.pageEnd,
            c.text,
            embedTexts[i],
            Math.ceil(c.text.length / 4),
            `[${vectors[i].join(",")}]`,
          ],
        );
      }

      for (const l of links) {
        await client.query(
          `INSERT INTO edges (src_kind, src_id, dst_kind, dst_id, type, version_id, evidence)
           VALUES ('clause', $1, $2, $3, $4, $5, $6)`,
          [
            idByKey.get(l.srcKey),
            l.dstKey ? "clause" : "standard",
            l.dstKey ? idByKey.get(l.dstKey) : l.dstStandard,
            l.type,
            job.version_id,
            l.evidence,
          ],
        );
      }

      const meta = {
        parse: {
          ocr_pages: parsed.ocrPages,
          ocr_reasons: parsed.ocrReasons,
          two_column_pages: parsed.twoColumnPages,
          reordered_pages: parsed.reorderedPages,
          empty_pages: parsed.emptyPages,
          low_quality_pages: parsed.lowQualityPages,
          stripped_pages: parsed.strippedPages,
        },
        structure: structure.stats,
        detected,
        mismatches,
        graph: fragment,
        affected_clauses: v.kind === "amendment" ? affected : undefined,
        link_counts: links.reduce<Record<string, number>>((acc, l) => ((acc[l.type] = (acc[l.type] ?? 0) + 1), acc), {}),
      };
      await client.query(
        `UPDATE document_versions
            SET status = 'staged', embed_model = $2, page_count = $3, ocr_page_count = $4, parse_quality = $5,
                extracted_meta = COALESCE(extracted_meta, '{}'::jsonb) || $6::jsonb
          WHERE id = $1`,
        [job.version_id, EMBED_MODEL_TAG, parsed.totalPages, parsed.ocrPages.length, parsed.parseQuality, JSON.stringify(meta)],
      );
    });

    await query(
      `UPDATE ingestion_jobs SET state = 'succeeded', step = 'staged', finished_at = now(), lease_until = NULL, error = NULL WHERE id = $1`,
      [job.id],
    );
    await log(job.id, "info", "staged", `${structure.nodes.length - 1} clause nodes, ${structure.chunks.length} chunks. Waiting for officer approval.`);
  } catch (err: any) {
    const message = String(err?.message ?? err).slice(0, 1000);
    const permanent = err instanceof PermanentError;
    if (!permanent && job.attempts < job.max_attempts) {
      const delay = BACKOFF_BASE_S * 2 ** (job.attempts - 1);
      await log(job.id, "warn", step, `${message} (will retry in ${delay} s)`);
      await query(
        `UPDATE ingestion_jobs SET state = 'queued', step = $2, error = $3, lease_until = NULL, run_after = now() + ($4 || ' seconds')::interval
          WHERE id = $1`,
        [job.id, step, `${step}: ${message}`, String(delay)],
      );
      await query(`UPDATE document_versions SET status = 'uploaded' WHERE id = $1`, [job.version_id]);
      return;
    }
    await log(job.id, "error", step, message);
    await query(
      `UPDATE ingestion_jobs SET state = 'failed', step = $2, error = $3, finished_at = now(), lease_until = NULL WHERE id = $1`,
      [job.id, step, `${step}: ${message}`],
    );
    await query(`UPDATE document_versions SET status = 'failed' WHERE id = $1`, [job.version_id]);
  }
}

async function main() {
  console.log(`[worker] ingestion worker ${WORKER_ID} started${once ? " (--once)" : ""}; storage ${STORAGE_ROOT}`);
  for (;;) {
    await heartbeat(null);
    await reclaimExpired();
    const job = await claim();
    if (job) {
      await processJob(job);
      await heartbeat(null);
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

async function shutdown() {
  try {
    await query(`DELETE FROM worker_heartbeats WHERE worker_id = $1`, [WORKER_ID]);
  } catch {
    /* ignore */
  }
  await closePool();
}

process.on("SIGINT", () => {
  shutdown().finally(() => process.exit(0));
});

main()
  .catch((err) => {
    console.error("[worker] fatal:", err);
    process.exitCode = 1;
  })
  .finally(() => shutdown());
