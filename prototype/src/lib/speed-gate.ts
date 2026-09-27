import standardsData from "../../data/standards.json";
import schemesData from "../../data/schemes.json";
import type { StandardRecord, QueryResponse } from "./types";

interface CacheEntry {
  response: QueryResponse;
  expiresAt: number;
}

// In-memory Exact Query Cache (TTL: 10 minutes)
const queryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export function clearSpeedGateCache(): void {
  queryCache.clear();
}

export interface SpeedGateResult {
  hit: boolean;
  type?: "exact_identifier" | "official_faq" | "cached_response";
  matchedStandard?: StandardRecord;
  identifierType?: "IS_STANDARD" | "CML_LICENSE" | "HUID_HALLMARK" | "QCO_ORDER";
  response?: QueryResponse;
  latencyMs: number;
}

// Official BIS FAQs
const OFFICIAL_FAQS: Array<{
  pattern: RegExp;
  question: string;
  answer: string;
  sourceUrl: string;
  sourceTitle: string;
}> = [
  {
    pattern: /\b(?:what is bis|about bis|bureau of indian standards act)\b/i,
    question: "What is the Bureau of Indian Standards (BIS)?",
    answer:
      "The Bureau of Indian Standards (BIS) is the National Standard Body of India established under the BIS Act, 2016 for the harmonious development of the activities of standardization, marking, and quality certification of goods and for matters connected therewith or incidental thereto.",
    sourceUrl: "https://www.bis.gov.in/index.php/about-bis/genesis-of-bis/",
    sourceTitle: "Genesis of BIS - Official Portal",
  },
  {
    pattern: /\b(?:what is isi mark|difference between isi and bis|meaning of isi)\b/i,
    question: "What does the ISI mark signify?",
    answer:
      "The ISI mark is the official conformity mark for industrial products in India certified under Scheme-I of the BIS (Conformity Assessment) Regulations, 2018. It certifies that a product complies with the relevant Indian Standard (IS) developed by BIS. For products under mandatory Quality Control Orders (QCOs), manufacturing or selling without the ISI mark is a cognizable legal offense under Section 29 of the BIS Act, 2016.",
    sourceUrl: "https://www.bis.gov.in/product-certification/overview/",
    sourceTitle: "BIS Scheme-I Product Certification Overview",
  },
  {
    pattern: /\b(?:what is cuid|what is huid|huid meaning|hallmark unique identification)\b/i,
    question: "What is Hallmark Unique Identification (HUID)?",
    answer:
      "HUID (Hallmark Unique Identification) is a 6-digit alphanumeric code laser-engraved onto gold jewellery and artefacts at BIS-recognized Assaying and Hallmarking Centres (AHCs). Every hallmarked piece of gold jewellery carries three mandatory marks: (1) BIS Logo, (2) Purity in Carats and Fineness (e.g. 22K916), and (3) 6-digit HUID code. The consumer can verify the genuineness and purity of any piece via the BIS Care Mobile App under 'Verify HUID'.",
    sourceUrl: "https://www.bis.gov.in/hallmarking-overview/",
    sourceTitle: "BIS Hallmarking Scheme & HUID Guidelines",
  },
  {
    pattern: /\b(?:msme subsidy|bis fee discount for msme|udyam concession)\b/i,
    question: "What concessions are available for MSMEs and Startups under BIS certification?",
    answer:
      "Under BIS Gazette Notification & Guidelines, Micro, Small, and Medium Enterprises (MSMEs) registered with a valid Udyam Registration Certificate, as well as DPIIT-recognized Startups and Women Entrepreneurs, are eligible for an **80% concession on application and annual minimum marking fees** under Scheme-I. Additionally, testing charges are subsidized by up to 50% for selected consumer products.",
    sourceUrl: "https://www.manakonline.in",
    sourceTitle: "Manak Online - MSME Concession Guidelines",
  },
  {
    pattern: /\b(?:how to verify cml|verify licence number|check isi licence)\b/i,
    question: "How do I verify a BIS Licence (CM/L) number?",
    answer:
      "A BIS Licence number is a 7 or 8-digit CM/L code (Certification Marks / Licence) located beneath the ISI mark. To verify its operative status: (1) Open the official **BIS Care App** and select 'Verify Licence Details', or (2) Visit the **Manak Online** portal (manakonline.in) under 'Conformity Assessment' -> 'Search a Licensee'. The portal displays manufacturer name, factory address, valid standard, brand names, and validity period.",
    sourceUrl: "https://www.manakonline.in/MANAK/SearchALicence",
    sourceTitle: "Manak Online Licensee Search",
  },
  {
    pattern: /\b(?:scheme[- ]?i\s*(?:vs|and|or)\s*scheme[- ]?ii|difference between (?:scheme[- ]?i|isi)\s*(?:and|vs)\s*(?:scheme[- ]?ii|crs)|scheme[- ]?1\s*(?:vs|and|or)\s*scheme[- ]?2|difference between isi and crs|isi vs crs)\b/i,
    question: "What is the difference between Scheme-I (ISI Mark) and Scheme-II (CRS)?",
    answer:
      "**Scheme-I (ISI Mark):** Governs industrial, mechanical, consumer, chemical, and food products (e.g. pressure cookers, cement, structural steel, helmets, toys, packaged water). It requires a preliminary factory audit by BIS technical officers, verification of an in-house laboratory conforming to the Scheme of Testing & Inspection (STI), independent third-party sample testing, and ongoing market surveillance. MSMEs enjoy an 80% fee discount and a 30-day simplified fast-track route.\n\n**Scheme-II (CRS - Compulsory Registration Scheme):** Administered primarily for IT hardware, electronics, and solar PV products under MeitY notifications (e.g. laptops, mobile phones, displays, battery storage). It operates on **Self-Declaration of Conformity (SDoC)** based solely on safety test reports issued by BIS-recognized/NABL-accredited domestic test laboratories. **No initial factory inspection is conducted** prior to registration grant.",
    sourceUrl: "https://www.bis.gov.in/product-certification/overview/",
    sourceTitle: "BIS Conformity Assessment Schemes Comparison",
  },
  {
    pattern: /\b(?:what is fmcs|foreign manufacturer|importing to india|fmcs scheme|foreign manufacturers certification scheme|scheme[- ]?iv)\b/i,
    question: "What is the Foreign Manufacturers Certification Scheme (FMCS) under Scheme-IV?",
    answer:
      "The **Foreign Manufacturers Certification Scheme (FMCS)** enables overseas manufacturing units to use the BIS Standard Mark (ISI mark) on goods exported to India. Key requirements:\n1. **Authorized Indian Representative (AIR):** Overseas unit must nominate a legally responsible AIR residing in India.\n2. **Factory Audit Abroad:** Two BIS technical officers travel overseas to inspect the manufacturing facility, quality management systems, and test equipment.\n3. **Independent Sample Testing:** Drawn samples are sealed and tested in BIS laboratories in India.\n4. **Performance Bank Guarantee (PBG):** Minimum USD $10,000 PBG deposited with BIS upon licence grant.",
    sourceUrl: "https://www.manakonline.in",
    sourceTitle: "FMCS Portal & Regulations",
  },
  {
    pattern: /\b(?:what is qco|quality control order|is bis mandatory|is isi mandatory|mandatory vs voluntary)\b/i,
    question: "What is a Quality Control Order (QCO) and is BIS certification mandatory?",
    answer:
      "A **Quality Control Order (QCO)** is a statutory order issued by Government of India Ministries (DPIIT, MeitY, MoRTH, Steel, Textiles, Chemicals) under Section 16 of the BIS Act, 2016. When a QCO is enforced for an Indian Standard, **compliance and BIS certification become legally mandatory** for domestic manufacturers as well as foreign exporters. Manufacturing, importing, storing, distributing, or selling non-certified goods without the Standard Mark is a **cognizable criminal offense punishable under Section 29 of the BIS Act, 2016** with imprisonment up to two years or heavy fines.",
    sourceUrl: "https://www.bis.gov.in/qco-notifications/",
    sourceTitle: "Gazette Quality Control Orders Registry",
  },
  {
    pattern: /\b(?:how to apply|application process|how to get (?:isi|bis|licence)|steps to get certified|certification procedure|certification pathway)\b/i,
    question: "What is the step-by-step procedure to apply for BIS certification?",
    answer:
      "To obtain a BIS licence:\n1. **Identify the Standard:** Determine the operative Indian Standard and Scheme (Scheme-I for general products, Scheme-II for electronics).\n2. **Setup In-House Testing:** Ensure your facility has test equipment conforming to the Scheme of Testing and Inspection (STI).\n3. **Online Application:** Register on **Manak Online** (manakonline.in) and submit Form-V along with factory layout, machinery list, test personnel details, and Udyam MSME certificate (for 80% fee discount).\n4. **Factory Inspection:** BIS officers inspect factory operations, witness testing, and draw verification samples (or 30-day simplified MSME route with third-party pre-test report).\n5. **Licence Grant:** BIS issues the CM/L licence within 30 days (simplified) or 60-90 days (standard route).",
    sourceUrl: "https://www.manakonline.in",
    sourceTitle: "Manak Online Product Certification Guidelines",
  },
  {
    pattern: /^(?:what is sti|scheme of testing and inspection|in-house lab requirements|factory testing equipment)\??$/i,
    question: "What is the Scheme of Testing and Inspection (STI)?",
    answer:
      "The **Scheme of Testing and Inspection (STI)** is a statutory document prescribed by BIS for every licensed product. It specifies:\n- **Mandatory Routine Tests:** Exact tests that must be conducted on each production batch (e.g. pressure test, tensile strength, leakage).\n- **Testing Frequency & Lot Size:** Required number of test samples per production batch or hourly interval.\n- **In-House Test Equipment:** List of calibrated laboratory equipment the factory must maintain on-site.\n- **Quality Records:** Mandatory format for maintaining test registers signed by an approved Quality Control officer.",
    sourceUrl: "https://www.bis.gov.in/sti-guidelines/",
    sourceTitle: "BIS Scheme of Testing and Inspection Standards",
  },
  {
    pattern: /^(?:difference between bis and iso|bis vs iso|is bis iso)\??$/i,
    question: "What is the difference between BIS and ISO?",
    answer:
      "**BIS (Bureau of Indian Standards):** The National Standards Body of India established by Indian Parliament. BIS formulates **Indian Standards (IS)** tailored to Indian operating conditions, safety mandates, and statutory Quality Control Orders (QCOs), and grants product licences (ISI mark).\n\n**ISO (International Organization for Standardization):** An independent international NGO that formulates voluntary international standards (such as ISO 9001 for quality management or ISO 14001 for environment). ISO does not issue product certification marks directly; BIS is India's official voting member at ISO and often harmonizes Indian Standards with ISO equivalents.",
    sourceUrl: "https://www.bis.gov.in/international-relations/",
    sourceTitle: "BIS & International Standardization (ISO/IEC)",
  },
];

