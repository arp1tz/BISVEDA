"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, FileText, CheckCircle2 } from "lucide-react";

interface FormFieldItem {
  field: number;
  key: string;
  label: string;
  required: boolean;
}

const FORM_FIELDS: FormFieldItem[] = [
  { field: 1, key: "name_of_jeweller", label: "Name of Jeweller", required: true },
  { field: 2, key: "outlet_address", label: "Address of outlet(s) with PIN code, district, state, telephone, fax, email", required: true },
  { field: 3, key: "near_landmark", label: "Near Landmark", required: false },
  { field: 4, key: "constitution", label: "Whether Proprietorship / Partnership / Pvt. Ltd. Company / PSU", required: true },
  { field: 5, key: "management_names", label: "Names of persons responsible for management", required: true },
  { field: 6, key: "contact_person", label: "Name and designation of contact person", required: true },
  { field: 7, key: "certificate_applied_for", label: "BIS Hallmarking Certificate applied for", required: true },
  { field: 8, key: "existing_certificates", label: "Whether already holds any other BIS Certificate", required: false },
  { field: 9, key: "annual_turnover", label: "Approximate annual turnover", required: true },
  { field: 10, key: "corporate_details", label: "Corporate-level details and outlet list", required: false },
  { field: 11, key: "cancellation_conviction", label: "Whether any previous cancellation / conviction", required: true },
  { field: 12, key: "payment_details", label: "Payment details", required: false },
  { field: 13, key: "identification_mark", label: "Identification mark used on articles", required: true },
];

export default function FormIPrintPage() {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = sessionStorage.getItem("bisveda_form_i_state");
      if (raw) {
        setFormData(JSON.parse(raw));
      }
    } catch (e) {
      console.error("Failed to load form state from sessionStorage", e);
    }
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const getFieldValue = (item: FormFieldItem): string => {
    return (
      formData[item.key] ||
      formData[`field_${item.field}`] ||
      formData[`field${item.field}`] ||
      formData[item.label] ||
      ""
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 print:bg-white print:text-black">
      {/* Non-printed Navigation Bar */}
      <div className="print:hidden border-b border-slate-200 bg-white sticky top-0 z-10 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to BISVEDA
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0B2A4A]" />
            Form I Jeweller Registration Draft
          </span>
        </div>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 bg-[#0B2A4A] hover:bg-[#081e35] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Print / Save as PDF
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-[850px] mx-auto my-8 p-8 md:p-12 bg-white border border-slate-200 shadow-md rounded-lg print:border-none print:shadow-none print:my-0 print:p-0">
        {/* Official Banner / Header */}
        <div className="border-b-2 border-slate-800 pb-4 mb-6 text-center">
          <p className="text-xs uppercase tracking-widest text-[#bd2f2f] font-bold mb-1">
            DRAFT: prepared with BISVEDA, submit on Manak Online
          </p>
          <h1 className="text-xl font-bold text-slate-900 uppercase">
            BUREAU OF INDIAN STANDARDS
          </h1>
          <p className="text-sm font-semibold text-slate-700 mt-1">
            FORM I
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            (refer sub-regulation (2) of regulation 3)
          </p>
          <p className="text-sm font-bold text-slate-800 mt-2 uppercase tracking-wide">
            Application for Grant of Certificate of Registration to Jewellers for Sale of Hallmarked Articles
          </p>
        </div>

        {/* Form Fields Table */}
        <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
          {FORM_FIELDS.map((item) => {
            const val = getFieldValue(item);
            return (
              <div key={item.field} className="grid grid-cols-12 p-3 text-sm">
                <div className="col-span-1 font-bold text-slate-700">
                  {item.field}.
                </div>
                <div className="col-span-6 font-medium text-slate-800 pr-4">
                  {item.label}
                  {item.required && <span className="text-[#bd2f2f] ml-1">*</span>}
                </div>
                <div className="col-span-5 text-slate-900 font-mono text-sm break-words bg-slate-50/50 print:bg-transparent p-1.5 rounded">
                  {val ? (
                    <span className="font-semibold text-slate-950">{val}</span>
                  ) : (
                    <span className="italic text-slate-400 font-sans">[Not Provided / Blank]</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Declaration & Signature Block */}
        <div className="mt-8 pt-6 border-t border-slate-300 text-xs text-slate-700 leading-relaxed">
          <p className="font-semibold text-slate-800 mb-2">13. Undertaking</p>
          <p>
            I/We undertake that we shall strictly follow the provisions of Bureau of Indian Standards Act, 2016, Rules,
            2017, and Hallmarking Regulations 2018 and guidelines for conformity assessment scheme issued thereunder upon
            grant of Certificate by Bureau of Indian Standards for sale of gold or silver hallmarked articles as per IS
            1417/2112.
          </p>
          <div className="mt-12 flex justify-between items-end">
            <div>
              <p>Date: {new Date().toLocaleDateString("en-IN")}</p>
              <p className="mt-1">Place: ____________________</p>
            </div>
            <div className="text-right">
              <div className="w-48 border-b border-slate-600 mb-1" />
              <p className="font-semibold">Signature & Seal of Applicant</p>
              <p className="text-[10px] text-slate-500">Name & Designation</p>
            </div>
          </div>
        </div>

        {/* Footer Notes */}
        <div className="mt-8 pt-4 border-t border-slate-200 text-[10px] text-slate-500 text-center">
          <p>
            Generated via BISVEDA Prototype. Official registration must be finalized through the Manak Online portal (www.manakonline.in).
          </p>
        </div>
      </div>
    </div>
  );
}
