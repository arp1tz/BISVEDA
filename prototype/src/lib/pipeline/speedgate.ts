/**
 * BISVEDA — Canonical Verified FAQ Matcher (src/lib/pipeline/speedgate.ts, P12.2)
 *
 * Fast canonical question-and-answer layer for a handful of frequent BIS queries (e.g.
 * "what is hallmarking"). Only entries marked `verified: true` are ever served, and only after
 * two independent checks both pass: the static audit (`scripts/faq-verify.ts`, run by hand) and
 * the runtime guard in `matchCanonicalFaq` below (which re-checks every source against the live
 * KB and runs the answer through the trust gate on first use). Everything else in
 * `CANONICAL_FAQS` — most entries — is `verified: false`: real topics people ask about, kept
 * here for documentation, but never shortcut. Their questions run the full pipeline (retrieval
 * -> adjudication -> trust gate), which either finds real evidence or refuses honestly; this is
 * the intended behaviour, not a fallback path.
 *
 * `matchCanonicalFaq` returns null whenever nothing verified matches, and the caller proceeds to
 * that full pipeline exactly as it would for any other question.
 *
 * Note: Never expose internal layer names to end users.
 */

import type { BisvedaResponse } from "./respond";
import type { EvidencePackage, Source } from "./package";
import type { HallmarkCard, MarkCard } from "./respond";
import { getChunksByStandard } from "../kb/store";
import { runTrustGate } from "./trust";

export interface StandardReference {
  id: string;
  title: string;
  class: string;
  why: string;
}

export interface FaqSource {
  id?: string;
  label?: string;
  standard_id: string;
  clause: string;
  title: string;
  page: number;
  text: string;
  url?: string;
  source_url?: string;
}

export interface CanonicalFaqEntry {
  id: string;
  triggers: Array<string | RegExp>;
  keywords: string[]; // key tokens that must be present
  question: string;
  standards: StandardReference[];
  sources: FaqSource[];
  answer: (lang: string) => string;
  follow_ups: string[];
  cards?: {
    hallmark?: HallmarkCard;
    mark?: MarkCard;
  };
  /**
   * P12.2: set to `false` when a source's cited text isn't a real excerpt from the KB (checked
   * against `data/kb/chunks.json` by `scripts/faq-verify.ts` and re-checked at runtime below).
   * An unverified entry is never served — `matchCanonicalFaq` skips it and the question runs
   * through the full pipeline (retrieval -> trust gate), which either finds real evidence or
   * gives an honest "not in our documents" refusal. The entry stays in this file rather than
   * being deleted, so the topic and its trigger phrases are still documented here.
   */
  verified?: boolean;
}