/**
 * L1 Speed Gate (§6.4):
 * Ultra-fast (<150ms) path for exact identifiers, verbatim official FAQs, and cached queries.
 * Bypasses heavy retrieval and LLM generation ONLY for exact/verbatim matches.
 * Normal conversational queries ("tell me about X", product queries) traverse the full RAG pipeline.
 */
export function checkSpeedGate(query: string, mediaPresent: boolean = false): SpeedGateResult {
  const t0 = Date.now();

  // If multimodal media is attached, bypass Speed Gate to full pipeline
  if (mediaPresent) {
    return { hit: false, latencyMs: Date.now() - t0 };
  }

  const trimmed = query.trim();
  const normalizedKey = trimmed.toLowerCase().replace(/\s+/g, " ");

  // 1. Exact Cache Hit (<50ms)
  const cached = queryCache.get(normalizedKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      hit: true,
      type: "cached_response",
      response: cached.response,
      latencyMs: Date.now() - t0,
    };
  }

  // 2. Exact Identifier Match (<150ms)
  // ONLY match when the query is purely an exact identifier lookup (e.g. "IS 4151", "IS:2347", "IS 17526:2020", "IS 456").
  // Conversational questions ("tell me about IS 4151", "what does IS 4151 specify") MUST go to the full RAG pipeline.
  const isMatch = trimmed.match(/\b(IS\s*[:\s]?\s*\d{1,5}(?:\s*(?:\([^)]+\)|Part\s*\d+))?(?::\d{4})?)\b/i);
  const wordCount = trimmed.split(/\s+/).length;
  const isConversationalOrDetailed =
    wordCount > 3 ||
    /\b(tell|about|explain|describe|requirement|requirements|what|how|why|which|can|should|detail|details|scope|clause|clauses|test|tests|tested|testing|lab|labs|laboratory|laboratories|where|near|location|cost|fee|fees|concession|apply|application|process|procedure|audit|inspection|sample|pressure|strength|burst|bursting|tensile|elongation|thickness|dimension|formula|chemical|tolerance)\b/i.test(trimmed);

  if (isMatch && !isConversationalOrDetailed) {
    const rawIs = isMatch[1];
    const stdNumOnly = rawIs.replace(/^IS\s*/i, "").split(":")[0].trim();

    const standards = standardsData as unknown as StandardRecord[];
    const matched = standards.find((s) => {
      const sNum = s.standard_number.replace(/^IS\s*/i, "").split(":")[0].trim();
      return sNum.toLowerCase() === stdNumOnly.toLowerCase();
    });

    if (matched) {
      const response = buildSpeedGateStandardResponse(trimmed, matched);
      queryCache.set(normalizedKey, { response, expiresAt: Date.now() + CACHE_TTL_MS });

      return {
        hit: true,
        type: "exact_identifier",
        identifierType: "IS_STANDARD",
        matchedStandard: matched,
        response,
        latencyMs: Date.now() - t0,
      };
    }
  }

  // Check for CM/L License Number (e.g. CM/L-1234567 or CML 8493021)
  const cmlMatch = trimmed.match(/\b(?:CM\s*[\/-]?\s*L\s*[-:]?\s*(\d{7,8}))\b/i);
  if (cmlMatch && wordCount <= 4) {
    const cmlNum = cmlMatch[1];
    const response = buildSpeedGateCmlResponse(trimmed, cmlNum);
    return {
      hit: true,
      type: "exact_identifier",
      identifierType: "CML_LICENSE",
      response,
      latencyMs: Date.now() - t0,
    };
  }

  // Check for HUID Hallmark Code (6-digit alphanumeric e.g. AB1234, 7A8B9C)
  const huidMatch = trimmed.match(/\b([A-Z0-9]{6})\b/i);
  if (huidMatch && wordCount <= 4 && (trimmed.toLowerCase().includes("huid") || trimmed.toLowerCase().includes("gold") || trimmed.toLowerCase().includes("jewel") || trimmed.toLowerCase().includes("hallmark"))) {
    const huid = huidMatch[1].toUpperCase();
    const response = buildSpeedGateHuidResponse(trimmed, huid);
    return {
      hit: true,
      type: "exact_identifier",
      identifierType: "HUID_HALLMARK",
      response,
      latencyMs: Date.now() - t0,
    };
  }

  // 3. Verbatim Official FAQ Match (<200ms)
  // Verbatim FAQs are STRICTLY for meta/procedural BIS questions (e.g. "What is BIS?", "What does ISI mark mean?").
  // Any product, technical, or multi-word conversational queries bypass Speed Gate to full RAG pipeline.
  const hasProductOrTechnicalNoun =
    /\b(manufacture|manufacturer|manufacturing|produce|maker|bottle|cooker|steel|cement|helmet|toy|pipe|wire|gold|jewellery|water|battery|iron|cable|transformer|led|glass|valve|tile|plywood)\b/i.test(trimmed);
  const isComplexFaqQuery =
    wordCount > 14 ||
    hasProductOrTechnicalNoun ||
    /\b(clause|clauses|sample|burst|bursting|tensile|elongation|thickness|dimension|formula|tolerance)\b/i.test(trimmed);

  if (!isComplexFaqQuery) {
    for (const faq of OFFICIAL_FAQS) {
      if (faq.pattern.test(trimmed)) {
        const response = buildSpeedGateFaqResponse(trimmed, faq);
        queryCache.set(normalizedKey, { response, expiresAt: Date.now() + CACHE_TTL_MS });

        return {
          hit: true,
          type: "official_faq",
          response,
          latencyMs: Date.now() - t0,
        };
      }
    }
  }

  return { hit: false, latencyMs: Date.now() - t0 };
}

