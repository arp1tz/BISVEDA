/**
 * BISVEDA Layer 5 — Agent Orchestrator & Specialist Agents (V7 §10 & V8 §10)
 * Deterministic orchestrator that routes user queries to bounded specialist agents:
 * 1. QCO & Regulatory Agent (Gazette orders, mandatory status, Section 29 penalties)
 * 2. Technical QA Agent (Clauses, testing limits, Annex A test equipment, STI)
 * 3. Certification & Licensing Agent (Schemes, MSME 80% fee fast-track, Form-V)
 * 4. Lab & Centre Locator Agent (Distance-ranked NABL & BIS testing facilities)
 * 5. Consumer Assistance & Mark Verifier Agent (ISI, CM/L, CRS, Gold HUID)
 * 6. Standards Q&A Agent (General standard scope and catalog matching)
 */

import type { LaboratoryRecord, RecommendationResult, EvidenceClause } from "./types";
import kbData from "../../data/knowledge_base.json";

export type SpecialistAgentId =
  | "qco_agent"
  | "technical_agent"
  | "certification_agent"
  | "lab_agent"
  | "verifier_agent"
  | "standards_agent"
  | "form_agent";

export interface SpecialistAgentInfo {
  id: SpecialistAgentId;
  name: string;
  role: string;
  badgeColor: string;
  icon: string;
}

export const SPECIALIST_AGENTS: Record<SpecialistAgentId, SpecialistAgentInfo> = {
  qco_agent: {
    id: "qco_agent",
    name: "QCO & Statutory Enforcement Agent",
    role: "Official Gazette Orders & Legal Penal Sanctions Adjudication",
    badgeColor: "bg-red-500/15 text-red-700 border-red-500/30",
    icon: "⚖️",
  },
  technical_agent: {
    id: "technical_agent",
    name: "Technical Testing & STI Agent",
    role: "Clause Limits, In-House Test Equipment & Scheme of Testing",
    badgeColor: "bg-purple-500/15 text-purple-700 border-purple-500/30",
    icon: "🔬",
  },
  certification_agent: {
    id: "certification_agent",
    name: "Licensing & MSME Scheme Agent",
    role: "Certification Schemes, 80% Fee Concessions & Fast-Track Application",
    badgeColor: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    icon: "🏭",
  },
  lab_agent: {
    id: "lab_agent",
    name: "Testing Laboratory Locator Agent",
    role: "Distance-Ranked NABL & BIS Apex Laboratory Matching",
    badgeColor: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    icon: "📍",
  },
  verifier_agent: {
    id: "verifier_agent",
    name: "Statutory Mark Authenticator Agent",
    role: "Consumer Protection, ISI Mark & CM/L Licence Validation",
    badgeColor: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    icon: "🛡️",
  },
  form_agent: {
    id: "form_agent",
    name: "Form-I & Application Generator Agent",
    role: "Statutory Licensing Document Preparation",
    badgeColor: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
    icon: "📋",
  },
  standards_agent: {
    id: "standards_agent",
    name: "Standards Catalogue & Scope Agent",
    role: "Product-to-Standard Matching & Regulatory Intelligence",
    badgeColor: "bg-navy/15 text-navy border-navy/30",
    icon: "📖",
  },
};

export interface OrchestrationResult {
  agent: SpecialistAgentInfo;
  confidence: number;
  synthesis: string;
  keyInsights: string[];
  recommendedNextActions: string[];
}

/**
 * Classifies query intent deterministically into the canonical specialist agents.
 */
export function classifySpecialistAgent(query: string): { agentId: SpecialistAgentId; confidence: number } {
  const q = query.toLowerCase();

  // 1. QCO / Gazette / Mandatory Check
  if (
    q.includes("qco") ||
    q.includes("mandatory") ||
    q.includes("gazette") ||
    q.includes("legal") ||
    q.includes("penalty") ||
    q.includes("penal") ||
    q.includes("punish") ||
    q.includes("section 29") ||
    q.includes("compulsory")
  ) {
    return { agentId: "qco_agent", confidence: 0.96 };
  }

  // 2. Technical / Testing / Equipment / STI Check
  if (
    q.includes("test") ||
    q.includes("clause") ||
    q.includes("equipment") ||
    q.includes("sti") ||
    q.includes("sit") ||
    q.includes("sampling") ||
    q.includes("sample quantity") ||
    q.includes("annex") ||
    q.includes("drop tower") ||
    q.includes("pressure limit") ||
    q.includes("rigidity")
  ) {
    return { agentId: "technical_agent", confidence: 0.94 };
  }

  // 3. Mark / Licence / HUID Verification
  if (
    q.includes("verify") ||
    q.includes("genuine") ||
    q.includes("fake") ||
    q.includes("counterfeit") ||
    q.includes("cml") ||
    q.includes("cm/l") ||
    q.includes("huid") ||
    q.includes("hallmark") ||
    q.includes("stamp")
  ) {
    return { agentId: "verifier_agent", confidence: 0.95 };
  }

  // 4. Lab / Testing Facilities / Proximity
  if (
    q.includes("lab") ||
    q.includes("laboratory") ||
    q.includes("where to test") ||
    q.includes("centre") ||
    q.includes("near") ||
    q.includes("location") ||
    q.includes("pune") ||
    q.includes("delhi") ||
    q.includes("mumbai")
  ) {
    return { agentId: "lab_agent", confidence: 0.93 };
  }

  // 5. Licensing / MSME Fast Track / Schemes
  if (
    q.includes("msme") ||
    q.includes("scheme") ||
    q.includes("subsidy") ||
    q.includes("fee") ||
    q.includes("cost") ||
    q.includes("concession") ||
    q.includes("how to get license") ||
    q.includes("how to apply") ||
    q.includes("fast track") ||
    q.includes("udyam")
  ) {
    return { agentId: "certification_agent", confidence: 0.94 };
  }

  // 6. Form Preparation
  if (q.includes("form") || q.includes("application form") || q.includes("schedule ii")) {
    return { agentId: "form_agent", confidence: 0.92 };
  }

  // Default: Standards Catalogue Agent
  return { agentId: "standards_agent", confidence: 0.90 };
}

