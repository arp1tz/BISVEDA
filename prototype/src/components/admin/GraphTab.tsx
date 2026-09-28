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
  X,
  Target,
} from "lucide-react";
import type { GraphApiNode, GraphApiLink, GraphApiResponse } from "@/lib/knowledge/types";

// Dynamically import react-force-graph-2d with ssr: false
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#1e1e1e] text-xs text-slate-400">
      Loading graph canvas…
    </div>
  ),
});

// P7.2 node color tokens
export const NODE_COLORS: Record<string, string> = {
  standard: "#3b82f6",    // Blue
  clause: "#64748b",      // Gray
  lab: "#22c55e",         // Green
  ahc_region: "#eab308",  // Gold
  ahc: "#eab308",         // Gold
  domain: "#E8710A",      // Accent
  reference: "#94a3b8",   // Muted
  form: "#a855f7",        // Purple
};

function getNodeColor(type: string): string {
  const norm = (type || "").toLowerCase();
  return NODE_COLORS[norm] || "#94a3b8";
}

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

  // Search input state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  // Filters & Controls
  const [depth, setDepth] = useState<number>(1);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [enabledTypes, setEnabledTypes] = useState<Record<string, boolean>>({
    standard: true,
    clause: true,
    lab: true,
    ahc_region: true,
    domain: true,
    reference: true,
    form: true,
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
  }, [focusedNodeId, depth, enabledTypes, onGraphLoaded]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const processedGraph = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    return { nodes: graphData.nodes, links: graphData.links };
  }, [graphData]);

  // Search matches
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim() || !graphData) return [];
    const q = searchQuery.toLowerCase();
    return graphData.nodes
      .filter((n) => n.id.toLowerCase().includes(q) || (n.label || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchQuery, graphData]);

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

  // Handle node click
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
    fgRef.current?.zoomToFit(400, 40);
  };

  const handleSelectFromSearch = (node: GraphApiNode) => {
    setSearchQuery("");
    setSearchOpen(false);
    onSelectNode(node);
    if (onFocusNode) {
      onFocusNode(node.id);
    }
  };

  return (
    <div ref={containerRef} className="relative h-full w-full bg-[#1e1e1e] overflow-hidden flex flex-col text-slate-200">
      {/* Top Floating Controls */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
        {/* Scope Indicator / Local Focus Toggle */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#252525]/95 px-3 py-2 shadow-md backdrop-blur-md text-xs">
          {focusedNodeId ? (
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#3b82f6]" />
              <span>
                Local Graph: <code className="font-mono text-white font-bold">{focusedNodeId}</code>
              </span>
              <div className="flex items-center gap-1 pl-2 border-l border-slate-700">
                <span className="text-slate-400">Depth:</span>
                {[1, 2].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDepth(d)}
                    className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                      depth === d
                        ? "bg-[#3b82f6] text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              {onClearFocus && (
                <button
                  onClick={onClearFocus}
                  className="ml-2 rounded px-2 py-0.5 font-medium text-slate-400 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  Global View
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">Global Knowledge Graph</span>
              <span className="text-slate-400">
                ({graphData?.totalNodesInStore || 0} nodes · {graphData?.totalEdgesInStore || 0} edges)
              </span>
            </div>
          )}
        </div>

        {/* Search Box */}
        <div className="relative">
          <div className="flex items-center rounded-xl border border-slate-700 bg-[#252525]/95 px-3 py-1.5 shadow-md backdrop-blur-md text-xs">
            <Search className="h-3.5 w-3.5 text-slate-400 mr-2" />
            <input
              type="text"
              placeholder="Find standard, clause, lab…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              className="bg-transparent text-xs text-white placeholder-slate-400 focus:outline-hidden w-44"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-white ml-1">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {searchOpen && searchMatches.length > 0 && (
            <div className="absolute top-full left-0 mt-1.5 w-64 rounded-xl border border-slate-700 bg-[#252525] shadow-xl overflow-hidden z-30 divide-y divide-slate-800">
              {searchMatches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleSelectFromSearch(m)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-750 transition-colors flex items-center justify-between"
                >
                  <div className="truncate pr-2">
                    <div className="font-semibold text-white truncate">{m.label}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{m.id}</div>
                  </div>
                  <span
                    className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold shrink-0"
                    style={{
                      backgroundColor: `${getNodeColor(m.type)}22`,
                      color: getNodeColor(m.type),
                    }}
                  >
                    {m.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#252525]/95 px-3 py-2 shadow-md backdrop-blur-md text-xs font-medium cursor-pointer transition-colors ${
            showFilters ? "border-[#3b82f6] text-white" : "text-slate-300 hover:text-white"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          <span>Filters</span>
        </button>
      </div>

      {/* Type Filters Dropdown / Drawer */}
      {showFilters && (
        <div className="absolute top-16 left-3 z-10 rounded-xl border border-slate-700 bg-[#252525]/95 p-3 shadow-xl backdrop-blur-md text-xs space-y-2 max-w-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Toggle Node Types
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(enabledTypes).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white text-xs">
                <input
                  type="checkbox"
                  checked={enabledTypes[t]}
                  onChange={(e) =>
                    setEnabledTypes((prev) => ({ ...prev, [t]: e.target.checked }))
                  }
                  className="rounded border-slate-700 bg-slate-800 text-[#3b82f6] focus:ring-0"
                />
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: getNodeColor(t) }}
                  />
                  <span className="capitalize">{t.replace("_", " ")}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Floating Canvas Controls (Right) */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 rounded-xl border border-slate-700 bg-[#252525]/95 p-1 shadow-md">
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={handleResetZoom}
          title="Fit View"
          className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Main Graph Canvas */}
      <div className="flex-1 w-full h-full">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1e1e1e]/80 backdrop-blur-2xs">
            <span className="text-xs font-semibold text-slate-300">Rendering knowledge graph…</span>
          </div>
        )}

        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={processedGraph}
          backgroundColor="#1e1e1e"
          nodeId="id"
          nodeLabel="label"
          nodeColor={(node: any) => {
            const baseColor = getNodeColor(node.type);
            if (hoverNode) {
              return highlightNodes.has(node.id) || selectedNodeId === node.id
                ? baseColor
                : "rgba(100, 116, 139, 0.25)";
            }
            return baseColor;
          }}
          nodeVal={(node: any) => Math.max(3.5, Math.sqrt(node.degree || 1) * 2.8)}
          nodeRelSize={4}
          linkColor={(link: any) => {
            if (hoverNode) {
              return highlightLinks.has(link) ? "#60a5fa" : "rgba(255, 255, 255, 0.04)";
            }
            return "rgba(255, 255, 255, 0.16)";
          }}
          linkWidth={(link: any) => (highlightLinks.has(link) ? 2 : 1)}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          cooldownTicks={120}
          onEngineStop={() => {
            if (focusedNodeId) {
              fgRef.current?.zoomToFit(400, 40);
            }
          }}
          nodeCanvasObjectMode={() => "after"}
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const isHighlighted = highlightNodes.has(node.id) || selectedNodeId === node.id;
            const isHovered = hoverNode?.id === node.id;

            // Labels on hover or zoom > 1.5
            if (globalScale > 1.5 || isHighlighted || isHovered) {
              const label = node.label || node.id;
              const fontSize = Math.max(10 / globalScale, 3);
              ctx.font = `${fontSize}px Inter, sans-serif`;
              ctx.fillStyle = isHighlighted ? "#ffffff" : isHovered ? "#93c5fd" : "#cbd5e1";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(label, node.x, node.y + (node.val || 4) + 4 / globalScale);
            }
          }}
        />
      </div>

      {/* Legend (Bottom-Left) */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 bg-[#252525]/95 px-3 py-1.5 shadow-md backdrop-blur-md text-[11px] text-slate-300">
        {Object.entries(NODE_COLORS)
          .filter(([type]) => type !== "ahc")
          .map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="capitalize">{type.replace("_", " ")}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
