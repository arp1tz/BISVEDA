"use client";

import React from "react";
import { ShieldCheck, ExternalLink, Smartphone } from "lucide-react";
import type { MarkCard as MarkCardData } from "@/lib/pipeline/respond";

interface MarkCardProps {
  card: MarkCardData;
}

export function MarkCard({ card }: MarkCardProps) {
  const { cml_number, note } = card;

  return (
    <div className="w-full my-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4 text-[#0F172A] shadow-sm">
      <div className="flex items-center gap-2 pb-2.5 border-b border-blue-200">
        <ShieldCheck className="w-5 h-5 text-[#0B2A4A]" />
        <h3 className="text-sm font-semibold text-[#0B2A4A]">
          BIS Standard Mark Licence Information
        </h3>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
          ISI / CM-L
        </span>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-white rounded-lg border border-blue-200">
        <div>
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
            Licence Number
          </span>
          <div className="mt-0.5">
            <span className="font-mono text-base font-bold text-[#0B2A4A] tracking-wider">
              {cml_number || "CM/L Recognized"}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {note}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href="https://www.manakonline.in"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B2A4A] hover:bg-[#081e35] text-white text-xs font-medium transition-colors shadow-sm"
          >
            <span>Manak Online</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-600 px-1">
        <Smartphone className="w-3.5 h-3.5 text-slate-500" />
        <span>You can also check licence status using &quot;Verify Licence for Care&quot; in the BIS Care app.</span>
      </div>
    </div>
  );
}
