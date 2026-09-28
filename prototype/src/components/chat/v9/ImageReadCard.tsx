"use client";

import React from "react";
import { Camera, CheckCircle2, AlertCircle, Eye } from "lucide-react";
import type { ImageReadCard as ImageReadCardData } from "@/lib/pipeline/respond";

interface ImageReadCardProps {
  card: ImageReadCardData;
}

export function ImageReadCard({ card }: ImageReadCardProps) {
  const {
    category,
    product_guess,
    description,
    label_text,
    isi_mark_seen,
    bis_hallmark_seen,
    purity_mark,
    huid,
    cml_number,
    confidence_note,
  } = card;

  return (
    <div className="w-full my-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-[#0F172A] text-xs">
      <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200">
        <Camera className="w-4 h-4 text-[#0B2A4A]" />
        <span className="font-semibold text-slate-800">
          What we read from your photo
        </span>
        <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded bg-slate-200 text-slate-700">
          User-Provided Evidence
        </span>
      </div>

      <div className="mt-2.5 space-y-2">
        {product_guess && (
          <div className="flex items-baseline gap-2">
            <span className="text-slate-500 font-medium">Product / Object:</span>
            <span className="font-semibold text-slate-900">{product_guess}</span>
            {category && (
              <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                {category}
              </span>
            )}
          </div>
        )}

        {description && (
          <p className="text-slate-600 italic">
            &ldquo;{description}&rdquo;
          </p>
        )}

        {label_text && (
          <div className="p-2 bg-white rounded border border-slate-200 font-mono text-[11px] text-slate-800 break-words">
            <span className="text-[10px] text-slate-400 font-sans block mb-0.5">Visible label text:</span>
            {label_text}
          </div>
        )}

        {/* Badges for marks seen */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {isi_mark_seen === true && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" /> ISI Mark Seen
            </span>
          )}

          {bis_hallmark_seen === true && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              <CheckCircle2 className="w-3 h-3" /> BIS Hallmark Symbol Seen
            </span>
          )}

          {cml_number && (
            <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
              Licence: {cml_number}
            </span>
          )}

          {purity_mark && (
            <span className="text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Purity: {purity_mark}
            </span>
          )}

          {huid && (
            <span className="text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-mono">
              HUID: {huid}
            </span>
          )}
        </div>

        {confidence_note && (
          <p className="text-[10px] text-slate-400 pt-0.5">
            Note: {confidence_note}
          </p>
        )}
      </div>
    </div>
  );
}
