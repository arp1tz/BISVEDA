import { NextRequest, NextResponse } from "next/server";
import { localGetVersionImpact } from "@/lib/local-db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vid: string }> }
) {
  try {
    const { vid } = await params;
    const versionId = parseInt(vid, 10);
    if (isNaN(versionId)) {
      return NextResponse.json({ error: "Invalid version ID" }, { status: 400 });
    }

    const impact = await localGetVersionImpact(versionId);
    return NextResponse.json(impact);
  } catch (err: any) {
    console.error("[Version Impact API Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to compute version impact" },
      { status: 500 }
    );
  }
}
