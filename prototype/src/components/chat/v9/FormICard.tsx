"use client";

import React from "react";
import Link from "next/link";
import { FileText, Printer, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import type { FormICard as FormICardData } from "@/lib/pipeline/respond";

interface FormICardProps {
  card: FormICardData;
}

export function FormICard({ card }: FormICardProps) {
  const { fields, missing_required, print_url } = card;

  const filledKeys = Object.keys(fields).filter((k) => fields[k]?.trim().length > 0);
  const totalCount = 13;
  const isComplete = missing_required.length === 0;

  const handleOpenPrint = () => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("bisveda_form_i_state", JSON.stringify(fields));
      } catch (err) {
        console.error("Failed to store form state in sessionStorage", err);
      }
    }
  };

  return (
    <div className="w-full my-4 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden text-[#0F172A]">
      {/* Header */}
      <div className="bg-[#0B2A4A] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#E8710A]" />
          <div>
            <h3 className="text-sm font-semibold tracking-wide">
              Form I Jeweller Registration Application
            </h3>
            <p className="text-[11px] text-slate-300">
              {filledKeys.length} of {totalCount} fields drafted
            </p>
          </div>
        </div>

        {isComplete ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready to Print
          </span>
        ) : (
          <span className="text-[11px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
            Draft in progress
          </span>
        )}
      </div>

      <div className="p-4 space-y-3.5">
        {/* Filled Fields Preview */}
        {filledKeys.length > 0 ? (
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto divide-y divide-slate-100 pr-1">
            {filledKeys.map((key) => (
              <div key={key} className="pt-1.5 first:pt-0 flex items-start justify-between gap-3 text-xs">
                <span className="text-slate-500 capitalize">{key.replace(/_/g, " ")}:</span>
                <span className="font-semibold text-slate-900 text-right max-w-[65%] truncate">
                  {fields[key]}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">
            No fields recorded yet. Answer the questions above to populate your official registration draft.
          </p>
        )}

        {/* Missing Required Warning (if any) */}
        {!isComplete && missing_required.length > 0 && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
            <div className="flex items-center gap-1.5 font-semibold text-amber-800 mb-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Pending required fields ({missing_required.length}):</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
              {missing_required.slice(0, 3).map((item, idx) => (
                <li key={idx} className="truncate">{item}</li>
              ))}
              {missing_required.length > 3 && (
                <li className="italic text-slate-500">+ {missing_required.length - 3} more</li>
              )}
            </ul>
          </div>
        )}

        {/* Action Button */}
        {print_url && (
          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <span className="text-[11px] text-slate-500">
              Official Manak Online format
            </span>

            <Link
              href={print_url}
              onClick={handleOpenPrint}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-[#0B2A4A] hover:bg-[#081e35] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Open Printable Draft</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
