import { NextRequest, NextResponse } from "next/server";
import { localDiffVersions } from "@/lib/local-db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vid: string; b: string }> }
) {
  try {
    const { vid, b } = await params;
    const vIdA = parseInt(vid, 10);
    const vIdB = parseInt(b, 10);

    if (isNaN(vIdA) || isNaN(vIdB)) {
      return NextResponse.json({ error: "Invalid version IDs" }, { status: 400 });
    }

    const diffResult = await localDiffVersions(vIdA, vIdB);
    return NextResponse.json(diffResult);
  } catch (err: any) {
    console.error("[Version Diff API Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to compare versions" },
      { status: 500 }
    );
  }
}
