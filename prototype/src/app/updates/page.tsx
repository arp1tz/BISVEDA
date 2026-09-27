"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  Calendar,
  Filter,
  Search,
  ExternalLink,
  ShieldAlert,
  FileText,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Sparkles,
  Layers,
  ChevronRight,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { standardToSlug } from "@/lib/standards-helper";

interface UpdateItem {
  id: string;
  title: string;
  category: "qco" | "amendment" | "new_standard" | "lab_circular" | "consumer_alert";
  categoryLabel: string;
  standard_number?: string;
  standard_title?: string;
  gazette_notification?: string;
  ministry: string;
  publish_date: string;
  enforcement_date?: string;
  week: string;
  summary: string;
  official_url: string;
  is_mandatory: boolean;
}

const UPDATES_DATA: UpdateItem[] = [
  {
    id: "UPD-2026-W38-01",
    title: "Quality Control Order (QCO) for Stainless Steel Cookware & Pressure Cookers Mandatory Enforcement",
    category: "qco",
    categoryLabel: "QCO Enforcement Order",
    standard_number: "IS 2347",
    standard_title: "Domestic Pressure Cookers — Specification (Fourth Revision)",
    gazette_notification: "S.O. 4128(E) / DPIIT",
    ministry: "Ministry of Commerce and Industry (DPIIT)",
    publish_date: "2026-09-18",
    enforcement_date: "2026-10-01",
    week: "Week 38 (Sep 2026)",
    summary: "DPIIT notifies strict statutory prohibition on manufacture, import, and sale of non-certified domestic pressure cookers. All units must bear ISI Mark under Scheme-I.",
    official_url: "https://www.bis.gov.in/product-certification/products-under-compulsory-certification/",
    is_mandatory: true,
  },
  {
    id: "UPD-2026-W38-02",
    title: "Amendment No. 2 Notified for Structural Steel Standard IS 2062:2011",
    category: "amendment",
    categoryLabel: "Standard Amendment",
    standard_number: "IS 2062",
    standard_title: "Hot Rolled Medium and High Tensile Structural Steel — Specification",
    gazette_notification: "BIS/CED-08/AMD-02",
    ministry: "Bureau of Indian Standards (Civil Engineering Division)",
    publish_date: "2026-09-15",
    week: "Week 38 (Sep 2026)",
    summary: "Refines impact test energy parameters at -20°C for Grade E350 and amends sulfur/phosphorus maximum limits in line with updated seismic design guidelines.",
    official_url: "https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/knowyourstandards/indian_standards/isdetails/2062",
    is_mandatory: true,
  },
  {
    id: "UPD-2026-W37-01",
    title: "Mandatory QCO for Protective Helmets for Two-Wheeler Riders (Phase IV)",
    category: "qco",
    categoryLabel: "QCO Enforcement Order",
    standard_number: "IS 4151",
    standard_title: "Protective Helmets for Two Wheeler Riders — Specification",
    gazette_notification: "S.O. 3892(E) / MoRTH",
    ministry: "Ministry of Road Transport and Highways (MoRTH)",
    publish_date: "2026-09-08",
    enforcement_date: "Immediate",
    week: "Week 37 (Sep 2026)",
    summary: "MoRTH and BIS mandate total ban on sale of non-ISI helmets. Local traffic authorities empowered to seize substandard non-compliant helmets under Motor Vehicles Act §129.",
    official_url: "https://www.bis.gov.in/product-certification/products-under-compulsory-certification/",
    is_mandatory: true,
  },
  {
    id: "UPD-2026-W37-02",
    title: "Extension of Laboratory Recognition Scheme (LRS) for Packaged Drinking Water",
    category: "lab_circular",
    categoryLabel: "Laboratory Circular",
    standard_number: "IS 14543",
    standard_title: "Packaged Drinking Water (Other than Natural Mineral Water)",
    gazette_notification: "BIS/LPAC/CIRC-114",
    ministry: "Central Marks Department-I (BIS)",
    publish_date: "2026-09-05",
    week: "Week 37 (Sep 2026)",
    summary: "Recognized third-party laboratories granted authorization for pesticide residue testing down to 0.0001 mg/L using GC-MS/MS and LC-MS/MS.",
    official_url: "https://www.bis.gov.in/laboratory-overview/",
    is_mandatory: false,
  },
  {
    id: "UPD-2026-W36-01",
    title: "New Standard Published: Photovoltaic Modules for Extreme Agro-Climatic Zones",
    category: "new_standard",
    categoryLabel: "New Standard Published",
    standard_number: "IS 18250",
    standard_title: "Terrestrial Photovoltaic (PV) Modules — Salt Mist & Ammonia Resistance",
    gazette_notification: "ETD-28 (24810)",
    ministry: "Electrotechnical Division (BIS)",
    publish_date: "2026-08-28",
    week: "Week 36 (Aug 2026)",
    summary: "Establishes accelerated degradation testing protocol for solar panels deployed in coastal and high-ammonia rural agricultural installations.",
    official_url: "https://www.services.bis.gov.in",
    is_mandatory: false,
  },
  {
    id: "UPD-2026-W35-01",
    title: "6-Digit HUID Hallmarking Mandate Extended to 55 Additional Districts",
    category: "qco",
    categoryLabel: "Hallmarking Order",
    standard_number: "IS 1417",
    standard_title: "Gold and Gold Alloys, Jewellery/Artefacts — Fineness and Marking",
    gazette_notification: "CA/HM/2026/08",
    ministry: "Ministry of Consumer Affairs, Food & Public Distribution",
    publish_date: "2026-08-20",
    enforcement_date: "2026-09-01",
    week: "Week 35 (Aug 2026)",
    summary: "Hallmarking of 14, 18, 20, 22, 23, and 24-carat gold jewellery made mandatory across 55 additional districts in India. All items require unique laser-etched 6-digit alphanumeric HUID.",
    official_url: "https://www.manakonline.in",
    is_mandatory: true,
  },
  {
    id: "UPD-2026-W34-01",
    title: "Consumer Advisory: Substandard Electric Immersion Rods & Heaters Seized",
    category: "consumer_alert",
    categoryLabel: "Consumer Safety Alert",
    standard_number: "IS 368",
    standard_title: "Electric Immersion Water Heaters — Safety Requirements",
    gazette_notification: "ENF-NORTH/2026-44",
    ministry: "BIS Enforcement Directorate",
    publish_date: "2026-08-14",
    week: "Week 34 (Aug 2026)",
    summary: "Enforcement raids in Delhi-NCR result in seizure of 4,200 non-ISI immersion rods lacking earthing safety and creepage distance. Consumers cautioned against uncertified heating appliances.",
    official_url: "https://www.bis.gov.in/consumer-overview/",
    is_mandatory: true,
  },
];

