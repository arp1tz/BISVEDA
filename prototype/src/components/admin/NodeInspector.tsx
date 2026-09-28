"use client";

import React from "react";
import {
  ExternalLink,
  Focus,
  FileText,
  Share2,
  CheckCircle,
  Clock,
  XCircle,
  ArrowRight,
  Info,
  Layers,
  FlaskConical,
  BookOpen,
  Link2,
} from "lucide-react";
import type { GraphApiNode, GraphApiLink } from "@/lib/knowledge/types";

interface NodeInspectorProps {
  node: GraphApiNode | null;
  links: GraphApiLink[];
  onSelectNode: (nodeId: string) => void;
  onFocusNode: (nodeId: string) => void;
  onOpenDocument?: (docId: string) => void;
}

export function NodeInspector({
  node,
  links,
  onSelectNode,
  onFocusNode,
  onOpenDocument,
}: NodeInspectorProps) {
  if (!node) {
    return (
      <aside className="w-[340px] border-l border-slate-200 bg-white p-6 flex flex-col items-center justify-center text-center text-slate-400">
        <Layers className="h-10 w-10 text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-600">No Node Selected</p>
        <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
          Click any node in the knowledge graph to inspect its metadata, clauses, references, and accredited laboratories.
        </p>
      </aside>
    );
  }

  const getNodeId = (endpoint: any) =>
    typeof endpoint === "object" && endpoint !== null ? endpoint.id : endpoint;

  // Find incoming and outgoing edges for this node
  const connectedLinks = links.filter((l) => {
    const s = getNodeId(l.source);
    const t = getNodeId(l.target);
    return s === node.id || t === node.id;
  });

  // Group connections for standards
  const isStandard = node.type.toLowerCase() === "standard";
  const clauseLinks = connectedLinks.filter((l) => l.type === "HAS_CLAUSE");
  const refLinks = connectedLinks.filter((l) => l.type === "REFERENCES");
  const labLinks = connectedLinks.filter((l) => l.type === "TESTS");
  const otherLinks = isStandard
    ? connectedLinks.filter((l) => l.type !== "HAS_CLAUSE" && l.type !== "REFERENCES" && l.type !== "TESTS")
    : connectedLinks;

  const sourceUrl = node.props?.source_url || node.props?.source || "";

  const renderLinkItem = (link: GraphApiLink, idx: number) => {
    const s = getNodeId(link.source);
    const t = getNodeId(link.target);
    const isSource = s === node.id;
    const otherNodeId = isSource ? t : s;
    return (
      <div
        key={`${s}-${t}-${idx}`}
        className="w-full rounded-lg border border-slate-200 bg-white p-2 hover:border-[#0B2A4A] hover:bg-slate-50/80 transition-colors group flex items-center justify-between gap-2"
      >
        <button
          type="button"
          onClick={() => onSelectNode(otherNodeId)}
          className="min-w-0 flex-1 text-left cursor-pointer"
        >
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="font-mono font-semibold text-slate-700">{link.type}</span>
            {link.source_url && (
              <>
                <span>•</span>
                <span className="text-[9px] text-slate-400 truncate max-w-[140px]">
                  {link.source_url}
                </span>
              </>
            )}
          </div>
          <div className="font-mono font-medium text-slate-900 truncate text-[11px] mt-0.5">
            {otherNodeId}
          </div>
        </button>
        <button
          type="button"
          onClick={() => onSelectNode(otherNodeId)}
          className="p-1 text-slate-400 group-hover:text-[#0B2A4A] cursor-pointer"
          title="Inspect node"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  return (
    <aside className="w-[340px] border-l border-slate-200 bg-white flex flex-col h-full overflow-hidden text-xs">
      {/* Header */}
      <div className="border-b border-slate-200 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
            {node.type}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            <CheckCircle className="h-3 w-3" />
            <span>Active Record</span>
          </span>
        </div>

        <h3 className="text-sm font-semibold text-slate-900 leading-snug break-words">
          {node.label}
        </h3>

        <div className="flex items-center gap-3 text-slate-500 text-[11px] pt-0.5">
          <span>
            ID: <code className="font-mono text-slate-800">{node.id}</code>
          </span>
          <span>•</span>
          <span>
            Degree: <strong className="text-slate-800">{node.degree}</strong>
          </span>
        </div>

        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0B2A4A] hover:underline pt-1"
          >
            <span>Official BIS Source Link</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
        <button
          onClick={() => onFocusNode(node.id)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
        >
          <Focus className="h-3.5 w-3.5 text-[#0B2A4A]" />
          <span>Focus Local</span>
        </button>

        {node.props?.doc_id && onOpenDocument && (
          <button
            onClick={() => onOpenDocument(String(node.props?.doc_id))}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 text-[#0B2A4A]" />
            <span>View PDF</span>
          </button>
        )}
      </div>

      {/* Scrollable Body: Properties & Connections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Properties */}
        {node.props && Object.keys(node.props).length > 0 && (
          <div>
            <h4 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider mb-1.5">
              Node Properties
            </h4>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 space-y-1.5">
              {Object.entries(node.props)
                .filter(([k]) => k !== "source_url" && k !== "embedding")
                .map(([key, val]) => (
                  <div key={key} className="flex items-start justify-between gap-2 text-[11px]">
                    <span className="text-slate-500 font-mono">{key}:</span>
                    <span className="text-slate-900 font-medium text-right break-words max-w-[180px]">
                      {typeof val === "object" ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Standard-specific grouped views */}
        {isStandard ? (
          <>
            {/* Connected Labs */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <FlaskConical className="h-3.5 w-3.5 text-[#22c55e]" />
                <h4 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
                  Accredited Labs ({labLinks.length})
                </h4>
              </div>
              {labLinks.length === 0 ? (
                <p className="text-slate-400 text-[11px] italic">No testing labs in current registry scope.</p>
              ) : (
                <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                  {labLinks.map((l, i) => renderLinkItem(l, i))}
                </div>
              )}
            </div>

            {/* Standard Clauses */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <BookOpen className="h-3.5 w-3.5 text-[#3b82f6]" />
                <h4 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
                  Clauses ({clauseLinks.length})
                </h4>
              </div>
              {clauseLinks.length === 0 ? (
                <p className="text-slate-400 text-[11px] italic">No indexed clauses.</p>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
                  {clauseLinks.map((l, i) => renderLinkItem(l, i))}
                </div>
              )}
            </div>

            {/* References */}
            {refLinks.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Link2 className="h-3.5 w-3.5 text-[#94a3b8]" />
                  <h4 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
                    References ({refLinks.length})
                  </h4>
                </div>
                <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                  {refLinks.map((l, i) => renderLinkItem(l, i))}
                </div>
              </div>
            )}

            {/* Other Connections */}
            {otherLinks.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider mb-1.5">
                  Other Relationships ({otherLinks.length})
                </h4>
                <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                  {otherLinks.map((l, i) => renderLinkItem(l, i))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* General Connections List */
          <div>
            <h4 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider mb-1.5">
              Connections ({connectedLinks.length})
            </h4>
            {connectedLinks.length === 0 ? (
              <p className="text-slate-400 text-[11px] italic">No direct connections found.</p>
            ) : (
              <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
                {connectedLinks.map((l, i) => renderLinkItem(l, i))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
