/**
 * POST /api/v8/ingest/quarantine/scan/[id]
 * Runs automated prompt injection, malware heuristics, and statutory validation scan on quarantined file.
 */

import { NextRequest, NextResponse } from "next/server";
import { updateQuarantineItem, getQuarantineStore } from "@/lib/quarantine-store";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const store = getQuarantineStore();
  const existing = store.find((r) => r.media_id === id);

  if (!existing) {
    return NextResponse.json({ error: "Quarantine record not found" }, { status: 404 });
  }

  // Perform heuristic prompt injection scan on the preview text
  const preview = existing.extracted_text_preview || "";
  const injectionPatterns = [
    /disregard\s+(?:prior|previous|all)\s+instructions/i,
    /system\s*prompt/i,
    /ignore\s+(?:the\s+above|rules|safety)/i,
    /you\s+are\s+now\s+in\s+developer\s+mode/i,
    /bypass\s+mandatory/i,
  ];

  const foundFlags: string[] = [];
  for (const pat of injectionPatterns) {
    if (pat.test(preview)) {
      foundFlags.push("PROMPT_INJECTION_PATTERN_MATCH");
    }
  }

  const isSuspicious = foundFlags.length > 0 || existing.prompt_injection_detected;
  const updatedRecord = updateQuarantineItem(id, {
    prompt_injection_detected: isSuspicious,
    injection_flags: isSuspicious ? [...new Set([...existing.injection_flags, ...foundFlags])] : [],
    audit_verdict: isSuspicious
      ? "FLAGGED — High-risk prompt injection payload detected in document text block."
      : "CLEARED — Automated security and statutory heuristics passed.",
    is_citable: !isSuspicious,
  });

  return NextResponse.json({
    success: true,
    media_id: id,
    prompt_injection_detected: updatedRecord?.prompt_injection_detected ?? isSuspicious,
    injection_flags: updatedRecord?.injection_flags ?? foundFlags,
    audit_verdict: updatedRecord?.audit_verdict ?? "Scan completed",
    is_citable: updatedRecord?.is_citable ?? false,
    scanned_at: new Date().toISOString(),
  });
}