export const CANONICAL_FAQS: CanonicalFaqEntry[] = [
  // ── 1. Gold Hallmarking & HUID ──────────────────────────────────────────
  // Verified against data/kb/chunks.json by scripts/faq-verify.ts: both sources below are
  // genuine excerpts from IS 15820, the standard that actually defines the term "hallmarking"
  // (IS 1417, our other gold document, never uses that word in the edition we hold).
  {
    id: "what-is-hallmarking",
    verified: true,
    triggers: [
      /\bwhat\s+(?:is|are)\s+(?:bis\s+)?hallmarking\b/i,
      /\bdefine\s+hallmarking\b/i,
      /\bhallmarking\s+(?:meaning|definition|concept|kya\s+hai)\b/i,
      /\bhallmarking\s+explained\b/i,
      /\babout\s+hallmarking\b/i,
    ],
    keywords: ["hallmark", "hallmarking"],
    question: "What is hallmarking of gold and silver articles?",
    standards: [
      { id: "IS 15820", title: "General Requirement for Competence of Assaying and Hallmarking Centres", class: "applies", why: "Defines hallmarking and sets the competence requirements for the centres that carry it out." },
      { id: "IS 1417", title: "Gold and Gold Alloys, Jewellery/Artefacts: Fineness and Marking", class: "applies", why: "Specifies the gold fineness grades that get marked." },
    ],
    sources: [
      { id: "S1", standard_id: "IS 15820", clause: "3.1", title: "Hallmarking (definition)", page: 6, text: "The accurate determination and official recording of the proportionate content of precious metal in precious metal articles.", source_url: "/api/docs/is-15820" },
      { id: "S2", standard_id: "IS 15820", clause: "3.2", title: "Fineness (definition)", page: 6, text: "The content of the named precious metal(s) measured in terms of parts per thousand by mass of alloy.", source_url: "/api/docs/is-15820" },
      { id: "S3", standard_id: "IS 15820", clause: "1", title: "Scope", page: 6, text: "standard covers general requirements for competence of assaying and hallmarking centres.", source_url: "/api/docs/is-15820" },
    ],
    answer: () =>
      `**Hallmarking** is the accurate determination and official recording of the proportionate content of precious metal in a precious metal article [S1]. The purity figure that gets marked, its fineness, is that content measured in parts per thousand by mass of alloy [S2].\n\nIn India, hallmarking is carried out by an Assaying and Hallmarking Centre (AHC) recognised by the Bureau of Indian Standards. **IS 15820** sets out the competence requirements such a centre must meet [S3], and **IS 1417** specifies the gold fineness grades that a jewellery article can be marked with.\n\nTo verify a specific piece of hallmarked jewellery, the official route is the BIS Care app or Manak Online, since checking an individual mark isn't something a standards document itself can tell you.`,
    follow_ups: [
      "What gold fineness grades does IS 1417 specify?",
      "What are Assaying and Hallmarking Centres required to do under IS 15820?",
    ],
  },

  {
    id: "what-is-huid",
    // P12.2: not verified against the KB (see scripts/faq-verify.ts) — kept for documentation
    // of the topic/triggers, but matchCanonicalFaq() never serves it. The question runs through
    // the full retrieval pipeline instead, which either finds real evidence or refuses honestly.
    verified: false,
    triggers: [
      /\bwhat\s+(?:is|are)\s+huid\b/i,
      /\bdefine\s+huid\b/i,
      /\bhuid\s+(?:meaning|full\s+form|kya\s+hai)\b/i,
      /\bhallmark\s+unique\s+identification\b/i,
      /\bhow\s+does\s+huid\s+work\b/i,
    ],
    keywords: ["huid"],
    question: "What is HUID (Hallmark Unique Identification)?",
    standards: [
      { id: "IS 1417", title: "Gold and Gold Alloys, Jewellery/Artefacts — Fineness and Marking", class: "applies", why: "Specifies HUID marking on gold jewellery." },
      { id: "IS 15820", title: "Assaying and Hallmarking Centres Competence", class: "applies", why: "Regulates HUID generation and laser marking at AHCs." },
    ],
    sources: [
      { id: "S1", standard_id: "IS 1417", clause: "Cl. 6.1.3", title: "HUID Laser Engraving", page: 4, text: "HUID is a 6-digit alphanumeric code assigned uniquely to each piece of gold jewellery at an authorized AHC.", source_url: "/api/docs/is-1417-2016" },
    ],
    answer: () =>
      `**HUID** stands for **Hallmark Unique Identification**. It is an official 6-character alphanumeric code (for example, \`AB12C3\`) laser-engraved onto every piece of hallmarked gold jewellery.\n\n### Key Features of HUID:\n- **Unique Traceability**: Every individual piece of jewellery receives its own distinct HUID at an accredited Assaying and Hallmarking Centre (AHC).\n- **Central BIS Portal Registration**: The HUID is uploaded to the central BIS database along with the jeweller's registration number, assay testing results, and piece weight.\n- **Consumer Protection**: Eliminates counterfeit hallmarking and under-karatage.\n- **Instant Verification**: Anyone can enter the 6 characters into the official **BIS Care App** under "Verify HUID" to view:\n  - Jeweller Registration Number & Name\n  - Assaying & Hallmarking Centre Name & BIS Recognition Number\n  - Article Type (e.g. Ring, Bangle, Necklace)\n  - Date of Hallmarking and Purity Grade.`,
    follow_ups: [
      "Can a jeweller sell hallmarked jewellery without an HUID?",
      "What are the official gold purity grades under IS 1417?",
      "How to register a jewellery shop under Form I?",
    ],
  },

  {
    id: "what-is-916-gold",
    // P12.2: not verified against the KB (see scripts/faq-verify.ts) — kept for documentation
    // of the topic/triggers, but matchCanonicalFaq() never serves it. The question runs through
    // the full retrieval pipeline instead, which either finds real evidence or refuses honestly.
    verified: false,
    triggers: [
      /\bwhat\s+is\s+916\s+(?:gold|hallmark)?\b/i,
      /\bwhat\s+does\s+916\s+mean\b/i,
      /\b22k\s+(?:vs|or)?\s*916\b/i,
      /\b916\s+gold\s+purity\b/i,
    ],
    keywords: ["916"],
    question: "What is 916 gold and 22 Karat purity?",
    standards: [
      { id: "IS 1417", title: "Gold and Gold Alloys, Jewellery/Artefacts — Fineness and Marking", class: "applies", why: "Defines 22K / 916 fineness grade." },
    ],
    sources: [
      { id: "S1", standard_id: "IS 1417", clause: "Table 1", title: "Fineness Grades of Gold Alloys", page: 3, text: "Grade 22K corresponds to a minimum fineness of 916 parts per thousand (91.6% pure gold).", source_url: "/api/docs/is-1417-2016" },
    ],
    answer: () =>
      `**916 gold** represents **22 Karat gold**, which is the most popular standard for gold jewellery in India.\n\n### Purity Breakdown:\n- **916** denotes parts per thousand: **916 parts out of 1000 are pure gold**, or **91.6% pure gold** by weight.\n- The remaining 8.4% consists of alloying metals (such as copper and silver) added to provide durability and mechanical strength, since pure 24K gold is too soft for intricate jewellery.\n\nUnder **IS 1417**, official hallmarking marks this grade as **22K916** alongside the BIS triangle logo and 6-digit HUID.`,
    follow_ups: [
      "What other gold purity grades are recognized under IS 1417?",
      "How to verify 916 gold with HUID?",
      "Can 24 karat gold be hallmarked?",
    ],
    cards: {
      hallmark: { purity_karat: "22K", purity_fineness: "916", huid_format_valid: true },
    },
  },

  // Verified against data/kb/chunks.json: the scope and terminology clauses quoted below are
  // real excerpts. The full 8-grade fineness table (clause 4.1) also exists in the document, but
  // the extracted text for that specific table is corrupted by a known 2-column PDF layout issue
  // (see progress.md), so its numbers cannot be reliably paired to a karat, we say so honestly.
  {
    id: "gold-purity-grades-is1417",
    verified: true,
    triggers: [
      /\b(?:what\s+are\s+the\s+)?purity\s+grades\s+(?:under|for|in)\s+is\s*1417\b/i,
      /\bgold\s+karat\s+grades\s+in\s+india\b/i,
      /\bwhich\s+gold\s+purities\s+can\s+be\s+hallmarked\b/i,
      /\ballowed\s+gold\s+grades\b/i,
    ],
    keywords: ["purity", "grade", "gold"],
    question: "What gold purity grades and terminology does IS 1417 define?",
    standards: [
      { id: "IS 1417", title: "Gold and Gold Alloys, Jewellery/Artefacts: Fineness and Marking", class: "applies", why: "Defines gold grades, carat, and fineness terminology." },
    ],
    sources: [
      { id: "S1", standard_id: "IS 1417", clause: "1.1", title: "Scope", page: 10, text: "This standard specifies eight grades of gold, used", source_url: "/api/docs/is-1417" },
      { id: "S2", standard_id: "IS 1417", clause: "3.2", title: "Carat (definition)", page: 10, text: "One-twenty fourth part by mass of the metallic element", source_url: "/api/docs/is-1417" },
      { id: "S3", standard_id: "IS 1417", clause: "3.4", title: "Fine Gold (definition)", page: 10, text: "It is gold having fineness 999 parts per thousand", source_url: "/api/docs/is-1417" },
      { id: "S4", standard_id: "IS 1417", clause: "3.7", title: "Standard Gold (definition)", page: 10, text: "Gold having fineness 995 parts per thousand", source_url: "/api/docs/is-1417" },
    ],
    answer: () =>
      `**IS 1417** specifies eight grades of gold used in the manufacture of jewellery and artefacts, based on their gold content [S1].\n\nSome of the terms it defines:\n- **Carat**: one twenty-fourth part by mass of the metallic element gold [S2].\n- **Fineness**: the ratio of gold content to total mass, expressed in parts per thousand.\n- **Fine Gold**: gold with a fineness of 999 parts per thousand or above [S3].\n- **Standard Gold**: gold with a fineness of 995 parts per thousand or above [S4].\n\nThe document also gives the full grade table linking each karat to its exact fineness, but the extracted text for that specific table is too garbled to quote reliably here. Ask about a specific karat and BISVEDA will search the standard directly rather than guess.`,
    follow_ups: [
      "What does an Assaying and Hallmarking Centre do under IS 15820?",
      "What is the difference between fine gold and standard gold?",
    ],
  },

  {
    id: "is-hallmarking-mandatory",
    // P12.2: not verified against the KB (see scripts/faq-verify.ts) — kept for documentation
    // of the topic/triggers, but matchCanonicalFaq() never serves it. The question runs through
    // the full retrieval pipeline instead, which either finds real evidence or refuses honestly.
    verified: false,
    triggers: [
      /\bis\s+hallmarking\s+mandatory\b/i,
      /\bis\s+gold\s+hallmarking\s+compulsory\b/i,
      /\bhallmarking\s+mandatory\s+rules\b/i,
      /\bwho\s+must\s+get\s+hallmarking\b/i,
    ],
    keywords: ["mandatory", "hallmarking"],
    question: "Is gold hallmarking mandatory in India?",
    standards: [
      { id: "IS 1417", title: "Gold and Gold Alloys — Fineness and Marking", class: "applies", why: "Specifies marking compliance." },
    ],
    sources: [
      { id: "S1", standard_id: "IS 1417", clause: "Govt Order 2021/2023", title: "Compulsory Hallmarking Order", page: 1, text: "Hallmarking of gold jewellery is mandatory across notified districts in India under the Hallmarking Order.", source_url: "/api/docs/is-1417-2016" },
    ],
    answer: () =>
      `**Yes, gold hallmarking is mandatory in India.**\n\n- The Government of India, through the Ministry of Consumer Affairs, Food & Public Distribution and BIS, has implemented **mandatory hallmarking** in phases across more than **350+ notified districts** covering all major consumer areas.\n- In notified districts, registered jewellers **cannot sell un-hallmarked gold jewellery or artefacts**.\n- Since April 1, 2023, sale of gold jewellery without the **6-digit HUID** is strictly prohibited.\n- **Exemptions**: Jewellers with an annual turnover up to ₹40 lakh, articles weighing less than 2 grams, export jewellery, and medical/industrial gold are exempt from mandatory hallmarking.`,
    follow_ups: [
      "What is the penalty for selling unhallmarked gold jewellery?",
      "How to register a jewellery business for hallmarking under Form I?",
    ],
  },

  {
    id: "how-to-verify-huid",
    // P12.2: not verified against the KB (see scripts/faq-verify.ts) — kept for documentation
    // of the topic/triggers, but matchCanonicalFaq() never serves it. The question runs through
    // the full retrieval pipeline instead, which either finds real evidence or refuses honestly.
    verified: false,
    triggers: [
      /\bhow\s+to\s+verify\s+huid\b/i,
      /\bhow\s+to\s+check\s+huid\b/i,
      /\bverify\s+huid\s+in\s+bis\s+care\b/i,
      /\bcheck\s+gold\s+hallmark\s+online\b/i,
    ],
    keywords: ["verify", "huid"],
    question: "How do I verify a 6-digit HUID code?",
    standards: [
      { id: "IS 1417", title: "Gold and Gold Alloys Fineness and Marking", class: "applies", why: "Defines HUID." },
    ],
    sources: [
      { id: "S1", standard_id: "IS 1417", clause: "Cl. 6.1", title: "Consumer Verification", page: 4, text: "Consumers can verify HUID numbers on the BIS Care mobile app or Manak Online portal.", source_url: "/api/docs/is-1417-2016" },
    ],
    answer: () =>
      `You can verify any 6-digit HUID in real time using the official **BIS Care App**:\n\n1. Download the free **BIS Care App** from Google Play Store or Apple App Store.\n2. Tap on **"Verify HUID"** on the home screen.\n3. Enter the 6-character alphanumeric code etched on the jewellery (e.g., \`AB12C3\`).\n4. Tap **Search / Submit**.\n5. The app displays:\n   - **Jeweller Name and Registration Number**\n   - **Assaying & Hallmarking Centre (AHC) Name and Registration**\n   - **Article Type** (e.g. Ring, Chain, Earring)\n   - **Purity Grade** (e.g. 22K916)\n   - **Date of Hallmarking**.\n\nIf the HUID does not appear or shows invalid details, report the violation directly through the app's complaint portal.`,
    follow_ups: [
      "What should I do if the HUID is not recognized in BIS Care?",
      "Where are recognized Assaying and Hallmarking Centres located?",
    ],
  },

  // ── 2. Helmets & Head Protection ─────────────────────────────────────────
  {
    id: "what-is-is-4151",
    // P12.2: not verified against the KB (see scripts/faq-verify.ts) — kept for documentation
    // of the topic/triggers, but matchCanonicalFaq() never serves it. The question runs through
    // the full retrieval pipeline instead, which either finds real evidence or refuses honestly.
    verified: false,
    triggers: [
      /\bwhat\s+is\s+is\s*4151\b/i,
      /\bis\s*4151\s+(?:scope|summary|specification|kya\s+hai)\b/i,
      /\bmotorcycle\s+helmet\s+standard\s+in\s+india\b/i,
      /\btwo\s*wheeler\s+helmet\s+standard\b/i,
    ],
    keywords: ["4151", "helmet"],
    question: "What is Indian Standard IS 4151 for motorcycle helmets?",
    standards: [
      { id: "IS 4151", title: "Protective Helmets for Motorcycle Riders — Specification", class: "applies", why: "Primary standard for motorcycle rider helmets in India." },
    ],
    sources: [
      { id: "S1", standard_id: "IS 4151", clause: "Cl. 1", title: "Scope of IS 4151", page: 1, text: "This standard covers the requirements regarding materials, construction, workmanship, finish and performance for protective helmets for everyday motorcycle riders.", source_url: "/api/docs/is-4151-2015" },
      { id: "S2", standard_id: "IS 4151", clause: "Cl. 6", title: "Physical & Performance Requirements", page: 7, text: "Specifies impact attenuation, retention system, audibility, and peripheral vision tests.", source_url: "/api/docs/is-4151-2015" },
    ],
    answer: () =>
      `**IS 4151** (*Protective Helmets for Motorcycle Riders — Specification*) is the mandatory Indian Standard governing protective helmets worn by riders and pillion passengers of two-wheeled motor vehicles in India.\n\n### Key Requirements under IS 4151:\n1. **Impact Attenuation Test (Cl. 6.4)**: The helmet is dropped onto flat and kerbstone steel anvils from specific drop heights. Peak deceleration must not exceed **300 g**, ensuring severe head trauma prevention.\n2. **Retention System & Chin Strap (Cl. 6.6)**: The chin strap must withstand dynamic drop loads without stretching more than 25 mm or breaking, and buckle mechanisms must prevent accidental release.\n3. **Peripheral Vision (Cl. 6.1)**: Requires an unobstructed horizontal field of view of at least **105°** on either side of the midline.\n4. **Maximum Weight (Cl. 4.2)**: Helmets must not exceed **1.2 kg (1200 grams)** to reduce neck strain.\n5. **Mandatory QCO Compliance**: Under the Two-Wheeler Helmets (Quality Control) Order, no two-wheeler helmet can be manufactured, imported, or sold in India without an authentic **ISI mark** and valid **CM/L licence**.`,
    follow_ups: [
      "Is an ISI marked helmet mandatory by law in India?",
      "What is the difference between IS 4151 and IS 2925?",
      "Where can I find BIS-recognised testing labs for helmets?",
    ],
  },

  {
    id: "is-helmet-mandatory-qco",
    // P12.2: not verified against the KB (see scripts/faq-verify.ts) — kept for documentation
    // of the topic/triggers, but matchCanonicalFaq() never serves it. The question runs through
    // the full retrieval pipeline instead, which either finds real evidence or refuses honestly.
    verified: false,
    triggers: [
      /\bis\s+helmet\s+mandatory\s+(?:under|by)\s+qco\b/i,
      /\bis\s+isi\s+helmet\s+compulsory\b/i,
      /\bis\s+it\s+illegal\s+to\s+sell\s+non\s*isi\s+helmets\b/i,
      /\bhelmet\s+qco\s+rules\b/i,
    ],
    keywords: ["mandatory", "helmet"],
    question: "Is an ISI-marked helmet mandatory under Quality Control Orders in India?",
    standards: [
      { id: "IS 4151", title: "Protective Helmets for Motorcycle Riders", class: "applies", why: "Enforced under the mandatory QCO." },
    ],
    sources: [
      { id: "S1", standard_id: "IS 4151", clause: "QCO 2020", title: "Helmets (Quality Control) Order", page: 1, text: "Under Ministry of Road Transport and Highways (MoRTH) notification and BIS Act Section 16, protective helmets for motorcycle riders must conform to IS 4151 and bear the Standard Mark.", source_url: "/api/docs/is-4151-2015" },
    ],
    answer: () =>
      `**Yes, wearing and selling ISI-marked helmets conforming to IS 4151 is strictly mandatory in India.**\n\n### Legal Enforcement:\n- **Motor Vehicles Act & MoRTH QCO**: Under the *Two-Wheeler Helmets (Quality Control) Order*, all motorcycle helmets manufactured, imported, stored, or sold in India must conform to **IS 4151:2015** and carry the official **ISI mark** with a 7 or 8-digit **CM/L licence number**.\n- **Prohibition on Non-ISI Helmets**: Selling, stocking, or manufacturing non-ISI or substandard helmets is a punishable criminal offence under Section 17 & 29 of the BIS Act, 2016.\n- **Penalties**: Up to **2 years imprisonment** and a fine of at least ₹2,00,000 (or up to 10 times the value of goods produced/sold).\n- **Traffic Police Enforcement**: Riding with a non-ISI helmet or non-conforming industrial cap attracts fines under Section 129 & 194D of the Motor Vehicles (Amendment) Act.`,
    follow_ups: [
      "How to check if an ISI mark on a helmet is genuine?",
      "Can construction helmets (IS 2925) be used for motorcycle riding?",
    ],
  },

  {
    id: "difference-is4151-vs-is2925",
    // P12.2: not verified against the KB (see scripts/faq-verify.ts) — kept for documentation
    // of the topic/triggers, but matchCanonicalFaq() never serves it. The question runs through
    // the full retrieval pipeline instead, which either finds real evidence or refuses honestly.
    verified: false,
    triggers: [
      /\bdifference\s+between\s+is\s*4151\s+and\s+is\s*2925\b/i,
      /\bis\s*4151\s+vs\s+is\s*2925\b/i,
      /\bcan\s+i\s+wear\s+(?:a\s+)?construction\s+helmet\s+on\s+(?:a\s+)?bike\b/i,
      /\bindustrial\s+vs\s+motorcycle\s+helmet\b/i,
    ],
    keywords: ["4151", "2925"],
    question: "What is the difference between IS 4151 and IS 2925 helmets?",
    standards: [
      { id: "IS 4151", title: "Protective Helmets for Motorcycle Riders", class: "applies", why: "For vehicular road impact." },
      { id: "IS 2925", title: "Industrial Safety Helmets", class: "applies", why: "For falling objects on construction/industrial sites." },
    ],
    sources: [
      { id: "S1", standard_id: "IS 4151", clause: "Cl. 1", title: "Scope of Motorcycle Helmets", page: 1, text: "Designed for high-speed kinetic vehicular impact on roads.", source_url: "/api/docs/is-4151-2015" },
      { id: "S2", standard_id: "IS 2925", clause: "Cl. 1", title: "Scope of Industrial Helmets", page: 1, text: "Designed to protect workers against falling objects and electrical shock on industrial/construction sites.", source_url: "/api/docs/is-2925-1984" },
    ],
    answer: () =>
      `**IS 4151** and **IS 2925** serve completely different protection environments and are **not interchangeable**:\n\n| Feature | Motorcycle Helmets (**IS 4151**) | Industrial Safety Helmets (**IS 2925**) |\n|---|---|---|\n| **Primary Danger** | High-velocity vehicle crash, road abrasion, multi-directional impacts | Overhead falling objects, sharp vertical drops, electrical hazards |\n| **Design** | Full-face or open-face with EPS foam liner, thick shell, visor, chin strap | Hard shell with suspended internal harness (cradle); no heavy foam liner |\n| **Impact Attenuation** | Drop from ~2.8m onto steel anvils; peak deceleration < 300 g | 5 kg striker dropped from 1 meter; force transmitted < 5.0 kN |\n| **Road Legality** | **Mandatory & Legal** for two-wheeler riding | **Illegal** for motorcycle riding on public roads |\n\n> **Warning**: Wearing an industrial hard hat (IS 2925) while riding a motorcycle provides almost no protection in a vehicular collision and violates the Motor Vehicles Act.`,
    follow_ups: [
      "What tests are conducted on IS 2925 industrial helmets?",
      "What are the marking requirements on IS 4151 helmets?",
    ],
  },

  // ── 3. Toys & Child Safety ────────────────────────────────────────────────
  {
    id: "bis-standards-for-toys",
    // P12.2: not verified against the KB (see scripts/faq-verify.ts) — kept for documentation
    // of the topic/triggers, but matchCanonicalFaq() never serves it. The question runs through
    // the full retrieval pipeline instead, which either finds real evidence or refuses honestly.
    verified: false,
    triggers: [
      /\bwhat\s+are\s+the\s+(?:bis\s+)?standards\s+for\s+toys\b/i,
      /\btoy\s+safety\s+standards\s+in\s+india\b/i,
      /\bis\s+9873\s+and\s+is\s*15644\b/i,
      /\bstandards\s+applicable\s+to\s+toys\b/i,
    ],
    keywords: ["toy", "toys", "safety"],
    question: "What Indian Standards apply to toys in India?",
    standards: [
      { id: "IS 9873 (Part 1)", title: "Safety of Toys — Part 1: Mechanical and Physical Properties", class: "applies", why: "Covers mechanical hazards, choking risks, small parts, and sharp edges." },
      { id: "IS 9873 (Part 3)", title: "Safety of Toys — Part 3: Migration of Certain Elements", class: "applies", why: "Specifies maximum limits for toxic heavy metals (lead, cadmium, mercury, etc.)." },
      { id: "IS 15644", title: "Safety of Electric Toys", class: "applies", why: "Mandatory for battery-operated, electric, and remote-controlled toys." },
    ],
    sources: [
      { id: "S1", standard_id: "IS 9873 (Part 1)", clause: "Cl. 1", title: "Mechanical Safety", page: 1, text: "Applies to toys intended for children under 14 years.", source_url: "/api/docs/is-9873-1-2019" },
      { id: "S2", standard_id: "IS 9873 (Part 3)", clause: "Table 1", title: "Heavy Metal Migration Limits", page: 3, text: "Antimony, Arsenic, Barium, Cadmium, Chromium, Lead, Mercury, Selenium.", source_url: "/api/docs/is-9873-3-2017" },
    ],
    answer: () =>
      `Under the mandatory **Toys (Quality Control) Order, 2020**, all toys for children under 14 years old must conform to the following Indian Standards and bear the **ISI mark**:\n\n1. **Non-Electric Toys (Scheme I — ISI Mark)**:\n   - **IS 9873 (Part 1)**: Mechanical and Physical properties — tests for choking hazards (small parts cylinder for kids under 36 months), sharp edges, drop tests, and strangulation cords.\n   - **IS 9873 (Part 2)**: Flammability requirements.\n   - **IS 9873 (Part 3)**: Migration of Certain Elements — strict maximum chemical limits for 8 heavy metals (Lead, Mercury, Cadmium, Arsenic, Antimony, Barium, Chromium, Selenium).\n\n2. **Electric Toys (Scheme I — ISI Mark)**:\n   - **IS 15644**: Electrical safety — battery enclosure security, maximum voltage limits (<= 24V DC), heating, radiation, and insulation.\n   - *Plus* IS 9873 Parts 1, 2, and 3 for mechanical and chemical safety.\n\nSelling imported or domestic toys without an authentic ISI mark is illegal in India.`,
    follow_ups: [
      "Can toys be sold without an ISI mark in India?",
      "What heavy metals are restricted under IS 9873 Part 3?",
      "How to obtain a BIS licence for manufacturing toys?",
    ],
  },

  {
    id: "is-toy-certification-mandatory",
    // P12.2: not verified against the KB (see scripts/faq-verify.ts) — kept for documentation
    // of the topic/triggers, but matchCanonicalFaq() never serves it. The question runs through
    // the full retrieval pipeline instead, which either finds real evidence or refuses honestly.
    verified: false,
    triggers: [
      /\bis\s+bis\s+certification\s+mandatory\s+for\s+toys\b/i,
      /\bcan\s+toys\s+be\s+sold\s+without\s+isi\s+mark\b/i,
      /\btoy\s+qco\s+rules\b/i,
      /\btoy\s+quality\s+control\s+order\b/i,
    ],
    keywords: ["mandatory", "toy"],
    question: "Is BIS certification mandatory for selling toys in India?",
    standards: [
      { id: "IS 9873 (Part 1)", title: "Safety of Toys — Physical Properties", class: "applies", why: "Mandatory standard for all toys." },
      { id: "IS 15644", title: "Safety of Electric Toys", class: "applies", why: "Mandatory for electric toys." },
    ],
    sources: [
      { id: "S1", standard_id: "IS 9873 (Part 1)", clause: "Toys QCO 2020", title: "Toys Quality Control Order 2020", page: 1, text: "Enforced from 1st January 2021 by Ministry of Commerce and Industry under BIS Act 2016 Section 16.", source_url: "/api/docs/is-9873-1-2019" },
    ],
    answer: () =>
      `**Yes, BIS certification with the ISI mark is 100% mandatory for all toys sold in India.**\n\n### Key Regulations:\n- **Effective Date**: Enforced since **January 1, 2021** under the *Toys (Quality Control) Order, 2020* issued by the Department for Promotion of Industry and Internal Trade (DPIIT).\n- **Scope**: Covers all toys intended for use in play by children under 14 years of age, whether manufactured domestically or imported from abroad.\n- **Foreign Manufacturers**: Must obtain a valid BIS licence under the Foreign Manufacturers Certification Scheme (FMCS) before shipping toys into India.\n- **Consequences**: Uncertified toys are subject to immediate seizure by customs/BIS enforcement officers, and offenders face heavy fines and prosecution under the BIS Act, 2016.`,
    follow_ups: [
      "What are the specific requirements for electric toys under IS 15644?",
      "How can consumers verify the ISI mark on a toy box?",
    ],
  },

  // ── 4. General BIS, ISI Mark, CM/L & Procedures ─────────────────────────
  {
    id: "what-is-isi-mark",
    // P12.2: not verified against the KB (see scripts/faq-verify.ts) — kept for documentation
    // of the topic/triggers, but matchCanonicalFaq() never serves it. The question runs through
    // the full retrieval pipeline instead, which either finds real evidence or refuses honestly.
    verified: false,
    triggers: [
      /\bwhat\s+is\s+(?:an?\s+)?isi\s+mark\b/i,
      /\bdefine\s+isi\s+mark\b/i,
      /\bisi\s+mark\s+(?:meaning|details|kya\s+hai)\b/i,
      /\bhow\s+to\s+identify\s+isi\s+mark\b/i,
    ],
    keywords: ["isi", "mark"],
    question: "What is the ISI mark and what information must appear with it?",
    standards: [
      { id: "IS 4151", title: "Protective Helmets", class: "applies", why: "Example of Scheme I ISI mark application." },
    ],
    sources: [
      { id: "S1", standard_id: "IS 4151", clause: "Cl. 7.1", title: "Marking of Standard Mark", page: 11, text: "The Standard Mark (ISI mark) consists of the monogram, Indian Standard number above, and licence number (CM/L) below.", source_url: "/api/docs/is-4151-2015" },
    ],
    answer: () =>
      `The **ISI mark** is the official conformity mark issued by the Bureau of Indian Standards (BIS) under its **Scheme I (Product Certification Scheme)**. It certifies that an industrial or consumer product conforms to the relevant Indian Standard.\n\n### Anatomy of a Genuine ISI Mark:\nA genuine ISI mark is **never just the logo alone**. It must always include 3 components:\n1. **The ISI Monogram** (the distinctive geometric 'ISI' symbol).\n2. **The Indian Standard Number on Top** (e.g., \`IS 4151\` for helmets, \`IS 9873 (Part 1)\` for toys).\n3. **The CM/L Licence Number at the Bottom** (e.g., \`CM/L-1234567\`), which is a 7 or 8-digit unique factory licence number.\n\nConsumers can verify any CM/L licence number for free in the **BIS Care App** under "Verify License Details".`,
    follow_ups: [
      "How do I verify a CM/L licence number in the BIS Care app?",
      "What is the difference between ISI mark and Hallmarking?",
      "What is a Quality Control Order (QCO)?",
    ],
  },

  {
    id: "what-is-cml-number",
    // P12.2: not verified against the KB (see scripts/faq-verify.ts) — kept for documentation
    // of the topic/triggers, but matchCanonicalFaq() never serves it. The question runs through
    // the full retrieval pipeline instead, which either finds real evidence or refuses honestly.
    verified: false,
    triggers: [
      /\bwhat\s+is\s+(?:a\s+)?cm\/?l\s+(?:number|licence|license)\b/i,
      /\bhow\s+many\s+digits\s+is\s+cm\/?l\b/i,
      /\bcm\/?l\s+meaning\b/i,
      /\bhow\s+to\s+verify\s+cm\/?l\b/i,
    ],
    keywords: ["cml", "licence"],
    question: "What is a CM/L licence number and how is it verified?",
    standards: [
      { id: "IS 4151", title: "Protective Helmets", class: "applies", why: "Specifies CM/L marking." },
    ],
    sources: [
      { id: "S1", standard_id: "IS 4151", clause: "Cl. 7.1", title: "CM/L Marking", page: 11, text: "The licence number (CM/L-XXXXXXXX) is granted to a specific manufacturing unit following factory inspection.", source_url: "/api/docs/is-4151-2015" },
    ],
    answer: () =>
      `**CM/L** stands for **Certification / Licence**. It is a unique **7 or 8-digit licence number** granted by the Bureau of Indian Standards to a specific manufacturing facility for producing a certified product.\n\n### Format:\n- Appears directly under the ISI mark as: \`CM/L - XXXXXXX\` (7 digits) or \`CM/L - XXXXXXXX\` (8 digits).\n- It is manufacturer- and plant-specific (different factories of the same brand have different CM/L numbers).\n\n### How to Verify Authenticity:\n1. Open the **BIS Care App**.\n2. Tap **"Verify Licence Details"**.\n3. Enter the 7 or 8 digits.\n4. You will see: Manufacturer Name, Factory Address, Brand Names covered, Standard Number, and Validity Status (Operative, Suspended, or Expired).`,
    follow_ups: [
      "What should I do if a CM/L number shows 'Expired' or 'Suspended'?",
      "How can a manufacturer apply for a CM/L licence?",
    ],
  },

  {
    id: "what-is-qco",
    // P12.2: not verified against the KB (see scripts/faq-verify.ts) — kept for documentation
    // of the topic/triggers, but matchCanonicalFaq() never serves it. The question runs through
    // the full retrieval pipeline instead, which either finds real evidence or refuses honestly.
    verified: false,
    triggers: [
      /\bwhat\s+is\s+(?:a\s+)?qco\b/i,
      /\bquality\s+control\s+order\s+meaning\b/i,
      /\bexplain\s+qco\b/i,
      /\bhow\s+are\s+qcos\s+issued\b/i,
    ],
    keywords: ["qco", "quality", "order"],
    question: "What is a Quality Control Order (QCO) issued by the Government?",
    standards: [
      { id: "IS 4151", title: "Protective Helmets", class: "applies", why: "Example of standard under mandatory QCO." },
    ],
    sources: [
      { id: "S1", standard_id: "IS 4151", clause: "BIS Act Sec 16", title: "Section 16 of BIS Act 2016", page: 1, text: "Empowers the Central Government to notify mandatory conformity to Indian Standards in public interest.", source_url: "/api/docs/is-4151-2015" },
    ],
    answer: () =>
      `A **Quality Control Order (QCO)** is an official technical regulation issued by the Central Government under **Section 16 of the Bureau of Indian Standards Act, 2016**.\n\n### Key Aspects of a QCO:\n- **Mandatory Compliance**: While standardisation in India is generally voluntary, products notified under a QCO become **legally mandatory**.\n- **Scope**: No person can manufacture, import, distribute, sell, hire, or exhibit for sale any product covered by a QCO without conforming to the specified Indian Standard and bearing the official Standard Mark (ISI mark).\n- **Public Interest**: QCOs are notified for public safety, consumer health, environment protection, prevention of deceptive practices, and national security.\n- **Examples**: Motorcycle Helmets (IS 4151), Toys (IS 9873 / IS 15644), Pressure Cookers, Drinking Water, and Steel Products.`,
    follow_ups: [
      "Which products are currently under mandatory QCOs?",
      "What are the penalties for violating a QCO in India?",
    ],
  },

  {
    id: "what-is-bis-care-app",
    // P12.2: not verified against the KB (see scripts/faq-verify.ts) — kept for documentation
    // of the topic/triggers, but matchCanonicalFaq() never serves it. The question runs through
    // the full retrieval pipeline instead, which either finds real evidence or refuses honestly.
    verified: false,
    triggers: [
      /\bwhat\s+is\s+(?:the\s+)?bis\s+care\s+app\b/i,
      /\bhow\s+to\s+use\s+bis\s+care\s+app\b/i,
      /\bfeatures\s+of\s+bis\s+care\b/i,
      /\bwhere\s+to\s+download\s+bis\s+care\b/i,
    ],
    keywords: ["care", "app"],
    question: "What is the BIS Care App and what can consumers do with it?",
    standards: [
      { id: "IS 1417", title: "Gold Hallmarking", class: "applies", why: "Used for HUID verification." },
    ],
    sources: [
      { id: "S1", standard_id: "IS 1417", clause: "BIS Digital Portal", title: "BIS Care Consumer Portal", page: 1, text: "Official mobile application launched by BIS for consumer verification and grievance redressal.", source_url: "/api/docs/is-1417-2016" },
    ],
    answer: () =>
      `The **BIS Care App** is the official mobile application created by the Bureau of Indian Standards to empower consumers to verify product quality marks and register complaints.\n\n### Key Features:\n1. **Verify HUID**: Enter the 6-digit code on gold jewellery to confirm jeweller name, testing centre, purity, and date.\n2. **Verify ISI / CM/L**: Enter the 7-8 digit licence number to confirm if the manufacturer's licence is currently active.\n3. **Verify CRS (Compulsory Registration Scheme)**: Verify electronic and IT goods registration numbers (R-numbers).\n4. **Know Your Standards**: Look up Indian Standards and product specifications.\n5. **File Complaints**: Submit photographic evidence of fake ISI marks, hallmarking fraud, or substandard products directly to BIS enforcement wings. Complaints are tracked with an official docket number.`,
    follow_ups: [
      "How do I file a complaint about a counterfeit ISI mark?",
      "How to verify an ISI helmet using the app?",
    ],
  },

  {
    id: "form-i-jeweller-registration-process",
    // P12.2: not verified against the KB (see scripts/faq-verify.ts) — kept for documentation
    // of the topic/triggers, but matchCanonicalFaq() never serves it. The question runs through
    // the full retrieval pipeline instead, which either finds real evidence or refuses honestly.
    verified: false,
    triggers: [
      /\bhow\s+to\s+register\s+(?:as\s+a\s+)?jeweller\s+for\s+hallmarking\b/i,
      /\bwhat\s+is\s+form\s+i\b/i,
      /\bjeweller\s+registration\s+procedure\b/i,
      /\bdocuments\s+required\s+for\s+jeweller\s+hallmarking\s+registration\b/i,
    ],
    keywords: ["form", "jeweller", "registration"],
    question: "How do jewellers register for BIS Hallmarking under Form I?",
    standards: [
      { id: "IS 1417", title: "Gold Hallmarking", class: "applies", why: "Scheme requires registration under Form I." },
      { id: "IS 15820", title: "AHC Competence", class: "applies", why: "Registered jewellers submit articles to recognized AHCs." },
    ],
    sources: [
      { id: "S1", standard_id: "IS 1417", clause: "Form I Guidelines", title: "Application for Certificate of Registration", page: 1, text: "Form I is the statutory application for jewellers to sell hallmarked gold/silver articles.", source_url: "/api/docs/form-i-jeweller" },
    ],
    answer: () =>
      `Under the BIS Hallmarking Scheme, any jeweller selling gold or silver hallmarked articles must hold a valid **Certificate of Registration** granted under **Form I**.\n\n### Key Steps in Registration:\n1. **Online Application**: Applied via the **Manak Online** portal (\`www.manakonline.in\`). Registration is paperless and granted automatically upon fee payment.\n2. **Required Details (13 Fields)**:\n   - Trade / Legal Name of the Jeweller\n   - Address of each sales outlet with PIN code and contact info\n   - Constitution of the firm (Proprietorship, Partnership, Pvt Ltd, PSU)\n   - Identity & Address proof of authorized signatory (Aadhaar, PAN, GST)\n   - Proof of premises (GST certificate, rent agreement, sale deed)\n   - Annual Turnover declaration.\n3. **Fees**: Zero registration fee for micro enterprises (turnover < ₹5 crore in certain categories) or a nominal slab-based fee.\n4. **Validity**: The certificate is valid for a **lifetime** (no annual renewal required).\n\nYou can draft your Form I application right here in BISVEDA by telling me your firm name and outlet address.`,
    follow_ups: [
      "Can I draft Form I registration right now?",
      "What is the turnover fee slab for jewellers?",
    ],
  },
];

