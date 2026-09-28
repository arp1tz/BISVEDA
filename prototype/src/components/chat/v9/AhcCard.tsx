"use client";

import React from "react";
import { Award, MapPin, Calendar, ShieldCheck, CheckCircle2 } from "lucide-react";
import type { AhcCard as AhcCardData } from "@/lib/pipeline/respond";
import { LabsMap } from "./LabsMap";

interface AhcCardProps {
  card: AhcCardData;
}

export function AhcCard({ card }: AhcCardProps) {
  const { ahcs } = card;

  // Prepare map pins for AHCs with coordinates
  const mapPins = ahcs
    .filter((a) => typeof a.lat === "number" && typeof a.lng === "number")
    .map((a) => ({
      id: a.recognition_no,
      name: a.name,
      city: a.district || "",
      state: a.state || "",
      lat: a.lat!,
      lng: a.lng!,
      detail_url: a.source_url,
      source: "Manak Online",
    }));

  return (
    <div className="w-full my-4 rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden text-[#0F172A]">
      {/* Header */}
      <div className="bg-[#0B2A4A] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-[#E8710A]" />
          <div>
            <h3 className="text-sm font-semibold tracking-wide">
              Assaying & Hallmarking Centres (AHCs)
            </h3>
            <p className="text-[11px] text-slate-300">
              {ahcs.length} Operative Centres listed
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/10 text-slate-200">
          Manak Online
        </span>
      </div>

      {/* Map (if coordinates exist) */}
      {mapPins.length > 0 && (
        <div className="p-3 bg-slate-50 border-b border-[#E5E7EB]">
          <LabsMap labs={mapPins} />
        </div>
      )}

      {/* AHC List */}
      <div className="divide-y divide-[#E5E7EB] max-h-[360px] overflow-y-auto">
        {ahcs.map((ahc) => (
          <div key={ahc.recognition_no} className="p-3.5 hover:bg-slate-50/70 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-[#0B2A4A] truncate">
                    {ahc.name}
                  </h4>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                    {ahc.status || "Operative"}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                  {ahc.address || [ahc.district, ahc.state].filter(Boolean).join(", ")}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-[#64748B]">
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    ID: {ahc.recognition_no}
                  </span>
                  {ahc.metals && (
                    <span className="text-[11px] text-[#0B2A4A] font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      {ahc.metals}
                    </span>
                  )}
                  {ahc.validity && (
                    <span className="flex items-center gap-1 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Valid: {ahc.validity}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-slate-50 text-[11px] text-[#64748B] border-t border-[#E5E7EB] flex items-center justify-between">
        <span>Official Manak Online Directory</span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
          <ShieldCheck className="w-3 h-3 text-[#228f4a]" /> Operative Status Verified
        </span>
      </div>
    </div>
  );
}