function buildSpeedGateStandardResponse(query: string, std: StandardRecord): QueryResponse {
  const isMandatory = Boolean(std.mandatory_qco);
  const derivedTier: "A" | "B" | "C" =
    std.source_type === "FULL_TEXT"
      ? "C"
      : std.source_type === "PRODUCT_MANUAL"
      ? "B"
      : "A";

  const synthesis =
    `### ⚡ Speed Gate: Official Standard Passport for **${std.standard_number}**\n\n` +
    `**Title:** ${std.full_title}  \n` +
    `**Product Category:** ${std.product_category} (${std.industry})  \n` +
    `**Certification Scheme:** ${std.scheme}  \n` +
    `**Current Operative Status:** **${std.status || "CURRENT"}**  \n` +
    `**Regulatory Regime:** ${isMandatory ? "🚨 **MANDATORY QCO ENFORCED** — Section 29 compliance required" : "Voluntary Standard (No mandatory QCO currently gazetted)"}  \n\n` +
    `#### Scope & Specification Summary\n` +
    `${std.scope}  \n\n` +
    `#### Key Testing Parameters\n` +
    (std.key_testing_parameters && std.key_testing_parameters.length > 0
      ? std.key_testing_parameters.map((t, idx) => `- **[S${idx + 1}]** ${t}`).join("\n")
      : "_Refer to official standard specification for testing provisions._") +
    `\n\n*Source: Bureau of Indian Standards National Catalog ([Official Link](${std.document_url}))*`;

  return {
    query,
    outcome: "answered",
    confidenceScore: 0.99,
    synthesis,
    recommendations: [
      {
        standardNumber: std.standard_number,
        title: std.full_title,
        year: std.year,
        relevanceScore: 1.0,
        applicability: "DIRECTLY_APPLICABLE",
        applicabilityReason: `Exact identifier match from Speed Gate registry lookup.`,
        groundingState: derivedTier !== "A" ? "verified" : "supported_inference",
        scheme: std.scheme,
        mandatoryQco: isMandatory,
        scope: std.scope,
        tier: derivedTier,
        testingClauses: (std.key_testing_parameters || []).map((p, idx) => ({
          standardNumber: std.standard_number,
          title: std.full_title,
          verbatimText: p,
          confidence: 1.0,
          authorityLevel: "AUTHORITATIVE",
          sourceUrl: std.document_url,
          isMandatoryQco: isMandatory,
        })),
        sourceUrl: std.document_url,
        isPrimary: true,
      },
    ],
    activeEvidence: (std.key_testing_parameters || []).map((p) => ({
      standardNumber: std.standard_number,
      title: std.full_title,
      verbatimText: p,
      confidence: 1.0,
      authorityLevel: "AUTHORITATIVE",
      sourceUrl: std.document_url,
    })),
    qcoAlert: isMandatory
      ? {
          isMandatory: true,
          orderTitle: `Quality Control Order for ${std.standard_number}`,
          ministry: "Ministry of Consumer Affairs / Relevant Line Ministry",
          penalProvision: "Section 29 of BIS Act, 2016",
        }
      : undefined,
    isSpeedGateHit: true,
    reasoningSteps: [
      {
        stage: "UNDERSTAND",
        status: "done",
        detail: `Speed Gate (§6.4): Exact identifier hit for ${std.standard_number} (0ms LLM bypass)`,
      },
      {
        stage: "RETRIEVE",
        status: "done",
        detail: `Catalogue matched primary record: ${std.full_title}`,
      },
      {
        stage: "SYNTHESIZE",
        status: "done",
        detail: `Instant deterministic passport generated with full statutory citations`,
      },
    ],
  };
}

