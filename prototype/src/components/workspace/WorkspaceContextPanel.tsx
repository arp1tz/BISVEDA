"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Clock,
  RotateCcw,
  SlidersHorizontal,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Building2,
  FileCheck2,
  Search,
  Filter,
  LocateFixed,
} from "lucide-react";
import type { SavedChatSession } from "@/lib/chat-storage";

interface WorkspaceContextPanelProps {
  currentQuery: string;
  onSelectQuery: (query: string) => void;
  onNewResearch: () => void;
  recentSearches: Array<{
    query: string;
    standards: Array<{ num: string; title: string }>;
    lastSearched: string;
  }>;
  savedSessions?: SavedChatSession[];
  relatedStandards?: Array<{
    standardNumber: string;
    title: string;
  }>;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenSavedChats?: () => void;
}

export function WorkspaceContextPanel({
  currentQuery,
  onSelectQuery,
  onNewResearch,
  recentSearches,
  savedSessions = [],
  relatedStandards = [],
  isCollapsed = false,
  onToggleCollapse,
  onOpenSavedChats,
}: WorkspaceContextPanelProps) {
  const [filterScheme, setFilterScheme] = useState("all");
  const [userLocation, setUserLocation] = useState("Nagpur, Maharashtra");
  const [isEditingLocation, setIsEditingLocation] = useState(false);

  // Related standards from active research session
  const standardsList = relatedStandards.length > 0
    ? relatedStandards
    : [];

  if (isCollapsed) {
    return (
      <aside className="w-12 border-r border-border bg-surface-raised flex flex-col items-center py-4 space-y-4 shrink-0">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-xl text-ink-faint hover:text-navy hover:bg-surface-alt transition-colors"
          title="Expand Workspace Panel"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="writing-vertical text-xs font-black uppercase tracking-wider text-ink-faint mt-4">
          Workspace
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-72 sm:w-80 border-r border-border bg-surface-raised flex flex-col h-full overflow-y-auto shrink-0 text-xs">
      {/* Workspace Header */}
      <div className="p-4 border-b border-border bg-surface-alt/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-blue" />
          <h2 className="font-extrabold uppercase tracking-wider text-navy text-xs">
            Workspace Context
          </h2>
        </div>
        <button
          onClick={onNewResearch}
          className="font-bold text-[11px] text-blue hover:text-navy hover:underline flex items-center gap-1"
        >
          <RotateCcw className="h-3 w-3" />
          <span>New</span>
        </button>
      </div>

      <div className="p-4 space-y-6 flex-1">
        {/* Section 1: Current Research */}
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-faint">
            Current Research
          </span>
          <div className="rounded-xl border border-navy/20 bg-surface-raised p-3 shadow-2xs space-y-1.5">
            <div className="font-extrabold text-navy text-xs line-clamp-2">
              &ldquo;{currentQuery || "General BIS Research"}&rdquo;
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-success font-bold">
              <CheckCircle2 className="h-3 w-3" />
              <span>Verified against BIS sources</span>
            </div>
          </div>
        </div>

        {/* Section 2: Recent Searches (Moved to LEFT rail per spec) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-faint flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-orange" />
              Recent Searches
            </span>
          </div>

          <div className="space-y-1.5">
            {recentSearches.slice(0, 5).map((rs, idx) => (
              <div
                key={idx}
                onClick={() => onSelectQuery(rs.query)}
                className="group flex flex-col p-2.5 rounded-xl border border-border bg-surface hover:bg-surface-alt/60 hover:border-navy/30 cursor-pointer transition-all space-y-1"
              >
                <div className="font-bold text-navy group-hover:text-blue truncate">
                  {rs.query}
                </div>
                <div className="flex items-center justify-between text-[10px] text-ink-faint">
                  <span className="font-mono">
                    {rs.standards?.[0]?.num || "BIS Standard"}
                  </span>
                  <span>{rs.lastSearched}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Related Standards */}
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-faint flex items-center gap-1.5">
            <BookOpen className="h-3 w-3 text-blue" />
            Related Standards
          </span>

          <div className="space-y-1.5">
            {standardsList.length > 0 ? (
              standardsList.map((std, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectQuery(`Statutory requirements for ${std.standardNumber}`)}
                  className="p-2.5 rounded-xl border border-border bg-surface hover:bg-surface-alt/50 hover:border-navy/30 cursor-pointer transition-all"
                >
                  <span className="font-mono font-bold text-navy text-[11px] block">
                    {std.standardNumber}
                  </span>
                  <p className="text-[11px] text-ink-soft line-clamp-1 mt-0.5">
                    {std.title}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-[11px] text-ink-faint italic p-2 rounded-lg border border-dashed border-border text-center">
                Applicable standards will appear here based on your research query.
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Research Controls / Location */}
        <div className="space-y-2.5 pt-2 border-t border-border">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-faint flex items-center gap-1.5">
            <Filter className="h-3 w-3 text-navy" />
            Research Controls
          </span>

          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-ink-soft">
                  Target Testing Location:
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined" && navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition((pos) => {
                        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        try {
                          localStorage.setItem("bisveda_user_location", JSON.stringify(coords));
                        } catch {}
                        setUserLocation(`GPS Detected (${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)})`);
                      });
                    }
                  }}
                  className="text-[10px] font-bold text-blue hover:text-navy hover:underline flex items-center gap-1"
                >
                  <LocateFixed className="h-3 w-3" />
                  <span>Detect GPS</span>
                </button>
              </div>
              <div className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-1.5">
                <MapPin className="h-3.5 w-3.5 text-orange shrink-0" />
                <input
                  type="text"
                  value={userLocation}
                  onChange={(e) => setUserLocation(e.target.value)}
                  className="w-full bg-transparent text-[11px] font-medium text-navy focus:outline-none"
                  placeholder="Enter city or PIN code..."
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-ink-soft block mb-1">
                Certification Scheme Filter:
              </label>
              <select
                value={filterScheme}
                onChange={(e) => setFilterScheme(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-navy focus:border-navy focus:outline-none"
              >
                <option value="all">All Statutory Schemes</option>
                <option value="scheme1">Scheme-I (ISI Mark)</option>
                <option value="scheme2">Scheme-II (CRS)</option>
                <option value="hallmark">Scheme-IV (Hallmarking)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Saved Consultations Link */}
        {onOpenSavedChats && (
          <div className="pt-2">
            <button
              onClick={onOpenSavedChats}
              className="w-full flex items-center justify-between rounded-xl border border-border bg-surface-alt/60 p-2.5 text-navy font-bold hover:bg-surface-sunken transition-all"
            >
              <span className="flex items-center gap-1.5 text-[11px]">
                <Bookmark className="h-3.5 w-3.5 text-orange" />
                Saved Research Dossiers
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-ink-faint" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
