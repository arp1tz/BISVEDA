"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Award,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Building,
  Sparkles,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { AppHeader } from "@/components/chat/v9/AppHeader";
import { AppFooter } from "@/components/chat/v9/AppFooter";

interface SchemeGuide {
  id: string;
  badge: string;
  name: string;
  description: string;
  legalBasis: string;
  steps: Array<{ title: string; desc: string; form?: string }>;
  products: string[];
  ctaText: string;
  ctaQuery: string;
}

const SCHEMES: SchemeGuide[] = [
  {
    id: "scheme-i",
    badge: "Scheme I",
    name: "ISI Mark (Product Certification Scheme)",
    description:
      "The premier third-party guarantee of product quality and safety in India. Manufacturers undergo factory audit and independent laboratory testing before being granted a CM/L licence to apply the Standard Mark.",
    legalBasis: "BIS Act 2016, Section 13 & Mandatory Quality Control Orders (Section 16)",
    steps: [
      {
        title: "1. Standard Identification & Lab Testing Setup",
        desc: "Identify the applicable Indian Standard (e.g. IS 4151 for helmets, IS 9873 for toys) and set up mandatory in-house testing equipment.",
      },
      {
        title: "2. Online Application on Manak Online",
        desc: "Submit Form V on Manak Online with factory layout, list of manufacturing machinery, test personnel credentials, and application fee.",
        form: "Form V",
      },
      {
        title: "3. Factory Audit & Verification Visit",
        desc: "BIS inspecting officers visit the manufacturing premises to verify manufacturing capability, quality control system, and witness sample testing.",
      },
      {
        title: "4. Independent Sample Testing in BIS Lab",
        desc: "Counter-samples drawn during factory audit are tested at BIS Central/Regional Labs or BIS-recognized LIMS laboratories.",
      },
      {
        title: "5. Grant of CM/L Licence",
        desc: "Upon passing tests, BIS issues a unique 7 or 8-digit CM/L licence number authorizing use of the ISI mark on the product packaging.",
      },
    ],
    products: [
      "Motorcycle Helmets (IS 4151 - Mandatory QCO)",
      "Industrial Helmets (IS 2925)",
      "Toys for children under 14 (IS 9873 & IS 15644 - Mandatory QCO)",
      "Pressure Cookers, Gas Cylinders, Packaged Drinking Water",
    ],
    ctaText: "Check ISI Mark Compliance in Chat",
    ctaQuery: "How do I get an ISI mark licence for manufacturing helmets or toys?",
  },
  {
    id: "hallmarking",
    badge: "Hallmarking Scheme",
    name: "Precious Metals Hallmarking Scheme (IS 1417 & IS 15820)",
    description:
      "Mandatory certification of the purity and fineness of gold and silver jewellery. Certified through laser-etched 6-digit Hallmark Unique Identification (HUID) at accredited Assaying & Hallmarking Centres.",
    legalBasis: "Hallmarking Order under BIS Act 2016 (Mandatory in 350+ notified districts)",
    steps: [
      {
        title: "1. Jeweller Registration (Form I)",
        desc: "Jewellers apply for a Certificate of Registration on Manak Online under Form I. Registration is granted automatically upon submission.",
        form: "Form I",
      },
      {
        title: "2. Submission to Recognized AHC",
        desc: "Registered jewellers submit un-hallmarked gold articles to an accredited Assaying and Hallmarking Centre (AHC) recognized under IS 15820.",
      },
      {
        title: "3. Assay Testing (XRF & Fire Assay)",
        desc: "AHC draws samples and performs non-destructive XRF screening and referee cupellation fire assay under IS 1418 to verify purity fineness.",
      },
      {
        title: "4. 6-Digit HUID Laser Engraving",
        desc: "Upon meeting the purity grade (e.g. 22K916), the AHC laser-engraves the BIS triangle, purity mark, and a unique 6-digit HUID code.",
      },
      {
        title: "5. Consumer Verification in BIS Care",
        desc: "The HUID is synchronized with the central BIS database, allowing consumers to verify jeweller and purity details on the BIS Care app.",
      },
    ],
    products: [
      "24K Gold Artefacts (24K995)",
      "22K Gold Jewellery (22K916)",
      "18K Gold Jewellery (18K750)",
      "14K Gold Jewellery (14K585)",
    ],
    ctaText: "Draft Form I Jeweller Registration",
    ctaQuery: "I want to apply for BIS hallmarking registration for my jewellery shop",
  },
];

