"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Search,
  Filter,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Info,
  Maximize2,
  ChevronDown,
} from "lucide-react";
import type { GraphApiNode, GraphApiLink, GraphApiResponse } from "@/lib/knowledge/types";

// Dynamically import react-force-graph-2d with ssr: false
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-50 text-xs text-slate-500">
      Loading graph canvas...
    </div>
  ),
});

const NODE_COLORS: Record<string, string> = {
  Standard: "#0B2A4A",      // Navy
  QCO: "#B91C1C",           // Red
  Scheme: "#7C3AED",        // Purple
  Lab: "#0D9488",           // Teal
  ProductGroup: "#D97706",  // Amber
  Product: "#F59E0B",       // Light Amber
  Committee: "#4B5563",     // Grey
  Document: "#64748B",      // Slate
  DocVersion: "#475569",    // Blue-grey
  Chunk: "#94A3B8",         // Light slate
  Clause: "#334155",        // Dark slate
};

interface GraphTabProps {
  onSelectNode: (node: GraphApiNode) => void;
  selectedNodeId?: string | null;
  focusedNodeId?: string | null;
  onClearFocus?: () => void;
  onFocusNode?: (nodeId: string) => void;
  onGraphLoaded?: (data: GraphApiResponse) => void;
}

export function GraphTab({
  onSelectNode,
  selectedNodeId,
  focusedNodeId,
  onClearFocus,
  onFocusNode,
  onGraphLoaded,
}: GraphTabProps) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastClickRef = useRef<{ id: string; time: number }>({ id: "", time: 0 });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Data state
  const [graphData, setGraphData] = useState<GraphApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Controls
  const [depth, setDepth] = useState<number>(1);
  const [includeProposed, setIncludeProposed] = useState<boolean>(true);
  const [orphansOnly, setOrphansOnly] = useState<boolean>(false);
  const [enabledTypes, setEnabledTypes] = useState<Record<string, boolean>>({
    Standard: true,
    QCO: true,
    Scheme: true,
    Lab: true,
    ProductGroup: true,
    Product: true,
    Committee: true,
    Document: true,
    Clause: true,
    Chunk: true,
  });

  // Hover & interaction state
  const [hoverNode, setHoverNode] = useState<any | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<any>>(new Set());

  // Resize handler
  useEffect(() => {
    function updateDimensions() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 800,
          height: containerRef.current.clientHeight || 600,
        });
      }
    }
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Fetch graph data from API
  const fetchGraph = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (focusedNodeId) {
        params.set("focus", focusedNodeId);
        params.set("depth", String(depth));
      }
      if (includeProposed) {
        params.set("includeProposed", "true");
      }
      const activeTypes = Object.entries(enabledTypes)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (activeTypes.length > 0 && !focusedNodeId) {
        params.set("types", activeTypes.join(","));
      }

      const res = await fetch(`/api/admin/graph?${params.toString()}`);
      if (res.ok) {
        const data: GraphApiResponse = await res.json();
        setGraphData(data);
        onGraphLoaded?.(data);
      }
    } catch (err) {
      console.error("[Graph Fetch Error]:", err);
    } finally {
      setLoading(false);
    }
  }, [focusedNodeId, depth, includeProposed, enabledTypes]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Filter nodes for orphans if requested
  const processedGraph = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };

    let nodes = [...graphData.nodes];
    let links = [...graphData.links];

    if (orphansOnly) {
      const linkedNodeIds = new Set<string>();
      links.forEach((l) => {
        linkedNodeIds.add(typeof l.source === "object" ? (l.source as any).id : l.source);
        linkedNodeIds.add(typeof l.target === "object" ? (l.target as any).id : l.target);
      });
      nodes = nodes.filter((n) => !linkedNodeIds.has(n.id));
      links = [];
    }

    return { nodes, links };
  }, [graphData, orphansOnly]);

  // Handle node hover
  const handleNodeHover = (node: any) => {
    setHoverNode(node || null);
    if (!node) {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      return;
    }

    const neighbors = new Set<string>([node.id]);
    const links = new Set<any>();

    processedGraph.links.forEach((link: any) => {
      const srcId = typeof link.source === "object" ? link.source.id : link.source;
      const tgtId = typeof link.target === "object" ? link.target.id : link.target;

      if (srcId === node.id || tgtId === node.id) {
        neighbors.add(srcId);
        neighbors.add(tgtId);
        links.add(link);
      }
    });

    setHighlightNodes(neighbors);
    setHighlightLinks(links);
  };

  // Handle node click (and detect double-click to focus)
  const handleNodeClick = (node: any) => {
    const now = Date.now();
    if (lastClickRef.current.id === node.id && now - lastClickRef.current.time < 350) {
      if (onFocusNode) {
        onFocusNode(node.id);
      }
    }
    lastClickRef.current = { id: node.id, time: now };

    onSelectNode({
      id: node.id,
      type: node.type,
      label: node.label,
      degree: node.degree || 0,
      status: node.status,
      props: node.props,
    });
  };

  // Zoom controls
  const handleZoomIn = () => fgRef.current?.zoom(fgRef.current.zoom() * 1.3, 400);
  const handleZoomOut = () => fgRef.current?.zoom(fgRef.current.zoom() / 1.3, 400);
  const handleResetZoom = () => {
    fgRef.current?.zoomToFit(400, 30);
  };

  return (
    <div ref={containerRef} className="relative h-full w-full bg-slate-50 overflow-hidden flex flex-col">
      {/* Top Filter Overlay */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-xs backdrop-blur-xs text-xs">
        {focusedNodeId ? (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">
              Local: <code className="font-mono text-[#0B2A4A]">{focusedNodeId}</code>
            </span>
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <span className="text-slate-500">Depth:</span>
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  onClick={() => setDepth(d)}
                  className={`px-2 py-0.5 rounded font-medium ${
                    depth === d
                      ? "bg-[#0B2A4A] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            {onClearFocus && (
              <button
                onClick={onClearFocus}
                className="ml-2 rounded px-2 py-0.5 font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                Reset to Global
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-700">Global Graph</span>
            {graphData?.isCapped && (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200/60">
                Top 1,500 Nodes
              </span>
            )}
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-600">
              <input
                type="checkbox"
                checked={includeProposed}
                onChange={(e) => setIncludeProposed(e.target.checked)}
                className="rounded border-slate-300 text-[#0B2A4A] focus:ring-0"
              />
              <span>Proposed Edges</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-600">
              <input
                type="checkbox"
                checked={orphansOnly}
                onChange={(e) => setOrphansOnly(e.target.checked)}
                className="rounded border-slate-300 text-[#0B2A4A] focus:ring-0"
              />
              <span>Orphans Only</span>
            </label>
          </div>
        )}
      </div>

      {/* Floating Canvas Controls (Right) */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-xs">
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={handleResetZoom}
          title="Fit View"
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Main Graph Canvas */}
      <div className="flex-1 w-full h-full">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-2xs">
            <span className="text-xs font-semibold text-slate-600">Computing graph topology...</span>
          </div>
        )}

        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={processedGraph}
          nodeId="id"
          nodeLabel="label"
          nodeColor={(node: any) => NODE_COLORS[node.type] || "#64748B"}
          nodeVal={(node: any) => Math.max(3, Math.sqrt(node.degree || 1) * 2.5)}
          nodeRelSize={4}
          linkColor={(link: any) =>
            highlightLinks.has(link)
              ? "#0B2A4A"
              : link.status === "proposed"
              ? "#D97706"
              : "#CBD5E1"
          }
          linkWidth={(link: any) => (highlightLinks.has(link) ? 2 : 1)}
          linkLineDash={(link: any) => (link.status === "proposed" ? [3, 2] : null)}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          cooldownTicks={100}
          onEngineStop={() => {
            if (focusedNodeId) {
              fgRef.current?.zoomToFit(400, 40);
            }
          }}
          nodeCanvasObjectMode={() => "after"}
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const isHighlighted = highlightNodes.has(node.id) || selectedNodeId === node.id;
            const isHovered = hoverNode?.id === node.id;

            // Draw label when hovered, selected, neighbor, or zoomed in
            if (globalScale > 2 || isHighlighted || isHovered) {
              const label = node.label || node.id;
              const fontSize = Math.max(10 / globalScale, 3);
              ctx.font = `${fontSize}px Inter, sans-serif`;
              ctx.fillStyle = isHighlighted ? "#0B2A4A" : "#334155";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(label, node.x, node.y + (node.val || 4) + 4 / globalScale);
            }
          }}
        />
      </div>

      {/* Tiny Legend (Bottom-Left) */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white/95 px-3 py-1.5 shadow-2xs backdrop-blur-xs text-[11px] text-slate-600">
        {Object.entries(NODE_COLORS)
          .filter(([type]) => !focusedNodeId ? type !== "Chunk" && type !== "DocVersion" : true)
          .map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span>{type}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
