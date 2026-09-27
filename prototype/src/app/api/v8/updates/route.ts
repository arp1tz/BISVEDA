/**
 * GET /api/v8/updates
 * §5.2, §5.4 | Spec ref: v8 architecture bis veda.txt
 *
 * What's New Feed — aggregate feed of regulatory Quality Control Orders,
 * Gazette notifications, and standard amendments.
 */

import { NextRequest, NextResponse } from "next/server";
import qcosData from "../../../../../data/qcos.json";
import standardsData from "../../../../../data/standards.json";
import type { QCORecord, StandardRecord } from "@/lib/types";

const qcos = qcosData as unknown as QCORecord[];
const standards = standardsData as unknown as (StandardRecord & { amendments?: string[] })[];

export interface UpdateItem {
  id: string;
  type: "QCO_MANDATORY" | "AMENDMENT" | "NEW_STANDARD" | "ANNOUNCEMENT";
  title: string;
  ministry?: string;
  effectiveDate: string;
  standardNumbers: string[];
  summary: string;
  sourceUrl: string;
  officialGazette?: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const typeFilter = searchParams.get("type")?.toUpperCase();
  const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 100);

  const updates: UpdateItem[] = [];

  // 1. QCO updates
  for (const qco of qcos) {
    updates.push({
      id: `upd-qco-${qco.standard_number.replace(/\s+/g, "")}`,
      type: "QCO_MANDATORY",
      title: qco.order_name || qco.full_title,
      ministry: qco.ministry || "Ministry of Commerce and Industry",
      effectiveDate: qco.gazette_date || qco.publication_date || "2024-03-01",
      standardNumbers: [qco.standard_number],
      summary: `Mandatory BIS certification enforced under BIS Act §16. All domestic and imported goods must bear ISI mark.`,
      sourceUrl: "https://www.egazette.gov.in",
    });
  }

  // 2. Standards with amendments
  for (const std of standards) {
    if (std.amendments && std.amendments.length > 0) {
      for (let i = 0; i < std.amendments.length; i++) {
        const amdText = std.amendments[i];
        updates.push({
          id: `upd-amd-${std.standard_id}-${i}`,
          type: "AMENDMENT",
          title: `${amdText} to ${std.standard_number}`,
          effectiveDate: "2024-01-15",
          standardNumbers: [std.standard_number],
          summary: `Technical modifications and conformity assessment updates for ${std.full_title}.`,
          sourceUrl: std.source_url || "https://standards.bis.gov.in",
        });
      }
    }
  }

  // Sort by effectiveDate descending
  updates.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));

  let filtered = updates;
  if (typeFilter) {
    filtered = filtered.filter((u) => u.type === typeFilter);
  }

  return NextResponse.json({
    total: filtered.length,
    returned: filtered.slice(0, limit).length,
    updates: filtered.slice(0, limit),
  });
}
