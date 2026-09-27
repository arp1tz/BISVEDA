/**
 * GET /api/v8/ingest/quarantine
 * Retrieves documents and uploads held in quarantine for security verification or injection flags.
 */

import { NextResponse } from "next/server";
import { getQuarantineStore } from "@/lib/quarantine-store";

export async function GET() {
  const store = getQuarantineStore();
  return NextResponse.json({
    total: store.length,
    records: store,
  });
}
