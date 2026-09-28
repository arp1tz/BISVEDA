"use client";

import React from "react";
import Link from "next/link";
import {
  Info,
  BookOpen,
  Languages,
  Camera,
  FlaskConical,
  FileText,
  PhoneCall,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { AppHeader } from "@/components/chat/v9/AppHeader";
import { AppFooter } from "@/components/chat/v9/AppFooter";

const CORE_FEATURES = [
  {
    icon: BookOpen,
    title: "Cited answers from official documents",
    desc: "Every fact points to the Indian Standard clause and page it came from, so you can check it yourself.",
  },
  {
    icon: Languages,
    title: "Ask in any Indian language",
    desc: "Type or speak in English, Hindi, Marathi, or the other scheduled languages, by keyboard or by voice.",
  },
  {
    icon: Camera,
    title: "Check a photo",
    desc: "Upload a product or mark photo to identify the likely standard, or check an ISI/hallmark format.",
  },
  {
    icon: FlaskConical,
    title: "Find a lab or hallmarking centre",
    desc: "Locate BIS-recognised testing laboratories and Assaying and Hallmarking Centres near you.",
  },
  {
    icon: FileText,
    title: "Draft your Form I",
    desc: "Jewellers can draft the hallmarking registration form in conversation, then print it.",
  },
];

const ACCURACY_POINTS = [
  "Answers come only from the documents we hold, never from general knowledge.",
  "Every fact carries a clause and page citation you can open and check.",
  "If something is not in our documents, BISVEDA says so instead of guessing.",
];

interface Accordion {
  title: string;
  items: string[];
}

const PLANNED: Accordion[] = [
  {
    title: "All standards and schemes",
    items: [
      "The full BIS catalogue of over 23,300 standards, not just the 8 we hold today.",
      "Other certification schemes: CRS, Scheme X, and Foreign Manufacturer Certification.",
      "Live QCO mandatory-certification checks for any product.",
      "Tracking of standard revisions and amendments over time.",
    ],
  },
  {
    title: "Consumer services",
    items: [
      "Filing and tracking counterfeit and complaint reports.",
      "Product recall notices.",
      "Direct BIS Care app integration for mark verification.",
    ],
  },
  {
    title: "Language and access",
    items: [
      "Voice conversations natively in all 22 scheduled languages.",
      "The Exotel voice helpline at full scale.",
    ],
  },
  {
    title: "For businesses",
    items: [
      "A one-page compliance summary you can export: standard, QCO status, certification steps, labs.",
      "Direct handoff of a drafted Form I into Manak Online.",
      "A feed of new standards, amendments, and QCO notices as they are published.",
    ],
  },
  {
    title: "For BIS staff",
    items: [
      "Review queues for newly ingested documents before they go live.",
      "Automatic checks for outdated or superseded source PDFs.",
      "A data-quality dashboard across the whole knowledge base.",
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0F172A] font-sans">
      <AppHeader />

      <main id="main-content" className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 space-y-10">
        {/* Intro */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#E8710A]">
            <Info className="w-4 h-4" />
            <span>About this prototype</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B2A4A] tracking-tight">
            BISVEDA
          </h1>
          <p className="text-sm text-[#64748B] leading-relaxed max-w-2xl">
            BISVEDA is a conversational assistant that helps you find the right Indian Standard, understand
            certification requirements, and locate testing labs, with every answer traced back to an official
            document.
          </p>
        </div>

        {/* What works today */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-[#0B2A4A]">What works today</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CORE_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex gap-3 p-4 rounded-xl border border-[#E5E7EB] bg-white">
                  <div className="p-2 h-fit rounded-lg bg-[#F7F8FA] text-[#0B2A4A] shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#0F172A]">{f.title}</h3>
                    <p className="text-xs text-[#64748B] leading-relaxed mt-0.5">{f.desc}</p>
                  </div>
                </div>
              );
            })}
            <div className="flex gap-3 p-4 rounded-xl border border-[#E5E7EB] bg-white">
              <div className="p-2 h-fit rounded-lg bg-[#F7F8FA] text-[#0B2A4A] shrink-0">
                <PhoneCall className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A]">Speak with BISVEDA on call</h3>
                <p className="text-xs text-[#64748B] leading-relaxed mt-0.5">
                  Request a callback and talk through the same assistant over the phone.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How answers stay accurate */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#0B2A4A]">How answers stay accurate</h2>
          <ul className="space-y-2">
            {ACCURACY_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2 text-sm text-[#0F172A]">
                <CheckCircle2 className="h-4 w-4 text-[#228f4a] shrink-0 mt-0.5" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Current coverage */}
        <section className="space-y-3 p-5 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA]">
          <h2 className="text-sm font-bold text-[#0B2A4A]">Current coverage</h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            <strong className="text-[#0F172A]">Helmets:</strong> IS 4151, IS 2925 &middot;{" "}
            <strong className="text-[#0F172A]">Toys:</strong> IS 9873 (Part 1 &amp; 3), IS 15644 &middot;{" "}
            <strong className="text-[#0F172A]">Hallmarking:</strong> IS 1417, IS 1418, IS 15820, plus the Form I
            jeweller registration template.
          </p>
          <p className="text-xs text-[#64748B] leading-relaxed">
            The document ingestion pipeline behind this prototype is already built. It is not limited to 8
            standards; it can take in BIS&apos;s full catalogue of over 23,300 published standards.
          </p>
        </section>

        {/* Planned for the full version */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#0B2A4A]">Planned for the full version</h2>
          <div className="space-y-2">
            {PLANNED.map((group) => (
              <details key={group.title} className="group rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
                <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer text-sm font-semibold text-[#0F172A] list-none select-none">
                  <span>{group.title}</span>
                  <ChevronDown className="h-4 w-4 text-[#64748B] transition-transform group-open:rotate-180 shrink-0" />
                </summary>
                <ul className="px-4 pb-3.5 pt-0.5 space-y-1.5">
                  {group.items.map((item) => (
                    <li key={item} className="text-xs text-[#64748B] leading-relaxed pl-1 border-l-2 border-[#E5E7EB]">
                      <span className="pl-2 block">{item}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>

        <div className="pt-2 text-center">
          <Link href="/" className="text-sm font-semibold text-[#0B2A4A] hover:underline">
            Back to BISVEDA
          </Link>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
