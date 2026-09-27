"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  BookOpen,
  Scale,
  Award,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  PhoneCall,
  MapPin,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function AboutPage() {
  const milestones = [
    {
      year: "1947",
      title: "Establishment of Indian Standards Institution (ISI)",
      desc: "Registered on 6 January 1947 under the Department of Industries and Supplies to spearhead standardization across post-independence India.",
    },
    {
      year: "1952",
      title: "ISI Certification Marks Act Enacted",
      desc: "Conferred statutory authority to license manufacturers to use the iconic ISI Standard Mark.",
    },
    {
      year: "1986",
      title: "Bureau of Indian Standards Act, 1986",
      desc: "Reconstituted ISI into the statutory Bureau of Indian Standards (BIS) with expanded mandate across product and system certification.",
    },
    {
      year: "2000",
      title: "Gold Hallmarking Scheme Inaugurated",
      desc: "Introduced formal certification of precious gold jewellery to protect retail consumers against under-caratage.",
    },
    {
      year: "2016",
      title: "Modern BIS Act, 2016 (Act No. 11 of 2016)",
      desc: "Established BIS as the National Standards Body of India, empowered Central Government to notify mandatory Quality Control Orders (QCOs), and introduced strict Section 29 criminal penal provisions.",
    },
    {
      year: "2021",
      title: "Mandatory 6-Digit HUID Laser Hallmarking",
      desc: "Universal rollout of unique alphanumeric laser trace codes ensuring 100% purity accountability for gold jewellery.",
    },
  ];

  const regionalOffices = [
    { region: "Central Region", city: "Ghaziabad / Delhi", address: "Plot No. 20/9, Site IV, Sahibabad Industrial Area, Ghaziabad - 201010", phone: "0120-4177100" },
    { region: "Northern Region", city: "Chandigarh", address: "Plot No. 4-A, Sector 27-B, Madhya Marg, Chandigarh - 160019", phone: "0172-2650206" },
    { region: "Southern Region", city: "Chennai", address: "CIT Campus, IV Cross Road, Taramani, Chennai - 600113", phone: "044-22541216" },
    { region: "Eastern Region", city: "Kolkata", address: "1/14 C.I.T. Scheme VII M, V.I.P. Road, Kankurgachi, Kolkata - 700054", phone: "033-23553243" },
    { region: "Western Region", city: "Mumbai", address: "Manakalaya, E9, MIDC, Behind Marol Telephone Exchange, Andheri (East), Mumbai - 400093", phone: "022-28329295" },
  ];

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
          <span className="text-navy font-bold">About BIS & Statutory Mandate</span>
        </div>

        {/* Hero Section */}
        <div className="rounded-2xl border border-border bg-surface-raised p-6 sm:p-8 shadow-xs mb-8">
          <div className="max-w-3xl space-y-3">
            <span className="rounded-full bg-navy/10 px-3 py-1 text-xs font-black uppercase text-navy">
              National Standards Body of India
            </span>
            <h1 className="text-2xl sm:text-4xl font-black text-navy tracking-tight leading-tight">
              Bureau of Indian Standards: Protecting Consumer Safety & Industrial Quality
            </h1>
            <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
              Operating under the Ministry of Consumer Affairs, Food and Public Distribution, Government of India, the Bureau of Indian Standards (BIS) develops voluntary and mandatory standards, operates product certification schemes, and certifies purity to build a self-reliant, quality-conscious nation.
            </p>
          </div>
        </div>

        {/* Statutory Mandate Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-xs space-y-2">
            <BookOpen className="h-6 w-6 text-blue" />
            <h3 className="text-sm font-black text-navy uppercase tracking-wider">
              Standards Formulation
            </h3>
            <p className="text-xs text-ink-soft leading-relaxed">
              Formulation of Indian Standards across 15 Division Councils encompassing electronics, food, civil, metallurgical, chemical, and renewable sectors.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-xs space-y-2">
            <ShieldCheck className="h-6 w-6 text-orange" />
            <h3 className="text-sm font-black text-navy uppercase tracking-wider">
              Conformity Assessment & QCOs
            </h3>
            <p className="text-xs text-ink-soft leading-relaxed">
              Enforcement of mandatory Quality Control Orders (QCOs) issued by central ministries under Section 16 of the BIS Act, 2016 to prevent counterfeit, substandard goods.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-xs space-y-2">
            <Award className="h-6 w-6 text-success" />
            <h3 className="text-sm font-black text-navy uppercase tracking-wider">
              Gold Hallmarking & HUID
            </h3>
            <p className="text-xs text-ink-soft leading-relaxed">
              Universal hallmarking of gold and silver articles with laser-inscribed 6-digit HUID codes through an audited network of Assaying and Hallmarking Centres (AHCs).
            </p>
          </div>
        </div>

        {/* Historical Evolution Timeline */}
        <div className="rounded-2xl border border-border bg-surface-raised p-6 sm:p-8 shadow-xs mb-8">
          <h2 className="text-lg font-black text-navy mb-6 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue" />
            Historical Evolution: From ISI (1947) to Modern BIS Act (2016)
          </h2>

          <div className="relative border-l border-border pl-6 space-y-6">
            {milestones.map((m, idx) => (
              <div key={idx} className="relative">
                <div className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-surface-raised bg-navy" />
                <span className="font-mono text-xs font-black text-orange block mb-0.5">
                  {m.year}
                </span>
                <h4 className="text-sm font-bold text-navy">{m.title}</h4>
                <p className="text-xs text-ink-soft mt-1 leading-relaxed max-w-2xl">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Regional Offices Directory */}
        <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-xs">
          <h2 className="text-lg font-black text-navy mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-success" />
            Regional Directorate Offices & Central Laboratories
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regionalOffices.map((office, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-border bg-surface-alt/40 p-4 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-navy">{office.region}</span>
                  <span className="text-[10px] rounded bg-navy/10 px-2 py-0.5 font-bold text-navy">
                    {office.city}
                  </span>
                </div>
                <p className="text-ink-soft text-[11px] leading-relaxed">{office.address}</p>
                <p className="text-[11px] font-mono text-ink-faint flex items-center gap-1.5 pt-1">
                  <PhoneCall className="h-3 w-3 text-orange" />
                  <span>{office.phone}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
