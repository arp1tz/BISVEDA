"use client";

import React from "react";
import { FlaskConical, MapPin, ExternalLink, Calendar, ShieldCheck } from "lucide-react";
import type { LabsCard as LabsCardData } from "@/lib/pipeline/respond";
import { LabsMap } from "./LabsMap";

interface LabsCardProps {
  card: LabsCardData;
}

export function LabsCard({ card }: LabsCardProps) {
  const { standard_id, labs, retrieved_note } = card;

  // Prepare map pins for labs with coordinates
  const mapPins = labs
    .filter((l) => typeof l.lat === "number" && typeof l.lng === "number")
    .map((l) => ({
      id: l.id,
      name: l.name,
      city: l.city || "",
      state: l.state || "",
      lat: l.lat,
      lng: l.lng,
      detail_url: l.source_url,
      source: "BIS LIMS",
    }));

  return (
    <div className="w-full my-4 rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden text-[#0F172A]">
      {/* Header */}
      <div className="bg-[#0B2A4A] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-[#E8710A]" />
          <div>
            <h3 className="text-sm font-semibold tracking-wide">
              BIS-Recognised Testing Laboratories
            </h3>
            <p className="text-[11px] text-slate-300">
              Scope: {standard_id} • {labs.length} laboratories found
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/10 text-slate-200">
          Official LIMS
        </span>
      </div>

      {/* Map (if coordinates exist) */}
      {mapPins.length > 0 && (
        <div className="p-3 bg-slate-50 border-b border-[#E5E7EB]">
          <LabsMap labs={mapPins} />
        </div>
      )}

      {/* Lab List */}
      <div className="divide-y divide-[#E5E7EB] max-h-[360px] overflow-y-auto">
        {labs.map((lab) => (
          <div key={lab.id} className="p-3.5 hover:bg-slate-50/70 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-[#0B2A4A] truncate">
                    {lab.name}
                  </h4>
                  {lab.current_status && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {lab.current_status}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-[#64748B]">
                  {(lab.city || lab.state) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {[lab.city, lab.state].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {lab.recognition_valid_upto && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Valid up to: {lab.recognition_valid_upto}
                    </span>
                  )}
                </div>

                {lab.scope && lab.scope[0]?.remark && lab.scope[0].remark !== "- -" && (
                  <p className="text-[11px] text-slate-500 mt-1 italic">
                    Note: {lab.scope[0].remark}
                  </p>
                )}
              </div>

              {lab.source_url && (
                <a
                  href={lab.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-slate-400 hover:text-[#0B2A4A] transition-colors rounded hover:bg-slate-100 flex-shrink-0"
                  title="View scope on BIS LIMS portal"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Citation */}
      {retrieved_note && (
        <div className="px-4 py-2 bg-slate-50 text-[11px] text-[#64748B] border-t border-[#E5E7EB] flex items-center justify-between">
          <span>{retrieved_note}</span>
          <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
            <ShieldCheck className="w-3 h-3 text-[#228f4a]" /> Verified directory
          </span>
        </div>
      )}
    </div>
  );
}
