/**
 * POST /api/v8/ingest/publish/[jobId]
 * Approve and publish an ingested document.
 */
import { NextRequest, NextResponse } from "next/server";
import { approveIngestionJob } from "@/lib/ingestion/pipeline";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  try {
    const ok = await approveIngestionJob(jobId);
    if (!ok) {
      return NextResponse.json(
        { error: "Job not found or not in awaiting_review state" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, status: "published", jobId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
