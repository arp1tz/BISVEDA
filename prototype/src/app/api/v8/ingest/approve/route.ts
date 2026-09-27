/**
 * POST /api/v8/ingest/approve
 * Approve or reject a provisional ingestion job.
 *
 * Body: { jobId: string; action: "approve" | "reject"; reason?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { approveIngestionJob, rejectIngestionJob, getIngestionResult } from "@/lib/ingestion/pipeline";

export async function POST(request: NextRequest) {
  let body: { jobId?: string; action?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobId, action, reason } = body;
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  if (action === "approve") {
    const ok = await approveIngestionJob(jobId);
    if (!ok) return NextResponse.json({ error: "Job not found or not in awaiting_review state" }, { status: 404 });
    return NextResponse.json({ status: "published", jobId });
  } else {
    const ok = await rejectIngestionJob(jobId, reason ?? "Rejected by officer");
    if (!ok) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ status: "rejected", jobId });
  }
}
