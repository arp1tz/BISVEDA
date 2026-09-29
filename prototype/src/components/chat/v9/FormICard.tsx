"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FileText, Printer, CheckCircle2, AlertCircle, Download, Loader2 } from "lucide-react";
import type { FormICard as FormICardData } from "@/lib/pipeline/respond";

interface FormICardProps {
  card: FormICardData;
}

const TOTAL_ITEMS = 13;

const LABELS: Record<string, string> = {
  name_of_jeweller: "Firm name",
  outlet_address: "Outlet address",
  near_landmark: "Landmark",
  constitution: "Ownership",
  management_names: "Management",
  contact_person: "Contact person",
  certificate_applied_for: "Certificate for",
  existing_certificates: "Other BIS certificates",
  annual_turnover: "Annual turnover",
  corporate_details: "Corporate level",
  cancellation_conviction: "Cancellation / conviction",
  payment_details: "Payment",
  identification_mark: "Identification mark",
};

export function FormICard({ card }: FormICardProps) {
  const { fields, missing_required } = card;
  const ready = card.ready ?? missing_required.length === 0;
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledKeys = Object.keys(fields).filter((k) => fields[k]?.trim().length > 0);

  const storeForPrint = () => {
    try {
      sessionStorage.setItem("bisveda_form_i_state", JSON.stringify(fields));
    } catch {
      // print view will show blanks
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/form-i/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || "Form_I_draft.docx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not create the Word file. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="w-full my-4 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden text-[#0F172A]">
      <div className="bg-[#0B2A4A] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#E8710A]" />
          <div>
            <h3 className="text-sm font-semibold">Form I: jeweller registration draft</h3>
            <p className="text-[11px] text-slate-300">
              {filledKeys.length} of {TOTAL_ITEMS} items filled
            </p>
          </div>
        </div>

        {ready ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> Draft ready
          </span>
        ) : (
          <span className="text-[11px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
            In progress
          </span>
        )}
      </div>

      <div className="p-4 space-y-3.5">
        {filledKeys.length > 0 ? (
          <div className="space-y-1.5 max-h-[240px] overflow-y-auto divide-y divide-slate-100 pr-1">
            {filledKeys.map((key) => (
              <div key={key} className="pt-1.5 first:pt-0 flex items-start justify-between gap-3 text-xs">
                <span className="text-slate-500 shrink-0">{LABELS[key] || key.replace(/_/g, " ")}</span>
                <span className="font-semibold text-slate-900 text-right max-w-[65%] break-words">{fields[key]}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No details yet. Reply in chat with the items listed above.</p>
        )}

        {!ready && missing_required.length > 0 && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
            <div className="flex items-center gap-1.5 font-semibold text-amber-800 mb-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Still needed ({missing_required.length})</span>
            </div>
            <p className="text-[11px] text-amber-800">Say &quot;that&apos;s all&quot; to get the draft with these left blank.</p>
          </div>
        )}

        {ready && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 bg-[#E8710A] hover:bg-[#cf6408] disabled:opacity-70 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Download Word draft (.docx)</span>
              </button>
              {card.print_url && (
                <Link
                  href={card.print_url}
                  onClick={storeForPrint}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 border border-slate-300 hover:border-slate-400 text-[#0B2A4A] px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Printable view</span>
                </Link>
              )}
            </div>
            <p className="text-[11px] text-slate-500">Edit the file in Word, then apply on Manak Online. Nothing is sent to BIS from here.</p>
            {error && <p className="text-[11px] text-[#bd2f2f]">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
