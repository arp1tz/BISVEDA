/**
 * BISVEDA V9 — Stage 9: Evidence Package Builder (lib/pipeline/package.ts)
 * 
 * Constructs the frozen EvidencePackage containing stable S1..Sn sources.
 * This is the ONLY context the LLM receives.
 * 
 * Fixes B5: Separates doc_version_id, clause_id, and page fields cleanly.
 */

import { AdjudicationPackage } from "./adjudicate";
import { ChunkRow } from "../kb/store";

export interface Source {
  label: string;                // 'S1', 'S2', etc.
  kind: "chunk" | "fact" | "faq" | "catalogue";
  standard_id?: string;         // 'IS 4151'
  title: string;                // Human readable source title
  clause_id?: string;           // '4.2' (never put this in doc_version_id)
  page?: number;
  doc_version_id?: number;      // Version ID for PDF lookup
  has_file: boolean;            // Whether file is stored locally
  url: string;                  // Official source URL
  text: string;                 // Exact excerpt
}

export interface EvidencePackage {
  primary_standard: { id: string; title: string } | null;
  standards: Array<{ id: string; title: string; class: string; why: string }>;
  qco_status: "mandatory" | "notified_not_in_force" | "unknown";
  qco_title?: string;
  scheme?: string;
  steps: Array<{ text: string; source: string }>;
  labs_count: number;
  sources: Source[];
}

export function buildEvidencePackage(
  adjudicated: AdjudicationPackage,
  fusedChunks: ChunkRow[]
): EvidencePackage {
  const sources: Source[] = [];
  let sIndex = 1;

  // 1. Primary Standard Source (Catalogue / Identity)
  if (adjudicated.primaryStandard) {
    sources.push({
      label: `S${sIndex++}`,
      kind: "catalogue",
      standard_id: adjudicated.primaryStandard.id,
      title: `${adjudicated.primaryStandard.id} — ${adjudicated.primaryStandard.title}`,
      has_file: false,
      url: "https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/knowyourstandards/indian_standards/isdetails",
      text: `${adjudicated.primaryStandard.id} establishes the official Indian Standard requirements, specifications, and quality criteria for ${adjudicated.primaryStandard.title}.`,
    });
  }

  // 2. QCO Source (if present)
  if (adjudicated.qco && adjudicated.qco.status !== "unknown") {
    sources.push({
      label: `S${sIndex++}`,
      kind: "fact",
      standard_id: adjudicated.primaryStandard?.id,
      title: adjudicated.qco.order_title || "Official Gazette Quality Control Order",
      has_file: false,
      url: adjudicated.qco.source,
      text: `${adjudicated.qco.order_title || "Quality Control Order"} mandates that no person shall manufacture, import, distribute, or sell goods conforming to ${adjudicated.primaryStandard?.id || "this standard"} without the Bureau of Indian Standards (BIS) Standard Mark.`,
    });
  }

  // 3. Scheme Steps Source (if present)
  if (adjudicated.scheme && adjudicated.scheme.steps.length > 0) {
    sources.push({
      label: `S${sIndex++}`,
      kind: "fact",
      standard_id: adjudicated.primaryStandard?.id,
      title: `${adjudicated.scheme.scheme_name} Procedure`,
      has_file: false,
      url: "https://www.bis.gov.in/product-certification/scheme-i-isi-mark/",
      text: adjudicated.scheme.steps.map((s, idx) => `Step ${idx + 1}: ${s.text}`).join(". "),
    });
  }

  // 4. Evidence Chunks for Primary Standard (isolated from other standards)
  const primaryClean = adjudicated.primaryStandard?.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const relevantChunks = fusedChunks.filter((c) => {
    if (!primaryClean) return false;
    const stdClean = (c.standard_number || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return stdClean === primaryClean || stdClean.includes(primaryClean) || primaryClean.includes(stdClean);
  });

  for (const chunk of relevantChunks.slice(0, 4)) {
    const clauseText = (chunk.text || "").replace(/\s+/g, " ").trim();
    if (!clauseText) continue;

    sources.push({
      label: `S${sIndex++}`,
      kind: "chunk",
      standard_id: chunk.standard_number,
      title: `${chunk.standard_number || "Indian Standard"} — Clause ${chunk.clause_number || "General"}: ${chunk.clause_title || "Technical Requirement"}`,
      clause_id: chunk.clause_number,
      page: chunk.page_numbers?.[0],
      doc_version_id: 1, // Points to version 1
      has_file: true,
      url: chunk.source_url || `/api/sources/1/file`,
      text: clauseText.slice(0, 500),
    });
  }

  return {
    primary_standard: adjudicated.primaryStandard,
    standards: adjudicated.standards.map((s) => ({
      id: s.id,
      title: s.title,
      class: s.class,
      why: s.why,
    })),
    qco_status: adjudicated.qco?.status || "unknown",
    qco_title: adjudicated.qco?.order_title,
    scheme: adjudicated.scheme?.scheme_name,
    steps: adjudicated.scheme?.steps || [],
    labs_count: adjudicated.labs.length,
    sources,
  };
}
