/**
 * GET /api/v8/standards
 * §5.2, §5.3, §21.3 | Spec ref: v8 architecture bis veda.txt
 *
 * Catalogue search with full filters:
 * - q: Search query (standard number, title, or keywords)
 * - group: Product group filter
 * - status: Regulatory or lifecycle status (Active / Mandatory / Withdrawn)
 * - limit: Max results (default 50)
 */

import { NextRequest, NextResponse } from "next/server";
import standardsData from "../../../../../data/standards.json";
import qcosData from "../../../../../data/qcos.json";
import type { StandardRecord, QCORecord } from "@/lib/types";

const standards = standardsData as unknown as (StandardRecord & { amendments?: string[] })[];
const qcos = qcosData as unknown as QCORecord[];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase().trim();
  const group = searchParams.get("group")?.toLowerCase().trim();
  const status = searchParams.get("status")?.toLowerCase().trim();
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  // Fast-lookup map for QCO mandatory status
  const qcoSet = new Set<string>();
  for (const qco of qcos) {
    if (qco.mandatory_qco || qco.is_mandatory) {
      qcoSet.add(qco.standard_number.split(":")[0].trim().toUpperCase());
    }
  }

  let filtered = standards;

  if (q) {
    filtered = filtered.filter((s) => {
      const num = s.standard_number.toLowerCase();
      const title = s.full_title.toLowerCase();
      const scope = (s.scope || "").toLowerCase();
      const keywords = (s.keywords || []).map((k) => k.toLowerCase()).join(" ");
      return (
        num.includes(q) ||
        title.includes(q) ||
        scope.includes(q) ||
        keywords.includes(q)
      );
    });
  }

  if (group) {
    filtered = filtered.filter(
      (s) =>
        s.product_category?.toLowerCase().includes(group) ||
        s.industry?.toLowerCase().includes(group)
    );
  }

  if (status) {
    if (status === "mandatory") {
      filtered = filtered.filter((s) => {
        const clean = s.standard_number.split(":")[0].trim().toUpperCase();
        return s.mandatory_qco || qcoSet.has(clean);
      });
    } else {
      filtered = filtered.filter((s) => s.status?.toLowerCase().includes(status));
    }
  }

  const results = filtered.slice(0, limit).map((s) => {
    const cleanNum = s.standard_number.split(":")[0].trim().toUpperCase();
    const isMandatory = s.mandatory_qco || qcoSet.has(cleanNum);
    return {
      id: s.standard_id,
      standard_number: s.standard_number,
      full_title: s.full_title,
      product_category: s.product_category,
      industry: s.industry,
      scheme: s.scheme,
      certification_route: s.certification_route,
      year: s.year || s.standard_number.match(/:\s*(\d{4})/)?.[1] || "2020",
      status: s.status || "Active",
      knowledge_tier: "Tier A (Catalogue Record)",
      verification_status: s.verification_status || "VERIFIED",
      is_mandatory: isMandatory,
      scope: s.scope,
      amendments_count: s.amendments?.length || 0,
      source_url: s.source_url || "https://standards.bis.gov.in",
    };
  });

  return NextResponse.json({
    total: filtered.length,
    returned: results.length,
    standards: results,
  });
}
