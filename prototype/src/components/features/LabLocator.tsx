"use client";

import React, { useState } from "react";
import {
  MapPin,
  Search,
  Building,
  Phone,
  Mail,
  FlaskConical,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import labsData from "../../../data/laboratories.json";
import type { LaboratoryRecord } from "@/lib/types";
import { LaboratoryMap, type LabItem } from "./LaboratoryMap";

export function LabLocator() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStandard, setSelectedStandard] = useState("ALL");
  const [selectedState, setSelectedState] = useState("ALL");

  const labs: LaboratoryRecord[] = labsData as unknown as LaboratoryRecord[];

  // Distinct states
  const states = Array.from(new Set(labs.map((l) => l.state).filter(Boolean))).sort();

  // Filter labs
  const filteredLabs = labs.filter((lab) => {
    const matchesSearch =
      searchTerm === "" ||
      lab.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lab.city && lab.city.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStandard =
      selectedStandard === "ALL" ||
      lab.recognized_standards?.some((s) => s.toLowerCase().includes(selectedStandard.toLowerCase()));

    const matchesState = selectedState === "ALL" || lab.state === selectedState;

    return matchesSearch && matchesStandard && matchesState;
  });

  const mapLabs: LabItem[] = filteredLabs.slice(0, 40).map((lab, idx) => ({
    id: lab.id || lab.oslCode || idx + 1,
    name: lab.name,
    city: lab.city || "New Delhi",
    state: lab.state,
    lat: lab.lat || 28.6139,
    lng: lab.lng || 77.2090,
    oslCode: lab.accreditation_number || lab.oslCode,
    currentStatus: lab.currentStatus || "Active",
  }));

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-black uppercase text-success">
                NABL & BIS Directory
              </span>
              <span className="text-xs font-semibold text-ink-faint">
                {labs.length} Geocoded Laboratories Across India
              </span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-black text-navy">
              BIS Recognized Testing Laboratories Directory
            </h1>
            <p className="mt-1 text-sm text-ink-soft max-w-2xl leading-relaxed">
              Find accredited conformity assessment labs for preliminary testing, sample validation, and factory audit witness tests.
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-faint" />
            <input
              type="text"
              placeholder="Search by lab name, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-raised pl-9 pr-3 py-2 text-xs font-medium text-navy placeholder:text-ink-faint focus:border-navy focus:outline-none"
            />
          </div>

          <div>
            <select
              value={selectedStandard}
              onChange={(e) => setSelectedStandard(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs font-medium text-navy focus:border-navy focus:outline-none"
            >
              <option value="ALL">All Tested Standards</option>
              <option value="IS 2347">IS 2347 (Pressure Cookers)</option>
              <option value="IS 14543">IS 14543 (Packaged Water)</option>
              <option value="IS 17526">IS 17526 (Stainless Steel Bottles)</option>
              <option value="IS 269">IS 269 (Portland Cement)</option>
              <option value="IS 1293">IS 1293 (Plugs & Sockets)</option>
              <option value="IS 4151">IS 4151 (Protective Helmets)</option>
              <option value="IS 1417">IS 1417 (Gold Hallmarking / AHC)</option>
            </select>
          </div>

          <div>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs font-medium text-navy focus:border-navy focus:outline-none"
            >
              <option value="ALL">All States / UTs</option>
              {states.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Interactive Map View */}
      <div className="rounded-2xl border border-border bg-surface-raised p-4 shadow-xs space-y-2">
        <div className="flex items-center justify-between pb-2 border-b border-border/70">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-success" />
            <h3 className="text-xs font-black uppercase tracking-wider text-navy">
              Interactive Nationwide Laboratory Map
            </h3>
          </div>
          <span className="text-[11px] font-bold text-ink-faint">
            {mapLabs.length} Facilities Mapped
          </span>
        </div>
        <LaboratoryMap
          labs={mapLabs}
          initialCity={selectedState !== "ALL" ? selectedState : undefined}
        />
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-black uppercase tracking-wider text-ink-faint">
          Showing {filteredLabs.length} Accredited Facilities
        </h2>
      </div>

      {/* Lab Cards Grid */}
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredLabs.slice(0, 30).map((lab, idx) => (
          <div
            key={idx}
            className="flex flex-col rounded-xl border border-border bg-surface-raised p-4 shadow-2xs hover:border-navy/40 hover:shadow-xs transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="rounded bg-navy/10 px-2 py-0.5 text-[10px] font-mono font-bold text-navy">
                {lab.city || "Central"}, {lab.state}
              </span>
              <span className="flex items-center gap-1 rounded bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                <ShieldCheck className="h-3 w-3" /> NABL Recognized
              </span>
            </div>

            <h3 className="mt-2 text-sm font-black text-navy leading-snug">
              {lab.name}
            </h3>

            {lab.address && (
              <p className="mt-1 text-[11px] text-ink-faint line-clamp-2">
                {lab.address}
              </p>
            )}

            {/* Test capabilities */}
            <div className="mt-3 flex-1 border-t border-border/50 pt-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                Tested Standards:
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {(lab.recognized_standards || ["General BIS Scope"]).slice(0, 3).map((std, sIdx) => (
                  <span
                    key={sIdx}
                    className="rounded bg-surface-alt px-1.5 py-0.2 font-mono text-[10px] font-bold text-ink-soft"
                  >
                    {std}
                  </span>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
              <span className="text-ink-faint">
                Accreditation: <strong>{lab.accreditation_number || lab.oslCode || "BIS-01-2026"}</strong>
              </span>
              <a
                href="https://www.services.bis.gov.in"
                target="_blank"
                rel="noreferrer"
                className="font-bold text-blue hover:underline inline-flex items-center gap-1"
              >
                Book Test <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
