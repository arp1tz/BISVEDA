import { NextRequest, NextResponse } from "next/server";
import { getAllLabs, getAllAhcs, loadStore } from "@/lib/kb/store";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "labs" | "ahc" | undefined

    await loadStore();
    const labs = getAllLabs();
    const ahcs = getAllAhcs();

    const labsRetrievedAt = labs[0]?.retrieved_at || "2026-09-27";
    const ahcsRetrievedAt = ahcs[0]?.retrieved_at || "2026-09-27";

    if (type === "labs") {
      return NextResponse.json({
        total: labs.length,
        retrieved_at: labsRetrievedAt,
        data: labs,
      });
    }

    if (type === "ahc") {
      return NextResponse.json({
        total: ahcs.length,
        retrieved_at: ahcsRetrievedAt,
        data: ahcs,
      });
    }

    return NextResponse.json({
      counts: {
        labs: labs.length,
        ahc: ahcs.length,
      },
      retrieved_at: {
        labs: labsRetrievedAt,
        ahc: ahcsRetrievedAt,
      },
      labs,
      ahcs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
