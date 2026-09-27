"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Search,
  Filter,
  FileText,
  Copy,
  CheckCircle2,
  ExternalLink,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import kbData from "../../../data/knowledge_base.json";

interface KnowledgeChunk {
  chunk_id: string;
  doc_id: string;
  doc_title: string;
  edition: string;
  standard_number: string;
  page_number: number;
  section: string;
  char_count: number;
  text: string;
}

interface KnowledgeBaseExplorerProps {
  onOpenWorkspaceWithQuery?: (query: string) => void;
}

export function KnowledgeBaseExplorer({ onOpenWorkspaceWithQuery }: KnowledgeBaseExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStandard, setSelectedStandard] = useState<string>("ALL");
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const allChunks: KnowledgeChunk[] = (kbData as any).chunks || [];

  const filteredChunks = allChunks.filter((chunk) => {
    if (selectedStandard !== "ALL" && !chunk.standard_number.includes(selectedStandard)) {
      return false;
    }
    if (selectedSection !== "ALL" && chunk.section !== selectedSection) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const combined = `${chunk.section} ${chunk.text} ${chunk.edition}`.toLowerCase();
      return combined.includes(q);
    }
    return true;
  });

  const availableSections = Array.from(new Set(allChunks.map((c) => c.section)));

  const handleCopyCitation = (chunk: KnowledgeChunk) => {
    const citation = `[BIS Citation: ${chunk.edition}, ${chunk.section}, Page ${chunk.page_number}]`;
    navigator.clipboard.writeText(citation);
    setCopiedId(chunk.chunk_id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-navy/20 bg-gradient-to-r from-surface-raised via-surface to-surface-alt p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-orange animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-navy">
                भारतीय मानक ब्यूरो • तकनीकी ज्ञानकोष
              </span>
              <span className="rounded bg-navy/10 px-2 py-0.5 text-[10px] font-bold text-navy">
                Official Dec 2024 Edition
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-navy tracking-tight mt-1">
              BIS Product Manuals & Inspection Schemes (STI)
            </h1>
            <p className="text-xs sm:text-sm text-ink-soft max-w-3xl mt-1 leading-relaxed">
              Verbatim technical clauses, in-house test equipment lists (Annex A), sampling quotas, and Scheme of Inspection & Testing (Annex B) extracted directly from official Bureau of Indian Standards manuals.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <span className="rounded-xl border border-border bg-surface-raised px-3 py-2 text-center text-xs shadow-2xs">
              <span className="block text-lg font-black text-navy">{allChunks.length}</span>
              <span className="text-[10px] text-ink-faint font-semibold uppercase">Indexed Chunks</span>
            </span>
            <span className="rounded-xl border border-border bg-surface-raised px-3 py-2 text-center text-xs shadow-2xs">
              <span className="block text-lg font-black text-orange">100%</span>
              <span className="text-[10px] text-ink-faint font-semibold uppercase">Gazette Grounded</span>
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-2xl border border-border bg-surface-raised p-4 shadow-xs space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search within manuals (e.g. 'sample quantity', 'drop tower', 'Annex A', 'durability', 'chin strap')..."
            className="w-full rounded-xl border border-border bg-surface-alt/50 pl-10 pr-4 py-2 text-xs sm:text-sm text-navy placeholder:text-ink-faint focus:border-navy focus:bg-surface-raised focus:outline-none transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-ink-faint flex items-center gap-1">
              <Filter className="h-3 w-3" /> Standard:
            </span>
            {["ALL", "IS 4151"].map((std) => (
              <button
                key={std}
                onClick={() => setSelectedStandard(std)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  selectedStandard === std
                    ? "bg-navy text-white shadow-2xs"
                    : "border border-border bg-surface hover:bg-surface-alt text-ink"
                }`}
              >
                {std === "ALL" ? "All Standards" : "IS 4151 (Helmets)"}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-ink-faint">Section:</span>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-bold text-navy focus:border-navy focus:outline-none"
            >
              <option value="ALL">All Sections</option>
              {availableSections.map((sec, idx) => (
                <option key={idx} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-ink-faint font-semibold px-1">
        <span>Showing {filteredChunks.length} statutory knowledge chunk(s)</span>
        <span>Source: BIS Product Manuals (PM/ IS 4151/ 3/ Dec 2024 & Jan 2019)</span>
      </div>

      {/* Chunks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredChunks.map((chunk) => (
          <div
            key={chunk.chunk_id}
            className="rounded-2xl border border-border bg-surface-raised p-5 shadow-xs hover:border-navy/40 transition-all flex flex-col justify-between space-y-3 group"
          >
            <div className="space-y-2">
              {/* Card Meta Header */}
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-navy/10 px-2 py-0.5 font-mono text-[10px] font-black text-navy">
                  {chunk.standard_number} • Page {chunk.page_number}
                </span>
                <span className="text-[10px] text-ink-faint font-bold font-mono">
                  {chunk.edition}
                </span>
              </div>

              {/* Section Badge */}
              <h3 className="text-xs sm:text-sm font-black text-navy group-hover:text-blue transition-colors">
                {chunk.section}
              </h3>

              {/* Verbatim Text Preview */}
              <p className="text-xs text-ink-soft leading-relaxed line-clamp-6 bg-surface-alt/40 p-3 rounded-xl border border-border/60 font-mono text-[11px]">
                {chunk.text}
              </p>
            </div>

            {/* Action Bar */}
            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
              <button
                onClick={() => handleCopyCitation(chunk)}
                className="inline-flex items-center gap-1.5 text-ink-faint hover:text-navy font-bold transition-colors"
                title="Copy Citation"
              >
                {copiedId === chunk.chunk_id ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    <span className="text-success text-[11px]">Citation Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span className="text-[11px]">Copy Citation</span>
                  </>
                )}
              </button>

              {onOpenWorkspaceWithQuery && (
                <button
                  onClick={() => onOpenWorkspaceWithQuery(`${chunk.standard_number} ${chunk.section}`)}
                  className="inline-flex items-center gap-1 font-bold text-navy hover:text-blue transition-colors text-[11px]"
                >
                  <span>Query in Core RAG</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
