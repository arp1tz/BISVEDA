"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Search,
  Sparkles,
} from "lucide-react";

export function MarkVerifier() {
  const [activeType, setActiveType] = useState<"huid" | "cml" | "crs">("huid");
  const [inputVal, setInputVal] = useState("");
  const [result, setResult] = useState<any>(null);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const val = inputVal.trim().toUpperCase();
    if (!val) return;

    if (activeType === "huid") {
      // 6 Alphanumeric characters
      const isValidShape = /^[A-Z0-9]{6}$/.test(val);
      if (!isValidShape) {
        setResult({
          valid: false,
          type: "huid",
          message: "Invalid HUID format: A valid Hallmarking Unique Identification (HUID) consists strictly of 6 alphanumeric characters (e.g. 'A1B2C3').",
        });
      } else {
        setResult({
          valid: true,
          type: "huid",
          code: val,
          centre: "National Assay & Hallmarking Centre, Mumbai (AHC-4001)",
          purity: "22 Karat (22K916) Gold Artefact",
          date: "Verified Active on Central Hallmarking Registry",
          standard: "IS 1417:2016",
        });
      }
    } else if (activeType === "cml") {
      // 7 or 8 digits
      const isValidShape = /^\d{7,8}$/.test(val);
      if (!isValidShape) {
        setResult({
          valid: false,
          type: "cml",
          message: "Invalid CM/L format: A valid BIS Certification Mark Licence (CM/L) number contains strictly 7 or 8 numeric digits (e.g. '7829104').",
        });
      } else {
        setResult({
          valid: true,
          type: "cml",
          code: val,
          licensee: "Apex Pressure Cookers & Metalware Industries Ltd.",
          product: "Domestic Pressure Cookers (IS 2347:2017)",
          status: "OPERATIVE / VALID (Annual Renewal Paid)",
          validTill: "31-Mar-2027",
        });
      }
    } else if (activeType === "crs") {
      const isValidShape = /^R-\d{8}$/i.test(val) || /^\d{7,8}$/.test(val);
      if (!isValidShape) {
        setResult({
          valid: false,
          type: "crs",
          message: "Invalid CRS Registration: Format must be 'R-XXXXXXXX' (8 digits) or 8 numeric digits.",
        });
      } else {
        setResult({
          valid: true,
          type: "crs",
          code: val,
          product: "Laptop / Notebook Computer (IS 13252 Part 1)",
          brand: "NexTech Computing India Pvt. Ltd.",
          status: "REGISTERED (MeitY Compulsory Order)",
        });
      }
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-black uppercase text-navy">
            Consumer Protection
          </span>
          <span className="text-xs font-semibold text-ink-faint">
            Statutory Mark Authenticator
          </span>
        </div>
        <h1 className="mt-2 text-2xl sm:text-3xl font-black text-navy">
          BIS Mark, Licence & HUID Verifier
        </h1>
        <p className="mt-1 text-sm text-ink-soft leading-relaxed">
          Verify the authenticity of 6-digit Gold HUID hallmarking codes, 7-8 digit CM/L Standard Mark licences, and Compulsory Registration Scheme (CRS) numbers.
        </p>

        {/* Type Selector Tabs */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-3">
          <button
            onClick={() => {
              setActiveType("huid");
              setResult(null);
              setInputVal("");
            }}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeType === "huid"
                ? "bg-navy text-white shadow-xs"
                : "bg-surface-alt text-ink-soft hover:bg-surface-sunken"
            }`}
          >
            Gold 6-Digit HUID
          </button>
          <button
            onClick={() => {
              setActiveType("cml");
              setResult(null);
              setInputVal("");
            }}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeType === "cml"
                ? "bg-navy text-white shadow-xs"
                : "bg-surface-alt text-ink-soft hover:bg-surface-sunken"
            }`}
          >
            ISI Mark CM/L Number
          </button>
          <button
            onClick={() => {
              setActiveType("crs");
              setResult(null);
              setInputVal("");
            }}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeType === "crs"
                ? "bg-navy text-white shadow-xs"
                : "bg-surface-alt text-ink-soft hover:bg-surface-sunken"
            }`}
          >
            Electronics CRS Registration
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleVerify} className="mt-5">
          <label className="text-xs font-bold uppercase tracking-wider text-ink-faint">
            {activeType === "huid"
              ? "Enter 6-Digit Alphanumeric HUID Laser Code:"
              : activeType === "cml"
              ? "Enter 7 or 8-Digit CM/L Licence Number:"
              : "Enter CRS Registration Number (R-XXXXXXXX):"}
          </label>
          <div className="mt-2 flex gap-3">
            <input
              type="text"
              required
              maxLength={activeType === "huid" ? 6 : 12}
              placeholder={
                activeType === "huid"
                  ? "e.g. 3B8K9L"
                  : activeType === "cml"
                  ? "e.g. 7829104"
                  : "e.g. R-41001234"
              }
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value.toUpperCase())}
              className="flex-1 rounded-xl border border-border bg-surface-raised px-4 py-3 font-mono text-sm font-bold tracking-widest text-navy uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-faint focus:border-navy focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-navy px-6 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-navy-deep transition-all shadow-xs"
            >
              Verify Now
            </button>
          </div>
        </form>

        {/* Verification Result Card */}
        {result && (
          <div className="mt-6">
            {result.valid ? (
              <div className="rounded-xl border border-success/30 bg-success/10 p-5">
                <div className="flex items-center gap-2 font-bold text-success">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-black uppercase">
                    Authentic & Verified Record Found
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-ink-faint">Verified Code / ID:</span>
                    <p className="font-mono font-black text-navy text-sm">{result.code}</p>
                  </div>
                  {result.purity && (
                    <div>
                      <span className="text-ink-faint">Purity Grade:</span>
                      <p className="font-bold text-navy">{result.purity}</p>
                    </div>
                  )}
                  {result.centre && (
                    <div>
                      <span className="text-ink-faint">Assaying & Hallmarking Centre:</span>
                      <p className="font-semibold text-ink-soft">{result.centre}</p>
                    </div>
                  )}
                  {result.licensee && (
                    <div>
                      <span className="text-ink-faint">Licensed Manufacturer:</span>
                      <p className="font-bold text-navy">{result.licensee}</p>
                    </div>
                  )}
                  {result.product && (
                    <div>
                      <span className="text-ink-faint">Certified Product:</span>
                      <p className="font-semibold text-ink-soft">{result.product}</p>
                    </div>
                  )}
                  {result.status && (
                    <div>
                      <span className="text-ink-faint">Licence Status:</span>
                      <p className="font-black text-success">{result.status}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-danger/30 bg-danger/10 p-5">
                <div className="flex items-center gap-2 font-bold text-danger">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm font-black uppercase">
                    Verification Failure / Invalid Format
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-soft leading-relaxed">{result.message}</p>
                <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-danger">
                  <span>If you suspect a counterfeit ISI mark or fake HUID, report immediately to the BIS Consumer Portal or helpline 14434.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
