import { NextRequest, NextResponse } from "next/server";
import { query, tx } from "@/lib/db/client";
import { checkPdfBuffer, storeOriginal } from "@/lib/ingest/upload";

export const runtime = "nodejs";

type RecordStatus = "indexed" | "processing" | "failed";

interface IngestRecordRow {
  version_id: string;
  document_id: string;
  title: string;
  edition_label: string | null;
  status: string;
  file_name: string;
  file_bytes: string | number;
  uploaded_at: string;
  extracted_meta: { domain?: string; doc_class?: string; uploaded_by_label?: string } | null;
  job_state: string | null;
  job_error: string | null;
}

function mapStatus(status: string): RecordStatus {
  if (status === "published") return "indexed";
  if (status === "failed") return "failed";
  return "processing";
}

/** Lists the most recent uploaded versions with their latest job state (real data, no simulation). */
export async function GET() {
  const rows = await query<IngestRecordRow>(
    `SELECT v.id AS version_id, v.document_id, d.title, v.edition_label, v.status,
            v.file_name, v.file_bytes, v.uploaded_at, v.extracted_meta,
            j.state AS job_state, j.error AS job_error
       FROM document_versions v
       JOIN documents d ON d.id = v.document_id
       LEFT JOIN LATERAL (
         SELECT state, error FROM ingestion_jobs
          WHERE version_id = v.id ORDER BY created_at DESC LIMIT 1
       ) j ON true
      ORDER BY v.uploaded_at DESC
      LIMIT 200`,
  );

  const records = rows.map((r) => ({
    id: r.version_id,
    standard_id: r.document_id,
    title: r.title,
    domain: r.extracted_meta?.domain ?? "",
    version: r.edition_label ?? "",
    doc_class: r.extracted_meta?.doc_class ?? "",
    file_name: r.file_name,
    file_size_kb: Math.round(Number(r.file_bytes) / 1024),
    chunk_count: 0,
    node_count: 0,
    status: mapStatus(r.status),
    raw_status: r.status,
    job_state: r.job_state,
    error: r.job_error,
    timestamp: new Date(r.uploaded_at).toISOString(),
    ingested_by: r.extracted_meta?.uploaded_by_label ?? "",
  }));

  return NextResponse.json({ records });
}

function docTypeFor(docClass: string): "standard" | "form" | "guideline" {
  if (docClass === "Application / Form Guideline") return "guideline";
  return "standard";
}

function yearFrom(label: string): number | null {
  const m = label.match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

/** Accepts one PDF plus metadata (multipart/form-data), stores it and queues an ingest job. */
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

  const standardId = String(form.get("standard_id") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const domain = String(form.get("domain") ?? "").trim();
  const docClass = String(form.get("doc_class") ?? "").trim();
  const editionLabel = String(form.get("version") ?? "").trim();

  if (!standardId || !title) {
    return NextResponse.json({ error: "Enter both the Standard ID and the Document Title." }, { status: 400 });
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

  const filePath = await storeOriginal(check.sha256, buf);
  const uploadedByLabel = "Staff upload";

  try {
    const result = await tx(async (client) => {
      await client.query(
        `INSERT INTO documents (id, doc_type, title, domain, display_order)
         VALUES ($1, $2, $3, $4, 0)
         ON CONFLICT (id) DO NOTHING`,
        [standardId, docTypeFor(docClass), title, domain || "Other / General"],
      );
      const version = await client.query<{ id: string }>(
        `INSERT INTO document_versions
           (document_id, kind, edition_label, edition_year, status, file_sha256, file_path,
            file_name, file_bytes, extracted_meta)
         VALUES ($1, 'edition', $2, $3, 'uploaded', $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          standardId,
          editionLabel || null,
          yearFrom(editionLabel),
          check.sha256,
          filePath,
          file.name,
          check.bytes,
          JSON.stringify({ domain, doc_class: docClass, uploaded_by_label: uploadedByLabel, submitted_title: title }),
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
        status: "uploaded",
        message: `Stored ${file.name} (${Math.round(check.bytes / 1024)} KB) and queued it for ingestion. It is not searchable until an officer approves it.`,
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
