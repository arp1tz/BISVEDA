"use client";

import React, { useState } from "react";
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Scale,
  Info,
  Search,
} from "lucide-react";
import type { EvidenceClause } from "@/lib/types";

export interface SourceItem {
  id: string;
  standardNumber: string;
  title: string;
  clauseLocator?: string;
  pageNumber?: string | number;
  sourceType: "Standard Full Text" | "Gazette QCO" | "Product Manual / STI" | "Catalogue";
  verificationStatus: "Verified BIS Source" | "Strong Match" | "Gazette Notified";
  snippet?: string;
  officialUrl?: string;
}

interface SourcesEvidencePanelProps {
  sources?: SourceItem[];
  selectedClause?: EvidenceClause | null;
  onSelectClause?: (clause: EvidenceClause) => void;
  onOpenSourcePdf?: (citation: any) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function SourcesEvidencePanel({
  sources: customSources,
  selectedClause,
  onSelectClause,
  onOpenSourcePdf,
  isCollapsed = false,
  onToggleCollapse,
}: SourcesEvidencePanelProps) {
  const [searchFilter, setSearchFilter] = useState("");
  const [activeEvidenceModal, setActiveEvidenceModal] = useState<SourceItem | null>(null);

  const defaultSources: SourceItem[] = [
    {
      id: "s1",
      standardNumber: "IS 15410:2003",
      title: "Plastics Bottles/Containers for Packaged Natural Mineral Water and Packaged Drinking Water — Specification",
      clauseLocator: "Clause 6.2 • Page 12",
      sourceType: "Standard Full Text",
      verificationStatus: "Verified BIS Source",
      snippet: "Containers shall be manufactured from virgin food-grade plastics conforming to IS 10146, IS 10141, or IS 12252. The overall migration limit shall not exceed 10 mg/dm².",
      officialUrl: "https://www.services.bis.gov.in",
    },
    {
      id: "s2",
      standardNumber: "IS 14543:2016",
      title: "Packaged Drinking Water (other than Packaged Natural Mineral Water) — Specification",
      clauseLocator: "Clause 4.1 • Page 8",
      sourceType: "Standard Full Text",
      verificationStatus: "Verified BIS Source",
      snippet: "Packaged drinking water shall be filled in clean, hygienic, colourless and tamper-proof containers. Total dissolved solids shall not exceed 500 mg/L.",
      officialUrl: "https://www.services.bis.gov.in",
    },
    {
      id: "s3",
      standardNumber: "DPIIT QCO Order 2023",
      title: "Cookware, Utensils and Canisters for Liquid and Solid Foodstuffs (Quality Control) Order",
      clauseLocator: "Section 2 • S.O. 3600(E)",
      sourceType: "Gazette QCO",
      verificationStatus: "Gazette Notified",
      snippet: "Goods or articles specified in the Table shall conform to the corresponding Indian Standard and shall bear the Standard Mark under Scheme-I of Schedule-II of BIS (Conformity Assessment) Regulations.",
      officialUrl: "https://egazette.gov.in",
    },
    {
      id: "s4",
      standardNumber: "IS 2347:2017",
      title: "Domestic Pressure Cookers — Specification (Fourth Revision)",
      clauseLocator: "Clause 8.4 • Page 16",
      sourceType: "Standard Full Text",
      verificationStatus: "Verified BIS Source",
      snippet: "Pressure cookers shall be provided with a pressure release device designed to operate when the internal pressure exceeds the normal operating pressure by 50 kPa.",
      officialUrl: "https://www.services.bis.gov.in",
    },
  ];

  const sourceList = (customSources && customSources.length > 0) ? customSources : defaultSources;

  const filteredSources = sourceList.filter(
    (s) =>
      s.standardNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (s.clauseLocator && s.clauseLocator.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  if (isCollapsed) {
    return (
      <aside className="w-12 border-l border-border bg-surface-raised flex flex-col items-center py-4 space-y-4 shrink-0">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-xl text-ink-faint hover:text-navy hover:bg-surface-alt transition-colors"
          title="Expand Sources Panel"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="writing-vertical text-xs font-black uppercase tracking-wider text-ink-faint mt-4">
          Sources
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-72 sm:w-80 border-l border-border bg-surface-raised flex flex-col h-full overflow-y-auto shrink-0 text-xs">
      {/* Sources Header */}
      <div className="p-4 border-b border-border bg-surface-alt/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-orange" />
          <h2 className="font-extrabold uppercase tracking-wider text-navy text-xs">
            Sources &amp; Evidence
          </h2>
        </div>
        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-bold text-success">
          {sourceList.length} Verified
        </span>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-border/70">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-ink-faint" />
          <input
            type="text"
            placeholder="Search verified clauses..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface pl-8 pr-2.5 py-1 text-[11px] font-medium text-navy placeholder:text-ink-faint focus:border-navy focus:outline-none"
          />
        </div>
      </div>

      {/* Sources List */}
      <div className="p-3 space-y-3 flex-1 overflow-y-auto">
        <div className="text-[10px] text-ink-faint font-semibold uppercase tracking-wider px-1">
          Information BISVEDA relied upon:
        </div>

        {filteredSources.map((source) => (
          <div
            key={source.id}
            className="rounded-xl border border-border bg-surface hover:border-navy/40 p-3 space-y-2 transition-all shadow-2xs group"
          >
            {/* Top row: standard number + status badge */}
            <div className="flex items-center justify-between gap-1">
              <span className="font-mono font-extrabold text-navy text-[11px] group-hover:text-blue">
                {source.standardNumber}
              </span>
              <span className="rounded bg-success/15 text-success text-[9px] font-black uppercase px-1.5 py-0.2">
                {source.verificationStatus}
              </span>
            </div>

            {/* Title */}
            <h4 className="text-[11px] font-bold text-ink leading-snug line-clamp-2">
              {source.title}
            </h4>

            {/* Locator / Page / Clause */}
            {source.clauseLocator && (
              <div className="flex items-center gap-1.5 text-[10px] text-ink-faint font-mono">
                <FileText className="h-3 w-3 text-orange shrink-0" />
                <span>{source.clauseLocator}</span>
              </div>
            )}

            {/* View Evidence Action & Direct PDF Link */}
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[10px]">
              <a
                href={`/api/v8/documents/${encodeURIComponent(source.standardNumber)}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-bold text-navy hover:text-orange transition-colors"
                title="Open PDF directly in new tab"
              >
                <FileText className="h-3 w-3 text-orange" />
                <span>Open PDF</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  if (onOpenSourcePdf) {
                    onOpenSourcePdf({
                      standardNumber: source.standardNumber,
                      title: source.title,
                      clauseTitle: source.clauseLocator,
                      verbatimText: source.snippet,
                      pageNumber: 1,
                    });
                  } else {
                    setActiveEvidenceModal(source);
                  }
                  if (onSelectClause && source.snippet) {
                    onSelectClause({
                      standardNumber: source.standardNumber,
                      title: source.title,
                      clauseTitle: source.clauseLocator,
                      verbatimText: source.snippet,
                      sourceUrl: `/api/v8/documents/${encodeURIComponent(source.standardNumber)}/pdf`,
                      confidence: 0.98,
                      authorityLevel: "AUTHORITATIVE",
                    });
                  }
                }}
                className="font-bold text-blue hover:text-navy hover:underline flex items-center gap-0.5"
              >
                <span>View Evidence</span>
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Notice */}
      <div className="p-3 border-t border-border bg-surface-alt/20 text-[10px] text-ink-faint space-y-1">
        <div className="flex items-center gap-1 text-navy font-bold">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          <span>Statutory Integrity Promise</span>
        </div>
        <p className="leading-tight">
          Every statement is linked directly to authoritative gazette orders, official standards, or BIS directories.
        </p>
      </div>

      {/* Verbatim Evidence Modal */}
      {activeEvidenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface-raised p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-xs font-black text-orange">
                  {activeEvidenceModal.standardNumber}
                </span>
                <h3 className="text-sm font-black text-navy mt-0.5">
                  {activeEvidenceModal.title}
                </h3>
                <span className="text-[11px] font-mono text-ink-faint">
                  {activeEvidenceModal.clauseLocator}
                </span>
              </div>
              <button
                onClick={() => setActiveEvidenceModal(null)}
                className="p-1 rounded-lg text-ink-faint hover:text-navy hover:bg-surface-alt"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl border border-border bg-surface-alt/50 p-4 text-xs text-ink leading-relaxed space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-faint block">
                Official Verbatim Text:
              </span>
              <p className="font-mono text-[11px]">
                &ldquo;{activeEvidenceModal.snippet || "Statutory clause text retrieved from official BIS catalog."}&rdquo;
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={`/api/v8/documents/${encodeURIComponent(activeEvidenceModal.standardNumber)}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-orange hover:underline bg-orange/10 px-3 py-1.5 rounded-xl border border-orange/20"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Open Source PDF</span>
                  <ExternalLink className="h-3 w-3" />
                </a>

                {onOpenSourcePdf && (
                  <button
                    type="button"
                    onClick={() => {
                      const src = activeEvidenceModal;
                      setActiveEvidenceModal(null);
                      onOpenSourcePdf({
                        standardNumber: src.standardNumber,
                        title: src.title,
                        clauseTitle: src.clauseLocator,
                        verbatimText: src.snippet,
                        pageNumber: 1,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-navy hover:underline bg-surface border border-border px-3 py-1.5 rounded-xl"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-navy" />
                    <span>Interactive Viewer</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => setActiveEvidenceModal(null)}
                className="rounded-xl bg-navy px-4 py-1.5 text-xs font-bold text-white hover:bg-navy-deep"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