/**
 * Normalizes query string for canonical matching.
 */
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same normalization, used for comparing a cited quote against real KB chunk text. */
function normalizeForVerify(text: string): string {
  return normalizeForMatching(text);
}

/**
 * True if `quote` (normalized: lowercase, punctuation-insensitive, whitespace-collapsed) is a
 * real substring of at least one chunk of `standardId` in the live knowledge base. This is the
 * one check that decides whether an FAQ source is a genuine citation or a fabricated one.
 * Exported so `scripts/faq-verify.ts` can run the same check offline over the whole file.
 */
export function quoteExistsInKb(standardId: string, quote: string): boolean {
  const target = normalizeForVerify(quote);
  if (!target) return false;
  return getChunksByStandard(standardId).some((c) => normalizeForVerify(c.text).includes(target));
}

/** Checks every source of one FAQ against the KB. Used by both the audit script and the runtime guard below. */
export function verifyFaqSources(faq: CanonicalFaqEntry): Array<{ source: FaqSource; ok: boolean }> {
  return faq.sources.map((s) => ({ source: s, ok: quoteExistsInKb(s.standard_id, s.text) }));
}

// Runtime guard result, cached per FAQ id so the (cheap, but not free) checks below run once per
// server process rather than on every matching query.
const runtimeVerifyCache = new Map<string, boolean>();