function buildSpeedGateCmlResponse(query: string, cmlNum: string): QueryResponse {
  const synthesis =
    `### ⚡ Speed Gate: BIS Licence Verification (CM/L-${cmlNum})\n\n` +
    `**Queried Licence Identifier:** \`CM/L-${cmlNum}\`  \n` +
    `**Format Status:** Valid 7/8-digit BIS Scheme-I Certification Marks Licence format.  \n\n` +
    `#### Official Verification Route (Axiom A11 / §10.6 AG6)\n` +
    `In accordance with statutory security protocols, BISVEDA provides verified access routes to the live National Registry without speculative verification:\n\n` +
    `1. **BIS Care Mobile App:** Open App -> Select **'Verify Licence Details'** -> Enter \`${cmlNum}\` to inspect licensee name, factory address, valid standard, and expiration date.\n` +
    `2. **Manak Online Official Portal:** Visit [Manak Online Search Licensee](https://www.manakonline.in/MANAK/SearchALicence) and input the CM/L number.\n` +
    `3. **Reporting Non-Compliance:** If this mark appears on an unlisted or substandard product, report directly via the BIS Care App under **'Complaints'**.`;

  return {
    query,
    outcome: "answered",
    confidenceScore: 0.95,
    synthesis,
    recommendations: [],
    activeEvidence: [],
    isSpeedGateHit: true,
    reasoningSteps: [
      {
        stage: "UNDERSTAND",
        status: "done",
        detail: `Speed Gate: CM/L license format detected (${cmlNum})`,
      },
      {
        stage: "SYNTHESIZE",
        status: "done",
        detail: `Direct statutory verification procedure provided via BIS Care App and Manak Online`,
      },
    ],
  };
}

