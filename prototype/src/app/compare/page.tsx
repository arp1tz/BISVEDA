"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Scale,
  Plus,
  X,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Building2,
  Sparkles,
  Download,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { allStandards, getStandardBySlug, standardToSlug, type StandardItem } from "@/lib/standards-helper";

function CompareContent() {
  const searchParams = useSearchParams();
  const initialIdsParam = searchParams.get("ids");

  // Default to IS 2347 and IS 17526 if no query params
  const defaultSlugs = initialIdsParam
    ? initialIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : ["is-2347", "is-17526"];

  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(
    defaultSlugs.length > 0 ? defaultSlugs : ["is-2347", "is-17526"]
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const selectedStandards: StandardItem[] = selectedSlugs
    .map((slug) => getStandardBySlug(slug))
    .filter((s): s is StandardItem => s !== undefined);

  const handleAddStandard = (slug: string) => {
    if (selectedSlugs.includes(slug)) return;
    if (selectedSlugs.length >= 4) {
      alert("You can compare a maximum of 4 standards simultaneously.");
      return;
    }
    setSelectedSlugs([...selectedSlugs, slug]);
    setDropdownOpen(false);
  };

  const handleRemoveStandard = (slug: string) => {
    if (selectedSlugs.length <= 1) {
      alert("At least one standard must remain in the comparison matrix.");
      return;
    }
    setSelectedSlugs(selectedSlugs.filter((s) => s !== slug));
  };

  // Preset comparison pairs
  const presetPairs = [
    { label: "IS 2347 vs IS 17526 (Cookers vs Bottles)", slugs: ["is-2347", "is-17526"] },
    { label: "IS 14543 vs IS 13428 (Packaged vs Mineral Water)", slugs: ["is-14543", "is-13428"] },
    { label: "IS 16046 vs IS 616 (Batteries vs Audio/Electronics)", slugs: ["is-16046-part-2", "is-616"] },
    { label: "IS 1786:2008 vs IS 1786:1985 (TMT Steel Bars Revision)", slugs: ["is-1786", "is-1786-part-1"] },
  ];

  return (
    <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
      {/* Breadcrumb & Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-ink-faint mb-2">
          <Link href="/" className="hover:text-navy hover:underline">
            Home
          </Link>
          <span>/</span>
          <Link href="/standards" className="hover:text-navy hover:underline">
            Standards Register
          </Link>
          <span>/</span>
          <span className="text-navy font-bold">Comparison Matrix</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-black text-navy tracking-tight flex items-center gap-2.5">
                <Scale className="h-7 w-7 text-orange" />
                Standards Comparison Matrix
              </h1>
              <span className="rounded bg-success/20 px-2 py-0.5 text-xs font-black text-success">
                100% Operational
              </span>
            </div>
            <p className="text-xs sm:text-sm text-ink-soft">
              Side-by-side statutory analysis of scopes, mandatory QCO orders, testing clauses, and MSME fee structures.
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-ink-faint mr-1">Popular Comparisons:</span>
            {presetPairs.map((pair, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedSlugs(pair.slugs)}
                className="rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-[11px] font-bold text-navy hover:bg-surface-alt transition-colors"
              >
                {pair.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison Selector Bar */}
      <div className="rounded-2xl border border-border bg-surface-raised p-4 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-navy">Comparing {selectedStandards.length} Standards:</span>
          {selectedStandards.map((std) => {
            const slug = standardToSlug(std.standard_number);
            return (
              <span
                key={std.standard_id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-navy/30 bg-navy/5 px-2.5 py-1 text-xs font-bold text-navy"
              >
                <span>{std.standard_number}:{std.year}</span>
                <button
                  onClick={() => handleRemoveStandard(slug)}
                  className="text-ink-faint hover:text-orange"
                  title="Remove from comparison"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>

        {/* Add Standard Picker */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 rounded-xl bg-navy px-3.5 py-1.5 text-xs font-bold text-white hover:bg-navy-deep shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Standard</span>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-surface-raised p-3 shadow-xl z-50">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search standard (e.g. IS 4151, helmet, steel)..."
                className="w-full rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-xs text-ink focus:outline-none mb-2"
                autoFocus
              />
              <div className="max-h-60 overflow-y-auto space-y-1">
                {allStandards
                  .filter((s) => {
                    const q = searchFilter.toLowerCase();
                    return (
                      s.standard_number.toLowerCase().includes(q) ||
                      s.full_title.toLowerCase().includes(q)
                    );
                  })
                  .slice(0, 10)
                  .map((s) => {
                    const slug = standardToSlug(s.standard_number);
                    const isAlreadySelected = selectedSlugs.includes(slug);
                    return (
                      <button
                        key={s.standard_id}
                        disabled={isAlreadySelected}
                        onClick={() => handleAddStandard(slug)}
                        className={`w-full text-left rounded-lg p-2 text-xs flex items-center justify-between ${
                          isAlreadySelected
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-surface-alt text-ink"
                        }`}
                      >
                        <span className="font-bold text-navy truncate mr-2">
                          {s.standard_number} - {s.short_title}
                        </span>
                        <span className="text-[10px] text-ink-faint whitespace-nowrap">
                          {isAlreadySelected ? "Added" : "+ Add"}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side-by-Side Comparison Table */}
      <div className="rounded-2xl border border-border bg-surface-raised overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-alt/70">
                <th className="p-4 w-48 font-bold uppercase text-[10px] text-ink-faint tracking-wider">
                  Dimension
                </th>
                {selectedStandards.map((std) => (
                  <th key={std.standard_id} className="p-4 min-w-[260px] border-l border-border/60">
                    <div className="space-y-1">
                      <span className="font-mono text-sm font-black text-navy block">
                        {std.standard_number}:{std.year}
                      </span>
                      <span className="text-xs font-bold text-ink block line-clamp-2">
                        {std.full_title}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* Row 1: Mandatory QCO Status */}
              <tr className="hover:bg-surface-alt/30">
                <td className="p-4 font-bold text-navy flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange" />
                  QCO Legal Status
                </td>
                {selectedStandards.map((std) => (
                  <td key={std.standard_id} className="p-4 border-l border-border/60">
                    {std.mandatory_qco ? (
                      <span className="rounded-full bg-orange/15 px-2.5 py-1 text-[11px] font-black uppercase text-orange inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Mandatory QCO
                      </span>
                    ) : (
                      <span className="rounded-full bg-surface-alt px-2.5 py-1 text-[11px] font-bold text-ink-faint">
                        Voluntary
                      </span>
                    )}
                    {std.legal_source?.gazette_order && (
                      <p className="text-[10px] text-ink-soft mt-1 leading-tight">
                        {std.legal_source.gazette_order}
                      </p>
                    )}
                  </td>
                ))}
              </tr>

              {/* Row 2: Certification Scheme */}
              <tr className="hover:bg-surface-alt/30">
                <td className="p-4 font-bold text-navy flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue" />
                  Applicable Scheme
                </td>
                {selectedStandards.map((std) => (
                  <td key={std.standard_id} className="p-4 border-l border-border/60">
                    <span className="font-bold text-blue block text-xs">{std.scheme}</span>
                    <span className="text-[11px] text-ink-soft block mt-0.5">
                      {std.certification_route}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Row 3: Product Scope */}
              <tr className="hover:bg-surface-alt/30">
                <td className="p-4 font-bold text-navy flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-ink-faint" />
                  Scope & Application
                </td>
                {selectedStandards.map((std) => (
                  <td key={std.standard_id} className="p-4 border-l border-border/60 leading-relaxed text-ink-soft">
                    {std.scope}
                  </td>
                ))}
              </tr>

              {/* Row 4: Approved Materials */}
              <tr className="hover:bg-surface-alt/30">
                <td className="p-4 font-bold text-navy">Approved Materials</td>
                {selectedStandards.map((std) => (
                  <td key={std.standard_id} className="p-4 border-l border-border/60">
                    {std.materials && std.materials.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {std.materials.map((m, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-surface-alt px-2 py-0.5 text-[10px] font-medium text-navy"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-ink-faint">Standard specification defined</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Row 5: Mandatory Testing Parameters */}
              <tr className="hover:bg-surface-alt/30">
                <td className="p-4 font-bold text-navy">Mandatory Tests</td>
                {selectedStandards.map((std) => (
                  <td key={std.standard_id} className="p-4 border-l border-border/60">
                    {std.key_testing_parameters && (
                      <ul className="space-y-1">
                        {std.key_testing_parameters.map((param, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 text-[11px] text-ink-soft">
                            <span className="text-success font-bold">✓</span>
                            <span>{param}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                ))}
              </tr>

              {/* Row 6: MSME 80% Concession Fee */}
              <tr className="hover:bg-surface-alt/30">
                <td className="p-4 font-bold text-navy flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-success" />
                  MSME Fee Concession
                </td>
                {selectedStandards.map((std) => (
                  <td key={std.standard_id} className="p-4 border-l border-border/60">
                    <span className="text-xs font-black text-success block">80% Statutory Subsidy</span>
                    <span className="text-[11px] text-ink-soft block mt-0.5">
                      Application Fee: <strong className="text-navy">₹1,000</strong> (Normal: ₹5,000)
                    </span>
                    <span className="text-[11px] text-ink-soft block">
                      Annual License: <strong className="text-navy">₹2,000</strong> (Normal: ₹10,000)
                    </span>
                  </td>
                ))}
              </tr>

              {/* Row 7: Section 29 Penal Consequence */}
              <tr className="hover:bg-surface-alt/30">
                <td className="p-4 font-bold text-navy flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-red-600" />
                  Legal Penalties
                </td>
                {selectedStandards.map((std) => (
                  <td key={std.standard_id} className="p-4 border-l border-border/60 text-[11px]">
                    {std.mandatory_qco ? (
                      <span className="text-red-700 font-semibold block leading-tight">
                        Section 29 BIS Act: Up to 2 years imprisonment or fine up to ₹5,00,000 for sale without Standard Mark.
                      </span>
                    ) : (
                      <span className="text-ink-faint">Voluntary standard; no criminal penalty under Section 29.</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Row 8: Direct Actions & Official Government Portals */}
              <tr className="bg-surface-alt/20">
                <td className="p-4 font-bold text-navy">Direct Actions & Official Links</td>
                {selectedStandards.map((std) => {
                  const slug = standardToSlug(std.standard_number);
                  const isScheme1 = std.scheme.includes("Scheme-I");
                  return (
                    <td key={std.standard_id} className="p-4 border-l border-border/60">
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <Link
                          href={`/standards/${slug}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-navy px-2.5 py-1 text-xs font-bold text-white hover:bg-navy-deep shadow-xs"
                        >
                          Passport <ArrowRight className="h-3 w-3" />
                        </Link>
                        <Link
                          href={`/?q=${encodeURIComponent(std.short_title || std.full_title)}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs font-bold text-navy hover:bg-surface-alt"
                        >
                          <Sparkles className="h-3 w-3 text-orange" />
                          Chat
                        </Link>
                      </div>
                      <div className="flex flex-col gap-1 text-[11px]">
                        <a
                          href={std.legal_source?.portal_url || "https://www.bis.gov.in/product-certification/products-under-compulsory-certification/?lang=en"}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-orange hover:underline font-semibold"
                        >
                          <span>Gazette S.O. Order</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                        <a
                          href={isScheme1 ? "https://www.manakonline.in" : "https://www.crsbis.in/BIS/"}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue hover:underline font-semibold"
                        >
                          <span>{isScheme1 ? "Apply on Manak Online" : "Apply on CRSBIS"}</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

export default function ComparePage() {
  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <Navbar />
      <Suspense fallback={<div className="p-12 text-center text-xs text-ink-faint">Loading Comparison Matrix...</div>}>
        <CompareContent />
      </Suspense>
      <Footer />
    </div>
  );
}
