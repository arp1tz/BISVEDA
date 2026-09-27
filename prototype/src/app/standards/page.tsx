"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  BookOpen,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Sparkles,
  ArrowRight,
  LayoutGrid,
  List,
  ExternalLink,
  ShieldCheck,
  Building2,
  Zap,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { allStandards, standardToSlug } from "@/lib/standards-helper";

const CATEGORIES = [
  "All",
  "Kitchen & Cookware",
  "Electronics & IT",
  "Metallurgy & Steel",
  "Gold & Jewellery",
  "Packaged Water & Beverages",
  "Safety & PPE",
  "Cables & Electrical",
  "Cement & Building",
  "Automotive",
  "Toys & Child Safety",
  "Solar & Renewable",
];

export default function StandardsCatalogPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [schemeFilter, setSchemeFilter] = useState("All");
  const [tierFilter, setTierFilter] = useState("All");
  const [onlyMandatory, setOnlyMandatory] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  // Filtered standards
  const filteredStandards = useMemo(() => {
    let list = allStandards;

    if (onlyMandatory) {
      list = list.filter((s) => s.mandatory_qco);
    }

    if (schemeFilter !== "All") {
      list = list.filter((s) => s.scheme.toLowerCase().includes(schemeFilter.toLowerCase()));
    }

    if (tierFilter !== "All") {
      if (tierFilter === "Tier B") {
        list = list.filter((s) => s.key_testing_parameters && s.key_testing_parameters.length > 0);
      } else if (tierFilter === "Tier A") {
        list = list.filter((s) => !s.key_testing_parameters || s.key_testing_parameters.length === 0);
      }
    }

    if (selectedCategory !== "All") {
      list = list.filter(
        (s) =>
          s.product_category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
          s.industry.toLowerCase().includes(selectedCategory.toLowerCase()) ||
          (selectedCategory === "Kitchen & Cookware" &&
            (s.short_title.toLowerCase().includes("cooker") || s.short_title.toLowerCase().includes("bottle"))) ||
          (selectedCategory === "Gold & Jewellery" && s.short_title.toLowerCase().includes("gold")) ||
          (selectedCategory === "Metallurgy & Steel" && s.short_title.toLowerCase().includes("steel"))
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.standard_number.toLowerCase().includes(q) ||
          s.full_title.toLowerCase().includes(q) ||
          s.short_title.toLowerCase().includes(q) ||
          s.scope?.toLowerCase().includes(q) ||
          s.keywords?.some((k) => k.toLowerCase().includes(q))
      );
    }

    return list;
  }, [searchQuery, selectedCategory, schemeFilter, tierFilter, onlyMandatory]);

  const toggleCompare = (slug: string) => {
    if (selectedForCompare.includes(slug)) {
      setSelectedForCompare(selectedForCompare.filter((id) => id !== slug));
    } else {
      if (selectedForCompare.length >= 4) {
        alert("You can compare up to 4 standards at once.");
        return;
      }
      setSelectedForCompare([...selectedForCompare, slug]);
    }
  };

  const compareUrl = `/compare?ids=${selectedForCompare.join(",")}`;

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Breadcrumb & Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-ink-faint mb-2">
            <Link href="/" className="hover:text-navy hover:underline">
              Home
            </Link>
            <span>/</span>
            <span className="text-navy font-bold">Standards Knowledge Base</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-navy tracking-tight flex items-center gap-2.5">
                <BookOpen className="h-7 w-7 text-blue" />
                Indian Standards Register
                <span className="rounded-full bg-blue/10 px-3 py-0.5 text-xs font-bold text-blue">
                  {filteredStandards.length} Verified Standards
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-ink-soft mt-1">
                Browse official Bureau of Indian Standards specifications, active Quality Control Orders, and statutory testing requirements.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Link
                href="/compare"
                className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-raised px-3.5 py-2 text-xs font-bold text-navy hover:bg-surface-alt shadow-xs"
              >
                <Scale className="h-4 w-4 text-orange" />
                <span>Compare Matrix</span>
              </Link>
              <div className="flex rounded-lg border border-border bg-surface-raised p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded ${viewMode === "grid" ? "bg-navy text-white" : "text-ink-soft"}`}
                  title="Grid View"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded ${viewMode === "table" ? "bg-navy text-white" : "text-ink-soft"}`}
                  title="Table View"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="space-y-4 mb-8">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search standard number (e.g. IS 2347), product title, or keyword..."
                className="w-full rounded-xl border border-border bg-surface-raised pl-10 pr-4 py-2.5 text-xs sm:text-sm text-ink placeholder:text-ink-faint focus:border-navy focus:outline-none shadow-xs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={schemeFilter}
                onChange={(e) => setSchemeFilter(e.target.value)}
                className="rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs font-bold text-navy focus:outline-none"
              >
                <option value="All">All Schemes</option>
                <option value="Scheme-I">Scheme I (ISI Mark)</option>
                <option value="Scheme-II">Scheme II (CRS)</option>
                <option value="Scheme-IV">Scheme IV (Hallmarking)</option>
              </select>

              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs font-bold text-navy focus:outline-none"
              >
                <option value="All">All Tiers</option>
                <option value="Tier B">Tier B (Full Text &amp; STI)</option>
                <option value="Tier A">Tier A (Catalogue Record)</option>
              </select>

              <button
                onClick={() => setOnlyMandatory(!onlyMandatory)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                  onlyMandatory
                    ? "border-orange bg-orange/10 text-orange"
                    : "border-border bg-surface-raised text-ink-soft hover:text-navy"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-orange" />
                <span>Mandatory QCO Only</span>
              </button>
            </div>
          </div>

          {/* Industry Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  selectedCategory === cat
                    ? "bg-navy text-white shadow-xs"
                    : "border border-border bg-surface-raised text-ink-soft hover:bg-surface-alt hover:text-navy"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results Rendering */}
        {filteredStandards.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface-raised p-12 text-center my-8">
            <BookOpen className="h-10 w-10 text-ink-faint mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-bold text-navy">No Indian Standards Found</h3>
            <p className="text-xs text-ink-soft mt-1 max-w-md mx-auto">
              No matching standards were found for &quot;{searchQuery}&quot;. Try adjusting your search keywords or category filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
                setOnlyMandatory(false);
                setSchemeFilter("All");
              }}
              className="mt-4 rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-navy-deep"
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === "grid" ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStandards.map((std) => {
              const slug = standardToSlug(std.standard_number);
              const isSelected = selectedForCompare.includes(slug);

              return (
                <div
                  key={std.standard_id}
                  className={`group relative flex flex-col justify-between rounded-xl border bg-surface-raised p-5 shadow-xs transition-all hover:shadow-md hover:border-navy/40 ${
                    isSelected ? "border-navy ring-1 ring-navy" : "border-border"
                  }`}
                >
                  <div>
                    {/* Top Row: Standard Number, Year & Status */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCompare(slug)}
                          className="h-4 w-4 rounded border-border text-navy focus:ring-navy"
                          title="Select to compare"
                        />
                        <span className="font-mono text-sm font-black text-navy group-hover:text-blue transition-colors">
                          {std.standard_number}:{std.year}
                        </span>
                      </div>
                      {std.mandatory_qco ? (
                        <span className="rounded-full bg-orange/15 px-2 py-0.5 text-[10px] font-black uppercase text-orange">
                          Mandatory QCO
                        </span>
                      ) : (
                        <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[10px] font-bold text-ink-faint">
                          Voluntary
                        </span>
                      )}
                    </div>

                    {/* Standard Title */}
                    <Link href={`/standards/${slug}`} className="block">
                      <h3 className="text-sm font-bold text-ink group-hover:text-navy line-clamp-2 leading-snug">
                        {std.full_title}
                      </h3>
                    </Link>

                    {/* Sector & Scheme */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="rounded bg-surface-alt px-2 py-0.5 font-medium text-ink-soft">
                        {std.product_category}
                      </span>
                      <span className="rounded bg-blue/10 px-2 py-0.5 font-bold text-blue">
                        {std.scheme}
                      </span>
                    </div>

                    {/* Scope Snippet */}
                    <p className="mt-3 text-xs text-ink-soft line-clamp-2 leading-relaxed">
                      {std.scope}
                    </p>
                  </div>

                  {/* Bottom Row Actions */}
                  <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                    <Link
                      href={`/standards/${slug}`}
                      className="text-xs font-bold text-navy hover:text-blue hover:underline flex items-center gap-1"
                    >
                      View Passport <ArrowRight className="h-3 w-3" />
                    </Link>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleCompare(slug)}
                        className={`text-[11px] font-bold px-2 py-1 rounded transition-colors ${
                          isSelected
                            ? "bg-navy text-white"
                            : "text-ink-soft hover:text-navy hover:bg-surface-alt"
                        }`}
                      >
                        {isSelected ? "Selected" : "+ Compare"}
                      </button>
                      <Link
                        href={`/?q=${encodeURIComponent(std.short_title || std.full_title)}`}
                        className="rounded-lg bg-surface-alt p-1.5 text-navy hover:bg-navy hover:text-white transition-colors"
                        title="Open Research Workspace for this standard"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="rounded-xl border border-border bg-surface-raised overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-alt/70 text-ink-faint font-bold uppercase text-[10px] tracking-wider">
                  <th className="p-3 w-10 text-center">Compare</th>
                  <th className="p-3">Standard</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Product Category</th>
                  <th className="p-3">Scheme</th>
                  <th className="p-3">QCO Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStandards.map((std) => {
                  const slug = standardToSlug(std.standard_number);
                  const isSelected = selectedForCompare.includes(slug);

                  return (
                    <tr key={std.standard_id} className="hover:bg-surface-alt/40 transition-colors">
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCompare(slug)}
                          className="h-4 w-4 rounded border-border text-navy focus:ring-navy"
                        />
                      </td>
                      <td className="p-3 font-mono font-bold text-navy whitespace-nowrap">
                        <Link href={`/standards/${slug}`} className="hover:underline">
                          {std.standard_number}:{std.year}
                        </Link>
                      </td>
                      <td className="p-3 font-semibold text-ink max-w-xs truncate">
                        <Link href={`/standards/${slug}`} className="hover:text-blue">
                          {std.full_title}
                        </Link>
                      </td>
                      <td className="p-3 text-ink-soft whitespace-nowrap">{std.product_category}</td>
                      <td className="p-3 text-blue font-semibold whitespace-nowrap">{std.scheme}</td>
                      <td className="p-3 whitespace-nowrap">
                        {std.mandatory_qco ? (
                          <span className="rounded-full bg-orange/15 px-2 py-0.5 text-[10px] font-black uppercase text-orange">
                            Mandatory QCO
                          </span>
                        ) : (
                          <span className="text-ink-faint">Voluntary</span>
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap space-x-2">
                        <Link
                          href={`/standards/${slug}`}
                          className="font-bold text-navy hover:underline"
                        >
                          Passport
                        </Link>
                        <Link
                          href={`/?q=${encodeURIComponent(std.short_title || std.full_title)}`}
                          className="font-bold text-blue hover:underline"
                        >
                          Chat
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Floating Compare Action Bar */}
        {selectedForCompare.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-2xl border border-navy/30 bg-navy-deep px-5 py-3 text-white shadow-2xl backdrop-blur-lg">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-orange" />
              <span className="text-xs font-bold">
                {selectedForCompare.length} standard{selectedForCompare.length > 1 ? "s" : ""} selected for comparison
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={compareUrl}
                className="flex items-center gap-1.5 rounded-xl bg-orange px-4 py-1.5 text-xs font-black text-white hover:bg-orange/90 shadow-xs"
              >
                <span>Launch Compare Matrix</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <button
                onClick={() => setSelectedForCompare([])}
                className="text-xs text-white/70 hover:text-white underline px-1"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
