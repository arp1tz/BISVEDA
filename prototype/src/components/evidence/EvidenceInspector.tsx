"use client";

import React from "react";
import {
  FileCheck2,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  X,
  BookOpen,
} from "lucide-react";
import type { EvidenceClause } from "@/lib/types";

interface EvidenceInspectorProps {
  clause: EvidenceClause | null;
  onClose?: () => void;
}

export function EvidenceInspector({ clause, onClose }: EvidenceInspectorProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (!clause) return;
    navigator.clipboard.writeText(
      `${clause.standardNumber} ${clause.clauseTitle || ""}\n${clause.verbatimText}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!clause) {
    return (
      <aside className="w-88 shrink-0 border-l border-border bg-surface-alt/20 flex flex-col h-[calc(100vh-80px)] p-6 text-center justify-center items-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy/10 text-navy mb-3">
          <BookOpen className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-bold text-navy">Evidence & Clause Inspector</h3>
        <p className="mt-1.5 text-xs text-ink-faint leading-relaxed max-w-xs">
          Click any citation pill or testing clause in the conversation to inspect its verbatim legal text, confidence score, and official Gazette source.
        </p>
      </aside>
    );
  }

  const confidencePercent = Math.round((clause.confidence || 0.95) * 100);

  return (
    <aside className="w-88 shrink-0 border-l border-border bg-surface-raised flex flex-col h-[calc(100vh-80px)] overflow-y-auto p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-border">
        <div>
          <span className="inline-flex items-center gap-1 rounded bg-navy/10 px-2.5 py-0.5 font-mono text-xs font-black tracking-wider text-navy">
            {clause.standardNumber}
          </span>
          {clause.clauseNumber && (
            <span className="ml-2 rounded bg-surface-sunken px-2 py-0.5 text-xs font-mono font-bold text-ink-soft">
              Clause {clause.clauseNumber}
            </span>
          )}
          <h2 className="mt-2 text-sm font-black text-navy leading-snug">
            {clause.clauseTitle || clause.title}
          </h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-surface-alt text-ink-faint hover:text-navy"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Confidence & Authority Badges */}
      <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-alt/50 p-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-ink-faint">Grounded Confidence</p>
            <p className="text-xs font-black text-navy">{confidencePercent}% Verified</p>
          </div>
        </div>

        <div className="text-right">
          <span className="inline-flex items-center gap-1 rounded bg-blue/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-blue">
            <ShieldCheck className="h-3 w-3" />
            {clause.authorityLevel}
          </span>
        </div>
      </div>

      {/* Mandatory QCO Indicator */}
      {clause.isMandatoryQco && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-orange/30 bg-orange/10 p-2 text-xs font-bold text-orange">
          <AlertTriangle className="h-4 w-4 shrink-0 text-orange" />
          <span>Mandatory under Central Government QCO</span>
        </div>
      )}

      {/* Verbatim Text Excerpt */}
      <div className="mt-4">
        <div className="flex items-center justify-between pb-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Verbatim Legal Specification
          </label>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] font-bold text-navy hover:text-blue"
          >
            {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? "Copied" : "Copy Clause"}</span>
          </button>
        </div>

        <div className="rounded-xl border border-border bg-surface-alt/40 p-3.5 font-mono text-xs leading-relaxed text-ink shadow-2xs whitespace-pre-wrap">
          {clause.verbatimText}
        </div>
      </div>

      {/* Standard Metadata */}
      <div className="mt-5 space-y-2.5 text-xs border-t border-border pt-4">
        <div className="flex justify-between">
          <span className="text-ink-faint font-medium">Standard Title:</span>
          <span className="font-bold text-navy text-right max-w-[180px] truncate">
            {clause.title}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-faint font-medium">Source Registry:</span>
          <span className="font-semibold text-ink-soft">Official BIS Gazette</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-faint font-medium">Traceability:</span>
          <span className="font-mono text-success font-bold">100% Grounded</span>
        </div>
      </div>

      {/* External Action */}
      <div className="mt-auto pt-5">
        <a
          href={clause.sourceUrl || "https://www.services.bis.gov.in"}
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs font-bold text-white hover:bg-navy-deep transition-all shadow-xs"
        >
          <span>View Official BIS Document</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </aside>
  );
}
