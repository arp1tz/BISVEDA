/**
 * POST /api/v8/ingest
 * Upload a document into the ingestion pipeline (§7.1–§7.4).
 * Streams IngestionJobEvents via SSE or returns final result.
 *
 * Body (multipart/form-data):
 *   file: File (PDF/TXT/DOCX, ≤25 MB)
 *   claimedStandard?: string (e.g. "IS 4151")
 *   knowledgeTier?: "A" | "B" | "C"
 *   sourceUrl?: string
 *   stream?: "true" | "false"
 */
import { NextRequest, NextResponse } from "next/server";
import { runIngestionPipeline, IngestionJobEvent } from "@/lib/ingestion/pipeline";
import { createHash, randomUUID } from "crypto";

export const maxDuration = 60; // seconds

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const claimedStandard = (formData.get("claimedStandard") as string) || undefined;
  const knowledgeTier = ((formData.get("knowledgeTier") as string) || "B") as "A" | "B" | "C";
  const sourceUrl = (formData.get("sourceUrl") as string) || undefined;
  const stream = formData.get("stream") === "true";
  const uploadedBy = (formData.get("uploadedBy") as string) || "officer";

  const buffer = Buffer.from(await file.arrayBuffer());
  const jobId = `job-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const documentId = `doc-${createHash("sha256").update(buffer).digest("hex").slice(0, 16)}`;

  if (stream) {
    // SSE streaming mode
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        function send(data: object) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        try {
          const result = await runIngestionPipeline(
            {
              jobId,
              documentId,
              filename: file.name,
              content: buffer,
              mimeType: file.type || "application/octet-stream",
              claimedStandardNumber: claimedStandard,
              knowledgeTier,
              sourceUrl,
              uploadedBy,
            },
            (event: IngestionJobEvent) => send({ type: "job_event", event })
          );
          send({ type: "complete", result });
        } catch (err) {
          send({ type: "error", error: err instanceof Error ? err.message : String(err) });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Job-Id": jobId,
      },
    });
  }

  // Non-streaming: run pipeline and return result
  try {
    const result = await runIngestionPipeline({
      jobId,
      documentId,
      filename: file.name,
      content: buffer,
      mimeType: file.type || "application/octet-stream",
      claimedStandardNumber: claimedStandard,
      knowledgeTier,
      sourceUrl,
      uploadedBy,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v8/ingest?jobId=...
 * Poll for job status.
 */
export async function GET(request: NextRequest) {
  const { getIngestionResult, listIngestionJobs } = await import("@/lib/ingestion/pipeline");
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (jobId) {
    const result = getIngestionResult(jobId);
    if (!result) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json(result);
  }

  const jobs = listIngestionJobs();
  return NextResponse.json({ jobs });
}