/** True only if every source is a real KB excerpt AND the answer's own claims pass the trust gate. */
function passesRuntimeGuard(faq: CanonicalFaqEntry): boolean {
  const cached = runtimeVerifyCache.get(faq.id);
  if (cached !== undefined) return cached;

  const sourcesOk = verifyFaqSources(faq).every((r) => r.ok);
  let ok = sourcesOk;
  if (sourcesOk) {
    const pkg: EvidencePackage = {
      primary_standard: faq.standards[0] ? { id: faq.standards[0].id, title: faq.standards[0].title } : null,
      standards: faq.standards,
      sources: faq.sources.map((s, idx) => ({
        label: s.label || s.id || `S${idx + 1}`,
        standard_id: s.standard_id,
        title: s.title,
        clause: s.clause,
        page: s.page,
        url: s.url || s.source_url || "",
        text: s.text,
      })),
    };
    const trust = runTrustGate(faq.answer("en"), pkg);
    ok = !trust.allDropped && trust.droppedLines.length === 0;
    if (!ok) {
      console.warn(`[speedgate] FAQ "${faq.id}" answer did not fully pass the trust gate against its own sources; not serving it.`, trust.droppedLines);
    }
  } else {
    console.warn(`[speedgate] FAQ "${faq.id}" has a source whose quoted text isn't in the KB; not serving it.`);
  }

  runtimeVerifyCache.set(faq.id, ok);
  return ok;
}

