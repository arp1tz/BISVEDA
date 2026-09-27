"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Building2,
  Clock,
  Send,
  CheckCircle2,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function ContactPage() {
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("Standard Inquiry");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
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
          <span className="text-navy font-bold">Contact & Grievance Redressal</span>
        </div>

        {/* Hero */}
        <div className="rounded-2xl border border-border bg-surface-raised p-6 sm:p-8 shadow-xs mb-8">
          <div className="max-w-3xl space-y-3">
            <span className="rounded-full bg-navy/10 px-3 py-1 text-xs font-black uppercase text-navy">
              Official Bureau Directory
            </span>
            <h1 className="text-2xl sm:text-4xl font-black text-navy tracking-tight leading-tight">
              Contact BIS & Regulatory Grievance Portals
            </h1>
            <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
              Connect with the Bureau of Indian Standards Headquarters, Regional Directorates, or submit consumer complaints regarding defective ISI marked products.
            </p>
          </div>
        </div>

        {/* 3 Contact Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Head Office */}
          <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-xs space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue" />
              <h3 className="text-sm font-extrabold text-navy uppercase tracking-wider">
                BIS Headquarters
              </h3>
            </div>
            <p className="font-semibold text-ink">Manak Bhavan</p>
            <p className="text-ink-soft leading-relaxed">
              9 Bahadur Shah Zafar Marg, New Delhi - 110002, India
            </p>
            <div className="pt-2 border-t border-border/60 space-y-1.5 text-ink-soft">
              <p className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-orange" />
                <span>+91 11 23230131 / 23233375</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-blue" />
                <span>info@bis.gov.in</span>
              </p>
            </div>
          </div>

          {/* Ministry */}
          <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-xs space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-orange" />
              <h3 className="text-sm font-extrabold text-navy uppercase tracking-wider">
                Nodal Ministry
              </h3>
            </div>
            <p className="font-semibold text-ink">Department of Consumer Affairs</p>
            <p className="text-ink-soft leading-relaxed">
              Ministry of Consumer Affairs, Food & Public Distribution, Krishi Bhavan, New Delhi - 110001
            </p>
            <div className="pt-2 border-t border-border/60 space-y-1.5 text-ink-soft">
              <p className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-orange" />
                <span>National Helpline: 1915</span>
              </p>
              <p className="flex items-center gap-2">
                <ExternalLink className="h-3.5 w-3.5 text-blue" />
                <a href="https://consumeraffairs.nic.in" target="_blank" rel="noreferrer" className="hover:underline">
                  consumeraffairs.nic.in
                </a>
              </p>
            </div>
          </div>

          {/* Toll Free Helpline */}
          <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-xs space-y-3 text-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-success" />
                <h3 className="text-sm font-extrabold text-navy uppercase tracking-wider">
                  Citizen Helplines
                </h3>
              </div>
              <p className="mt-2 text-2xl font-black text-orange">14434</p>
              <p className="text-[11px] text-ink-faint">BIS Toll-Free Helpline (Working Hours)</p>
              <p className="mt-2 text-ink-soft">
                For licensing queries, standard purchases, and complaint status tracking.
              </p>
            </div>
            <div className="pt-2 border-t border-border/60 text-[11px] text-ink-faint">
              Mon - Fri: 09:30 AM to 06:00 PM IST
            </div>
          </div>
        </div>

        {/* Complaint / Direct Enquiry Form & Official Links */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Official Portals Box */}
          <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-xs space-y-4">
            <h2 className="text-base font-extrabold text-navy">
              Official Digital Enquiry & Grievance Channels
            </h2>
            <p className="text-xs text-ink-soft leading-relaxed">
              For binding statutory determinations, legal complaints, and application filings, use the official digital portals:
            </p>

            <div className="space-y-3 text-xs">
              <a
                href="https://www.bis.gov.in/consumer-overview/online-complaint-registration/?lang=en"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-border bg-surface-alt p-3.5 font-bold text-navy hover:bg-surface-sunken transition-all"
              >
                <div>
                  <span className="block">Online Consumer Complaint Registration</span>
                  <span className="text-[11px] font-normal text-ink-faint">
                    Report defective ISI mark goods or fake hallmarks
                  </span>
                </div>
                <ExternalLink className="h-4 w-4 text-orange shrink-0" />
              </a>

              <a
                href="https://www.bis.gov.in/directory/enquiry/?lang=en"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-border bg-surface-alt p-3.5 font-bold text-navy hover:bg-surface-sunken transition-all"
              >
                <div>
                  <span className="block">Enquiry on BIS Standards & Schemes</span>
                  <span className="text-[11px] font-normal text-ink-faint">
                    Technical queries submitted to technical committee secretariats
                  </span>
                </div>
                <ExternalLink className="h-4 w-4 text-blue shrink-0" />
              </a>

              <a
                href="https://www.manakonline.in"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-border bg-surface-alt p-3.5 font-bold text-navy hover:bg-surface-sunken transition-all"
              >
                <div>
                  <span className="block">Manak Online e-BIS Application Tracking</span>
                  <span className="text-[11px] font-normal text-ink-faint">
                    Track status of pending CM/L or CRS license grants
                  </span>
                </div>
                <ExternalLink className="h-4 w-4 text-success shrink-0" />
              </a>
            </div>
          </div>

          {/* Quick Inquiry Form */}
          <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-xs">
            <h2 className="text-base font-extrabold text-navy mb-2">
              Send an Advisory Inquiry
            </h2>
            <p className="text-xs text-ink-soft mb-4">
              Submit your inquiry to the BISVEDA Intelligence Support Desk.
            </p>

            {formSubmitted ? (
              <div className="rounded-xl border border-success/30 bg-success/10 p-6 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
                <h4 className="text-sm font-bold text-navy">Inquiry Received</h4>
                <p className="text-xs text-ink-soft">
                  Thank you, {name}. Your inquiry regarding &quot;{subject}&quot; has been logged. An intelligence advisory ticket will be generated.
                </p>
                <button
                  onClick={() => setFormSubmitted(false)}
                  className="mt-3 rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-white hover:bg-navy-deep"
                >
                  Submit Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-navy block mb-1">Your Full Name:</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full rounded-xl border border-border bg-surface-alt px-3 py-2 text-ink focus:outline-none focus:border-navy"
                  />
                </div>

                <div>
                  <label className="font-bold text-navy block mb-1">Email Address:</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. ramesh@msme-metals.in"
                    className="w-full rounded-xl border border-border bg-surface-alt px-3 py-2 text-ink focus:outline-none focus:border-navy"
                  />
                </div>

                <div>
                  <label className="font-bold text-navy block mb-1">Inquiry Type:</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface-alt px-3 py-2 font-medium text-navy focus:outline-none focus:border-navy"
                  >
                    <option>Standard Applicability Inquiry</option>
                    <option>MSME Fee Concession Clarification</option>
                    <option>Mandatory QCO Gazette Verification</option>
                    <option>NABL Laboratory Testing Scope</option>
                    <option>Tender Outdated Reference Audit</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-navy block mb-1">Your Message / Query:</label>
                  <textarea
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your product, manufacturing details, or technical question..."
                    className="w-full rounded-xl border border-border bg-surface-alt px-3 py-2 text-ink focus:outline-none focus:border-navy"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-navy py-2.5 font-bold text-white hover:bg-navy-deep shadow-xs transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Submit Regulatory Inquiry</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
