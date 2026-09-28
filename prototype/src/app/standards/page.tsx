"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  BookOpen,
  Search,
  ExternalLink,
  MessageSquare,
  FlaskConical,
  ShieldCheck,
  Tag,
  ArrowRight,
} from "lucide-react";
import { AppHeader } from "@/components/chat/v9/AppHeader";
import { AppFooter } from "@/components/chat/v9/AppFooter";

interface StandardItem {
  id: string;
  code: string;
  year: string;
  category: "helmets" | "toys" | "hallmarking";
  categoryLabel: string;
  title: string;
  qcoMandatory: boolean;
  docId: string;
  summary: string;
  keyClauses: string[];
  sampleQuestions: string[];
}

const STANDARDS_DATA: StandardItem[] = [
  {
    id: "IS 4151",
    code: "IS 4151:2015",
    year: "2015",
    category: "helmets",
    categoryLabel: "Helmets & Headgear",
    title: "Protective Helmets for Motorcycle Riders — Specification",
    qcoMandatory: true,
    docId: "is-4151-2015",
    summary:
      "Specifies the construction, physical performance, impact attenuation, retention system, and marking requirements for protective helmets worn by two-wheeler riders and passengers.",
    keyClauses: [
      "Cl. 6.4: Impact Attenuation Test (< 300 g peak deceleration)",
      "Cl. 6.6: Retention System & Dynamic Extension (< 25 mm)",
      "Cl. 6.1: Peripheral Vision (>= 105° on either side)",
      "Cl. 4.2: Maximum Weight Limit (1.2 kg)",
      "Cl. 7.1: Marking of Standard Mark (ISI) with CM/L number",
    ],
    sampleQuestions: [
      "What are the impact attenuation limits under IS 4151?",
      "Is IS 4151 helmet compulsory under Quality Control Orders?",
      "What are the retention system test requirements?",
    ],
  },
  {
    id: "IS 2925",
    code: "IS 2925:1984",
    year: "1984 (Reaffirmed 2020)",
    category: "helmets",
    categoryLabel: "Helmets & Headgear",
    title: "Industrial Safety Helmets — Specification",
    qcoMandatory: false,
    docId: "is-2925-1984",
    summary:
      "Covers protective headwear designed to safeguard industrial, construction, and mining workers from falling objects, vertical impacts, and electrical hazards.",
    keyClauses: [
      "Cl. 6.1: Shock Absorption Test (transmitted force <= 5.0 kN)",
      "Cl. 6.2: Penetration Resistance Test (5 kg drop striker)",
      "Cl. 6.3: Flammability & Electrical Resistance",
      "Cl. 5.1: Cradle & Headband Suspension Design",
    ],
    sampleQuestions: [
      "Can an IS 2925 construction helmet be used for motorcycle riding?",
      "What shock absorption test is required for industrial helmets?",
    ],
  },
  {
    id: "IS 9873 (Part 1)",
    code: "IS 9873 (Part 1):2019",
    year: "2019",
    category: "toys",
    categoryLabel: "Toys & Children",
    title: "Safety of Toys — Part 1: Mechanical and Physical Properties",
    qcoMandatory: true,
    docId: "is-9873-1-2019",
    summary:
      "Addresses mechanical and physical hazards in children's toys, including choking risks from small parts, sharp points, drop and impact tests, and cords.",
    keyClauses: [
      "Cl. 4.4: Small Parts Cylinder for children under 36 months",
      "Cl. 4.7: Sharp Edges & Points evaluation",
      "Cl. 5.24: Dynamic Drop and Impact Tests",
      "Cl. 4.14: Cords, Straps, and Strangulation risks",
    ],
    sampleQuestions: [
      "What is the small parts test for toys under IS 9873 Part 1?",
      "Are imported toys required to bear the ISI mark in India?",
    ],
  },
  {
    id: "IS 9873 (Part 3)",
    code: "IS 9873 (Part 3):2017",
    year: "2017",
    category: "toys",
    categoryLabel: "Toys & Children",
    title: "Safety of Toys — Part 3: Migration of Certain Elements",
    qcoMandatory: true,
    docId: "is-9873-3-2017",
    summary:
      "Establishes strict maximum permissible chemical migration limits for 8 heavy metals (lead, cadmium, mercury, arsenic, etc.) in toy materials and surface coatings.",
    keyClauses: [
      "Table 1: Maximum Migration Limits (Lead <= 90 mg/kg, Cadmium <= 75 mg/kg)",
      "Cl. 7: Preparation of Analytical Test Solutions",
      "Cl. 8: Elemental determination via Spectrometry / ICP",
    ],
    sampleQuestions: [
      "What heavy metals are restricted under IS 9873 Part 3?",
      "What is the maximum allowed lead migration in toy paint?",
    ],
  },
  {
    id: "IS 15644",
    code: "IS 15644:2006",
    year: "2006 (Reaffirmed 2021)",
    category: "toys",
    categoryLabel: "Toys & Children",
    title: "Safety of Electric Toys",
    qcoMandatory: true,
    docId: "is-15644-2006",
    summary:
      "Mandates safety requirements for battery-operated, electrical, and electronic toys, covering supply voltage, thermal limits, short-circuit protection, and insulation.",
    keyClauses: [
      "Cl. 5.1: Maximum operating voltage limit (<= 24V DC / AC)",
      "Cl. 7: Heating and abnormal operation safeguards",
      "Cl. 9: Battery enclosure security and tool accessibility",
      "Cl. 14: Resistance to moisture and dust",
    ],
    sampleQuestions: [
      "What is the maximum permissible voltage for electric toys under IS 15644?",
      "What battery security requirements apply to electronic toys?",
    ],
  },
  {
    id: "IS 1417",
    code: "IS 1417:2016",
    year: "2016",
    category: "hallmarking",
    categoryLabel: "Gold & Hallmarking",
    title: "Gold and Gold Alloys, Jewellery/Artefacts — Fineness and Marking",
    qcoMandatory: true,
    docId: "is-1417-2016",
    summary:
      "The definitive Indian Standard for gold hallmarking. Defines recognized karatage purity grades, official 3-mark hallmark stamping, and 6-digit HUID engraving rules.",
    keyClauses: [
      "Table 1: Fineness Grades (24K995, 23K958, 22K916, 20K833, 18K750, 14K585, 9K375)",
      "Cl. 6.1: Three Mandatory Hallmark Marks (BIS logo, Purity grade, HUID)",
      "Cl. 6.1.3: 6-Character Alphanumeric HUID Laser Engraving",
    ],
    sampleQuestions: [
      "What are the 3 mandatory marks on hallmarked gold jewellery?",
      "What is the purity of 22K916 gold under IS 1417?",
      "How to verify an HUID in the BIS Care app?",
    ],
  },
  {
    id: "IS 1418",
    code: "IS 1418:2009",
    year: "2009 (Reaffirmed 2019)",
    category: "hallmarking",
    categoryLabel: "Gold & Hallmarking",
    title: "Assaying of Gold in Gold Bullion, Gold Alloys and Gold Jewellery — Cupellation (Fire Assay)",
    qcoMandatory: true,
    docId: "is-1418-2009",
    summary:
      "Specifies the gold cupellation (fire assay) method — the referee and benchmark laboratory technique used by Assaying and Hallmarking Centres for exact gold purity determination.",
    keyClauses: [
      "Cl. 4: Principle of cupellation with lead foil and proof gold",
      "Cl. 6: Parting with nitric acid to separate silver",
      "Cl. 8: Accuracy and precision limits (+- 0.5 parts per thousand)",
    ],
    sampleQuestions: [
      "How does the fire assay cupellation method determine gold purity?",
      "Why is IS 1418 used as the referee method for gold hallmarking?",
    ],
  },
  {
    id: "IS 15820",
    code: "IS 15820:2009",
    year: "2009 (Reaffirmed 2019)",
    category: "hallmarking",
    categoryLabel: "Gold & Hallmarking",
    title: "General Requirements for Competence of Assaying and Hallmarking Centres",
    qcoMandatory: true,
    docId: "is-15820-2009",
    summary:
      "Prescribes technical competence, management, laboratory equipment, security, sampling protocols, and HUID laser engraving facilities for BIS-recognized AHCs.",
    keyClauses: [
      "Cl. 5: Assaying laboratory infrastructure & air conditioning",
      "Cl. 6: Personnel qualifications & certified assayers",
      "Cl. 7.2: Sampling procedures for precious metals",
      "Cl. 8: Laser marking security & central portal synchronization",
    ],
    sampleQuestions: [
      "What equipment is mandatory for an Assaying and Hallmarking Centre (AHC)?",
      "How are hallmarking centres recognized by BIS under IS 15820?",
    ],
  },
];

