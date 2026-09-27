import { NextRequest, NextResponse } from "next/server";
import { localGetAdminGraph } from "@/lib/local-db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const focus = searchParams.get("focus") || undefined;
    const depthParam = searchParams.get("depth");
    const depth = depthParam ? parseInt(depthParam, 10) : undefined;
    const typesParam = searchParams.get("types");
    const types = typesParam ? typesParam.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
    const includeProposed = searchParams.get("includeProposed") === "true";

    const graphData = await localGetAdminGraph({
      focus,
      depth,
      types,
      includeProposed,
    });

    return NextResponse.json(graphData);
  } catch (err: any) {
    console.error("[Graph API Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch graph topology" },
      { status: 500 }
    );
  }
}