export default function CertificationPage() {
  const [activeTab, setActiveTab] = useState<"scheme-i" | "hallmarking">("scheme-i");

  const currentScheme = SCHEMES.find((s) => s.id === activeTab) || SCHEMES[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] text-[#0F172A] font-sans">
      <AppHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero Section */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#E8710A] uppercase tracking-wider">
            <Award className="w-4 h-4" />
            <span>Official Conformity Assessment Guidance</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B2A4A] tracking-tight">
            BIS Certification Schemes &amp; Regulatory Compliance
          </h1>

          <p className="text-sm text-[#64748B] max-w-3xl leading-relaxed">
            The Bureau of Indian Standards operates statutory conformity assessment schemes ensuring consumer
            safety, health, and national quality standards. Explore the step-by-step procedures for the
            <strong> Scheme I (ISI Mark)</strong> and the <strong>Mandatory Hallmarking Scheme</strong>.
          </p>

          {/* Scheme Switcher Tabs */}
          <div className="pt-2 flex items-center gap-2 border-b border-[#E5E7EB] overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("scheme-i")}
              className={`pb-3 px-3 text-xs sm:text-sm font-semibold transition-all border-b-2 cursor-pointer ${
                activeTab === "scheme-i"
                  ? "text-[#0B2A4A] border-[#0B2A4A]"
                  : "text-[#64748B] border-transparent hover:text-[#0F172A]"
              }`}
            >
              Scheme I — ISI Mark (Products)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("hallmarking")}
              className={`pb-3 px-3 text-xs sm:text-sm font-semibold transition-all border-b-2 cursor-pointer ${
                activeTab === "hallmarking"
                  ? "text-[#0B2A4A] border-[#0B2A4A]"
                  : "text-[#64748B] border-transparent hover:text-[#0F172A]"
              }`}
            >
              Gold Hallmarking (IS 1417 &amp; Form I)
            </button>
          </div>
        </div>

        {/* Selected Scheme Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Flowchart & Steps */}
          <div className="lg:col-span-8 bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-7 shadow-xs space-y-6">
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-[#E8710A] uppercase tracking-wider">
                {currentScheme.badge} Compliance Pathway
              </span>
              <h2 className="text-xl font-bold text-[#0B2A4A]">
                {currentScheme.name}
              </h2>
              <p className="text-xs text-[#64748B] leading-relaxed">
                {currentScheme.description}
              </p>
            </div>

            {/* Legal notification alert */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Statutory Basis: </strong>
                <span>{currentScheme.legalBasis}</span>
              </div>
            </div>

            {/* Step by step timeline */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Certification Steps:
              </h3>

              <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {currentScheme.steps.map((st, idx) => (
                  <div key={idx} className="relative pl-8 space-y-1">
                    <div className="absolute left-1 top-0.5 w-4.5 h-4.5 rounded-full bg-[#0B2A4A] text-white text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </div>

                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-[#0B2A4A]">
                        {st.title}
                      </h4>
                      {st.form && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {st.form}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#64748B] leading-relaxed">
                      {st.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA in chat */}
            <div className="pt-4 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[#64748B]">
                Have questions regarding your factory, outlet, or test requirements?
              </div>

              <Link
                href={`/chat?q=${encodeURIComponent(currentScheme.ctaQuery)}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B2A4A] text-white hover:bg-[#081e36] text-xs font-semibold shadow-xs transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#E8710A]" />
                <span>{currentScheme.ctaText}</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Applicable Products & Key Facts */}
          <div className="lg:col-span-4 space-y-5">
            {/* Products Card */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Indexed Products</span>
              </h3>

              <ul className="space-y-2 text-xs text-[#0F172A]">
                {currentScheme.products.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[#E8710A] font-bold mt-0.5">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick Links Card */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4 text-[#0B2A4A]" />
                <span>Official Portals</span>
              </h3>

              <div className="space-y-2 text-xs">
                <a
                  href="https://www.manakonline.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-[#0B2A4A]">Manak Online Portal</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>

                <a
                  href="https://www.services.bis.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-[#0B2A4A]">BIS Care &amp; LIMS Services</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>

                <Link
                  href="/standards"
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-[#0B2A4A]">Indian Standards Catalogue</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/labs"
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-[#0B2A4A]">Testing Laboratories Directory</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
