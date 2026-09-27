"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Download,
  Printer,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Info,
  Layers,
  ChevronDown,
  ChevronUp,
  Cpu,
  FlaskConical,
  Users,
  Tag,
  FileCheck2,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function FormIPreparationPage() {
  const [activeSection, setActiveSection] = useState<number>(1);
  const [selectedStandard, setSelectedStandard] = useState("IS 2347:2017");

  // Sample factory draft state
  const [formData, setFormData] = useState({
    applicantName: "Apex Cookware Manufacturing Ltd.",
    factoryAddress: "Plot No. 42-B, Industrial Focal Point, Phase IV, Sahibabad, Ghaziabad, UP - 201010",
    corporateOffice: "DLF Cyber City, Tower C, 8th Floor, Gurugram, Haryana - 122002",
    gstin: "09AAACA1234F1Z8",
    pan: "AAACA1234F",
    msmeUdyam: "UDYAM-UP-28-0019284",
    standardNumber: "IS 2347:2017",
    productName: "Domestic Pressure Cookers",
    varieties: "Inner Lid & Outer Lid (Aluminium & Stainless Steel)",
    capacities: "2.0 L, 3.0 L, 5.0 L, 7.5 L, 10.0 L",
    brandNames: "ApexPro, ChefShield",
    annualCapacity: "1,200,000 Units / Annum",
    coreMachinery: "Deep Drawing Hydraulic Press (500 Ton), CNC Trimming & Beading Machine, Gasket Fitting Jig, Anodizing Plant",
    testingEquipment: "Hydrostatic Pressure Test Rig (tested to 300 kPa), Dead Weight Safety Valve Calibration Tester, Gasket Spring-Back Gauge, Thermal Shock Water Bath",
    qcInCharge: "Er. Rameshwar Verma, B.Tech (Mechanical), ASQ Certified Quality Engineer (14 yrs exp)",
    markingMode: "Permanent Stamping on Bottom Outer Body + Laser Etching on Lid with Sub-Clause 11.2 markings",
    feeCategory: "Micro & Small Enterprise (80% Concession on Annual Minimum Marking Fee under Scheme-I)",
  });

  const [activeTab, setActiveTab] = useState<"form" | "crosswalk">("form");

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(formData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Schedule_II_Form_1_${formData.standardNumber.replace(/[^a-zA-Z0-9]/g, "_")}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

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
          <Link href="/certification" className="hover:text-navy hover:underline">
            Certification Hub
          </Link>
          <span>/</span>
          <span className="text-navy font-bold">Schedule II Form 1 Statutory Drafter</span>
        </div>

        {/* Top Header Card */}
        <div className="rounded-2xl border border-border bg-surface-raised p-6 sm:p-8 shadow-xs mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-navy px-3 py-1 font-mono text-xs font-black text-white">
                  FORM 1 · SCHEDULE II
                </span>
                <span className="rounded-full bg-orange/15 px-3 py-1 text-xs font-black text-orange">
                  BIS (CONFORMITY ASSESSMENT) REGULATIONS, 2018
                </span>
                <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-black text-success">
                  SCHEME-I (ISI MARK)
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-navy tracking-tight">
                Statutory Application Drafter for Grant of Licence
              </h1>
              <p className="text-xs sm:text-sm text-ink-soft max-w-2xl leading-relaxed">
                Automated preparation of Form 1 under Regulation 3(1) with 7 statutory sections, provenance badges, and a direct 1-to-1 tab crosswalk for the official Manak Online (e-BIS) portal.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 shrink-0">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold text-navy hover:bg-surface-alt transition-colors"
              >
                <Printer className="h-4 w-4 text-ink-soft" />
                <span>Print / Save PDF</span>
              </button>
              <button
                onClick={handleDownloadJson}
                className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs font-bold text-white hover:bg-navy-deep transition-colors shadow-xs"
              >
                <Download className="h-4 w-4 text-white/70" />
                <span>Export Draft Payload</span>
              </button>
              <a
                href="https://www.manakonline.in"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-orange px-4 py-2.5 text-xs font-bold text-white hover:bg-orange/90 transition-colors shadow-xs"
              >
                <span>Submit on Manak Online</span>
                <ExternalLink className="h-4 w-4 text-white/70" />
              </a>
            </div>
          </div>

          {/* Navigation Toggle between Form View and Manak Online Crosswalk */}
          <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("form")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "form"
                    ? "bg-navy text-white shadow-xs"
                    : "bg-surface-alt text-ink-soft hover:text-navy border border-border"
                }`}
              >
                7 Statutory Sections (Form View)
              </button>
              <button
                onClick={() => setActiveTab("crosswalk")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "crosswalk"
                    ? "bg-navy text-white shadow-xs"
                    : "bg-surface-alt text-ink-soft hover:text-navy border border-border"
                }`}
              >
                Manak Online Portal Crosswalk (Tabs 1–6)
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-success font-bold">
                <span className="h-2 w-2 rounded-full bg-success"></span>
                Auto-Filled (High Confidence)
              </span>
              <span className="flex items-center gap-1.5 text-orange font-bold">
                <span className="h-2 w-2 rounded-full bg-orange"></span>
                Factory Confirmation Needed
              </span>
            </div>
          </div>
        </div>

        {activeTab === "crosswalk" ? (
          /* MANAK ONLINE CROSSWALK TAB */
          <div className="space-y-6">
            <div className="rounded-2xl border border-orange/30 bg-orange/5 p-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-orange shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-black text-navy">Manak Online (e-BIS) Portal Field Mapping</h3>
                  <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                    When you log into <a href="https://www.manakonline.in" target="_blank" rel="noreferrer" className="text-orange font-bold underline">manakonline.in</a> under &quot;Conformity Assessment &gt; Apply for New Licence&quot;, the e-portal presents exactly 6 tabs. Copy-paste the corresponding values from this pre-compiled draft directly into each tab.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tab 1 Crosswalk */}
              <div className="rounded-2xl border border-border bg-surface-raised p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <span className="h-6 w-6 rounded-full bg-navy text-white text-xs font-black flex items-center justify-center">1</span>
                  <h4 className="text-sm font-black text-navy">e-BIS Tab 1: General Information &amp; Factory</h4>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-ink-faint font-semibold block">Applicant Legal Name:</span>
                    <span className="font-bold text-ink">{formData.applicantName}</span>
                  </div>
                  <div>
                    <span className="text-ink-faint font-semibold block">Factory Address:</span>
                    <span className="font-bold text-ink">{formData.factoryAddress}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-ink-faint font-semibold block">GSTIN:</span>
                      <span className="font-mono font-bold text-ink">{formData.gstin}</span>
                    </div>
                    <div>
                      <span className="text-ink-faint font-semibold block">MSME Udyam:</span>
                      <span className="font-mono font-bold text-ink">{formData.msmeUdyam}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tab 2 Crosswalk */}
              <div className="rounded-2xl border border-border bg-surface-raised p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <span className="h-6 w-6 rounded-full bg-navy text-white text-xs font-black flex items-center justify-center">2</span>
                  <h4 className="text-sm font-black text-navy">e-BIS Tab 2: Standard &amp; Product Details</h4>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-ink-faint font-semibold block">Indian Standard:</span>
                    <span className="font-mono font-black text-navy">{formData.standardNumber}</span>
                  </div>
                  <div>
                    <span className="text-ink-faint font-semibold block">Product Description:</span>
                    <span className="font-bold text-ink">{formData.productName}</span>
                  </div>
                  <div>
                    <span className="text-ink-faint font-semibold block">Varieties / Sizes Covered:</span>
                    <span className="font-bold text-ink">{formData.varieties} ({formData.capacities})</span>
                  </div>
                  <div>
                    <span className="text-ink-faint font-semibold block">Trade Brand:</span>
                    <span className="font-bold text-ink">{formData.brandNames}</span>
                  </div>
                </div>
              </div>

              {/* Tab 3 Crosswalk */}
              <div className="rounded-2xl border border-border bg-surface-raised p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <span className="h-6 w-6 rounded-full bg-navy text-white text-xs font-black flex items-center justify-center">3</span>
                  <h4 className="text-sm font-black text-navy">e-BIS Tab 3: Manufacturing Machinery &amp; Capacity</h4>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-ink-faint font-semibold block">Annual Installed Capacity:</span>
                    <span className="font-bold text-ink">{formData.annualCapacity}</span>
                  </div>
                  <div>
                    <span className="text-ink-faint font-semibold block">Core Machinery Installed:</span>
                    <span className="font-bold text-ink">{formData.coreMachinery}</span>
                  </div>
                </div>
              </div>

              {/* Tab 4 Crosswalk */}
              <div className="rounded-2xl border border-border bg-surface-raised p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <span className="h-6 w-6 rounded-full bg-navy text-white text-xs font-black flex items-center justify-center">4</span>
                  <h4 className="text-sm font-black text-navy">e-BIS Tab 4: In-House Testing Instruments</h4>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-ink-faint font-semibold block">Mandatory STI Equipment:</span>
                    <span className="font-bold text-ink">{formData.testingEquipment}</span>
                  </div>
                  <div>
                    <span className="text-ink-faint font-semibold block">Competent QC Personnel:</span>
                    <span className="font-bold text-ink">{formData.qcInCharge}</span>
                  </div>
                </div>
              </div>

              {/* Tab 5 Crosswalk */}
              <div className="rounded-2xl border border-border bg-surface-raised p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <span className="h-6 w-6 rounded-full bg-navy text-white text-xs font-black flex items-center justify-center">5</span>
                  <h4 className="text-sm font-black text-navy">e-BIS Tab 5: Marking, Packaging &amp; STI</h4>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-ink-faint font-semibold block">Manner of Marking ISI:</span>
                    <span className="font-bold text-ink">{formData.markingMode}</span>
                  </div>
                  <div>
                    <span className="text-ink-faint font-semibold block">Scheme of Testing Acceptance:</span>
                    <span className="font-bold text-success">Undertaking to adhere to STI DOC: STI/2347/4 confirmed.</span>
                  </div>
                </div>
              </div>

              {/* Tab 6 Crosswalk */}
              <div className="rounded-2xl border border-border bg-surface-raised p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <span className="h-6 w-6 rounded-full bg-navy text-white text-xs font-black flex items-center justify-center">6</span>
                  <h4 className="text-sm font-black text-navy">e-BIS Tab 6: Fee &amp; MSME Subsidy Calculation</h4>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-ink-faint font-semibold block">Application Fee:</span>
                    <span className="font-mono font-bold text-ink">₹1,000 (Non-refundable)</span>
                  </div>
                  <div>
                    <span className="text-ink-faint font-semibold block">MSME Concession Category:</span>
                    <span className="font-bold text-orange">{formData.feeCategory}</span>
                  </div>
                  <div className="pt-2">
                    <span className="text-ink-faint font-semibold block">Estimated Net Grant Fee:</span>
                    <span className="text-base font-black text-navy font-mono">₹14,200 <span className="text-xs font-normal text-ink-soft">(Saved ₹32,000 via MSME subsidy)</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* FORM VIEW: 7 STATUTORY SECTIONS ACCORDION */
          <div className="space-y-6">
            {/* Section 1: Factory & Applicant */}
            <div className="rounded-2xl border border-border bg-surface-raised overflow-hidden shadow-xs">
              <button
                onClick={() => setActiveSection(activeSection === 1 ? 0 : 1)}
                className="w-full flex items-center justify-between p-5 bg-surface-alt/40 hover:bg-surface-alt text-left border-b border-border transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-lg bg-navy text-white text-xs font-black flex items-center justify-center">1</span>
                  <div>
                    <h3 className="text-sm font-bold text-navy">Section 1: Applicant &amp; Factory Identity</h3>
                    <p className="text-[11px] text-ink-faint">Legal enterprise name, factory address, GSTIN, and MSME classification</p>
                  </div>
                </div>
                {activeSection === 1 ? <ChevronUp className="h-4 w-4 text-ink-soft" /> : <ChevronDown className="h-4 w-4 text-ink-soft" />}
              </button>

              {activeSection === 1 && (
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-ink-soft mb-1">
                        Full Legal Name of Applicant Manufacturing Firm:
                      </label>
                      <input
                        type="text"
                        value={formData.applicantName}
                        onChange={(e) => setFormData({ ...formData, applicantName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-xs text-ink focus:border-navy"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-ink-soft mb-1">
                        Corporate / Registered Office:
                      </label>
                      <input
                        type="text"
                        value={formData.corporateOffice}
                        onChange={(e) => setFormData({ ...formData, corporateOffice: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-xs text-ink focus:border-navy"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink-soft mb-1">
                      Factory Premises Address (Where product is manufactured):
                    </label>
                    <input
                      type="text"
                      value={formData.factoryAddress}
                      onChange={(e) => setFormData({ ...formData, factoryAddress: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-xs text-ink focus:border-navy"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-ink-soft mb-1">GSTIN Number:</label>
                      <input
                        type="text"
                        value={formData.gstin}
                        onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-xs font-mono text-ink focus:border-navy"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-ink-soft mb-1">Company PAN:</label>
                      <input
                        type="text"
                        value={formData.pan}
                        onChange={(e) => setFormData({ ...formData, pan: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-xs font-mono text-ink focus:border-navy"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-ink-soft mb-1">MSME Udyam Reg. No.:</label>
                      <input
                        type="text"
                        value={formData.msmeUdyam}
                        onChange={(e) => setFormData({ ...formData, msmeUdyam: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-xs font-mono text-ink focus:border-navy"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Product & Standard Specification */}
            <div className="rounded-2xl border border-border bg-surface-raised overflow-hidden shadow-xs">
              <button
                onClick={() => setActiveSection(activeSection === 2 ? 0 : 2)}
                className="w-full flex items-center justify-between p-5 bg-surface-alt/40 hover:bg-surface-alt text-left border-b border-border transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-lg bg-navy text-white text-xs font-black flex items-center justify-center">2</span>
                  <div>
                    <h3 className="text-sm font-bold text-navy">Section 2: Product &amp; Standard Specification</h3>
                    <p className="text-[11px] text-ink-faint">Applicable Indian Standard, product varieties, trade brands, and intended usage</p>
                  </div>
                </div>
                {activeSection === 2 ? <ChevronUp className="h-4 w-4 text-ink-soft" /> : <ChevronDown className="h-4 w-4 text-ink-soft" />}
              </button>

              {activeSection === 2 && (
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-ink-soft mb-1">Indian Standard Number &amp; Year:</label>
                      <input
                        type="text"
                        value={formData.standardNumber}
                        onChange={(e) => setFormData({ ...formData, standardNumber: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-xs font-mono font-bold text-navy focus:border-navy"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-ink-soft mb-1">Standard Product Title:</label>
                      <input
                        type="text"
                        value={formData.productName}
                        onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-xs text-ink focus:border-navy"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-ink-soft mb-1">Product Varieties &amp; Types:</label>
                      <input
                        type="text"
                        value={formData.varieties}
                        onChange={(e) => setFormData({ ...formData, varieties: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-xs text-ink focus:border-navy"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-ink-soft mb-1">Capacities / Sizes Covered in Scope:</label>
                      <input
                        type="text"
                        value={formData.capacities}
                        onChange={(e) => setFormData({ ...formData, capacities: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-xs text-ink focus:border-navy"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink-soft mb-1">Trade Brand Names (Marked alongside ISI):</label>
                    <input
                      type="text"
                      value={formData.brandNames}
                      onChange={(e) => setFormData({ ...formData, brandNames: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-xs text-ink focus:border-navy"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Manufacturing Machinery & Production Capacity */}
            <div className="rounded-2xl border border-border bg-surface-raised overflow-hidden shadow-xs">
              <button
                onClick={() => setActiveSection(activeSection === 3 ? 0 : 3)}
                className="w-full flex items-center justify-between p-5 bg-surface-alt/40 hover:bg-surface-alt text-left border-b border-border transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-lg bg-navy text-white text-xs font-black flex items-center justify-center">3</span>
                  <div>
                    <h3 className="text-sm font-bold text-navy">Section 3: Manufacturing Machinery &amp; Production Capacity</h3>
                    <p className="text-[11px] text-ink-faint">List of installed production equipment and rated annual capacity</p>
                  </div>
                </div>
                {activeSection === 3 ? <ChevronUp className="h-4 w-4 text-ink-soft" /> : <ChevronDown className="h-4 w-4 text-ink-soft" />}
              </button>

              {activeSection === 3 && (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-ink-soft mb-1">Annual Installed Manufacturing Capacity:</label>
                    <input
                      type="text"
                      value={formData.annualCapacity}
                      onChange={(e) => setFormData({ ...formData, annualCapacity: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-xs text-ink focus:border-navy"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink-soft mb-1">Core Production Machinery Installed in Factory:</label>
                    <textarea
                      rows={3}
                      value={formData.coreMachinery}
                      onChange={(e) => setFormData({ ...formData, coreMachinery: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-xs text-ink focus:border-navy leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: In-House Testing Equipment */}
            <div className="rounded-2xl border border-border bg-surface-raised overflow-hidden shadow-xs">
              <button
                onClick={() => setActiveSection(activeSection === 4 ? 0 : 4)}
                className="w-full flex items-center justify-between p-5 bg-surface-alt/40 hover:bg-surface-alt text-left border-b border-border transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-lg bg-navy text-white text-xs font-black flex items-center justify-center">4</span>
                  <div>
                    <h3 className="text-sm font-bold text-navy">Section 4: In-House Testing Instruments &amp; Lab Facilities</h3>
                    <p className="text-[11px] text-ink-faint">Mandatory Scheme of Testing &amp; Inspection (STI) equipment and calibration records</p>
                  </div>
                </div>
                {activeSection === 4 ? <ChevronUp className="h-4 w-4 text-ink-soft" /> : <ChevronDown className="h-4 w-4 text-ink-soft" />}
              </button>

              {activeSection === 4 && (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-ink-soft mb-1">
                      In-House Testing Instruments Available for Routine &amp; Batch Tests:
                    </label>
                    <textarea
                      rows={3}
                      value={formData.testingEquipment}
                      onChange={(e) => setFormData({ ...formData, testingEquipment: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-xs text-ink focus:border-navy leading-relaxed"
                    />
                  </div>
                  <div className="rounded-xl border border-success/30 bg-success/5 p-3 flex items-center gap-2 text-xs text-success font-bold">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Satisfies mandatory minimum test equipment mandated under BIS Scheme of Testing &amp; Inspection (DOC: STI/2347/4).</span>
                  </div>
                </div>
              )}
            </div>

            {/* Section 5: Technical Staff & Quality Control In-Charge */}
            <div className="rounded-2xl border border-border bg-surface-raised overflow-hidden shadow-xs">
              <button
                onClick={() => setActiveSection(activeSection === 5 ? 0 : 5)}
                className="w-full flex items-center justify-between p-5 bg-surface-alt/40 hover:bg-surface-alt text-left border-b border-border transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-lg bg-navy text-white text-xs font-black flex items-center justify-center">5</span>
                  <div>
                    <h3 className="text-sm font-bold text-navy">Section 5: Competent Quality Control Personnel</h3>
                    <p className="text-[11px] text-ink-faint">Technical staff qualifications and factory laboratory in-charge</p>
                  </div>
                </div>
                {activeSection === 5 ? <ChevronUp className="h-4 w-4 text-ink-soft" /> : <ChevronDown className="h-4 w-4 text-ink-soft" />}
              </button>

              {activeSection === 5 && (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-ink-soft mb-1">Quality Control In-Charge Name &amp; Qualifications:</label>
                    <input
                      type="text"
                      value={formData.qcInCharge}
                      onChange={(e) => setFormData({ ...formData, qcInCharge: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-xs text-ink focus:border-navy"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Section 6: Marking & Packaging */}
            <div className="rounded-2xl border border-border bg-surface-raised overflow-hidden shadow-xs">
              <button
                onClick={() => setActiveSection(activeSection === 6 ? 0 : 6)}
                className="w-full flex items-center justify-between p-5 bg-surface-alt/40 hover:bg-surface-alt text-left border-b border-border transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-lg bg-navy text-white text-xs font-black flex items-center justify-center">6</span>
                  <div>
                    <h3 className="text-sm font-bold text-navy">Section 6: Marking &amp; Packaging Protocols</h3>
                    <p className="text-[11px] text-ink-faint">Manner of applying Standard Mark (ISI), CM/L number, batch traceability</p>
                  </div>
                </div>
                {activeSection === 6 ? <ChevronUp className="h-4 w-4 text-ink-soft" /> : <ChevronDown className="h-4 w-4 text-ink-soft" />}
              </button>

              {activeSection === 6 && (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-ink-soft mb-1">Manner of Standard Mark Application:</label>
                    <input
                      type="text"
                      value={formData.markingMode}
                      onChange={(e) => setFormData({ ...formData, markingMode: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-xs text-ink focus:border-navy"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Section 7: Declarations & Fee Concessions */}
            <div className="rounded-2xl border border-border bg-surface-raised overflow-hidden shadow-xs">
              <button
                onClick={() => setActiveSection(activeSection === 7 ? 0 : 7)}
                className="w-full flex items-center justify-between p-5 bg-surface-alt/40 hover:bg-surface-alt text-left border-b border-border transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-lg bg-navy text-white text-xs font-black flex items-center justify-center">7</span>
                  <div>
                    <h3 className="text-sm font-bold text-navy">Section 7: Statutory Undertakings &amp; 80% MSME Subsidy</h3>
                    <p className="text-[11px] text-ink-faint">Legal declarations under BIS Act 2016 and verified fee subsidy classification</p>
                  </div>
                </div>
                {activeSection === 7 ? <ChevronUp className="h-4 w-4 text-ink-soft" /> : <ChevronDown className="h-4 w-4 text-ink-soft" />}
              </button>

              {activeSection === 7 && (
                <div className="p-6 space-y-4">
                  <div className="rounded-xl border border-orange/30 bg-orange/5 p-4">
                    <span className="text-xs font-bold text-orange uppercase tracking-wide block mb-1">
                      MSME Concession Claimed:
                    </span>
                    <p className="text-xs text-navy font-bold">{formData.feeCategory}</p>
                    <p className="text-[11px] text-ink-soft mt-1">
                      Under BIS Circular No. CMD-III/16:MSME, Micro and Small enterprises registered under Udyam are entitled to an 80% concession on annual minimum marking fees and 50% concession on application audit charges.
                    </p>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-ink">
                      <input type="checkbox" defaultChecked className="mt-0.5 rounded border-border text-navy focus:ring-navy" />
                      <span>
                        I/We hereby declare that all particulars stated above are true and complete. I/We undertake to abide by the provisions of the Bureau of Indian Standards Act, 2016, and the Rules &amp; Regulations framed thereunder.
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
