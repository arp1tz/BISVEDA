"use client";

import React, { useState } from "react";
import {
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  FlaskConical,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { EvidenceClause, RecommendationResult } from "@/lib/types";

interface RecommendationCardProps {
  rec: RecommendationResult;
  onSelectClause: (clause: EvidenceClause) => void;
  onOpenExplainSimply?: (rec: RecommendationResult) => void;
}

export function RecommendationCard({
  rec,
  onSelectClause,
  onOpenExplainSimply,
}: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(rec.isPrimary);

  // Applicability tone styling
  const getApplicabilityStyle = () => {
    switch (rec.applicability) {
      case "DIRECTLY_APPLICABLE":
        return "bg-success/15 text-success border-success/30";
      case "MATERIAL_MISMATCH":
        return "bg-danger/15 text-danger border-danger/30 font-bold";
      case "POTENTIALLY_APPLICABLE":
        return "bg-warning/15 text-warning border-warning/30";
      default:
        return "bg-surface-alt text-ink-soft border-border";
    }
  };

  const getApplicabilityLabel = () => {
    switch (rec.applicability) {
      case "DIRECTLY_APPLICABLE":
        return "Directly Applicable Standard";
      case "MATERIAL_MISMATCH":
        return "Material Mismatch (See Details)";
      case "POTENTIALLY_APPLICABLE":
        return "Potentially Applicable";
      default:
        return "Related Standard";
    }
  };

  return (
    <div
      className={`rounded-xl border transition-all ${
        rec.isPrimary
          ? "border-navy/30 bg-surface-raised shadow-xs ring-1 ring-navy/10"
          : "border-border/70 bg-surface-raised/80 hover:border-navy/20"
      }`}
    >
      {/* Top Banner for Material Mismatch or Primary */}
      {rec.applicability === "MATERIAL_MISMATCH" && (
        <div className="flex items-center gap-2 rounded-t-xl bg-danger/10 px-4 py-1.5 text-xs font-bold text-danger border-b border-danger/20">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Warning: {rec.applicabilityReason}</span>
        </div>
      )}

      <div className="p-4 sm:p-5">
        {/* Header Row: Standard Number, Title, Score */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-navy/10 px-2.5 py-0.5 font-mono text-xs font-black tracking-wider text-navy">
                {rec.standardNumber}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold ${getApplicabilityStyle()}`}
              >
                {getApplicabilityLabel()}
              </span>
              {rec.mandatoryQco && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange/15 px-2 py-0.5 text-[10.5px] font-bold text-orange">
                  <ShieldCheck className="h-3 w-3" /> Mandatory QCO
                </span>
              )}
            </div>

            <h3 className="mt-2 text-base sm:text-lg font-black text-navy leading-snug">
              {rec.title}
            </h3>
          </div>

          {/* Relevance Meter */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
              Relevance
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-sm font-black text-navy">
                {Math.round(rec.relevanceScore * 100)}%
              </span>
              <div className="h-2 w-14 rounded-full bg-surface-alt overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue"
                  style={{ width: `${Math.round(rec.relevanceScore * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Why this applies explainer */}
        <div className="mt-3 rounded-lg bg-surface-alt/50 p-2.5 text-xs text-ink-soft border border-border/50">
          <p className="font-semibold text-navy flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-orange" />
            <span>Why this standard applies:</span>
          </p>
          <p className="mt-0.5 text-ink-soft leading-relaxed">
            {rec.applicabilityReason}
          </p>
        </div>

        {/* Expandable Testing Requirements */}
        {rec.testingClauses && rec.testingClauses.length > 0 && (
          <div className="mt-3 border-t border-border/60 pt-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex w-full items-center justify-between text-xs font-bold text-navy hover:text-blue"
            >
              <span className="flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5 text-blue" />
                <span>
                  Mandatory Lab Testing Parameters ({rec.testingClauses.length} Mandated Clauses)
                </span>
              </span>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {expanded && (
              <div className="mt-2.5 space-y-2">
                {rec.testingClauses.map((clause, idx) => (
                  <div
                    key={idx}
                    onClick={() => onSelectClause(clause)}
                    className="group flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-surface-raised p-2.5 hover:border-navy/40 hover:shadow-xs cursor-pointer transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        {clause.clauseNumber && (
                          <span className="rounded bg-navy/10 px-1.5 py-0.2 font-mono text-[10.5px] font-bold text-navy">
                            Cl. {clause.clauseNumber}
                          </span>
                        )}
                        <span className="text-xs font-bold text-navy group-hover:text-blue">
                          {clause.clauseTitle || clause.title}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-ink-soft line-clamp-2">
                        {clause.verbatimText}
                      </p>
                    </div>

                    <span className="shrink-0 text-[10px] font-bold text-blue opacity-0 group-hover:opacity-100 transition-opacity">
                      Inspect →
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Card Footer Actions */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-ink-faint">Scheme:</span>
            <span className="font-semibold text-navy">{rec.scheme}</span>
          </div>

          <div className="flex items-center gap-3">
            {onOpenExplainSimply && (
              <button
                onClick={() => onOpenExplainSimply(rec)}
                className="font-bold text-orange hover:underline text-xs"
              >
                Explain Simply (सरल भाषा)
              </button>
            )}
            <a
              href={rec.sourceUrl || "https://www.services.bis.gov.in"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-navy hover:text-blue"
            >
              <span>BIS Gazette Source</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
