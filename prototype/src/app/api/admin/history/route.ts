import { NextRequest, NextResponse } from "next/server";
import { localGetAuditLogs } from "@/lib/local-db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const target_type = searchParams.get("target_type") || undefined;
    const target_id = searchParams.get("target_id") || undefined;

    const logs = await localGetAuditLogs({ target_type, target_id });
    return NextResponse.json({ logs, total: logs.length });
  } catch (err: any) {
    console.error("[History API Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load audit history" },
      { status: 500 }
    );
  }
}
