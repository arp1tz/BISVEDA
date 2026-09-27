/**
 * BISVEDA — KB build, Stage 5: Knowledge graph (P1.6)
 *
 * Every node and edge is derived from the ingested documents (and, once
 * built, the labs/AHC directories) — nothing here is invented. Every edge
 * carries a `source` so the admin graph view (P7.2) can show provenance.
 */

import fs from "fs";
import path from "path";
import type { GraphEdge, GraphNode, KbChunk, KbGraph, KbStandard, SourceDoc } from "./types";

const PROTOTYPE_ROOT = path.resolve(__dirname, "../..");
const DIRECTORY_DIR = path.join(PROTOTYPE_ROOT, "data", "directory");

// Matches "IS 2062", "IS 2062:2011", "IS 9873 (Part 1)", "IS 9873 Part 1" etc.
const IS_CITE_RE = /\bIS\s*(\d{2,6})\s*(?:\(\s*Part\s*(\d+)\s*\)|Part\s*(\d+))?(?:\s*:\s*\d{4})?/gi;

function canonicalizeRef(num: string, part?: string): string {
  return part ? `IS ${num} (Part ${part})` : `IS ${num}`;
}

function extractReferences(text: string, ownStandardId: string): Map<string, number> {
  const counts = new Map<string, number>();
  let m: RegExpExecArray | null;
  IS_CITE_RE.lastIndex = 0;
  while ((m = IS_CITE_RE.exec(text)) !== null) {
    const canon = canonicalizeRef(m[1], m[2] || m[3]);
    if (canon === ownStandardId) continue; // not a real cross-reference
    counts.set(canon, (counts.get(canon) || 0) + 1);
  }
  return counts;
}

interface LabDirEntry {
  id: string;
  name: string;
  city?: string;
  state?: string;
  standards_in_scope?: string[]; // populated by scripts/directory/labs.ts (P1.8)
  source_url?: string;
}

interface AhcDirEntry {
  recognition_no: string;
  state?: string;
  status?: string;
}

function loadJsonIfExists<T>(file: string): T | null {
  const p = path.join(DIRECTORY_DIR, file);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

export function buildGraph(sources: SourceDoc[], standards: KbStandard[], chunks: KbChunk[]): KbGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const standardIds = new Set(standards.map((s) => s.id));

  // Domain nodes
  const domains = new Set(sources.map((s) => s.domain));
  for (const d of domains) {
    nodes.push({ id: `domain:${d}`, type: "domain", label: d });
  }

  // Standard nodes + IN_DOMAIN edges
  for (const std of standards) {
    nodes.push({
      id: `std:${std.id}`,
      type: "standard",
      label: std.id,
      props: { title: std.title, year: std.year, chunk_count: std.chunk_count },
    });
    const doc = sources.find((s) => s.doc_id === std.doc_id);
    edges.push({
      src: `std:${std.id}`,
      dst: `domain:${std.domain}`,
      type: "IN_DOMAIN",
      source: doc?.source_url || std.doc_id,
    });
  }

  // Clause nodes (top-level and second-level only) + HAS_CLAUSE edges
  const seenClauses = new Set<string>();
  for (const chunk of chunks) {
    const depth = chunk.clause.split(".").length;
    if (depth > 2) continue;
    if (!/^\d/.test(chunk.clause)) continue; // skip Annex/Table/Figure pseudo-clauses here
    const clauseNodeId = `clause:${chunk.standard_id}#${chunk.clause}`;
    if (!seenClauses.has(clauseNodeId)) {
      seenClauses.add(clauseNodeId);
      nodes.push({
        id: clauseNodeId,
        type: "clause",
        label: `${chunk.clause} ${chunk.clause_title}`.trim(),
        props: { standard_id: chunk.standard_id, page: chunk.page_start },
      });
      edges.push({
        src: `std:${chunk.standard_id}`,
        dst: clauseNodeId,
        type: "HAS_CLAUSE",
        source: `${chunk.doc_id} p.${chunk.page_start}`,
      });
    }
  }

  // References: aggregate per (standard_id -> cited ref) across all of a standard's chunks
  const refCounts = new Map<string, Map<string, number>>(); // standard_id -> ref -> count
  const refFirstSource = new Map<string, string>(); // "std|ref" -> doc_id p.N
  for (const chunk of chunks) {
    const refs = extractReferences(chunk.text, chunk.standard_id);
    if (refs.size === 0) continue;
    const bucket = refCounts.get(chunk.standard_id) ?? new Map<string, number>();
    for (const [ref, count] of refs) {
      bucket.set(ref, (bucket.get(ref) || 0) + count);
      const key = `${chunk.standard_id}|${ref}`;
      if (!refFirstSource.has(key)) refFirstSource.set(key, `${chunk.doc_id} p.${chunk.page_start}`);
    }
    refCounts.set(chunk.standard_id, bucket);
  }

  const seenRefNodes = new Set<string>();
  for (const [standardId, refs] of refCounts) {
    for (const [ref, count] of refs) {
      const isInternal = standardIds.has(ref);
      const dstId = isInternal ? `std:${ref}` : `ref:${ref}`;
      if (!isInternal && !seenRefNodes.has(dstId)) {
        seenRefNodes.add(dstId);
        nodes.push({ id: dstId, type: "reference", label: ref });
      }
      edges.push({
        src: `std:${standardId}`,
        dst: dstId,
        type: "REFERENCES",
        weight: count,
        source: refFirstSource.get(`${standardId}|${ref}`) || standardId,
      });
    }
  }

  // Form node + FORM_FOR edge (Form I -> IS 1417, the only standard it names that's in our KB)
  const formDoc = sources.find((s) => s.domain === "forms");
  if (formDoc) {
    nodes.push({ id: `form:${formDoc.doc_id}`, type: "form", label: formDoc.title });
    if (standardIds.has("IS 1417")) {
      edges.push({
        src: `form:${formDoc.doc_id}`,
        dst: "std:IS 1417",
        type: "FORM_FOR",
        source: formDoc.doc_id,
      });
    }
  }

  // Labs (P1.8 output, if it exists yet) — TESTS edges only for labs whose
  // scope includes a KB standard.
  const labs = loadJsonIfExists<LabDirEntry[]>("labs.json");
  if (labs) {
    for (const lab of labs) {
      const scopedStandards = (lab.standards_in_scope || []).filter((s) => standardIds.has(s));
      if (scopedStandards.length === 0) continue;
      nodes.push({
        id: `lab:${lab.id}`,
        type: "lab",
        label: lab.name,
        props: { city: lab.city, state: lab.state },
      });
      for (const stdId of scopedStandards) {
        edges.push({
          src: `lab:${lab.id}`,
          dst: `std:${stdId}`,
          type: "TESTS",
          source: lab.source_url || "BIS LIMS",
        });
      }
    }
  }

  // AHCs (P1.9 output, if it exists yet) — grouped by state to keep the graph light.
  const ahcs = loadJsonIfExists<AhcDirEntry[]>("ahc.json");
  if (ahcs && standardIds.has("IS 1417")) {
    const states = new Set(
      ahcs.filter((a) => (a.status || "").toLowerCase().includes("operative")).map((a) => a.state).filter(Boolean)
    );
    for (const state of states) {
      const nodeId = `ahc-region:${state}`;
      nodes.push({ id: nodeId, type: "ahc_region", label: `AHCs — ${state}` });
      edges.push({
        src: nodeId,
        dst: "domain:gold",
        type: "HALLMARKS",
        source: "Manak Online AHC list",
      });
    }
  }

  return { nodes, edges };
}
