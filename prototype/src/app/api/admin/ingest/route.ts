import { NextRequest, NextResponse } from "next/server";
import { query, tx } from "@/lib/db/client";
import { domainKey, normalizeStandardId, slugForId } from "@/lib/ingest/ids";
import { checkPdfBuffer, storeOriginal } from "@/lib/ingest/upload";

export const runtime = "nodejs";

interface IngestRecordRow {
  version_id: string;
  document_id: string;
  title: string;
  domain: string;
  doc_type: string;
  kind: string;
  amendment_no: number | null;
  edition_label: string | null;
  edition_year: number | null;
  status: string;
  file_name: string;
  file_bytes: string | number;
  uploaded_at: string;
  extracted_meta: { doc_class?: string; uploaded_by_label?: string; submitted_title?: string; mismatches?: unknown[] } | null;
  job_state: string | null;
  job_step: string | null;
  job_error: string | null;
  job_run_after: string | null;
  chunk_count: string;
}

/** Lists the most recent document versions with their latest job, and whether an ingestion worker is running. */
export async function GET() {
  const [rows, workers] = await Promise.all([
    query<IngestRecordRow>(
      `SELECT v.id AS version_id, v.document_id, d.title, d.domain, d.doc_type, v.kind, v.amendment_no,
              v.edition_label, v.edition_year, v.status, v.file_name, v.file_bytes, v.uploaded_at, v.extracted_meta,
              j.state AS job_state, j.step AS job_step, j.error AS job_error, j.run_after AS job_run_after,
              (SELECT count(*) FROM chunks c WHERE c.version_id = v.id) AS chunk_count
         FROM document_versions v
         JOIN documents d ON d.id = v.document_id
         LEFT JOIN LATERAL (
           SELECT state, step, error, run_after FROM ingestion_jobs
            WHERE version_id = v.id ORDER BY created_at DESC LIMIT 1
         ) j ON true
        ORDER BY v.uploaded_at DESC
        LIMIT 200`,
    ),
    query<{ worker_id: string; seen_at: string; current_job: string | null; age_s: number }>(
      `SELECT worker_id, seen_at, current_job, EXTRACT(EPOCH FROM now() - seen_at)::float AS age_s
         FROM worker_heartbeats ORDER BY seen_at DESC`,
    ),
  ]);

  const records = rows.map((r) => ({
    id: r.version_id,
    standard_id: r.document_id,
    title: r.extracted_meta?.submitted_title ?? r.title,
    domain: r.domain,
    kind: r.kind,
    amendment_no: r.amendment_no,
    version: r.edition_label ?? (r.kind === "amendment" ? `Amendment No. ${r.amendment_no}` : r.edition_year ? String(r.edition_year) : ""),
    doc_class: r.extracted_meta?.doc_class ?? r.doc_type,
    file_name: r.file_name,
    file_size_kb: Math.round(Number(r.file_bytes) / 1024),
    chunk_count: Number(r.chunk_count),
    status: r.status,
    job_state: r.job_state,
    job_step: r.job_step,
    error: r.job_error,
    retry_at: r.job_state === "queued" && r.job_error ? r.job_run_after : null,
    mismatch_count: Array.isArray(r.extracted_meta?.mismatches) ? r.extracted_meta!.mismatches!.length : 0,
    timestamp: new Date(r.uploaded_at).toISOString(),
    ingested_by: r.extracted_meta?.uploaded_by_label ?? "",
  }));

  // A worker refreshes its heartbeat every poll (2 s) and during long steps; allow for a long embedding batch.
  const alive = workers.filter((w) => w.age_s < 120);
  return NextResponse.json({
    records,
    worker: { running: alive.length > 0, count: alive.length, last_seen: workers[0]?.seen_at ?? null },
  });
}

function docTypeFor(docClass: string): "standard" | "form" | "guideline" {
  if (docClass === "Application / Form Guideline") return "form";
  if (docClass === "Test Method / Protocol" || docClass === "Standard Specification") return "standard";
  return "guideline";
}

function yearFrom(label: string): number | null {
  const m = label.match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

function parseTerms(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,;\n]/)
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length >= 3 && t.length <= 60),
    ),
  ).slice(0, 20);
}

