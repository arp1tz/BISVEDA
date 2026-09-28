"use client";

import React from "react";
import { Sparkles, Shield, AlertTriangle, ExternalLink, CheckCircle2 } from "lucide-react";
import type { HallmarkCard as HallmarkCardData } from "@/lib/pipeline/respond";

interface HallmarkCardProps {
  card: HallmarkCardData;
}

export function HallmarkCard({ card }: HallmarkCardProps) {
  const { purity_karat, purity_fineness, huid, huid_format_valid } = card;

  return (
    <div className="w-full my-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4 text-[#0F172A] shadow-sm">
      {/* Title */}
      <div className="flex items-center gap-2 pb-3 border-b border-amber-200">
        <Sparkles className="w-5 h-5 text-[#E8710A]" />
        <h3 className="text-sm font-semibold text-[#0B2A4A]">
          BIS Gold Hallmark Verification Guide
        </h3>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
          IS 1417
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Purity Block */}
        {(purity_karat || purity_fineness) && (
          <div className="p-3 bg-white rounded-lg border border-amber-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Purity Grade
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-base font-bold text-slate-900">
                {purity_karat || ""} {purity_fineness ? `(${purity_fineness})` : ""}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              Conforms to IS 1417 Table 1 standard fineness grades.
            </p>
          </div>
        )}

        {/* HUID Block */}
        {huid && (
          <div className="p-3 bg-white rounded-lg border border-amber-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                HUID Code
              </span>
              {huid_format_valid === true ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" /> Valid format
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  <AlertTriangle className="w-3 h-3" /> Invalid format
                </span>
              )}
            </div>
            <div className="mt-1">
              <span className="font-mono text-base font-bold tracking-widest text-[#0B2A4A]">
                {huid}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              6-character alphanumeric laser-etched identification.
            </p>
          </div>
        )}
      </div>

      {/* Advisory Callout */}
      <div className="mt-3 p-3 bg-white/80 rounded-lg border border-amber-200 flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
        <Shield className="w-4 h-4 text-[#0B2A4A] flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-slate-900">Official Verification Method:</p>
          <p className="text-slate-600 mt-0.5">
            To verify authentic hallmarking registration and assaying details for this piece, enter the HUID code in the official <strong>BIS Care Mobile App</strong> under &quot;Verify HUID&quot;.
          </p>
        </div>
      </div>
    </div>
  );
}
