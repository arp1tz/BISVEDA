"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  Edit3,
  Plus,
  ExternalLink,
  Search,
  Filter,
  CheckCheck,
  AlertCircle,
  Clock,
  Check,
} from "lucide-react";
import type { FactRecord } from "@/lib/knowledge/types";

interface FactsTabProps {
  onRefresh?: () => void;
  onSelectNode?: (nodeId: string) => void;
}

export function FactsTab({ onRefresh, onSelectNode }: FactsTabProps) {
  const [facts, setFacts] = useState<FactRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("proposed");
  const [predicateFilter, setPredicateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Selection for bulk approve
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Reject dialog state
  const [rejectingFact, setRejectingFact] = useState<FactRecord | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Edit modal state
  const [editingFact, setEditingFact] = useState<FactRecord | null>(null);
  const [editPredicate, setEditPredicate] = useState("");
  const [editObject, setEditObject] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editNote, setEditNote] = useState("");

  // Add fact modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSubject, setNewSubject] = useState("std:IS 4151");
  const [newPredicate, setNewPredicate] = useState("mandated_by");
  const [newObject, setNewObject] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newUrl, setNewUrl] = useState("https://standards.bis.gov.in");

  const fetchFacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (predicateFilter) params.set("predicate", predicateFilter);

      const res = await fetch(`/api/admin/facts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFacts(data.facts || []);
        setSelectedIds(new Set());
      }
    } catch (err) {
      console.error("[Fetch Facts Error]:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, predicateFilter]);

  useEffect(() => {
    fetchFacts();
  }, [fetchFacts]);

  // Approve single fact
  const handleApprove = async (factId: number) => {
    try {
      const res = await fetch(`/api/admin/facts/${factId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", actor: "Dr. A. K. Verma" }),
      });
      if (res.ok) {
        await fetchFacts();
        onRefresh?.();
      }
    } catch (err) {
      console.error("[Approve Error]:", err);
    }
  };

  // Reject single fact
  const handleConfirmReject = async () => {
    if (!rejectingFact || !rejectReason.trim()) return;
    try {
      const res = await fetch(`/api/admin/facts/${rejectingFact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          reason: rejectReason,
          actor: "Dr. A. K. Verma",
        }),
      });
      if (res.ok) {
        setRejectingFact(null);
        setRejectReason("");
        await fetchFacts();
        onRefresh?.();
      }
    } catch (err) {
      console.error("[Reject Error]:", err);
    }
  };

  // Edit single fact
  const handleConfirmEdit = async () => {
    if (!editingFact) return;
    try {
      const res = await fetch(`/api/admin/facts/${editingFact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          actor: "Dr. A. K. Verma",
          note: editNote,
          updates: {
            predicate: editPredicate,
            object_id: editObject || null,
            value: editValue || null,
          },
        }),
      });
      if (res.ok) {
        setEditingFact(null);
        await fetchFacts();
        onRefresh?.();
      }
    } catch (err) {
      console.error("[Edit Error]:", err);
    }
  };

  // Add manual fact
  const handleAddFact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/facts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_id: newSubject,
          predicate: newPredicate,
          object_id: newObject || null,
          value: newValue || null,
          source_url: newUrl,
          actor: "Dr. A. K. Verma",
        }),
      });
      if (res.ok) {
        setShowAddModal(false);
        await fetchFacts();
        onRefresh?.();
      }
    } catch (err) {
      console.error("[Add Fact Error]:", err);
    }
  };

  // Bulk approve selected
  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch("/api/admin/facts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk_approve",
          fact_ids: Array.from(selectedIds),
          actor: "Dr. A. K. Verma",
        }),
      });
      if (res.ok) {
        await fetchFacts();
        onRefresh?.();
      }
    } catch (err) {
      console.error("[Bulk Approve Error]:", err);
    }
  };

  // Filter facts by search query
  const filteredFacts = facts.filter((f) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.subject_id.toLowerCase().includes(q) ||
      f.predicate.toLowerCase().includes(q) ||
      (f.object_id && f.object_id.toLowerCase().includes(q)) ||
      (f.value && f.value.toLowerCase().includes(q)) ||
      (f.note && f.note.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex h-full flex-col bg-white overflow-hidden text-xs">
      {/* Top Filter Bar */}
      <div className="border-b border-slate-200 p-4 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          {(["proposed", "approved", "rejected", ""] as const).map((st) => (
            <button
              key={st || "all"}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 font-medium border text-xs capitalize ${
                statusFilter === st
                  ? "border-[#0B2A4A] bg-[#0B2A4A] text-white shadow-2xs"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {st || "All Statuses"}
            </button>
          ))}

          {/* Predicate Quick Filter */}
          <select
            value={predicateFilter}
            onChange={(e) => setPredicateFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
          >
            <option value="">All Predicates</option>
            <option value="mandated_by">mandated_by (QCO)</option>
            <option value="certified_under">certified_under (Scheme)</option>
            <option value="accredited_for">accredited_for (Lab)</option>
            <option value="references">references</option>
            <option value="fee_concession_msme">fee_concession_msme</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkApprove}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white hover:bg-emerald-800 shadow-2xs"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Bulk Approve ({selectedIds.size})</span>
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5 text-[#0B2A4A]" />
            <span>Add Manual Fact</span>
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="border-b border-slate-200 px-4 py-2 bg-slate-50/50 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search facts by subject, predicate, or object..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0B2A4A] focus:outline-none"
          />
        </div>
        <span className="text-[11px] text-slate-500 font-medium">
          {filteredFacts.length} fact records in queue
        </span>
      </div>

      {/* Facts Queue List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading facts queue...</div>
        ) : filteredFacts.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No facts found matching filter criteria.
          </div>
        ) : (
          filteredFacts.map((fact) => {
            const isSelected = selectedIds.has(fact.id);
            return (
              <div
                key={fact.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Bulk Select Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      const next = new Set(selectedIds);
                      if (e.target.checked) next.add(fact.id);
                      else next.delete(fact.id);
                      setSelectedIds(next);
                    }}
                    className="mt-1 rounded border-slate-300 text-[#0B2A4A] focus:ring-0"
                  />

                  {/* Fact Triple & Metadata */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => onSelectNode?.(fact.subject_id)}
                        className="font-mono font-bold text-slate-900 hover:text-[#0B2A4A] hover:underline"
                      >
                        {fact.subject_id}
                      </button>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-700">
                        {fact.predicate}
                      </span>
                      {fact.object_id ? (
                        <button
                          onClick={() => onSelectNode?.(fact.object_id!)}
                          className="font-mono font-bold text-[#0B2A4A] hover:underline"
                        >
                          {fact.object_id}
                        </button>
                      ) : (
                        <span className="font-semibold text-slate-800 break-words">
                          "{fact.value}"
                        </span>
                      )}

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                          fact.status === "approved"
                            ? "bg-emerald-50 text-emerald-700"
                            : fact.status === "rejected"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {fact.status}
                      </span>
                    </div>

                    {fact.note && (
                      <p className="text-[11px] text-slate-600 bg-slate-50 rounded p-1.5 border border-slate-100 italic">
                        {fact.note}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Source: <a href={fact.source_url} target="_blank" rel="noreferrer" className="text-[#0B2A4A] underline">Official link</a></span>
                      <span>•</span>
                      <span>Author: {fact.created_by}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {fact.status !== "approved" && (
                    <button
                      onClick={() => handleApprove(fact.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-800 shadow-2xs"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>Approve</span>
                    </button>
                  )}

                  {fact.status !== "rejected" && (
                    <button
                      onClick={() => {
                        setRejectingFact(fact);
                        setRejectReason("");
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
                    >
                      <XCircle className="h-3.5 w-3.5 text-red-600" />
                      <span>Reject</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setEditingFact(fact);
                      setEditPredicate(fact.predicate);
                      setEditObject(fact.object_id || "");
                      setEditValue(fact.value || "");
                      setEditNote("");
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reject Modal */}
      {rejectingFact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Reject Fact #{rejectingFact.id}
            </h3>
            <p className="text-xs text-slate-600">
              Rejecting this fact will mark it inactive and remove its corresponding graph connection (status 'rejected') from regulatory answers.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reason for Rejection (mandatory)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. QCO does not cover this variant / Order withdrawn"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-[#0B2A4A] focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingFact(null)}
                className="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={!rejectReason.trim()}
                className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Fact Modal */}
      {editingFact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Edit Fact #{editingFact.id}
            </h3>
            <p className="text-xs text-slate-500">
              Editing creates a new version of the fact and archives the previous fact to maintain complete provenance.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-slate-700">Predicate</label>
                <input
                  type="text"
                  value={editPredicate}
                  onChange={(e) => setEditPredicate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>
              <div>
                <label className="font-medium text-slate-700">Target Object Node ID (optional)</label>
                <input
                  type="text"
                  value={editObject}
                  onChange={(e) => setEditObject(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>
              <div>
                <label className="font-medium text-slate-700">Literal Value (if no object node)</label>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>
              <div>
                <label className="font-medium text-slate-700">Audit Change Note</label>
                <input
                  type="text"
                  placeholder="e.g. Corrected QCO code reference"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingFact(null)}
                className="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEdit}
                className="rounded-lg bg-[#0B2A4A] px-4 py-2 font-semibold text-white hover:bg-[#071D33]"
              >
                Save Revision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Manual Fact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form
            onSubmit={handleAddFact}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4"
          >
            <h3 className="text-base font-semibold text-slate-900">
              Add Manual Regulatory Fact
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-slate-700">Subject Node ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. std:IS 4151"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="font-medium text-slate-700">Predicate</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. mandated_by"
                  value={newPredicate}
                  onChange={(e) => setNewPredicate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="font-medium text-slate-700">Object Node ID (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. qco:helmet-2020"
                  value={newObject}
                  onChange={(e) => setNewObject(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="font-medium text-slate-700">Literal Value (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 80% fee concession for MSME"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>
              <div>
                <label className="font-medium text-slate-700">Official Source URL (mandatory)</label>
                <input
                  type="url"
                  required
                  placeholder="https://standards.bis.gov.in/..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#0B2A4A] px-4 py-2 font-semibold text-white hover:bg-[#071D33]"
              >
                Create Fact
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
