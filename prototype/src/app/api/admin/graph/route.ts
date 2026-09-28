import { NextRequest, NextResponse } from "next/server";
import { getGraph } from "@/lib/kb/store";
import type { GraphApiNode, GraphApiLink, GraphApiResponse } from "@/lib/knowledge/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const focusNodeId = searchParams.get("focus") || "";
    const depth = parseInt(searchParams.get("depth") || "1", 10);
    const typesParam = searchParams.get("types");

    const kbGraph = getGraph();
    const allNodes = kbGraph.nodes || [];
    const allEdges = kbGraph.edges || [];

    // Calculate node degree
    const degreeMap = new Map<string, number>();
    for (const e of allEdges) {
      degreeMap.set(e.src, (degreeMap.get(e.src) || 0) + 1);
      degreeMap.set(e.dst, (degreeMap.get(e.dst) || 0) + 1);
    }

    let filteredNodes = allNodes;
    let filteredEdges = allEdges;

    if (focusNodeId) {
      // Local graph BFS up to depth (1 or 2)
      const visited = new Set<string>([focusNodeId]);
      let currentFrontier = [focusNodeId];

      for (let d = 0; d < Math.min(depth, 3); d++) {
        const nextFrontier: string[] = [];
        for (const e of allEdges) {
          if (currentFrontier.includes(e.src) && !visited.has(e.dst)) {
            visited.add(e.dst);
            nextFrontier.push(e.dst);
          } else if (currentFrontier.includes(e.dst) && !visited.has(e.src)) {
            visited.add(e.src);
            nextFrontier.push(e.src);
          }
        }
        currentFrontier = nextFrontier;
      }

      filteredNodes = allNodes.filter((n) => visited.has(n.id));
      filteredEdges = allEdges.filter((e) => visited.has(e.src) && visited.has(e.dst));
    } else if (typesParam) {
      const allowedTypes = new Set(
        typesParam
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      );
      if (allowedTypes.size > 0) {
        filteredNodes = allNodes.filter((n) => allowedTypes.has((n.type || "").toLowerCase()));
        const allowedIds = new Set(filteredNodes.map((n) => n.id));
        filteredEdges = allEdges.filter((e) => allowedIds.has(e.src) && allowedIds.has(e.dst));
      }
    }

    const apiNodes: GraphApiNode[] = filteredNodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label || n.id,
      degree: degreeMap.get(n.id) || 0,
      status: "current",
      props: (n.props as Record<string, any>) || {},
    }));

    const apiLinks: GraphApiLink[] = filteredEdges.map((e) => ({
      source: e.src,
      target: e.dst,
      type: e.type,
      status: "current",
      source_url: e.source,
    }));

    const response: GraphApiResponse = {
      nodes: apiNodes,
      links: apiLinks,
      totalNodesInStore: allNodes.length,
      totalEdgesInStore: allEdges.length,
      isCapped: false,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("Admin graph API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