function buildSpeedGateHuidResponse(query: string, huid: string): QueryResponse {
  const synthesis =
    `### ⚡ Speed Gate: Hallmark Unique Identification (HUID: ${huid})\n\n` +
    `**Queried HUID Identifier:** \`${huid}\`  \n` +
    `**Format Classification:** 6-character alphanumeric Hallmarking code.  \n\n` +
    `#### Official Verification Method (Mandatory Gold Hallmarking Scheme)\n` +
    `Gold jewellery manufactured or sold in mandatory hallmarking districts must bear 3 marks: (1) BIS Logo, (2) Purity Mark (e.g. 22K916), (3) 6-digit HUID.\n\n` +
    `To verify this exact article's authenticity, purity, and assaying date:\n` +
    `- **Step 1:** Download and open the **BIS Care App** (Android / iOS).\n` +
    `- **Step 2:** Tap on **'Verify HUID'**.\n` +
    `- **Step 3:** Enter \`${huid}\`.\n` +
    `- **Step 4:** The app returns the jeweller registration number, AHC centre code, purity, and date of hallmarking.`;

  return {
    query,
    outcome: "answered",
    confidenceScore: 0.95,
    synthesis,
    recommendations: [],
    activeEvidence: [],
    isSpeedGateHit: true,
    reasoningSteps: [
      {
        stage: "UNDERSTAND",
        status: "done",
        detail: `Speed Gate: 6-digit HUID code detected (${huid})`,
      },
      {
        stage: "SYNTHESIZE",
        status: "done",
        detail: `Statutory HUID verification procedure generated`,
      },
    ],
  };
}

function buildSpeedGateFaqResponse(
  query: string,
  faq: { question: string; answer: string; sourceUrl: string; sourceTitle: string }
): QueryResponse {
  const synthesis =
    `### ⚡ Official BIS FAQ: ${faq.question}\n\n` +
    `${faq.answer}\n\n` +
    `---\n` +
    `*Source: [${faq.sourceTitle}](${faq.sourceUrl})*`;

  return {
    query,
    outcome: "answered",
    confidenceScore: 0.99,
    synthesis,
    recommendations: [],
    activeEvidence: [],
    isSpeedGateHit: true,
    reasoningSteps: [
      {
        stage: "UNDERSTAND",
        status: "done",
        detail: `Speed Gate: Matched official verbatim BIS FAQ (<150ms)`,
      },
      {
        stage: "SYNTHESIZE",
        status: "done",
        detail: `Returned authoritative verbatim answer with official portal source`,
      },
    ],
  };
}
