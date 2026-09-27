"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, Paperclip, BookOpen, ShieldCheck, FlaskConical, Sparkles, Camera } from "lucide-react";
import { AppHeader } from "@/components/chat/v9/AppHeader";
import { AppFooter } from "@/components/chat/v9/AppFooter";
import { VisualProductInspectorModal } from "@/components/features/VisualProductInspectorModal";

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  const productPills = [
    { label: "Helmets", query: "Which Indian Standard applies to motorcycle helmets and is it mandatory?" },
    { label: "Toys", query: "Safety requirements and standards for children's toys" },
    { label: "Pressure Cooker", query: "Which BIS standard applies to domestic stainless steel pressure cookers?" },
    { label: "Packaged Water", query: "Is BIS certification mandatory for packaged drinking water?" },
  ];

  const actionCards = [
    {
      icon: BookOpen,
      title: "Find your standard",
      desc: "Discover applicable Indian Standard specifications for any product",
      query: "Which Indian Standard applies to my product?",
    },
    {
      icon: ShieldCheck,
      title: "Check if BIS is mandatory",
      desc: "Verify Quality Control Orders (QCO) published in the Official Gazette",
      query: "Is BIS certification mandatory for my product under a QCO?",
    },
    {
      icon: FlaskConical,
      title: "Find a lab near you",
      desc: "Locate accredited laboratories capable of conformity testing",
      query: "Which BIS-recognized laboratories can test my product?",
    },
  ];

  const handleSearch = (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q && !attachedFile) return;
    const conversationId = `conv-${Date.now()}`;

    if (attachedFile) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.includes("base64,") ? dataUrl.split("base64,")[1] : dataUrl;
        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            `pending_attachment_${conversationId}`,
            JSON.stringify({
              name: attachedFile.name,
              previewUrl: dataUrl,
              base64,
              type: attachedFile.type,
            })
          );
        }
        router.push(`/chat/${conversationId}${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      };
      reader.readAsDataURL(attachedFile);
      return;
    }

    router.push(`/chat/${conversationId}?q=${encodeURIComponent(q)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleTryExample = () => {
    const example = productPills[0];
    setQuery(example.query);
    handleSearch(example.query);
  };

  return (
    <div className="flex flex-col min-h-screen sm:h-screen w-screen overflow-x-hidden bg-white text-[#0F172A] font-sans justify-between">
      {/* Shared Minimal Header */}
      <AppHeader />

      {/* Center 1-Screen Landing View */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6 max-w-4xl mx-auto w-full">
        {/* Hero Headings */}
        <div className="text-center space-y-2.5 mb-7">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-[#0B2A4A] tracking-tight leading-tight">
            Find the right BIS standard, certification and lab.
          </h1>
          <p className="text-sm sm:text-base text-[#64748B] max-w-xl mx-auto leading-relaxed">
            Ask in any Indian language. Every answer shows its official source.
          </p>
        </div>

        {/* Search Box */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl relative mb-4">
          <div className="flex items-center w-full bg-[#F7F8FA] border border-[#E5E7EB] focus-within:border-[#0B2A4A] focus-within:ring-2 focus-within:ring-[#0B2A4A]/10 rounded-xl px-3.5 py-2.5 shadow-xs transition-all">
            <Search className="h-5 w-5 text-[#64748B] shrink-0 mr-2.5" />
            <input
              type="text"
              id="landing-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about a product, standard or certification…"
              className="flex-1 bg-transparent text-sm text-[#0F172A] placeholder-[#64748B] focus:outline-hidden"
              autoFocus
            />

            {/* Hidden file input for attachment */}
            <input
              type="file"
              id="file-attachment-input"
              className="hidden"
              accept="image/*,.pdf"
              onChange={(e) => {
                if (e.target.files?.[0]) setAttachedFile(e.target.files[0]);
              }}
            />

            <button
              type="button"
              onClick={() => setIsPhotoModalOpen(true)}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0B2A4A] hover:bg-[#E5E7EB] cursor-pointer transition-colors mr-1"
              title="Check a product photo"
            >
              <Camera className="h-4 w-4" />
            </button>

            <label
              htmlFor="file-attachment-input"
              className={`p-1.5 rounded-lg text-[#64748B] hover:text-[#0B2A4A] hover:bg-[#E5E7EB] cursor-pointer transition-colors mr-1.5 ${
                attachedFile ? "text-[#E8710A] bg-[#FFF7ED]" : ""
              }`}
              title={attachedFile ? attachedFile.name : "Attach photo or document"}
            >
              <Paperclip className="h-4 w-4" />
            </label>

            <button
              type="submit"
              disabled={!query.trim() && !attachedFile}
              className="p-2 rounded-lg bg-[#0B2A4A] text-white hover:bg-[#081e36] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Submit Query"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {attachedFile && (
            <div className="text-[11px] text-[#64748B] mt-1 flex items-center gap-1.5">
              <span>Attached: {attachedFile.name}</span>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                className="text-red-500 hover:underline cursor-pointer"
              >
                Remove
              </button>
            </div>
          )}
        </form>

        {/* Product Pills + Try an example */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8 max-w-2xl">
          {productPills.map((pill) => (
            <button
              key={pill.label}
              onClick={() => {
                setQuery(pill.query);
                handleSearch(pill.query);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F7F8FA] border border-[#E5E7EB] text-[#0F172A] hover:border-[#0B2A4A] hover:bg-white hover:text-[#0B2A4A] transition-all cursor-pointer"
            >
              {pill.label}
            </button>
          ))}
          <button
            onClick={handleTryExample}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#E8710A] bg-[#FFF7ED] border border-[#FDBA74]/50 hover:bg-[#FFEDD5] transition-all cursor-pointer flex items-center gap-1"
          >
            <Sparkles className="h-3 w-3" />
            <span>Try an example</span>
          </button>
        </div>

        {/* 3 Action Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full max-w-2xl">
          {actionCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                onClick={() => {
                  setQuery(card.query);
                  handleSearch(card.query);
                }}
                className="flex flex-col items-start p-3.5 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#0B2A4A] hover:shadow-xs transition-all text-left cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-[#F7F8FA] text-[#0B2A4A] group-hover:bg-[#0B2A4A] group-hover:text-white transition-colors mb-2.5">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold text-[#0F172A] mb-1 group-hover:text-[#0B2A4A]">
                  {card.title}
                </h3>
                <p className="text-[11px] text-[#64748B] leading-snug line-clamp-2">
                  {card.desc}
                </p>
              </button>
            );
          })}
        </div>
      </main>

      {/* Shared Minimal Footer */}
      <AppFooter />

      {/* Visual Product Inspector Modal */}
      <VisualProductInspectorModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
      />
    </div>
  );
}
