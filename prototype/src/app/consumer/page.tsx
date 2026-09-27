"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Smartphone,
  Scale,
  Award,
  AlertOctagon,
  FileText,
  PhoneCall,
  Search,
  Filter,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MarkVerifier } from "@/components/features/MarkVerifier";

interface RecallItem {
  id: string;
  product: string;
  brand: string;
  standard: string;
  violation: string;
  action_taken: string;
  region: string;
  date: string;
  status: "Recalled" | "Seized" | "Warning Issued";
}

const SAFETY_ALERTS_RECALLS: RecallItem[] = [
  {
    id: "REC-2026-088",
    product: "Domestic Pressure Cookers (Inner Lid)",
    brand: "SpeedCook / Royal Chef (Counterfeit)",
    standard: "IS 2347:2017",
    violation: "Fake ISI mark without valid CM/L license number; burst test failure at 180 kPa.",
    action_taken: "Seizure of 1,840 units from Delhi wholesale godowns under Section 28 of BIS Act.",
    region: "Delhi-NCR",
    date: "2026-09-12",
    status: "Seized",
  },
  {
    id: "REC-2026-074",
    product: "Two-Wheeler Protective Helmets",
    brand: "RideSafe Non-ISI",
    standard: "IS 4151:2020",
    violation: "Substandard thermoplastic shell with no shock absorption liner or retention test approval.",
    action_taken: "Market recall and criminal FIR registered against unauthorized distributor.",
    region: "Maharashtra & Gujarat",
    date: "2026-08-29",
    status: "Recalled",
  },
  {
    id: "REC-2026-069",
    product: "Electric Immersion Water Heating Rods",
    brand: "ThermoHeat 1500W",
    standard: "IS 368:2014",
    violation: "Non-compliant insulation resistance and high earth leakage current risk of electrocution.",
    action_taken: "Immediate stop-sale order and nationwide consumer advisory issued.",
    region: "Uttar Pradesh & Bihar",
    date: "2026-08-15",
    status: "Warning Issued",
  },
  {
    id: "REC-2026-052",
    product: "20-Litre Packaged Drinking Water Jars",
    brand: "AquaPure Local Canning Unit",
    standard: "IS 14543:2024",
    violation: "Operating with expired BIS license; high microbial count exceeding permissible limits.",
    action_taken: "Production plant sealed; notice served under Consumer Protection Act.",
    region: "Karnataka",
    date: "2026-07-22",
    status: "Seized",
  },
];

