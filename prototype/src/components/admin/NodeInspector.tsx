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
          Click any node in the graph, chunks table, or fact list to inspect its metadata and connections.
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

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "approved":
      case "published":
      case "current":
      case "in_force":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            <CheckCircle className="h-3 w-3" />
            <span>Active / Approved</span>
          </span>
        );
      case "proposed":
      case "draft":
      case "in_review":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            <Clock className="h-3 w-3" />
            <span>Proposed / Draft</span>
          </span>
        );
      case "rejected":
      case "archived":
      case "withdrawn":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            <XCircle className="h-3 w-3" />
            <span>Archived / Inactive</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            <span>Verified Record</span>
          </span>
        );
    }
  };

  const sourceUrl = node.props?.source_url || node.props?.source || "";

  return (
    <aside className="w-[340px] border-l border-slate-200 bg-white flex flex-col h-full overflow-hidden text-xs">
      {/* Header */}
      <div className="border-b border-slate-200 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
            {node.type}
          </span>
          {getStatusBadge(node.status || node.props?.status)}
        </div>

        <h3 className="text-sm font-semibold text-slate-900 leading-snug break-words">
          {node.label}
        </h3>

        <div className="flex items-center gap-3 text-slate-500 text-[11px] pt-1">
          <span>ID: <code className="font-mono text-slate-800">{node.id}</code></span>
          <span>•</span>
          <span>Degree: <strong className="text-slate-800">{node.degree}</strong></span>
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
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
        >
          <Focus className="h-3.5 w-3.5 text-[#0B2A4A]" />
          <span>Local Graph</span>
        </button>

        {node.type === "Document" && onOpenDocument && (
          <button
            onClick={() => onOpenDocument(node.id.replace(/^doc:/, ""))}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            <FileText className="h-3.5 w-3.5 text-[#0B2A4A]" />
            <span>Open Document</span>
          </button>
        )}
      </div>

      {/* Scrollable Body: Properties & Connections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Properties */}
        {node.props && Object.keys(node.props).length > 0 && (
          <div>
            <h4 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider mb-2">
              Node Properties
            </h4>
            <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-2.5 space-y-1.5">
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

        {/* Connections List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
              Connections ({connectedLinks.length})
            </h4>
          </div>

          {connectedLinks.length === 0 ? (
            <p className="text-slate-400 text-[11px] italic">No direct connections found.</p>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {connectedLinks.map((link, idx) => {
                const s = getNodeId(link.source);
                const t = getNodeId(link.target);
                const isSource = s === node.id;
                const otherNodeId = isSource ? t : s;
                return (
                  <button
                    key={`${s}-${t}-${idx}`}
                    onClick={() => onSelectNode(otherNodeId)}
                    className="w-full text-left rounded-lg border border-slate-200 bg-white p-2 hover:border-[#0B2A4A] hover:bg-slate-50/80 transition-colors group flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <span className="font-mono font-semibold text-slate-700">
                          {link.type}
                        </span>
                        <span>•</span>
                        <span className={link.status === "approved" ? "text-emerald-600" : "text-amber-600"}>
                          {link.status}
                        </span>
                      </div>
                      <div className="font-mono font-medium text-slate-800 truncate text-[11px] mt-0.5">
                        {otherNodeId}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#0B2A4A] shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
