"use client";

import React, { useState } from "react";
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
  RotateCcw,
  Globe2,
  Cpu,
  Factory,
  Gem,
  ArrowRight,
  Info,
  Scale,
} from "lucide-react";
import schemesData from "../../../data/schemes.json";

export function SchemeWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [origin, setOrigin] = useState<"domestic" | "foreign" | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [selectedSchemeKey, setSelectedSchemeKey] = useState<string>("scheme_1_simplified");
  const [isMsme, setIsMsme] = useState<boolean>(true);

  // Fee calculation with MSME discount
  const baseAppFee = selectedSchemeKey === "crs" ? 5000 : 7000;
  const baseInspectionFee = selectedSchemeKey === "crs" ? 0 : 14000;
  const discountRate = isMsme ? 0.8 : 0.0;
  const finalAppFee = Math.round(baseAppFee * (1 - discountRate));
  const finalInspectionFee = Math.round(baseInspectionFee * (1 - (isMsme ? 0.5 : 0.0)));
  const totalEstimated = finalAppFee + finalInspectionFee;

  const activeScheme = (schemesData as any)[selectedSchemeKey] || schemesData.scheme_1_simplified;

  const handleSelectOrigin = (selectedOrigin: "domestic" | "foreign") => {
    setOrigin(selectedOrigin);
    if (selectedOrigin === "foreign") {
      setSelectedSchemeKey("fmcs");
      setCategory("foreign_import");
      setStep(3); // Foreign directly routes to Scheme-IV FMCS
    } else {
      setStep(2);
    }
  };

  const handleSelectCategory = (catId: string, targetSchemeKey: string) => {
    setCategory(catId);
    setSelectedSchemeKey(targetSchemeKey);
    setStep(3);
  };

  const handleReset = () => {
    setStep(1);
    setOrigin(null);
    setCategory(null);
    setSelectedSchemeKey("scheme_1_simplified");
  };

  return (
    <div id="wizard" className="rounded-3xl border border-border bg-surface-raised p-6 sm:p-8 shadow-xs">
      {/* Header Badge & Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue/15 px-2.5 py-0.5 text-xs font-black uppercase text-blue">
              Interactive Compliance Assessment
            </span>
            <span className="text-xs font-semibold text-ink-faint">
              BIS Act 2016 Conformity
            </span>
          </div>
          <h2 className="mt-2 text-2xl sm:text-3xl font-black text-navy tracking-tight">
            Check Your Certification Route
          </h2>
          <p className="mt-1 text-sm text-ink-soft max-w-2xl leading-relaxed">
            Determine whether your enterprise needs Scheme-I (ISI Mark), Scheme-II (CRS), Scheme-IV (FMCS), or BIS Hallmarking through this 3-step decision tree.
          </p>
        </div>

        {/* Step Progress Badge */}
        <div className="rounded-2xl border border-border bg-surface-alt/70 p-4 text-right">
          <div className="text-[10px] font-black uppercase tracking-wider text-ink-faint">
            Certification Route Finder
          </div>
          <div className="mt-1 flex items-center gap-2 justify-end">
            <span className="text-sm font-extrabold text-navy">
              Step {step} of 3
            </span>
            <span className="text-xs font-bold text-orange font-mono">
              {step === 1 ? "33%" : step === 2 ? "66%" : "100%"}
            </span>
          </div>
          <div className="mt-2 w-36 bg-border h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-orange h-full transition-all duration-300"
              style={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }}
            />
          </div>
        </div>
      </div>

      {/* Breadcrumb Steps Header */}
      <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-ink-faint">
        <span className={step >= 1 ? "text-navy font-bold" : ""}>1. Origin</span>
        <span>•</span>
        <span className={step >= 2 ? "text-navy font-bold" : ""}>2. Product Category</span>
        <span>•</span>
        <span className={step === 3 ? "text-navy font-bold" : ""}>3. Testing &amp; Scheme</span>
      </div>

      {/* STEP 1: ORIGIN */}
      {step === 1 && (
        <div className="mt-6 space-y-4">
          <div>
            <span className="text-xs font-black uppercase text-orange">Question 1 of 3</span>
            <h3 className="text-lg font-black text-navy mt-1">
              Where is your product manufactured?
            </h3>
            <p className="text-xs text-ink-soft mt-1">
              Select your manufacturing location to determine jurisdictional certification regulations under the BIS Act 2016.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Domestic Option */}
            <div
              onClick={() => handleSelectOrigin("domestic")}
              className="group relative flex flex-col justify-between rounded-2xl border-2 border-border bg-surface-alt/30 p-6 transition-all hover:border-navy hover:bg-surface-raised cursor-pointer shadow-xs hover:shadow-md"
            >
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue/15 text-blue mb-4 group-hover:bg-navy group-hover:text-white transition-all">
                  <Building2 className="h-6 w-6" />
                </div>
                <h4 className="text-base font-black text-navy group-hover:text-blue transition-colors">
                  Domestic (Manufactured inside India)
                </h4>
                <p className="mt-2 text-xs text-ink-soft leading-relaxed">
                  Units located inside Indian territory eligible for domestic Scheme-I (ISI Mark) or Scheme-II (CRS) routes.
                </p>
              </div>

              <div className="mt-6 flex items-center gap-1.5 text-xs font-extrabold text-navy group-hover:text-orange">
                <span>Proceed to Category</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>

            {/* Foreign Option */}
            <div
              onClick={() => handleSelectOrigin("foreign")}
              className="group relative flex flex-col justify-between rounded-2xl border-2 border-border bg-surface-alt/30 p-6 transition-all hover:border-orange hover:bg-surface-raised cursor-pointer shadow-xs hover:shadow-md"
            >
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange/15 text-orange mb-4 group-hover:bg-orange group-hover:text-white transition-all">
                  <Globe2 className="h-6 w-6" />
                </div>
                <h4 className="text-base font-black text-navy group-hover:text-orange transition-colors">
                  Foreign (Importing into India)
                </h4>
                <p className="mt-2 text-xs text-ink-soft leading-relaxed">
                  Manufacturing facilities located overseas intending to export mandatory QCO products to India.
                </p>
              </div>

              <div className="mt-6 flex items-center gap-1.5 text-xs font-extrabold text-orange">
                <span>Direct to Scheme-IV (FMCS)</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: PRODUCT CATEGORY (DOMESTIC) */}
      {step === 2 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-black uppercase text-orange">Question 2 of 3</span>
              <h3 className="text-lg font-black text-navy mt-1">
                What category does your product belong to?
              </h3>
              <p className="text-xs text-ink-soft mt-1">
                Select your product sector to match the statutory BIS scheme and verification mode.
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs font-bold text-ink-soft hover:text-navy underline"
            >
              ← Back to Origin
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Category 1: Appliances / Industrial / Cookware / Cement / Steel / Toys */}
            <div
              onClick={() => handleSelectCategory("industrial", "scheme_1_simplified")}
              className="group flex flex-col justify-between rounded-2xl border-2 border-border bg-surface-alt/30 p-5 transition-all hover:border-navy hover:bg-surface-raised cursor-pointer shadow-xs hover:shadow-md"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10 text-navy mb-3 group-hover:bg-navy group-hover:text-white transition-all">
                  <Factory className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-black uppercase text-navy">
                  Scheme-I (ISI Mark)
                </span>
                <h4 className="mt-2 text-sm font-black text-navy">
                  Appliances, Cookware, Steel, Cement, Food &amp; Toys
                </h4>
                <p className="mt-1.5 text-xs text-ink-soft leading-relaxed">
                  Pressure cookers, steel bottles, packaged water, toys, structural steel, cement, electrical cables, helmets.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-navy group-hover:text-orange">
                <span>View Route Details</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </div>

            {/* Category 2: Electronics & IT Goods */}
            <div
              onClick={() => handleSelectCategory("electronics", "crs")}
              className="group flex flex-col justify-between rounded-2xl border-2 border-border bg-surface-alt/30 p-5 transition-all hover:border-blue hover:bg-surface-raised cursor-pointer shadow-xs hover:shadow-md"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/15 text-blue mb-3 group-hover:bg-blue group-hover:text-white transition-all">
                  <Cpu className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-blue/15 px-2 py-0.5 text-[10px] font-black uppercase text-blue">
                  Scheme-II (CRS)
                </span>
                <h4 className="mt-2 text-sm font-black text-navy">
                  Electronics, IT Hardware &amp; Solar Equipment
                </h4>
                <p className="mt-1.5 text-xs text-ink-soft leading-relaxed">
                  Laptops, displays, mobile phones, power adapters, LED lamps, inverters, solar panels, lithium-ion battery packs.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-blue group-hover:text-navy">
                <span>View CRS Route</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </div>

            {/* Category 3: Gold & Silver Jewellery */}
            <div
              onClick={() => handleSelectCategory("hallmarking", "hallmarking")}
              className="group flex flex-col justify-between rounded-2xl border-2 border-border bg-surface-alt/30 p-5 transition-all hover:border-orange hover:bg-surface-raised cursor-pointer shadow-xs hover:shadow-md"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange/15 text-orange mb-3 group-hover:bg-orange group-hover:text-white transition-all">
                  <Gem className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-orange/15 px-2 py-0.5 text-[10px] font-black uppercase text-orange">
                  Hallmarking
                </span>
                <h4 className="mt-2 text-sm font-black text-navy">
                  Gold &amp; Silver Jewellery / Artefacts
                </h4>
                <p className="mt-1.5 text-xs text-ink-soft leading-relaxed">
                  14k, 18k, 20k, 22k, 23k, and 24k gold articles requiring unique 6-digit alphanumeric HUID laser engraving.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-orange group-hover:text-navy">
                <span>View Hallmarking</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: RESULT & COMPLIANCE ROADMAP */}
      {step === 3 && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-alt/40 p-4 rounded-2xl border border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success text-white">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-success tracking-wider">
                  Assessment Complete • Determined Pathway
                </span>
                <h3 className="text-base font-black text-navy">
                  {activeScheme.badge}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-raised px-3 py-1.5 text-xs font-bold text-navy hover:bg-surface-alt transition-all shadow-2xs"
              >
                <RotateCcw className="h-3.5 w-3.5 text-ink-faint" />
                <span>Start Over</span>
              </button>
            </div>
          </div>

          {/* Scheme Switcher Tabs */}
          <div className="flex flex-wrap gap-2">
            {Object.values(schemesData).map((s: any) => (
              <button
                key={s.id}
                onClick={() => setSelectedSchemeKey(s.id)}
                className={`rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-all ${
                  selectedSchemeKey === s.id
                    ? "border-navy bg-navy text-white shadow-xs"
                    : "border-border bg-surface-raised text-ink-soft hover:border-navy/40"
                }`}
              >
                {s.badge}
              </button>
            ))}
          </div>

          {/* Details & Calculator Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Procedural Summary & Steps */}
            <div className="lg:col-span-2 space-y-5">
              <div className="rounded-2xl border border-border bg-surface-alt/20 p-5 space-y-4">
                <div>
                  <h4 className="text-base font-black text-navy">
                    {activeScheme.title}
                  </h4>
                  <p className="mt-1 text-xs text-ink-soft leading-relaxed">
                    {activeScheme.routeSummary}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface-raised p-3.5 text-xs text-ink-soft">
                  <span className="font-bold text-navy uppercase text-[10px] tracking-wider block mb-1">
                    Applicable Scope:
                  </span>
                  <p>{activeScheme.scopeSummary}</p>
                </div>

                <div className="rounded-xl border border-success/30 bg-success/10 p-3.5 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-success mb-1">
                    <Sparkles className="h-4 w-4" />
                    <span>Statutory MSME / Startup Concession:</span>
                  </div>
                  <p className="text-ink-soft font-medium">{activeScheme.msmeBenefit}</p>
                </div>

                {/* Steps List */}
                <div>
                  <h5 className="text-xs font-black uppercase tracking-wider text-navy mb-2.5">
                    Procedural Roadmap to Licence Grant:
                  </h5>
                  <div className="space-y-2">
                    {activeScheme.steps?.map((st: string, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-raised p-3 text-xs"
                      >
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-white font-mono font-bold text-[10px] mt-0.5">
                          {idx + 1}
                        </div>
                        <p className="font-medium text-ink-soft leading-relaxed">{st}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-ink-faint">
                    Official Portal: <strong className="text-navy">{activeScheme.portalName}</strong>
                  </span>
                  <a
                    href={activeScheme.portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-orange px-4 py-2 text-xs font-bold text-white hover:bg-orange/90 shadow-xs"
                  >
                    <span>Proceed to {activeScheme.portalName}</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Right Col: Interactive Fee & Timeline Estimator */}
            <div className="space-y-5">
              <div className="rounded-2xl border border-border bg-surface-raised p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-navy uppercase tracking-wider">
                    Statutory Fee Estimator
                  </h4>
                  <span className="text-[10px] font-bold text-success bg-success/15 px-2 py-0.5 rounded-full">
                    Gazette 2026
                  </span>
                </div>

                {/* Enterprise Toggle */}
                <div>
                  <label className="text-[11px] font-bold text-ink-soft block mb-1.5">
                    Enterprise Udyam Classification
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setIsMsme(true)}
                      className={`rounded-xl border py-2 text-xs font-bold transition-all ${
                        isMsme
                          ? "border-navy bg-navy text-white shadow-xs"
                          : "border-border bg-surface-alt text-ink-soft hover:border-navy/40"
                      }`}
                    >
                      Micro / Small (MSME)
                    </button>
                    <button
                      onClick={() => setIsMsme(false)}
                      className={`rounded-xl border py-2 text-xs font-bold transition-all ${
                        !isMsme
                          ? "border-navy bg-navy text-white shadow-xs"
                          : "border-border bg-surface-alt text-ink-soft hover:border-navy/40"
                      }`}
                    >
                      Large Industry
                    </button>
                  </div>
                </div>

                {/* Breakdown Card */}
                <div className="rounded-xl border border-border bg-surface-alt/40 p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Application Filing Fee:</span>
                    <span className="font-mono font-bold text-navy">₹{finalAppFee.toLocaleString()}</span>
                  </div>
                  {baseInspectionFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-ink-soft">Preliminary Audit Fee:</span>
                      <span className="font-mono font-bold text-navy">₹{finalInspectionFee.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-success font-semibold">
                    <span>Udyam Concession Saved:</span>
                    <span className="font-mono font-bold">
                      {isMsme ? "-80% (₹15,000+)" : "₹0"}
                    </span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between font-black text-sm text-navy">
                    <span>Initial Statutory Outlay:</span>
                    <span className="font-mono text-orange">₹{totalEstimated.toLocaleString()}</span>
                  </div>
                </div>

                {/* Timeline */}
                <div className="rounded-xl border border-blue/20 bg-blue/5 p-3.5 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-blue">
                    <Clock className="h-4 w-4" />
                    <span>Statutory Citizen Charter Timeline:</span>
                  </div>
                  <p className="mt-1 text-sm font-black text-navy">
                    {selectedSchemeKey === "scheme_1_simplified"
                      ? "30 Working Days (MSME Fast-Track)"
                      : selectedSchemeKey === "crs"
                      ? "15-20 Days (Self-Declaration)"
                      : selectedSchemeKey === "hallmarking"
                      ? "Instant Online Registration"
                      : "60-90 Days (Audit & Verification)"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    Governed under the BIS (Conformity Assessment) Regulations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
