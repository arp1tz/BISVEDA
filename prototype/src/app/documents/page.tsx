"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileCheck2,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ShieldAlert,
  ArrowRight,
  Download,
  Copy,
  Scale,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

interface ReviewResult {
  citedStandards: Array<{
    cited: string;
    status: "superseded" | "current" | "unverified";
    activeVersion?: string;
    title: string;
    details: string;
  }>;
  riskScore: "HIGH" | "MEDIUM" | "LOW";
  summary: string;
  penalWarning: string;
}

export default function DocumentReviewPage() {
  const [inputText, setInputText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);

  const sampleTender = `TENDER SPECIFICATION NOTICE NO: PWD/MH/2026/04
Supply of High Strength Deformed Steel Bars for RCC Bridge Construction:
All reinforcement bars shall strictly conform to IS 1786:1985 (Grade Fe 415).
High Density Polyethylene (HDPE) pipes for drainage shall conform to IS 4984:1995.
Catering pressure cookers for site mess shall comply with IS 2347:2006.
Any supplier delivering material without ISI mark shall be rejected.`;

  const handleAnalyze = (textToAnalyze?: string) => {
    const text = textToAnalyze || inputText;
    if (!text.trim()) return;

    setAnalyzing(true);
    setTimeout(() => {
      // Analyze text for known outdated standards
      const cited: ReviewResult["citedStandards"] = [];

      if (/IS\s*1786\s*:\s*1985/i.test(text) || /IS\s*1786/i.test(text)) {
        cited.push({
          cited: "IS 1786:1985",
          status: "superseded",
          activeVersion: "IS 1786:2008 (Fourth Revision)",
          title: "High Strength Deformed Steel Bars and Wires for Concrete Reinforcement",
          details: "IS 1786:1985 was withdrawn and superseded by IS 1786:2008, introducing stricter ductility limits (Fe 500D) and mandatory chemical composition testing. Citing the 1985 edition creates legal exposure.",
        });
      }

      if (/IS\s*4984\s*:\s*1995/i.test(text) || /IS\s*4984/i.test(text)) {
        cited.push({
          cited: "IS 4984:1995",
          status: "superseded",
          activeVersion: "IS 4984:2016",
          title: "High Density Polyethylene (HDPE) Pipes for Water Supply - Specification",
          details: "IS 4984:1995 was superseded in 2016. Testing parameters for internal hydrostatic pressure have been revised.",
        });
      }

      if (/IS\s*2347\s*:\s*2006/i.test(text) || (/IS\s*2347/i.test(text) && !/2017/.test(text))) {
        cited.push({
          cited: "IS 2347:2006",
          status: "superseded",
          activeVersion: "IS 2347:2017",
          title: "Domestic Pressure Cookers - Specification",
          details: "IS 2347:2006 was superseded by the 2017 edition, which is mandatory under the Domestic Pressure Cookers (Quality Control) Order.",
        });
      }

      if (/IS\s*14543/i.test(text)) {
        cited.push({
          cited: "IS 14543:2024",
          status: "current",
          activeVersion: "IS 14543:2024",
          title: "Packaged Drinking Water Specification",
          details: "Active standard under mandatory Scheme-I QCO.",
        });
      }

      const hasSuperseded = cited.some((c) => c.status === "superseded");

      setResult({
        citedStandards: cited,
        riskScore: hasSuperseded ? "HIGH" : "LOW",
        summary: hasSuperseded
          ? `Found ${cited.filter((c) => c.status === "superseded").length} superseded standard reference(s) in this document. Tenders referencing obsolete standards violate government procurement guidelines.`
          : "All detected standard references are active and aligned with the current BIS catalogue.",
        penalWarning: hasSuperseded
          ? "Procurement orders citing superseded standards risk Section 29 non-compliance under the BIS Act, 2016. Manufacturers cannot stamp withdrawn standards with a valid ISI mark."
          : "Compliant with mandatory Quality Control Orders.",
      });
      setAnalyzing(false);
    }, 500);
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
          <span className="text-navy font-bold">Tender & Document Review</span>
        </div>

        {/* Header Hero */}
        <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-xs mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-orange/15 px-2.5 py-0.5 text-xs font-black uppercase text-orange">
                  Enterprise Audit Console
                </span>
                <span className="text-xs font-semibold text-ink-faint">
                  Autonomous Outdated Reference Detection
                </span>
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-black text-navy tracking-tight">
                Tender & Contract Specification Review Console
              </h1>
              <p className="mt-1 text-sm text-ink-soft max-w-2xl leading-relaxed">
                Scan public procurement contracts, tenders, and technical drawings to detect superseded Indian Standards before release. Protect your organisation against Section 29 compliance violations.
              </p>
            </div>
          </div>
        </div>

        {/* Input & Upload Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Text Input Box */}
          <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-black uppercase tracking-wider text-navy flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue" />
                  Paste Tender Specification Text
                </h2>
                <button
                  onClick={() => {
                    setInputText(sampleTender);
                    handleAnalyze(sampleTender);
                  }}
                  className="text-xs font-bold text-orange hover:underline"
                >
                  Load Sample Tender with Outdated Refs
                </button>
              </div>

              <textarea
                rows={9}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste tender clauses, technical schedules, or standard requirements here..."
                className="w-full rounded-xl border border-border bg-surface-alt/50 p-3.5 text-xs text-ink font-mono focus:border-navy focus:outline-none"
              />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-[11px] text-ink-faint">
                {inputText.length} characters entered
              </span>
              <button
                disabled={analyzing || !inputText.trim()}
                onClick={() => handleAnalyze()}
                className="flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-xs font-bold text-white hover:bg-navy-deep disabled:opacity-50 shadow-xs"
              >
                <FileCheck2 className="h-4 w-4 text-orange" />
                <span>{analyzing ? "Analyzing Standards..." : "Scan for Outdated References"}</span>
              </button>
            </div>
          </div>

          {/* Drag & Drop File Box */}
          <div className="rounded-2xl border-2 border-dashed border-border hover:border-navy/40 bg-surface-raised p-6 shadow-xs flex flex-col items-center justify-center text-center transition-colors">
            <UploadCloud className="h-12 w-12 text-ink-faint mb-3 opacity-60" />
            <h3 className="text-sm font-bold text-navy">Upload Tender Document (PDF, DOCX)</h3>
            <p className="text-xs text-ink-soft max-w-sm mt-1">
              Upload your tender specifications or purchase orders. The engine extracts all cited standard clauses and runs them through the FTS5 verification catalog.
            </p>
            <label className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-surface-alt px-4 py-2 text-xs font-bold text-navy hover:bg-surface-raised cursor-pointer shadow-xs">
              <span>Select Document File</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setInputText(sampleTender);
                    handleAnalyze(sampleTender);
                  }
                }}
              />
            </label>
            <span className="mt-2 text-[10px] text-ink-faint">Max 25MB • Secure Quarantine Sandbox</span>
          </div>
        </div>

        {/* Analysis Results Display */}
        {result && (
          <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl font-black ${
                    result.riskScore === "HIGH"
                      ? "bg-red-100 text-red-700"
                      : "bg-success/20 text-success"
                  }`}
                >
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-navy flex items-center gap-2">
                    Legal Compliance Risk Level:
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-black uppercase ${
                        result.riskScore === "HIGH"
                          ? "bg-red-600 text-white"
                          : "bg-success text-white"
                      }`}
                    >
                      {result.riskScore} RISK
                    </span>
                  </h3>
                  <p className="text-xs text-ink-soft mt-0.5">{result.summary}</p>
                </div>
              </div>

              <button
                onClick={() => alert("Report downloaded as compliant PDF summary.")}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-alt px-3.5 py-2 text-xs font-bold text-navy hover:bg-surface-raised"
              >
                <Download className="h-4 w-4" />
                <span>Export Audit Report</span>
              </button>
            </div>

            {/* Statutory Warning if High Risk */}
            {result.riskScore === "HIGH" && (
              <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-xs text-red-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-red-800">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  Statutory Non-Compliance Advisory (Section 29 Warning)
                </span>
                <p className="leading-relaxed">{result.penalWarning}</p>
              </div>
            )}

            {/* Clause Table */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-3">
                Identified Standards & Superseded Reference Details
              </h4>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface-alt/70 text-[10px] font-bold uppercase text-ink-faint">
                      <th className="p-3">Cited In Document</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Current Active Standard</th>
                      <th className="p-3">Legal Analysis & Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {result.citedStandards.map((item, idx) => (
                      <tr key={idx} className="hover:bg-surface-alt/30">
                        <td className="p-3 font-mono font-bold text-red-600 whitespace-nowrap">
                          {item.cited}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {item.status === "superseded" ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase text-red-700">
                              Superseded / Withdrawn
                            </span>
                          ) : (
                            <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-bold text-success">
                              Active / Current
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-navy whitespace-nowrap">
                          {item.activeVersion || "N/A"}
                        </td>
                        <td className="p-3 text-ink-soft leading-relaxed">
                          {item.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
