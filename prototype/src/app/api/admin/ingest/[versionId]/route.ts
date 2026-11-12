/**
 * BISVEDA — one document version: inspect it, and the officer's decision (R2.2, R2.5–R2.8; ARCHITECTURE.md §5, §9).
 *
 * GET  → the version, its document, metadata read from the PDF (with mismatches), parse and
 *        structure statistics, the clause tree, link counts and the job log.
 * POST { action: "publish", product_terms?: string[], confirm_older?: boolean }
 *        edition: the previous published edition of the document becomes superseded; this one
 *          becomes searchable; the document's title, scope and product terms are updated; its
 *          part of the knowledge graph is rebuilt (clauses, cited standards, labs that test it).
 *          Publishing an edition older than the published one needs confirm_older.
 *        amendment: needs a published base edition; the clauses it changes are marked as amended.
 * POST { action: "reject", reason?: string }     a staged version is never searchable.
 * POST { action: "reprocess" }                    a failed, staged or rejected version is queued again.
 * Every decision writes audit_log and publishing bumps index_state, so running stores reload.
 * User identity comes with R6 (signed sessions, officer role); until then audit rows have no user_id.
 */

import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { query, tx } from "@/lib/db/client";
import { invalidateStoreCache } from "@/lib/kb/store";

export const runtime = "nodejs";