const CATEGORIES = [
  { id: "all", label: "All Updates" },
  { id: "qco", label: "QCO Orders & Mandates" },
  { id: "amendment", label: "Amendments" },
  { id: "new_standard", label: "New Standards" },
  { id: "lab_circular", label: "Lab Circulars" },
  { id: "consumer_alert", label: "Safety Alerts" },
];

export default function UpdatesPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyMandatory, setOnlyMandatory] = useState(false);

  const filteredUpdates = useMemo(() => {
    return UPDATES_DATA.filter((item) => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
      if (onlyMandatory && !item.is_mandatory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchStd = item.standard_number?.toLowerCase().includes(q);
        const matchSummary = item.summary.toLowerCase().includes(q);
        const matchMinistry = item.ministry.toLowerCase().includes(q);
        if (!matchTitle && !matchStd && !matchSummary && !matchMinistry) return false;
      }
      return true;
    });
  }, [selectedCategory, searchQuery, onlyMandatory]);

  // Group by week
  const groupedUpdates = useMemo(() => {
    const groups: Record<string, UpdateItem[]> = {};
    for (const item of filteredUpdates) {
      if (!groups[item.week]) groups[item.week] = [];
      groups[item.week].push(item);
    }
    return groups;
  }, [filteredUpdates]);

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-ink-faint mb-4">
          <Link href="/" className="hover:text-navy hover:underline">
            Home
          </Link>
          <span>/</span>
          <span className="text-navy font-bold">What&apos;s New &amp; Gazette Updates</span>
        </div>

        {/* Page Header */}
        <div className="rounded-2xl border border-border bg-surface-raised p-6 sm:p-8 shadow-xs mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-orange/15 px-3 py-1 text-xs font-black text-orange">
                <Bell className="h-3.5 w-3.5" />
                OFFICIAL STATUTORY BULLETIN
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-navy tracking-tight">
                What&apos;s New: BIS Gazette Orders &amp; Standards Feed
              </h1>
              <p className="text-xs sm:text-sm text-ink-soft max-w-2xl leading-relaxed">
                Real-time official tracking of Quality Control Orders (QCOs), Gazette amendments, newly published Indian Standards, lab circulars, and consumer safety alerts across all Union Ministries.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <a
                href="https://egazette.gov.in"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold text-navy hover:bg-surface-alt transition-colors"
              >
                <span>The Gazette of India</span>
                <ExternalLink className="h-3.5 w-3.5 text-ink-faint" />
              </a>
              <a
                href="https://www.bis.gov.in/product-certification/products-under-compulsory-certification/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs font-bold text-white hover:bg-navy-deep transition-colors shadow-xs"
              >
                <span>All Compulsory QCOs</span>
                <ExternalLink className="h-3.5 w-3.5 text-white/70" />
              </a>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="mt-6 pt-6 border-t border-border flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search IS number, QCO, ministry..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-surface text-xs text-ink focus:outline-none focus:border-navy"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedCategory === cat.id
                      ? "bg-navy text-white shadow-xs"
                      : "bg-surface-alt text-ink-soft hover:text-navy border border-border"
                  }`}
                >
                  {cat.label}
                </button>
              ))}

              <label className="flex items-center gap-2 ml-2 cursor-pointer text-xs font-bold text-ink-soft">
                <input
                  type="checkbox"
                  checked={onlyMandatory}
                  onChange={(e) => setOnlyMandatory(e.target.checked)}
                  className="rounded border-border text-orange focus:ring-orange"
                />
                <span>Mandatory QCOs Only</span>
              </label>
            </div>
          </div>
        </div>

        {/* Timeline Grouped List */}
        <div className="space-y-8">
          {Object.keys(groupedUpdates).length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface-raised p-12 text-center">
              <BookOpen className="h-10 w-10 text-ink-faint mx-auto mb-3 opacity-40" />
              <h3 className="text-base font-bold text-navy">No updates match your filter</h3>
              <p className="text-xs text-ink-soft mt-1">Try clearing the search query or selecting &quot;All Updates&quot;.</p>
              <button
                onClick={() => {
                  setSelectedCategory("all");
                  setSearchQuery("");
                  setOnlyMandatory(false);
                }}
                className="mt-4 px-4 py-2 bg-navy text-white text-xs font-bold rounded-xl hover:bg-navy-deep"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            Object.entries(groupedUpdates).map(([week, items]) => (
              <div key={week} className="space-y-4">
                {/* Week Header */}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-navy">
                    {week}
                  </h2>
                  <span className="text-xs font-bold text-ink-faint rounded-full bg-surface-alt px-2 py-0.5 border border-border">
                    {items.length} {items.length === 1 ? "notice" : "notices"}
                  </span>
                </div>

                {/* Items in this week */}
                <div className="grid grid-cols-1 gap-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border bg-surface-raised p-5 hover:border-navy/40 transition-all shadow-xs"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                                item.category === "qco"
                                  ? "bg-orange/15 text-orange border border-orange/20"
                                  : item.category === "amendment"
                                  ? "bg-blue/15 text-blue border border-blue/20"
                                  : item.category === "consumer_alert"
                                  ? "bg-rose-500/15 text-rose-600 border border-rose-500/20"
                                  : "bg-success/15 text-success border border-success/20"
                              }`}
                            >
                              {item.categoryLabel}
                            </span>

                            {item.is_mandatory && (
                              <span className="rounded-full bg-orange px-2 py-0.5 text-[9px] font-black uppercase text-white flex items-center gap-1">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Mandatory
                              </span>
                            )}

                            {item.gazette_notification && (
                              <span className="font-mono text-[11px] font-bold text-ink-faint">
                                {item.gazette_notification}
                              </span>
                            )}

                            <span className="text-[11px] text-ink-faint ml-auto">
                              Notified: {item.publish_date}
                              {item.enforcement_date && (
                                <span className="text-orange font-bold ml-2">
                                  · Effective: {item.enforcement_date}
                                </span>
                              )}
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-navy leading-snug">
                            {item.title}
                          </h3>

                          {item.standard_number && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-mono font-black text-navy bg-navy/10 px-2 py-0.5 rounded">
                                {item.standard_number}
                              </span>
                              {item.standard_title && (
                                <span className="text-ink-soft line-clamp-1">
                                  {item.standard_title}
                                </span>
                              )}
                            </div>
                          )}

                          <p className="text-xs text-ink leading-relaxed">
                            {item.summary}
                          </p>

                          <div className="flex items-center gap-1.5 text-[11px] text-ink-faint pt-1">
                            <Building2 className="h-3 w-3" />
                            <span>{item.ministry}</span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-row lg:flex-col gap-2 shrink-0 self-end lg:self-start">
                          {item.standard_number && (
                            <Link
                              href={`/standards/${standardToSlug(item.standard_number)}`}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-bold text-navy hover:bg-surface-alt transition-colors"
                            >
                              <BookOpen className="h-3.5 w-3.5 text-blue" />
                              <span>Standard Passport</span>
                            </Link>
                          )}
                          <a
                            href={item.official_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-navy px-3 py-1.5 text-xs font-bold text-white hover:bg-navy-deep transition-colors shadow-xs"
                          >
                            <span>Official Gazette</span>
                            <ExternalLink className="h-3 w-3 text-white/70" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
