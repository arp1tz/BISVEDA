"use client";

import React, { useState, useEffect, useMemo } from "react";
import { FlaskConical, Award, Search, ExternalLink, Calendar, MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import type { LabRecord, AhcRecord } from "@/lib/kb/types";

export function DirectoryTab() {
  const [activeTab, setActiveTab] = useState<"labs" | "ahc">("labs");
  const [labs, setLabs] = useState<LabRecord[]>([]);
  const [ahcs, setAhcs] = useState<AhcRecord[]>([]);
  const [retrievedAt, setRetrievedAt] = useState<{ labs: string; ahc: string }>({ labs: "", ahc: "" });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    async function loadDirectory() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/directory");
        if (res.ok) {
          const data = await res.json();
          setLabs(data.labs || []);
          setAhcs(data.ahcs || []);
          setRetrievedAt(data.retrieved_at || { labs: "2026-09-27", ahc: "2026-09-27" });
        }
      } catch (err) {
        console.error("Failed to load directory:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDirectory();
  }, []);

  // Reset page when tab or search query changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery]);

  const filteredLabs = useMemo(() => {
    if (!searchQuery.trim()) return labs;
    const q = searchQuery.toLowerCase();
    return labs.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.city || "").toLowerCase().includes(q) ||
        (l.state || "").toLowerCase().includes(q) ||
        l.standards_in_scope.some((s) => s.toLowerCase().includes(q))
    );
  }, [labs, searchQuery]);

  const filteredAhcs = useMemo(() => {
    if (!searchQuery.trim()) return ahcs;
    const q = searchQuery.toLowerCase();
    return ahcs.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.recognition_no.toLowerCase().includes(q) ||
        (a.district || "").toLowerCase().includes(q) ||
        (a.state || "").toLowerCase().includes(q) ||
        (a.metals || "").toLowerCase().includes(q)
    );
  }, [ahcs, searchQuery]);

  const currentList = activeTab === "labs" ? filteredLabs : filteredAhcs;
  const totalItems = currentList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedList = currentList.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white text-[#0F172A]">
      {/* Top Header & Sub-tab Bar */}
      <div className="p-4 border-b border-[#E5E7EB] bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("labs")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "labs"
                ? "bg-[#0B2A4A] text-white shadow-xs"
                : "bg-white border border-[#E5E7EB] text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <FlaskConical className="h-4 w-4 text-[#22c55e]" />
            <span>Testing Laboratories ({labs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("ahc")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "ahc"
                ? "bg-[#0B2A4A] text-white shadow-xs"
                : "bg-white border border-[#E5E7EB] text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <Award className="h-4 w-4 text-[#eab308]" />
            <span>Assaying &amp; Hallmarking Centres ({ahcs.length.toLocaleString()})</span>
          </button>
        </div>

        <div className="text-[11px] text-[#64748B]">
          Retrieved from official portals on:{" "}
          <strong className="text-[#0F172A]">
            {activeTab === "labs" ? retrievedAt.labs : retrievedAt.ahc}
          </strong>
        </div>
      </div>

      {/* Search and Pagination Toolbar */}
      <div className="p-3 border-b border-[#E5E7EB] bg-white flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeTab === "labs"
                ? "Search labs by name, city, state, standard (e.g. IS 4151)…"
                : "Search AHC by recognition no, centre name, district, state…"
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-hidden focus:border-[#0B2A4A]"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-[#64748B]">
          <span>
            Showing <strong>{(page - 1) * pageSize + 1}</strong> –{" "}
            <strong>{Math.min(page * pageSize, totalItems)}</strong> of {totalItems}
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-[#E5E7EB] bg-white text-xs disabled:opacity-40 cursor-pointer"
              >
                Prev
              </button>
              <span className="px-2 font-mono text-[11px]">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-[#E5E7EB] bg-white text-xs disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Directory Table Area */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-500">
            Loading official directory records…
          </div>
        ) : activeTab === "labs" ? (
          /* Testing Labs Table */
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-[#E5E7EB] text-[#64748B] font-semibold sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-4">Lab Name</th>
                <th className="py-2.5 px-4">Location</th>
                <th className="py-2.5 px-4">Standards in Scope</th>
                <th className="py-2.5 px-4">Status / Validity</th>
                <th className="py-2.5 px-4 text-right">Portal Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {paginatedList.map((labItem) => {
                const lab = labItem as LabRecord;
                return (
                  <tr key={lab.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#0F172A] max-w-xs break-words">
                      {lab.name}
                    </td>
                    <td className="py-3 px-4 text-[#64748B]">
                      <div className="flex items-center gap-1 font-medium text-[#0F172A]">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>
                          {lab.city}
                          {lab.state ? `, ${lab.state}` : ""}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {lab.geocode === "city-centroid" ? "City Centroid Coordinates" : "No Coordinates"}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {lab.standards_in_scope.map((std) => (
                          <span
                            key={std}
                            className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-[#0B2A4A]/10 text-[#0B2A4A]"
                          >
                            {std}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mb-1">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{lab.current_status || "Recognised"}</span>
                      </span>
                      {lab.recognition_valid_upto && (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Valid upto: {lab.recognition_valid_upto}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={lab.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B2A4A] hover:underline"
                      >
                        <span>BIS LIMS</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* AHC Table */
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-[#E5E7EB] text-[#64748B] font-semibold sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-4">Recognition No</th>
                <th className="py-2.5 px-4">Centre Name &amp; Address</th>
                <th className="py-2.5 px-4">Location</th>
                <th className="py-2.5 px-4">Metals</th>
                <th className="py-2.5 px-4">Status &amp; Validity</th>
                <th className="py-2.5 px-4 text-right">Portal Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {paginatedList.map((ahcItem) => {
                const ahc = ahcItem as AhcRecord;
                const metalList = (ahc.metals || "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                return (
                  <tr key={ahc.recognition_no} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#0B2A4A]">
                      {ahc.recognition_no}
                    </td>
                    <td className="py-3 px-4 max-w-sm">
                      <div className="font-semibold text-[#0F172A]">{ahc.name}</div>
                      {ahc.address && (
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {ahc.address}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#64748B]">
                      <div className="font-medium text-[#0F172A]">
                        {ahc.district}
                        {ahc.state ? `, ${ahc.state}` : ""}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {metalList.map((m) => (
                          <span
                            key={m}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              m.toLowerCase().includes("gold")
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mb-1">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{ahc.status || "OPERATIVE"}</span>
                      </span>
                      {ahc.validity && (
                        <div className="text-[10px] text-slate-500">
                          Valid: {ahc.validity}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={ahc.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B2A4A] hover:underline"
                      >
                        <span>Manak Online</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
