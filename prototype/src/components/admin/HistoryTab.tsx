"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  History,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  Filter,
  CheckCircle,
  FileText,
  Tag,
  AlertTriangle,
} from "lucide-react";
import type { AuditLogRecord } from "@/lib/knowledge/types";

export function HistoryTab() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (targetTypeFilter) params.set("target_type", targetTypeFilter);

      const res = await fetch(`/api/admin/history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("[Fetch History Error]:", err);
    } finally {
      setLoading(false);
    }
  }, [targetTypeFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case "publish":
      case "approve_fact":
        return (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            {action}
          </span>
        );
      case "reject_fact":
      case "archive":
        return (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
            {action}
          </span>
        );
      case "rollback":
      case "edit_fact":
        return (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            {action}
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="flex h-full flex-col bg-white overflow-hidden text-xs">
      {/* Top Filter Bar */}
      <div className="border-b border-slate-200 p-4 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[#0B2A4A]" />
          <span className="font-semibold text-slate-800">Governance Audit Trail</span>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={targetTypeFilter}
            onChange={(e) => setTargetTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
          >
            <option value="">All Entities</option>
            <option value="document_version">Document Versions</option>
            <option value="fact">Regulatory Facts</option>
          </select>
        </div>
      </div>

      {/* History Log List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading audit log...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No audit records found. Administrative actions will be logged here in real time.
          </div>
        ) : (
          logs.map((log) => {
            const isExpanded = expandedId === log.id;
            return (
              <div
                key={log.id}
                className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-slate-300 transition-colors"
              >
                <div
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    )}

                    <div className="flex items-center gap-2">
                      {getActionBadge(log.action)}
                      <span className="font-mono text-slate-900 font-bold">
                        {log.target_type}:{log.target_id}
                      </span>
                    </div>

                    {log.note && (
                      <span className="text-slate-600 truncate max-w-sm italic">
                        "{log.note}"
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 shrink-0">
                    <span className="font-medium text-slate-700">{log.actor}</span>
                    <span>•</span>
                    <span>{new Date(log.at).toLocaleString()}</span>
                  </div>
                </div>

                {/* Expanded Before / After State JSON */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 overflow-x-auto">
                      <span className="font-sans font-semibold text-slate-600 block mb-1">
                        State Before:
                      </span>
                      <pre className="text-slate-700 whitespace-pre-wrap">
                        {log.before ? JSON.stringify(log.before, null, 2) : "None (New entity)"}
                      </pre>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 overflow-x-auto">
                      <span className="font-sans font-semibold text-slate-600 block mb-1">
                        State After:
                      </span>
                      <pre className="text-slate-700 whitespace-pre-wrap">
                        {log.after ? JSON.stringify(log.after, null, 2) : "None"}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