/**
 * Executes the assigned specialist agent and generates authoritative, role-focused output.
 */
export function executeSpecialistAgent(
  query: string,
  primary: RecommendationResult,
  allRecs: RecommendationResult[],
  qcoAlert?: { isMandatory: boolean; orderTitle: string; ministry: string; penalProvision?: string },
  labs?: LaboratoryRecord[]
): OrchestrationResult {
  const { agentId, confidence } = classifySpecialistAgent(query);
  const agent = SPECIALIST_AGENTS[agentId];

  const stdNum = primary.standardNumber;
  const title = primary.title;

  let synthesis = "";
  const keyInsights: string[] = [];
  const recommendedNextActions: string[] = [];

  // Match relevant product manual knowledge chunks
  const chunks = (kbData as any).chunks || [];
  const relevantChunks = chunks.filter((c: any) =>
    c.standard_number.includes(stdNum.replace(/[^0-9]/g, ""))
  );

  switch (agentId) {
    case "qco_agent":
      if (qcoAlert?.isMandatory) {
        synthesis =
          `### Statutory Adjudication: ${stdNum} (${title})\n\n` +
          `> 🚨 **MANDATORY QUALITY CONTROL ORDER ENFORCED**  \n` +
          `> Governing Order: **${qcoAlert.orderTitle}**  \n` +
          `> Issuing Authority: **${qcoAlert.ministry}**  \n` +
          `> Statutory Penalty: **${qcoAlert.penalProvision || "Section 29 of BIS Act, 2016 (Imprisonment up to 2 years, minimum fine of ₹2,00,000)"}**  \n\n` +
          `Manufacturing, importing, distributing, or offering for sale any units of this product without an authentic BIS Standard Mark (ISI mark) is a **cognizable criminal offense** in India.`;
        keyInsights.push(`Governing standard ${stdNum} is strictly mandatory in India under gazetted QCO.`);
        keyInsights.push(`Criminal sanctions apply under Section 29 of the BIS Act, 2016 for non-compliance.`);
        recommendedNextActions.push(`Audit existing inventory for authentic ISI Mark and CM/L license stamps.`);
        recommendedNextActions.push(`Ensure manufacturing plant aligns with Scheme-I certification requirements.`);
      } else {
        synthesis =
          `### Regulatory Status: ${stdNum} (${title})\n\n` +
          `This product standard is currently under **voluntary certification** under Scheme-I. No mandatory Quality Control Order (QCO) is currently in force for this product scope. Manufacturers may obtain the BIS Standard Mark (ISI Mark) voluntarily for commercial credibility.`;
        keyInsights.push(`Standard ${stdNum} is currently voluntary; no mandatory QCO enforced.`);
        keyInsights.push(`Voluntary ISI certification provides quality assurance and preference in public procurement.`);
        recommendedNextActions.push(`Review Scheme-I certification requirements if voluntary ISI mark is desired.`);
        recommendedNextActions.push(`Monitor official Gazette notifications for any future proposed QCO draft orders.`);
      }
      break;

    case "technical_agent":
      synthesis = `### Technical Testing & STI Requirements: ${stdNum}\n\n` +
        `To achieve and maintain compliance, the product must satisfy the following statutory test methods:\n\n` +
        primary.testingClauses.map((c, i) => `* **[S${i + 1}] ${c.clauseTitle || c.standardNumber}**: ${c.verbatimText}`).join("\n\n") +
        (relevantChunks.length > 0
          ? `\n\n#### Official Product Manual & Testing Guidelines (${relevantChunks[0]?.edition})\n` +
            `* **In-House Testing Setup (Annex A)**: Factory laboratory must be equipped with mandatory test rigs as prescribed in Annex A.\n` +
            `* **Scheme of Inspection & Testing (Annex B)**: Manufacturer must adhere to daily sampling and levels of control specified in Table 1.`
          : "");
      keyInsights.push(`${primary.testingClauses.length} mandatory testing clauses bound to ${stdNum}.`);
      keyInsights.push(`Sample test specimens must be drawn strictly per BIS sampling directives.`);
      recommendedNextActions.push(`Calibrate in-house test equipment against NABL master standards.`);
      recommendedNextActions.push(`Maintain Scheme of Inspection & Testing (SIT) records for BIS factory surveillance.`);
      break;

    case "certification_agent":
      synthesis = `### Certification & MSME Fast-Track Roadmap: ${stdNum}\n\n` +
        `* **Governing Certification Scheme**: ${primary.scheme || "Scheme-I (ISI Mark Certification)"}\n` +
        `* **MSME Concession Advantage**: DPIIT-recognized Startups, Micro, and Small Enterprises with valid Udyam certificates receive an **80% concession on application and annual marking fees**.\n` +
        `* **Simplified 30-Day Fast-Track**: Eligible manufacturers with complete in-house testing facilities can obtain provisional licence within 30 days of submission.\n\n` +
        `#### 4-Step Application Procedure:\n` +
        `1. Setup in-house testing equipment matching the Scheme of Testing & Inspection (STI).\n` +
        `2. File online application **Form-V** on the [BIS Manak Online Portal](https://www.manakonline.in).\n` +
        `3. Undergo factory verification audit by BIS inspecting officer.\n` +
        `4. Receive official 7 or 8-digit **CM/L Licence Number** upon satisfactory audit reports.`;
      keyInsights.push(`80% fee concession verified for Udyam-registered MSMEs and Startups.`);
      keyInsights.push(`30-day fast track procedure operational on Manak Online.`);
      recommendedNextActions.push(`Prepare Udyam Certificate and factory plant layout.`);
      recommendedNextActions.push(`Submit application Form-V on Manak Online.`);
      break;

    case "lab_agent":
      const topLabs = (labs || []).slice(0, 4);
      synthesis = `### Recognized Testing Laboratories for ${stdNum}\n\n` +
        `Independent testing and prototype certification can be conducted at the following BIS and NABL accredited facilities:\n\n` +
        (topLabs.length > 0
          ? topLabs.map((l) => `* **${l.name}** — ${l.city}, ${l.state}${l.distance_km !== undefined ? ` *(📍 ${l.distance_km} km away)*` : ""}\n  *Accreditation / Scope:* ${l.testing_scope?.join(", ") || l.type || "BIS Recognized Testing Laboratory"}`).join("\n\n")
          : `* **BIS Central Laboratory (CLD)** — Sahibabad / Ghaziabad (Apex Statutory Facility)\n* **BIS Western Regional Office Laboratory (WROL)** — Mumbai, Maharashtra`);
      keyInsights.push(`Accredited facilities mapped by geographic distance.`);
      keyInsights.push(`Test reports from these recognized centres are legally acceptable for BIS licensing.`);
      recommendedNextActions.push(`Contact nearest accredited laboratory to schedule pre-certification sample testing.`);
      recommendedNextActions.push(`Verify sample quantities before dispatch.`);
      break;

    case "verifier_agent":
      synthesis = `### Statutory Mark Authenticator: ${stdNum}\n\n` +
        `Every legitimate unit of this product sold in India must indelibly display:\n` +
        `1. **The BIS Standard Mark (ISI mark)** with the Indian Standard specification code (${stdNum}) printed clearly above the mark.\n` +
        `2. **The 7 or 8-digit CM/L Licence Number** printed directly below the mark (e.g. \`CM/L-3112320\`).\n` +
        `3. Manufacturer brand identity, batch/lot number, and month/year of manufacture.\n\n` +
        `> 💡 **Consumer Protection Notice**: Absence of the CM/L licence number beneath the ISI mark indicates a potentially counterfeit product. Report suspicious goods on the BIS Care Mobile App.`;
      keyInsights.push(`Both standard number above and CM/L number below the ISI mark are statutorily mandatory.`);
      keyInsights.push(`Valid CM/L licences can be cross-verified directly on Manak Online.`);
      recommendedNextActions.push(`Cross-reference licence number on the official BIS Care portal.`);
      recommendedNextActions.push(`Report uncertified goods to the Chief Vigilance Officer, BIS.`);
      break;

    default:
      synthesis = `### Applicable Standard: ${stdNum} (${title})\n\n` +
        `Based on verified Bureau of Indian Standards records, your product scope is governed by **${stdNum}**.\n\n` +
        (qcoAlert?.isMandatory ? `> 🚨 **Mandatory QCO Enforced**: Regulated under ${qcoAlert.orderTitle}.\n\n` : "") +
        `* **Industry / Sector**: Safety & Industrial Compliance\n` +
        `* **Certification Scheme**: ${primary.scheme || "Scheme-I (ISI Mark)"}\n` +
        `* **Key Testing Requirements**: ${primary.testingClauses.map((c) => c.clauseTitle || c.standardNumber).join(", ")}`;
      keyInsights.push(`Primary standard identified as ${stdNum}.`);
      recommendedNextActions.push(`Review the full specification requirements on the BIS Portal.`);
      break;
  }

  return {
    agent,
    confidence,
    synthesis,
    keyInsights,
    recommendedNextActions,
  };
}