export default function StandardsPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredStandards = useMemo(() => {
    return STANDARDS_DATA.filter((std) => {
      const matchesCategory =
        selectedCategory === "all" || std.category === selectedCategory;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        std.id.toLowerCase().includes(q) ||
        std.code.toLowerCase().includes(q) ||
        std.title.toLowerCase().includes(q) ||
        std.summary.toLowerCase().includes(q) ||
        std.categoryLabel.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] text-[#0F172A] font-sans">
      <AppHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Hero Section */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#E8710A] uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            <span>Official BIS Standards Registry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B2A4A] tracking-tight">
            Indian Standards Catalogue
          </h1>
          <p className="text-sm text-[#64748B] max-w-3xl leading-relaxed">
            Explore the core Indian Standards currently indexed in BISVEDA. All standards are grounded in
            official Bureau of Indian Standards documentation, mandatory Quality Control Orders (QCOs),
            and laboratory testing scopes.
          </p>

          {/* Search & Filter Toolbar */}
          <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#64748B]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search standard by number (e.g. IS 4151, IS 1417) or keyword…"
                className="w-full pl-10 pr-4 py-2.5 bg-[#F7F8FA] border border-[#CBD5E1] rounded-xl text-sm focus:outline-hidden focus:border-[#0B2A4A] focus:bg-white transition-all placeholder-[#64748B]"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: "all", label: "All (8)" },
                { id: "helmets", label: "Helmets (2)" },
                { id: "toys", label: "Toys (3)" },
                { id: "hallmarking", label: "Gold (3)" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === tab.id
                      ? "bg-[#0B2A4A] text-white shadow-2xs"
                      : "bg-white border border-[#CBD5E1] text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between text-xs text-[#64748B] px-1">
          <span>
            Showing <strong>{filteredStandards.length}</strong> of {STANDARDS_DATA.length} Indian Standards
          </span>
          <span className="flex items-center gap-1 text-emerald-700 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" /> Official Gazette Backed
          </span>
        </div>

        {/* Standards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredStandards.map((std) => (
            <div
              key={std.id}
              className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-[#E8710A] uppercase tracking-wider block">
                      {std.categoryLabel}
                    </span>
                    <h3 className="text-lg font-bold text-[#0B2A4A] tracking-tight">
                      {std.code}
                    </h3>
                  </div>

                  {std.qcoMandatory ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                      Mandatory QCO
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200">
                      Standard Spec
                    </span>
                  )}
                </div>

                <h4 className="text-xs font-semibold text-slate-800 leading-snug">
                  {std.title}
                </h4>

                <p className="text-xs text-[#64748B] leading-relaxed">
                  {std.summary}
                </p>

                {/* Key Clauses */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    Core Technical Clauses:
                  </span>
                  <ul className="space-y-1 text-[11px] text-slate-600">
                    {std.keyClauses.slice(0, 3).map((cl, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-[#E8710A] font-bold">•</span>
                        <span>{cl}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/chat?q=What are the key technical requirements and clauses of ${std.id}?`}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0B2A4A] text-white hover:bg-[#081e36] text-xs font-semibold shadow-2xs transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Ask in Chat</span>
                  </Link>

                  <Link
                    href={`/labs?standard=${encodeURIComponent(std.id)}`}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-slate-500" />
                    <span>Labs</span>
                  </Link>
                </div>

                <a
                  href={`/api/docs/${std.docId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-[#E8710A] hover:underline font-medium"
                >
                  <span>Official Text</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
