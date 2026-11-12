import { NextRequest, NextResponse } from "next/server";
import { getAllLabs, loadStore } from "@/lib/kb/store";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const standard = searchParams.get("standard") || "";
    const city = searchParams.get("city") || "";
    const state = searchParams.get("state") || "";

    await loadStore();
    let labs = getAllLabs();

    if (standard) {
      const stdNorm = standard.toLowerCase().replace(/[^a-z0-9]/g, "");
      labs = labs.filter((l) =>
        l.standards_in_scope.some((s) => s.toLowerCase().replace(/[^a-z0-9]/g, "").includes(stdNorm))
      );
    }

    if (city) {
      const cNorm = city.toLowerCase().trim();
      labs = labs.filter((l) => (l.city || "").toLowerCase().includes(cNorm));
    }

    if (state) {
      const sNorm = state.toLowerCase().trim();
      labs = labs.filter((l) => (l.state || "").toLowerCase().includes(sNorm));
    }

    return NextResponse.json({
      total: labs.length,
      retrieved_at: labs[0]?.retrieved_at || "2026-09-27",
      labs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
