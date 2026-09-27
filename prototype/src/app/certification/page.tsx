"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Building2,
  FileText,
  Clock,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Percent,
  Search,
  ArrowRight,
  Compass,
  Layers,
  FlaskConical,
  Award,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SchemeWizard } from "@/components/features/SchemeWizard";
import { allStandards, StandardItem } from "@/lib/standards-helper";

export default function CertificationPage() {
  const [productQuery, setProductQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState("ALL");

  // Filter standards for the "Find a certification scheme" search module
  const searchResults = useMemo(() => {
    const q = productQuery.toLowerCase().trim();
    if (!q && selectedSector === "ALL") {
      // Default sample set of prominent products
      return allStandards.slice(0, 6);
    }
    return allStandards.filter((std) => {
      const matchesQ =
        !q ||
        std.standard_number.toLowerCase().includes(q) ||
        std.short_title.toLowerCase().includes(q) ||
        std.full_title.toLowerCase().includes(q) ||
        std.product_category.toLowerCase().includes(q) ||
        (std.keywords || []).some((k) => k.toLowerCase().includes(q));

      const matchesSector =
        selectedSector === "ALL" ||
        std.product_category.toLowerCase().includes(selectedSector.toLowerCase()) ||
        std.industry.toLowerCase().includes(selectedSector.toLowerCase());

      return matchesQ && matchesSector;
    });
  }, [productQuery, selectedSector]);

  const sampleKeywords = [
    "electrical appliance",
    "packaged drinking water",
    "steel product",
    "cement product",
    "cookware",
    "toys",
  ];

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 space-y-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-ink-faint">
          <Link href="/" className="hover:text-navy hover:underline">
            Home
          </Link>
          <span>/</span>
          <span className="text-navy font-bold">Certification Pathways</span>
        </div>

        {/* HERO SECTION */}
        <div className="rounded-3xl border border-border bg-surface-raised p-6 sm:p-10 shadow-xs">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-orange/15 px-3 py-0.5 text-xs font-black uppercase text-orange">
                Verified BIS Compliance Architecture
              </span>
              <span className="text-xs font-semibold text-ink-faint">
                Updated for 2026 Regulations
              </span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black text-navy tracking-tight leading-tight">
              Understand the BIS certification pathway
            </h1>
            <p className="mt-2 text-sm sm:text-base text-ink-soft leading-relaxed">
              Find applicable certification schemes, requirements, testing information, and related Indian Standards — using verified BIS information.
            </p>

            {/* Quick Navigation Action Pills */}
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#wizard"
                className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs font-bold text-white hover:bg-navy-deep transition-all shadow-xs"
              >
                <span>Check Certification Route (Wizard)</span>
                <ChevronRight className="h-4 w-4 text-orange" />
              </a>
              <a
                href="#discovery"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold text-navy hover:bg-surface-alt transition-all shadow-2xs"
              >
                <span>Find a Certification Scheme</span>
                <Search className="h-3.5 w-3.5 text-ink-faint" />
              </a>
              <a
                href="#process"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold text-navy hover:bg-surface-alt transition-all shadow-2xs"
              >
                <span>Explore Certification Process</span>
                <FileText className="h-3.5 w-3.5 text-ink-faint" />
              </a>
            </div>
          </div>
        </div>

        {/* SEQUENTIAL 5-STEP PATHWAY BAR */}
        <div className="rounded-2xl border border-border bg-surface-raised p-4 sm:p-5 shadow-xs overflow-x-auto">
          <div className="min-w-[650px] flex items-center justify-between gap-2 text-xs">
            {/* Step 01 */}
            <a
              href="#wizard"
              className="flex items-center gap-2 group p-2 rounded-xl hover:bg-surface-alt transition-all"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy text-white font-mono font-black text-xs group-hover:bg-orange transition-colors">
                01
              </span>
              <span className="font-bold text-navy group-hover:text-orange transition-colors">
                Determine certification route
              </span>
            </a>
            <span className="text-ink-faint font-bold">→</span>

            {/* Step 02 */}
            <a
              href="#discovery"
              className="flex items-center gap-2 group p-2 rounded-xl hover:bg-surface-alt transition-all"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy/15 text-navy font-mono font-black text-xs group-hover:bg-navy group-hover:text-white transition-colors">
                02
              </span>
              <span className="font-bold text-ink-soft group-hover:text-navy transition-colors">
                Find the applicable scheme
              </span>
            </a>
            <span className="text-ink-faint font-bold">→</span>

            {/* Step 03 */}
            <a
              href="#discovery"
              className="flex items-center gap-2 group p-2 rounded-xl hover:bg-surface-alt transition-all"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy/15 text-navy font-mono font-black text-xs group-hover:bg-navy group-hover:text-white transition-colors">
                03
              </span>
              <span className="font-bold text-ink-soft group-hover:text-navy transition-colors">
                Check requirements
              </span>
            </a>
            <span className="text-ink-faint font-bold">→</span>

            {/* Step 04 */}
            <Link
              href="/testing"
              className="flex items-center gap-2 group p-2 rounded-xl hover:bg-surface-alt transition-all"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy/15 text-navy font-mono font-black text-xs group-hover:bg-navy group-hover:text-white transition-colors">
                04
              </span>
              <span className="font-bold text-ink-soft group-hover:text-navy transition-colors">
                Understand testing
              </span>
            </Link>
            <span className="text-ink-faint font-bold">→</span>

            {/* Step 05 */}
            <a
              href="#official-services"
              className="flex items-center gap-2 group p-2 rounded-xl hover:bg-surface-alt transition-all"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange/15 text-orange font-mono font-black text-xs group-hover:bg-orange group-hover:text-white transition-colors">
                05
              </span>
              <span className="font-bold text-orange group-hover:underline">
                Proceed to BIS service
              </span>
            </a>
          </div>
        </div>

        {/* "WHAT ARE YOU LOOKING FOR?" SIMPLIFIED MODULES DASHBOARD */}
        <div>
          <div className="mb-4">
            <span className="text-xs font-black uppercase text-orange tracking-wider">
              Quick Discovery
            </span>
            <h2 className="text-2xl font-black text-navy mt-0.5">
              What are you looking for?
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card 1 */}
            <a
              href="#wizard"
              className="group flex flex-col justify-between rounded-2xl border border-border bg-surface-raised p-5 shadow-xs transition-all hover:border-navy hover:shadow-md"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange/15 text-orange mb-3 group-hover:bg-orange group-hover:text-white transition-all">
                  <Compass className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black text-navy group-hover:text-orange transition-colors">
                  Certification route wizard
                </h3>
                <p className="mt-1.5 text-xs text-ink-soft leading-relaxed">
                  3-step interactive tree to find your mandatory BIS scheme.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-navy group-hover:text-orange">
                <span>Start 3-Step Wizard</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </a>

            {/* Card 2 */}
            <a
              href="#discovery"
              className="group flex flex-col justify-between rounded-2xl border border-border bg-surface-raised p-5 shadow-xs transition-all hover:border-blue hover:shadow-md"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/15 text-blue mb-3 group-hover:bg-blue group-hover:text-white transition-all">
                  <Search className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black text-navy group-hover:text-blue transition-colors">
                  Find a certification scheme
                </h3>
                <p className="mt-1.5 text-xs text-ink-soft leading-relaxed">
                  Search by product, sector, or standard.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-blue">
                <span>Search Products</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </a>

            {/* Card 3 */}
            <a
              href="#discovery"
              className="group flex flex-col justify-between rounded-2xl border border-border bg-surface-raised p-5 shadow-xs transition-all hover:border-success hover:shadow-md"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15 text-success mb-3 group-hover:bg-success group-hover:text-white transition-all">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black text-navy group-hover:text-success transition-colors">
                  Understand requirements
                </h3>
                <p className="mt-1.5 text-xs text-ink-soft leading-relaxed">
                  See requirements associated with a scheme or standard.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-success">
                <span>View Requirements</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </a>

            {/* Card 4 */}
            <Link
              href="/testing"
              className="group flex flex-col justify-between rounded-2xl border border-border bg-surface-raised p-5 shadow-xs transition-all hover:border-purple-600 hover:shadow-md"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 mb-3 group-hover:bg-purple-600 group-hover:text-white transition-all">
                  <FlaskConical className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black text-navy group-hover:text-purple-600 transition-colors">
                  Find testing requirements
                </h3>
                <p className="mt-1.5 text-xs text-ink-soft leading-relaxed">
                  Discover relevant tests, accredited laboratories, and referenced methods.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-purple-600">
                <span>Open Testing Locator</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Card 5 */}
            <Link
              href="/standards"
              className="group flex flex-col justify-between rounded-2xl border border-border bg-surface-raised p-5 shadow-xs transition-all hover:border-navy hover:shadow-md"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10 text-navy mb-3 group-hover:bg-navy group-hover:text-white transition-all">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black text-navy group-hover:text-navy transition-colors">
                  Check a standard
                </h3>
                <p className="mt-1.5 text-xs text-ink-soft leading-relaxed">
                  Find the Indian Standards connected with a certification pathway.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-navy">
                <span>Browse Standards</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Card 6 */}
            <a
              href="#official-services"
              className="group flex flex-col justify-between rounded-2xl border border-border bg-surface-raised p-5 shadow-xs transition-all hover:border-orange hover:shadow-md"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange/15 text-orange mb-3 group-hover:bg-orange group-hover:text-white transition-all">
                  <ExternalLink className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black text-navy group-hover:text-orange transition-colors">
                  Explore BIS services
                </h3>
                <p className="mt-1.5 text-xs text-ink-soft leading-relaxed">
                  Find the appropriate official BIS service portal and apply online.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-orange">
                <span>View Official Portals</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </a>
          </div>
        </div>

        {/* EMBEDDED DECISION TREE (Check Your Certification Route) */}
        <SchemeWizard />

        {/* "FIND A CERTIFICATION SCHEME" PRODUCT SEARCH MODULE */}
        <div id="discovery" className="rounded-3xl border border-border bg-surface-raised p-6 sm:p-8 shadow-xs space-y-6">
          <div className="max-w-3xl">
            <span className="text-xs font-black uppercase text-orange tracking-wider">
              Product &amp; Standard Mapping
            </span>
            <h2 className="mt-1 text-2xl sm:text-3xl font-black text-navy tracking-tight">
              Find a certification scheme
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-ink-soft leading-relaxed">
              Describe your product. BIS Navigator's retrieval engine — not a generic AI — checks the applicable standard and any evidence for its certification route.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-ink-faint" />
            <input
              type="text"
              placeholder="Find certification (e.g. pressure cooker, packaged drinking water, steel, cement)..."
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              className="w-full rounded-2xl border-2 border-border bg-surface-alt/40 pl-11 pr-4 py-3 text-sm font-medium text-navy placeholder:text-ink-faint focus:border-navy focus:bg-surface-raised focus:outline-none shadow-2xs"
            />
          </div>

          {/* Quick Suggestion Pills */}
          <div>
            <div className="text-[11px] font-bold text-ink-faint mb-2">
              Popular searches:
            </div>
            <div className="flex flex-wrap gap-2">
              {sampleKeywords.map((kw) => (
                <button
                  key={kw}
                  onClick={() => setProductQuery(kw)}
                  className={`rounded-xl border px-3 py-1 text-xs font-bold transition-all ${
                    productQuery === kw
                      ? "border-navy bg-navy text-white shadow-xs"
                      : "border-border bg-surface-alt/60 text-ink-soft hover:border-navy/40 hover:bg-surface-raised"
                  }`}
                >
                  {kw}
                </button>
              ))}
              {productQuery && (
                <button
                  onClick={() => setProductQuery("")}
                  className="rounded-xl border border-border px-3 py-1 text-xs font-bold text-ink-faint hover:text-navy"
                >
                  Clear search
                </button>
              )}
            </div>
          </div>

          {/* Dynamic Search Results Grid */}
          <div className="pt-4 border-t border-border">
            <div className="mb-3 flex items-center justify-between text-xs text-ink-faint">
              <span>Showing {searchResults.length} matching standards &amp; certification mappings</span>
              <span className="text-[11px] italic">
                Examples are illustrative only — they aren't guaranteed certification mappings.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((std) => (
                <div
                  key={std.standard_id}
                  className="flex flex-col justify-between rounded-2xl border border-border bg-surface-alt/30 p-5 shadow-xs hover:border-navy/40 hover:bg-surface-raised transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-lg bg-navy px-2.5 py-1 font-mono text-xs font-black text-white">
                        {std.standard_number}
                      </span>
                      {std.mandatory_qco && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black uppercase text-red-700 border border-red-200">
                          Mandatory QCO
                        </span>
                      )}
                    </div>

                    <h4 className="mt-3 text-xs font-black text-navy line-clamp-2">
                      {std.short_title || std.full_title}
                    </h4>

                    <p className="mt-2 text-[11px] text-ink-soft line-clamp-2 leading-relaxed">
                      {std.scope}
                    </p>

                    <div className="mt-3 space-y-1 text-[11px]">
                      <div className="flex items-center gap-1.5 text-ink-faint">
                        <span className="font-semibold text-ink-soft">Scheme:</span>
                        <span className="font-bold text-navy">{std.scheme}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-ink-faint">
                        <span className="font-semibold text-ink-soft">Category:</span>
                        <span>{std.product_category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                    <Link
                      href="/testing"
                      className="font-bold text-blue hover:underline flex items-center gap-1"
                    >
                      <FlaskConical className="h-3 w-3" />
                      <span>Find Labs</span>
                    </Link>
                    <Link
                      href={`/standards`}
                      className="font-bold text-navy hover:underline flex items-center gap-1"
                    >
                      <span>Check Standard</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FACTORY AUDIT CHECKLIST & OFFICIAL BIS SERVICES */}
        <div id="process" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mandatory Document Checklist */}
          <div className="rounded-3xl border border-border bg-surface-raised p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue/15 text-blue">
                <FileText className="h-4 w-4" />
              </div>
              <h3 className="text-base font-black text-navy uppercase tracking-wider">
                Mandatory Factory Audit Checklist (Scheme I)
              </h3>
            </div>
            <ul className="space-y-3 text-xs text-ink-soft leading-relaxed">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <span>
                  <strong className="text-navy">Manufacturing Flowchart:</strong> Complete process diagram from raw material receipt to finished goods packaging.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <span>
                  <strong className="text-navy">In-House Testing Facility:</strong> On-site equipment capable of conducting all mandatory routine tests per the Scheme of Inspection and Testing (SIT).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <span>
                  <strong className="text-navy">Calibration Certificates:</strong> Valid NABL-traceable calibration certificates for all test gauges, scales, and instruments.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <span>
                  <strong className="text-navy">Competent Quality Personnel:</strong> Qualified quality control technician with designated responsibility for standard mark stamping.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <span>
                  <strong className="text-navy">Udyam Registration:</strong> Valid MSME registration certificate to unlock the statutory 80% fee subsidy.
                </span>
              </li>
            </ul>
          </div>

          {/* Official e-BIS Portal Actions */}
          <div id="official-services" className="rounded-3xl border border-border bg-surface-raised p-6 sm:p-8 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange/15 text-orange">
                  <ExternalLink className="h-4 w-4" />
                </div>
                <h3 className="text-base font-black text-navy uppercase tracking-wider">
                  Proceed to BIS Official Services
                </h3>
              </div>
              <p className="text-xs text-ink-soft leading-relaxed mb-5">
                The Bureau of Indian Standards operates digital portals for licensing. Select your pathway portal to begin your paperless application.
              </p>

              <div className="space-y-2.5 text-xs">
                <a
                  href="https://www.manakonline.in"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl border border-navy/20 bg-surface-alt p-3.5 font-bold text-navy hover:bg-navy hover:text-white transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Building2 className="h-4 w-4 text-orange" />
                    <span>Product Certification Portal (Scheme I &amp; FMCS)</span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                <a
                  href="https://www.crsbis.in/BIS/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl border border-navy/20 bg-surface-alt p-3.5 font-bold text-navy hover:bg-navy hover:text-white transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <FlaskConical className="h-4 w-4 text-blue" />
                    <span>Compulsory Registration Scheme (Scheme II - Electronics)</span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                <a
                  href="https://www.manakonline.in"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl border border-navy/20 bg-surface-alt p-3.5 font-bold text-navy hover:bg-navy hover:text-white transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Award className="h-4 w-4 text-orange" />
                    <span>Hallmarking Portal (Jewellers HUID Online)</span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-[11px] text-ink-faint">
              <span>National Standards Body of India</span>
              <span className="font-bold text-orange">Helpline: 14434</span>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