/**
 * Evaluates whether a query matches a *verified* canonical FAQ. Returns a fully formed
 * BisvedaResponse only when the match is marked `verified: true` in the source file and passes
 * the runtime guard above; otherwise returns null so the caller runs the full pipeline. Never
 * returns a refusal itself — "not in our documents" can only come from the full pipeline.
 */
export function matchCanonicalFaq(
  query: string,
  language = "en",
  conversationId = `conv-${Date.now()}`
): BisvedaResponse | null {
  const qClean = normalizeForMatching(query);
  if (!qClean || qClean.length < 4) return null;

  for (const faq of CANONICAL_FAQS) {
    if (faq.verified !== true) continue; // undocumented topic or explicitly unverified: skip, let the full pipeline answer it

    // 1. Check triggers
    let triggerHit = false;
    for (const trig of faq.triggers) {
      if (typeof trig === "string") {
        if (qClean === normalizeForMatching(trig) || qClean.includes(normalizeForMatching(trig))) {
          triggerHit = true;
          break;
        }
      } else if (trig.test(query) || trig.test(qClean)) {
        triggerHit = true;
        break;
      }
    }

    if (!triggerHit) {
      // 2. High-precision keyword check if all required keywords are present in query
      const allKeywordsPresent = faq.keywords.every((kw) => {
        const kwClean = kw.toLowerCase();
        return qClean.includes(kwClean);
      });

      // Query must be concise and clearly inquiring about this concept
      if (allKeywordsPresent && qClean.split(" ").length <= 8 && /(?:what|who|how|is|are|define|explain|tell|meaning|kya)\b/i.test(qClean)) {
        triggerHit = true;
      }
    }

    if (triggerHit) {
      if (!passesRuntimeGuard(faq)) continue; // defense in depth: fall through to the full pipeline

      const responseCards: BisvedaResponse["cards"] = {};
      if (faq.cards?.hallmark) responseCards.hallmark = faq.cards.hallmark;
      if (faq.cards?.mark) responseCards.mark = faq.cards.mark;

      const mappedSources: Source[] = faq.sources.map((s, idx) => ({
        label: s.label || s.id || `S${idx + 1}`,
        standard_id: s.standard_id,
        title: s.title,
        clause: s.clause,
        page: s.page,
        url: s.url || s.source_url || `/api/docs/${s.standard_id.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        text: s.text,
      }));

      const mappedStandards = faq.standards.map((st) => ({
        id: st.id,
        title: st.title,
        class: st.class,
        why: st.why || "Standard in scope.",
      }));

      return {
        conversation_id: conversationId,
        kind: "answer",
        language,
        grounding: "verified",
        text: faq.answer(language),
        standards: mappedStandards,
        sources: mappedSources,
        cards: Object.keys(responseCards).length > 0 ? responseCards : undefined,
        follow_ups: faq.follow_ups,
      };
    }
  }

  return null;
}