/**
 * Accepts one PDF plus metadata (multipart/form-data), stores it and queues an ingest job.
 * Fields: file, standard_id ("IS 4151", "IS 4151:1993", "IS 9873 (Part 1)"), title, domain,
 * doc_class, version (edition label), kind ("edition" | "amendment"), amendment_no, product_terms.
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart upload with a file field." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was attached." }, { status: 400 });
  }

  const rawId = String(form.get("standard_id") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const domain = domainKey(String(form.get("domain") ?? "").trim());
  const docClass = String(form.get("doc_class") ?? "").trim();
  const editionLabel = String(form.get("version") ?? "").trim();
  const kind = String(form.get("kind") ?? "edition") === "amendment" ? "amendment" : "edition";
  const amendmentNo = Number(String(form.get("amendment_no") ?? "").trim()) || null;
  const productTerms = parseTerms(String(form.get("product_terms") ?? ""));

  if (!rawId || !title) {
    return NextResponse.json({ error: "Enter both the Standard ID and the Document Title." }, { status: 400 });
  }
  const norm = normalizeStandardId(rawId);
  if (norm.id.length > 80) return NextResponse.json({ error: "The Standard ID is too long." }, { status: 400 });
  if (kind === "amendment" && !amendmentNo) {
    return NextResponse.json({ error: "Enter the amendment number (for example 1 for Amendment No. 1)." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const check = checkPdfBuffer(buf);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const existing = await query<{ id: string; status: string; document_id: string }>(
    `SELECT id, status, document_id FROM document_versions WHERE file_sha256 = $1`,
    [check.sha256],
  );
  if (existing.length > 0) {
    return NextResponse.json(
      {
        error: `This exact file is already registered (${existing[0].document_id}, status ${existing[0].status}).`,
        existing_version_id: existing[0].id,
      },
      { status: 409 },
    );
  }

  // An amendment changes the currently published edition of its standard.
  let baseVersionId: string | null = null;
  if (kind === "amendment") {
    const base = await query<{ id: string }>(
      `SELECT id FROM document_versions WHERE document_id = $1 AND kind = 'edition' AND status = 'published'`,
      [norm.id],
    );
    if (!base[0]) {
      return NextResponse.json(
        { error: `${norm.id} has no published edition to amend. Publish the edition first, then upload its amendments.` },
        { status: 400 },
      );
    }
    baseVersionId = base[0].id;
    const dup = await query<{ id: string }>(
      `SELECT id FROM document_versions WHERE base_version_id = $1 AND amendment_no = $2 AND status NOT IN ('rejected', 'failed')`,
      [baseVersionId, amendmentNo],
    );
    if (dup[0]) {
      return NextResponse.json({ error: `Amendment No. ${amendmentNo} to ${norm.id} is already uploaded.` }, { status: 409 });
    }
  }

  const filePath = await storeOriginal(check.sha256, buf);
  const uploadedByLabel = "Staff upload";

  try {
    const result = await tx(async (client) => {
      const slugBase = slugForId(norm.id) || "doc";
      const slugTaken = await client.query(`SELECT 1 FROM documents WHERE legacy_doc_id = $1 AND id <> $2`, [slugBase, norm.id]);
      const slug = slugTaken.rowCount ? `${slugBase}-${check.sha256.slice(0, 6)}` : slugBase;
      await client.query(
        `INSERT INTO documents (id, legacy_doc_id, doc_type, base_number, part, title, domain, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT COALESCE(max(display_order), 0) + 1 FROM documents))
         ON CONFLICT (id) DO NOTHING`,
        [norm.id, slug, docTypeFor(docClass), norm.baseNumber, norm.part, title, domain],
      );
      const version = await client.query<{ id: string }>(
        `INSERT INTO document_versions
           (document_id, kind, base_version_id, edition_label, edition_year, amendment_no, status, file_sha256, file_path,
            file_name, file_bytes, extracted_meta)
         VALUES ($1, $2, $3, $4, $5, $6, 'uploaded', $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          norm.id,
          kind,
          baseVersionId,
          editionLabel || null,
          kind === "edition" ? norm.year ?? yearFrom(editionLabel) : yearFrom(editionLabel),
          kind === "amendment" ? amendmentNo : null,
          check.sha256,
          filePath,
          file.name,
          check.bytes,
          JSON.stringify({
            doc_class: docClass,
            uploaded_by_label: uploadedByLabel,
            submitted_title: title,
            submitted_id: rawId,
            submitted_product_terms: productTerms,
          }),
        ],
      );
      const versionId = version.rows[0].id;
      const job = await client.query<{ id: string }>(
        `INSERT INTO ingestion_jobs (version_id, type, state) VALUES ($1, 'ingest', 'queued') RETURNING id`,
        [versionId],
      );
      return { versionId, jobId: job.rows[0].id };
    });

    return NextResponse.json(
      {
        version_id: result.versionId,
        job_id: result.jobId,
        document_id: norm.id,
        status: "uploaded",
        message:
          `Stored ${file.name} (${Math.round(check.bytes / 1024)} KB) as ${kind === "amendment" ? `Amendment No. ${amendmentNo} to ` : ""}${norm.id}` +
          ` and queued it for ingestion. It is not searchable until an officer approves it.`,
      },
      { status: 201 },
    );
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json({ error: "This exact file was registered a moment ago." }, { status: 409 });
    }
    console.error("[ingest] upload failed:", err);
    return NextResponse.json({ error: "The upload could not be saved. Check the server log." }, { status: 500 });
  }
}
