"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Network,
  FileText,
  Building2,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { GraphTab } from "@/components/admin/GraphTab";
import { NodeInspector } from "@/components/admin/NodeInspector";
import { DocumentsTab } from "@/components/admin/DocumentsTab";
import { DirectoryTab } from "@/components/admin/DirectoryTab";
import type { GraphApiNode, GraphApiLink, GraphApiResponse } from "@/lib/knowledge/types";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"graph" | "docs" | "directory">("graph");

  // Graph state
  const [selectedNode, setSelectedNode] = useState<GraphApiNode | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [graphLinks, setGraphLinks] = useState<GraphApiLink[]>([]);

  const handleGraphLoaded = (data: GraphApiResponse) => {
    setGraphLinks(data.links || []);
  };

  const handleSelectNode = (nodeOrId: GraphApiNode | string) => {
    if (typeof nodeOrId === "string") {
      const foundLink = graphLinks.find(
        (l) =>
          (typeof l.source === "object" ? (l.source as any).id : l.source) === nodeOrId ||
          (typeof l.target === "object" ? (l.target as any).id : l.target) === nodeOrId
      );
      setSelectedNode({
        id: nodeOrId,
        type: nodeOrId.split(":")[0] || "node",
        label: nodeOrId,
        degree: 1,
        props: foundLink ? { related_edge: foundLink.type } : {},
      });
    } else {
      setSelectedNode(nodeOrId);
    }
  };

  const handleFocusNode = (nodeId: string) => {
    setFocusedNodeId(nodeId);
  };

  const handleClearFocus = () => {
    setFocusedNodeId(null);
  };

  const handleOpenDocument = (docId: string) => {
    window.open(`/api/docs/${docId}`, "_blank");
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      router.push("/admin/login");
      router.refresh();
    } catch {
      router.push("/admin/login");
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white text-[#0F172A] font-sans">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-[#E5E7EB] bg-white px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-sm text-[#0B2A4A]">
            <span className="text-[#E8710A] text-lg font-black leading-none">◆</span>
            <span>BISVEDA</span>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full ml-1">
              Internal Console
            </span>
          </Link>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("graph")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "graph"
                  ? "bg-[#0B2A4A] text-white shadow-xs"
                  : "text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100"
              }`}
            >
              <Network className="h-3.5 w-3.5" />
              <span>Knowledge Graph</span>
            </button>

            <button
              onClick={() => setActiveTab("docs")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "docs"
                  ? "bg-[#0B2A4A] text-white shadow-xs"
                  : "text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Documents (9 PDFs)</span>
            </button>

            <button
              onClick={() => setActiveTab("directory")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "directory"
                  ? "bg-[#0B2A4A] text-white shadow-xs"
                  : "text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Directory (Labs &amp; AHC)</span>
            </button>
          </nav>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="text-xs font-semibold text-[#0B2A4A] hover:underline flex items-center gap-1"
          >
            <span>Public Assistant</span>
            <ExternalLink className="h-3 w-3" />
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer border border-transparent hover:border-red-200"
            title="Log out from admin console"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 flex overflow-hidden relative">
        {activeTab === "graph" && (
          <div className="flex-1 flex w-full h-full overflow-hidden">
            <div className="flex-1 h-full relative">
              <GraphTab
                onSelectNode={handleSelectNode}
                selectedNodeId={selectedNode?.id}
                focusedNodeId={focusedNodeId}
                onClearFocus={handleClearFocus}
                onFocusNode={handleFocusNode}
                onGraphLoaded={handleGraphLoaded}
              />
            </div>
            <NodeInspector
              node={selectedNode}
              links={graphLinks}
              onSelectNode={handleSelectNode}
              onFocusNode={handleFocusNode}
              onOpenDocument={handleOpenDocument}
            />
          </div>
        )}

        {activeTab === "docs" && <DocumentsTab />}

        {activeTab === "directory" && <DirectoryTab />}
      </main>
    </div>
  );
}