class DecisionError extends Error {
  constructor(message: string, public status: number, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  if (!UUID_RE.test(versionId)) return NextResponse.json({ error: "Unknown version." }, { status: 404 });

  const [version] = await query<Record<string, any>>(
    `SELECT v.id, v.document_id, v.kind, v.base_version_id, v.edition_label, v.edition_year, v.amendment_no, v.status,
            v.file_name, v.file_bytes, v.page_count, v.ocr_page_count, v.parse_quality, v.extracted_meta, v.embed_model,
            v.uploaded_at, v.published_at, v.superseded_at,
            d.title AS document_title, d.domain, d.doc_type, d.legacy_doc_id, d.product_terms, d.scope_text
       FROM document_versions v JOIN documents d ON d.id = v.document_id
      WHERE v.id = $1`,
    [versionId],
  );
  if (!version) return NextResponse.json({ error: "Unknown version." }, { status: 404 });

  const [published, clauses, linkCounts, jobs] = await Promise.all([
    query<{ id: string; edition_label: string | null; edition_year: number | null }>(
      `SELECT id, edition_label, edition_year FROM document_versions
        WHERE document_id = $1 AND kind = 'edition' AND status = 'published' AND id <> $2`,
      [version.document_id, versionId],
    ),
    query<Record<string, any>>(
      `SELECT c.id, c.parent_id, c.kind, c.number, c.title, c.depth, c.page_start, c.page_end,
              left(regexp_replace(c.text, '\\s+', ' ', 'g'), 160) AS excerpt,
              cardinality(c.amended_by) AS amended_count,
              (SELECT count(*) FROM chunks k WHERE k.clause_id = c.id)::int AS chunk_count
         FROM clauses c WHERE c.version_id = $1 ORDER BY c.ord`,
      [versionId],
    ),
    query<{ type: string; n: number }>(
      `SELECT type, count(*)::int AS n FROM edges WHERE version_id = $1 GROUP BY type ORDER BY type`,
      [versionId],
    ),
    query<Record<string, any>>(
      `SELECT id, type, state, step, attempts, max_attempts, error, run_after, created_at, started_at, finished_at
         FROM ingestion_jobs WHERE version_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [versionId],
    ),
  ]);
  const logs = jobs[0]
    ? await query<Record<string, any>>(
        `SELECT at, level, step, message FROM job_logs WHERE job_id = $1 ORDER BY id DESC LIMIT 60`,
        [jobs[0].id],
      )
    : [];

  return NextResponse.json({
    version,
    published_edition: published[0] ?? null,
    clauses,
    link_counts: linkCounts,
    jobs,
    logs: logs.reverse(),
  });
}

async function nextOrd(client: PoolClient): Promise<number> {
  const r = await client.query<{ n: number }>(`SELECT COALESCE(max(ord), 0) + 1 AS n FROM graph_nodes`);
  return Number(r.rows[0].n);
}

async function ensureNode(client: PoolClient, id: string, type: string, label: string, props: Record<string, unknown> | null) {
  await client.query(
    `INSERT INTO graph_nodes (id, ord, type, label, props) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [id, await nextOrd(client), type, label, props ? JSON.stringify(props) : null],
  );
}

/** Rebuilds the published standard's part of the knowledge graph from the version's graph fragment. */
async function applyGraph(client: PoolClient, versionId: string, doc: { id: string; slug: string; domain: string; title: string; year: number | null }, fragment: any) {
  const std = `std:${doc.id}`;
  const clausePrefix = `clause:${doc.id}#`;
  await client.query(`DELETE FROM edges WHERE src_id = $1 AND type IN ('HAS_CLAUSE', 'REFERENCES', 'IN_DOMAIN')`, [std]);
  await client.query(`DELETE FROM edges WHERE dst_id = $1 AND type = 'TESTS'`, [std]);
  await client.query(`DELETE FROM graph_nodes WHERE left(id, length($1)) = $1`, [clausePrefix]);

  const chunkCount = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM chunks WHERE version_id = $1`, [versionId]);
  await client.query(
    `INSERT INTO graph_nodes (id, ord, type, label, props) VALUES ($1, $2, 'standard', $3, $4)
     ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, props = EXCLUDED.props`,
    [std, await nextOrd(client), doc.id, JSON.stringify({ title: doc.title, year: doc.year ?? undefined, chunk_count: chunkCount.rows[0].n })],
  );
  // Other standards that cited this one as an outside reference now point at it directly.
  await client.query(`UPDATE edges SET dst_id = $1, dst_kind = 'std' WHERE dst_id = $2`, [std, `ref:${doc.id}`]);
  await client.query(`DELETE FROM graph_nodes WHERE id = $1`, [`ref:${doc.id}`]);

  await ensureNode(client, `domain:${doc.domain}`, "domain", doc.domain, null);
  await client.query(
    `INSERT INTO edges (src_kind, src_id, dst_kind, dst_id, type, version_id, evidence) VALUES ('std', $1, 'domain', $2, 'IN_DOMAIN', $3, $4)`,
    [std, `domain:${doc.domain}`, versionId, doc.slug],
  );

  for (const c of fragment?.clauses ?? []) {
    const id = `${clausePrefix}${c.number}`;
    await client.query(
      `INSERT INTO graph_nodes (id, ord, type, label, props) VALUES ($1, $2, 'clause', $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, await nextOrd(client), c.label, JSON.stringify({ standard_id: doc.id, page: c.page })],
    );
    await client.query(
      `INSERT INTO edges (src_kind, src_id, dst_kind, dst_id, type, version_id, evidence) VALUES ('std', $1, 'clause', $2, 'HAS_CLAUSE', $3, $4)`,
      [std, id, versionId, `${doc.slug} p.${c.page}`],
    );
  }

  for (const r of fragment?.references ?? []) {
    const internal = await client.query(`SELECT 1 FROM graph_nodes WHERE id = $1`, [`std:${r.id}`]);
    const dst = internal.rowCount ? `std:${r.id}` : `ref:${r.id}`;
    if (!internal.rowCount) await ensureNode(client, dst, "reference", r.id, null);
    await client.query(
      `INSERT INTO edges (src_kind, src_id, dst_kind, dst_id, type, version_id, weight, evidence) VALUES ('std', $1, $2, $3, 'REFERENCES', $4, $5, $6)`,
      [std, internal.rowCount ? "std" : "ref", dst, versionId, r.count, `${doc.slug} p.${r.page}`],
    );
  }

  const labs = await client.query<{ id: string; name: string; city: string | null; state: string | null; source_url: string }>(
    `SELECT id, name, city, state, source_url FROM labs WHERE $1 = ANY(standards_in_scope)`,
    [doc.id],
  );
  for (const lab of labs.rows) {
    await ensureNode(client, `lab:${lab.id}`, "lab", lab.name, { city: lab.city ?? undefined, state: lab.state ?? undefined });
    await client.query(
      `INSERT INTO edges (src_kind, src_id, dst_kind, dst_id, type, version_id, evidence) VALUES ('lab', $1, 'std', $2, 'TESTS', $3, $4)`,
      [`lab:${lab.id}`, std, versionId, lab.source_url || "BIS LIMS"],
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";

  if (action !== "publish" && action !== "reject" && action !== "reprocess") {
    return NextResponse.json({ error: 'action must be "publish", "reject" or "reprocess".' }, { status: 400 });
  }
  if (!UUID_RE.test(versionId)) return NextResponse.json({ error: "Unknown version." }, { status: 404 });

  try {
    const result = await tx(async (client) => {
      const cur = await client.query<Record<string, any>>(
        `SELECT v.id, v.document_id, v.kind, v.status, v.base_version_id, v.amendment_no, v.edition_year, v.extracted_meta,
                d.legacy_doc_id, d.domain, d.doc_type, d.title AS document_title, d.product_terms
           FROM document_versions v JOIN documents d ON d.id = v.document_id
          WHERE v.id = $1 FOR UPDATE OF v`,
        [versionId],
      );
      const v = cur.rows[0];
      if (!v) throw new DecisionError("Unknown version.", 404);
      const meta = v.extracted_meta ?? {};

      if (action === "reprocess") {
        if (!["failed", "staged", "rejected"].includes(v.status)) {
          throw new DecisionError(`Only a failed, staged or rejected version can be reprocessed (this one is ${v.status}).`, 409);
        }
        const active = await client.query(`SELECT 1 FROM ingestion_jobs WHERE version_id = $1 AND state IN ('queued', 'running')`, [versionId]);
        if (active.rowCount) throw new DecisionError("This version is already queued or being processed.", 409);
        const job = await client.query<{ id: string }>(
          `INSERT INTO ingestion_jobs (version_id, type, state) VALUES ($1, 'reprocess', 'queued') RETURNING id`,
          [versionId],
        );
        await client.query(`UPDATE document_versions SET status = 'uploaded' WHERE id = $1`, [versionId]);
        await client.query(
          `INSERT INTO audit_log (action, target_kind, target_id, before, after) VALUES ('version.reprocess', 'document_version', $1, $2, $3)`,
          [versionId, JSON.stringify({ status: v.status }), JSON.stringify({ status: "uploaded", job_id: job.rows[0].id })],
        );
        return { status: "uploaded", job_id: job.rows[0].id, superseded: [] as string[], publishedChange: false };
      }

      if (v.status !== "staged") {
        throw new DecisionError(`Only a staged version can be ${action === "publish" ? "published" : "rejected"} (this one is ${v.status}).`, 409);
      }

      if (action === "reject") {
        await client.query(`UPDATE document_versions SET status = 'rejected' WHERE id = $1`, [versionId]);
        await client.query(
          `INSERT INTO audit_log (action, target_kind, target_id, before, after) VALUES ('version.reject', 'document_version', $1, $2, $3)`,
          [versionId, JSON.stringify({ status: "staged" }), JSON.stringify({ status: "rejected", reason })],
        );
        return { status: "rejected", superseded: [] as string[], publishedChange: false };
      }

      const chunkCount = await client.query<{ n: string }>(`SELECT count(*) AS n FROM chunks WHERE version_id = $1`, [versionId]);
      if (Number(chunkCount.rows[0].n) === 0) throw new DecisionError("This version has no chunks; it cannot be published.", 409);

      if (v.kind === "amendment") {
        const base = await client.query<{ status: string }>(`SELECT status FROM document_versions WHERE id = $1`, [v.base_version_id]);
        if (base.rows[0]?.status !== "published") {
          throw new DecisionError("The edition this amendment changes is no longer the published edition; it cannot be published.", 409);
        }
        await client.query(`UPDATE document_versions SET status = 'published', published_at = now() WHERE id = $1`, [versionId]);
        const affected: string[] = Array.isArray(meta.affected_clauses) ? meta.affected_clauses : [];
        const marked = await client.query<{ id: string; number: string }>(
          `UPDATE clauses SET amended_by = array_append(amended_by, $2::uuid)
            WHERE version_id = $1 AND upper(number) = ANY($3::text[]) AND NOT ($2::uuid = ANY(amended_by))
          RETURNING id, number`,
          [v.base_version_id, versionId, affected.map((a) => a.toUpperCase())],
        );
        for (const c of marked.rows) {
          await client.query(
            `INSERT INTO edges (src_kind, src_id, dst_kind, dst_id, type, version_id, evidence) VALUES ('version', $1, 'clause', $2, 'AMENDS', $1, $3)`,
            [versionId, c.id, `Amendment No. ${v.amendment_no} changes ${c.number}`],
          );
        }
        await client.query(`UPDATE index_state SET version = version + 1, changed_at = now() WHERE id = 1`);
        await client.query(
          `INSERT INTO audit_log (action, target_kind, target_id, before, after) VALUES ('version.publish', 'document_version', $1, $2, $3)`,
          [
            versionId,
            JSON.stringify({ status: "staged" }),
            JSON.stringify({ status: "published", kind: "amendment", marked_clauses: marked.rows.map((r) => r.number), unmatched: affected.filter((a) => !marked.rows.some((r) => r.number.toUpperCase() === a.toUpperCase())) }),
          ],
        );
        return {
          status: "published",
          superseded: [] as string[],
          marked_clauses: marked.rows.map((r) => r.number),
          unmatched_targets: affected.filter((a) => !marked.rows.some((r) => r.number.toUpperCase() === a.toUpperCase())),
          publishedChange: true,
        };
      }

      // Edition.
      const current = await client.query<{ id: string; edition_year: number | null }>(
        `SELECT id, edition_year FROM document_versions WHERE document_id = $1 AND kind = 'edition' AND status = 'published' AND id <> $2`,
        [v.document_id, versionId],
      );
      const curYear = current.rows[0]?.edition_year ?? null;
      if (curYear && v.edition_year && v.edition_year < curYear && body?.confirm_older !== true) {
        throw new DecisionError(
          `This edition (${v.edition_year}) is older than the published one (${curYear}). Publishing it replaces the newer edition.`,
          409,
          { needs_confirmation: "older_edition" },
        );
      }

      const prev = await client.query<{ id: string }>(
        `UPDATE document_versions SET status = 'superseded', superseded_at = now()
          WHERE document_id = $1 AND kind = 'edition' AND status = 'published' AND id <> $2
        RETURNING id`,
        [v.document_id, versionId],
      );
      await client.query(`UPDATE document_versions SET status = 'published', published_at = now() WHERE id = $1`, [versionId]);

      const terms: string[] = Array.isArray(body?.product_terms)
        ? Array.from(new Set(body.product_terms.map((t: unknown) => String(t).trim().toLowerCase()).filter((t: string) => t.length >= 3 && t.length <= 60))).slice(0, 20) as string[]
        : Array.isArray(meta.submitted_product_terms) && meta.submitted_product_terms.length
          ? meta.submitted_product_terms
          : v.product_terms ?? [];
      const title = meta.submitted_title || v.document_title;
      await client.query(
        `UPDATE documents SET title = $2, product_terms = $3, scope_text = COALESCE($4, scope_text), updated_at = now() WHERE id = $1`,
        [v.document_id, title, terms, meta.detected?.scope_excerpt ?? null],
      );

      if (v.doc_type === "standard" && meta.graph) {
        await applyGraph(
          client,
          versionId,
          { id: v.document_id, slug: v.legacy_doc_id || v.document_id, domain: v.domain, title, year: v.edition_year },
          meta.graph,
        );
      }

      await client.query(`UPDATE index_state SET version = version + 1, changed_at = now() WHERE id = 1`);
      await client.query(
        `INSERT INTO audit_log (action, target_kind, target_id, before, after) VALUES ('version.publish', 'document_version', $1, $2, $3)`,
        [
          versionId,
          JSON.stringify({ status: "staged" }),
          JSON.stringify({ status: "published", superseded: prev.rows.map((r) => r.id), product_terms: terms, reason }),
        ],
      );
      return { status: "published", superseded: prev.rows.map((r) => r.id), product_terms: terms, publishedChange: true };
    });

    if (result.publishedChange) invalidateStoreCache();
    const { publishedChange: _p, ...out } = result as typeof result & { publishedChange: boolean };
    return NextResponse.json({ version_id: versionId, ...out });
  } catch (err: any) {
    if (err instanceof DecisionError) return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status });
    console.error("[ingest] decision failed:", err);
    return NextResponse.json({ error: "The decision could not be saved. Check the server log." }, { status: 500 });
  }
}