export default function ConsumerPage() {
  const [activeTab, setActiveTab] = useState<"verifier" | "complaints" | "recalls">("verifier");
  const [recallSearch, setRecallSearch] = useState("");

  const filteredRecalls = SAFETY_ALERTS_RECALLS.filter(
    (item) =>
      item.product.toLowerCase().includes(recallSearch.toLowerCase()) ||
      item.brand.toLowerCase().includes(recallSearch.toLowerCase()) ||
      item.standard.toLowerCase().includes(recallSearch.toLowerCase()) ||
      item.region.toLowerCase().includes(recallSearch.toLowerCase())
  );

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
          <span className="text-navy font-bold">Consumer Services &amp; Mark Verifier</span>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab("verifier")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "verifier"
                ? "bg-navy text-white shadow-xs"
                : "bg-surface-raised text-ink-soft hover:text-navy border border-border"
            }`}
          >
            Mark &amp; HUID Verifier
          </button>
          <button
            onClick={() => setActiveTab("complaints")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "complaints"
                ? "bg-navy text-white shadow-xs"
                : "bg-surface-raised text-ink-soft hover:text-navy border border-border"
            }`}
          >
            File Consumer Grievance
          </button>
          <button
            onClick={() => setActiveTab("recalls")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "recalls"
                ? "bg-navy text-white shadow-xs"
                : "bg-surface-raised text-ink-soft hover:text-navy border border-border"
            }`}
          >
            Safety Alerts &amp; Recalls Directory ({SAFETY_ALERTS_RECALLS.length})
          </button>
        </div>

        {activeTab === "verifier" && (
          <>
            {/* Embedded Mark Verifier Component */}
            <MarkVerifier />

            {/* Consumer Rights & Penalties Rail */}
            <div className="mx-auto max-w-4xl mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Statutory Legal Warning Box */}
              <div className="rounded-2xl border border-red-200 bg-red-50/80 p-6 shadow-xs">
                <h3 className="text-sm font-extrabold text-red-900 uppercase tracking-wider flex items-center gap-2 mb-2">
                  <Scale className="h-4 w-4 text-red-700" />
                  Penalties for Fake / Misleading Standard Marks
                </h3>
                <p className="text-xs text-red-800 leading-relaxed">
                  Under <strong>Section 29 of the Bureau of Indian Standards Act, 2016</strong>, unauthorized use or imitation of the Standard Mark (ISI mark), CRS number, or Hallmarking Unique Identification (HUID) is a cognizable criminal offense punishable with:
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-red-900 font-semibold list-disc list-inside">
                  <li>Imprisonment for a term extending up to <strong>two years</strong>.</li>
                  <li>Fine of not less than <strong>₹2,00,000</strong> extending up to ten times the value of goods.</li>
                  <li>Seizure and confiscation of all non-compliant merchandise.</li>
                </ul>
              </div>

              {/* BIS CARE Mobile App & Complaints */}
              <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-navy uppercase tracking-wider flex items-center gap-2 mb-2">
                    <Smartphone className="h-4 w-4 text-orange" />
                    BIS CARE Mobile App &amp; Complaint Portal
                  </h3>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Consumers can verify license validity and report counterfeit products carrying substandard ISI marks directly via the official government portal or the official <strong>BIS CARE</strong> mobile application.
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-border space-y-2">
                  <button
                    onClick={() => setActiveTab("complaints")}
                    className="w-full flex items-center justify-between rounded-xl border border-navy/20 bg-surface-alt p-3 text-xs font-bold text-navy hover:bg-navy hover:text-white transition-all"
                  >
                    <span>View Official Grievance Portals</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <div className="text-[11px] text-ink-faint flex items-center justify-between px-1">
                    <span>National Consumer Helpline: 1915</span>
                    <span className="font-bold text-orange">BIS Toll-Free: 14434</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "complaints" && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="rounded-2xl border border-border bg-surface-raised p-6 sm:p-8 shadow-xs">
              <h2 className="text-xl sm:text-2xl font-black text-navy tracking-tight">
                Official Consumer Complaint &amp; Redressal Portals
              </h2>
              <p className="text-xs sm:text-sm text-ink-soft mt-1 leading-relaxed">
                If you have purchased a product with a forged ISI mark, misleading HUID gold hallmarking, or defective product violating a mandatory Quality Control Order, use the statutory government avenues below:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                {/* Route 1: BIS e-Complaint */}
                <div className="rounded-2xl border border-border bg-surface p-5 flex flex-col justify-between hover:border-navy transition-all">
                  <div className="space-y-3">
                    <div className="h-10 w-10 rounded-xl bg-orange/15 flex items-center justify-center text-orange">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold text-navy">1. BIS Online Complaints Portal</h3>
                    <p className="text-xs text-ink-soft leading-relaxed">
                      Direct enforcement portal for reporting misuse of ISI mark, uncertified mandatory goods, and substandard quality products.
                    </p>
                    <div className="text-[11px] font-mono text-ink-faint">
                      Toll Free: 14434 · complaints@bis.gov.in
                    </div>
                  </div>
                  <a
                    href="https://www.bis.gov.in/consumer-overview/online-complaint-registration/?lang=en"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-navy px-3 py-2 text-xs font-bold text-white hover:bg-navy-deep transition-colors"
                  >
                    <span>Lodge BIS Complaint</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {/* Route 2: NCH (National Consumer Helpline) */}
                <div className="rounded-2xl border border-border bg-surface p-5 flex flex-col justify-between hover:border-navy transition-all">
                  <div className="space-y-3">
                    <div className="h-10 w-10 rounded-xl bg-blue/15 flex items-center justify-center text-blue">
                      <PhoneCall className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold text-navy">2. National Consumer Helpline (NCH)</h3>
                    <p className="text-xs text-ink-soft leading-relaxed">
                      Ministry of Consumer Affairs grievance portal for pre-litigation resolution, consumer refunds, and deficiency in service.
                    </p>
                    <div className="text-[11px] font-mono text-ink-faint">
                      Helpline: 1915 / SMS: 8800001915
                    </div>
                  </div>
                  <a
                    href="https://consumerhelpline.gov.in"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-blue px-3 py-2 text-xs font-bold text-white hover:bg-blue-600 transition-colors"
                  >
                    <span>Open NCH Portal</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {/* Route 3: E-Daakhil */}
                <div className="rounded-2xl border border-border bg-surface p-5 flex flex-col justify-between hover:border-navy transition-all">
                  <div className="space-y-3">
                    <div className="h-10 w-10 rounded-xl bg-success/15 flex items-center justify-center text-success">
                      <Scale className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold text-navy">3. E-Daakhil Consumer Court</h3>
                    <p className="text-xs text-ink-soft leading-relaxed">
                      File formal statutory consumer litigation online with District, State, or National Consumer Disputes Redressal Commissions (NCDRC).
                    </p>
                    <div className="text-[11px] font-mono text-ink-faint">
                      Under Consumer Protection Act 2019
                    </div>
                  </div>
                  <a
                    href="https://edaakhil.nic.in"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-success px-3 py-2 text-xs font-bold text-white hover:bg-success/90 transition-colors"
                  >
                    <span>File on E-Daakhil</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "recalls" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-navy flex items-center gap-2">
                    <AlertOctagon className="h-5 w-5 text-rose-500" />
                    BIS Enforcement Directorate: Seizures &amp; Recall Notices
                  </h2>
                  <p className="text-xs text-ink-soft mt-1">
                    Official list of seized substandard goods, recalled non-ISI products, and market warnings issued under the BIS Act, 2016.
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint" />
                  <input
                    type="text"
                    value={recallSearch}
                    onChange={(e) => setRecallSearch(e.target.value)}
                    placeholder="Filter by product, brand, standard..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-surface text-xs text-ink focus:border-navy"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRecalls.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-surface-raised p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-navy bg-navy/10 px-2 py-0.5 rounded">
                      {item.standard}
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                        item.status === "Seized"
                          ? "bg-rose-500/15 text-rose-600 border border-rose-500/20"
                          : item.status === "Recalled"
                          ? "bg-orange/15 text-orange border border-orange/20"
                          : "bg-amber-500/15 text-amber-700 border border-amber-500/20"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-navy">{item.product}</h3>
                    <p className="text-xs text-ink-soft font-semibold">{item.brand}</p>
                  </div>

                  <div className="text-xs text-ink leading-relaxed bg-surface-alt/50 p-3 rounded-xl border border-border/70 space-y-1">
                    <div>
                      <strong className="text-navy">Violation: </strong>
                      <span>{item.violation}</span>
                    </div>
                    <div>
                      <strong className="text-navy">Enforcement Action: </strong>
                      <span>{item.action_taken}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-ink-faint pt-1">
                    <span>Region: {item.region}</span>
                    <span>Notice Date: {item.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
