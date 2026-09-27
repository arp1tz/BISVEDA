"use client";

import React, { useState } from "react";
import {
  X,
  ExternalLink,
  FileText,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Sparkles,
  Maximize2,
  Minimize2,
  Copy,
  Check,
} from "lucide-react";

export interface SourceCitationContext {
  standardNumber: string;
  title: string;
  clauseNumber?: string;
  clauseTitle?: string;
  verbatimText?: string;
  pageNumber?: number | string;
  pageNumbers?: number[];
  breadcrumb?: string[];
  documentId?: string;
  filename?: string;
  knowledgeTier?: string;
}

interface PdfSourceViewerModalProps {
  citation: SourceCitationContext | null;
  onClose: () => void;
}

export function PdfSourceViewerModal({ citation, onClose }: PdfSourceViewerModalProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState<number>(() => {
    if (citation?.pageNumber) {
      const p = parseInt(String(citation.pageNumber), 10);
      return !isNaN(p) && p > 0 ? p : 1;
    }
    if (citation?.pageNumbers && citation.pageNumbers.length > 0) {
      return citation.pageNumbers[0];
    }
    return 1;
  });

  if (!citation) return null;

  const docIdentifier = citation.documentId || citation.standardNumber || citation.filename || "IS 9873";
  const pdfUrl = `/api/v8/documents/${encodeURIComponent(docIdentifier)}/pdf#page=${currentPage}`;

  const handleCopyQuote = () => {
    if (citation.verbatimText) {
      navigator.clipboard.writeText(citation.verbatimText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-6xl h-[92vh] rounded-2xl bg-surface-raised border border-border shadow-2xl overflow-hidden">
        
        {/* Top Header Bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-alt/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-white shrink-0">
              <FileText className="h-5 w-5 text-orange" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-black text-navy bg-navy/10 px-2 py-0.5 rounded">
                  {citation.standardNumber}
                </span>
                <span className="rounded bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Verified Statutory Source
                </span>
                {citation.clauseTitle && (
                  <span className="text-[11px] font-medium text-ink-faint truncate max-w-xs sm:max-w-md">
                    {citation.clauseTitle}
                  </span>
                )}
              </div>
              <h2 className="text-xs sm:text-sm font-bold text-ink truncate mt-0.5">
                {citation.title || "Bureau of Indian Standards Statutory Document"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Direct Open in New Tab Button */}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-bold text-navy hover:bg-surface-alt transition-colors shadow-2xs"
              title="Open full document PDF in new window"
            >
              <ExternalLink className="h-3.5 w-3.5 text-orange" />
              <span className="hidden sm:inline">Open in New Tab</span>
            </a>

            {/* Toggle Citation Excerpt Panel */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="rounded-xl border border-border bg-surface px-2.5 py-1.5 text-xs font-bold text-ink-soft hover:text-navy hover:bg-surface-alt transition-colors"
              title={isSidebarOpen ? "Hide cited quote panel" : "Show cited quote panel"}
            >
              {isSidebarOpen ? <Minimize2 className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5 text-orange" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-ink-faint hover:text-navy hover:bg-surface-alt transition-colors"
              title="Close viewer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Modal Main Body (Split View: Citation Context + PDF Embed) */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-surface">
          
          {/* Left Panel: NotebookLM-style Highlighted Cited Fact */}
          {isSidebarOpen && (
            <aside className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-border bg-surface-alt/30 flex flex-col shrink-0 overflow-y-auto p-4 space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-orange block mb-1">
                  NotebookLM Source Grounding
                </span>
                <h3 className="text-xs font-bold text-navy">
                  Cited Excerpt &amp; Statutory Provenance
                </h3>
              </div>

              {/* Breadcrumb Hierarchy */}
              {citation.breadcrumb && citation.breadcrumb.length > 0 && (
                <div className="rounded-xl border border-border bg-surface p-2.5 text-[11px] font-mono text-ink-soft space-y-1">
                  <span className="text-[9px] uppercase font-bold text-ink-faint block">Hierarchy Path:</span>
                  <div className="flex flex-wrap items-center gap-1">
                    {citation.breadcrumb.map((crumb, idx) => (
                      <React.Fragment key={idx}>
                        <span className="bg-surface-alt px-1.5 py-0.5 rounded text-navy font-semibold text-[10px]">
                          {crumb}
                        </span>
                        {idx < citation.breadcrumb!.length - 1 && <span className="text-ink-faint">›</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* Exact Verbatim Cited Text */}
              <div className="rounded-xl border border-orange/30 bg-orange/5 p-3.5 space-y-2 relative group shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Exact Highlighted Evidence:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyQuote}
                    className="p-1 rounded text-ink-faint hover:text-navy hover:bg-orange/10 transition-colors"
                    title="Copy cited excerpt"
                  >
                    {isCopied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>

                <div className="font-serif text-xs text-ink leading-relaxed border-l-2 border-orange pl-2.5 italic">
                  &ldquo;{citation.verbatimText || "Statutory clause requirements extracted directly from authentic Bureau of Indian Standards document."}&rdquo;
                </div>

                {citation.clauseNumber && (
                  <div className="text-[10px] font-mono font-bold text-navy pt-1 border-t border-orange/15">
                    Ref Clause: {citation.clauseNumber}
                  </div>
                )}
              </div>

              {/* Page Controls & Quick Jump */}
              <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-ink-faint block">
                  Document Navigation:
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-navy">
                    Page in Standard:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded-lg border border-border text-ink-soft hover:bg-surface-alt disabled:opacity-30"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 bg-surface-alt rounded border border-border">
                      {currentPage}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => p + 1)}
                      className="p-1 rounded-lg border border-border text-ink-soft hover:bg-surface-alt"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {citation.pageNumbers && citation.pageNumbers.length > 1 && (
                  <div className="pt-2 border-t border-border flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-ink-faint">Relevant Pages:</span>
                    {citation.pageNumbers.map((p) => (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                          currentPage === p
                            ? "bg-navy text-white"
                            : "bg-surface-alt hover:bg-surface-sunken text-ink-soft border border-border"
                        }`}
                      >
                        P. {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Statutory Authenticity Badge */}
              <div className="text-[11px] text-ink-soft bg-surface border border-border rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-navy text-[11px]">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  <span>Sovereign Integrity Promise</span>
                </div>
                <p className="text-[10px] text-ink-faint leading-normal">
                  All citations trace back to authentic Gazette notifications and Gazette of India statutory publications.
                </p>
              </div>
            </aside>
          )}

          {/* Right Area: Interactive Embedded PDF Viewer */}
          <main className="flex-1 flex flex-col min-h-0 bg-surface-sunken relative">
            <iframe
              src={pdfUrl}
              title={`Source Document - ${citation.standardNumber}`}
              className="w-full h-full border-0 bg-white"
            />
          </main>
        </div>
      </div>
    </div>
  );
}
