import type { EvidenceClause, LaboratoryRecord, QueryResponse, RecommendationResult, StandardRecord } from "./types";
import standardsData from "../../data/standards.json";
import { checkAmbiguity } from "./disambiguation";
import { hybridSearch, retrieveEvidence } from "./retrieval";
import { validateAndGuard, generateSafeRefusal } from "./guardrails";
import { processLanguageGateway, formatStatutoryNoticeBilingual } from "./language-gateway";
import { executeSpecialistAgent, classifySpecialistAgent, SPECIALIST_AGENTS } from "./orchestrator";
import { checkOutdatedReference } from "./outdated-checker";
import { generateFormDraft } from "./form-generator";
import { checkSpeedGate } from "./speed-gate";
import { adjudicateEvidence } from "./adjudicator";
import { renderEvidenceOnlySummary } from "./evidence-only";
import { routeConversationalIntent } from "./conversational-router";
import { buildComplianceDossier } from "./dossier-builder";

/**
 * BISVEDA AI Synthesis & Multi-Layer Orchestrator:
 * Executes the governed V7/V8 pipeline across all foundational layers:
 * L0 (Conversational Intent Gate & Clarification Trap) ->
 * L1 (Language Gateway & Speed Gate) ->
 * L2 (Outdated Reference & Document Authenticity) ->
 * L4 (Router, Ambiguity Trap & 9-Step Hybrid Adjudication) ->
 * L5 (Specialist Agent Dispatch, Dossier Builder & Evidence-Only Mode) ->
 * L6 (Trust Gate & Guardrails)
 */
export interface PipelineResolvedContext {
  activeStandard?: string;
  activeProduct?: string;
  activeMaterial?: string;
  activeLocation?: string;
  isFollowUp?: boolean;
}

export async function executeQueryPipeline(
  query: string,
  resolvedCtx?: PipelineResolvedContext
): Promise<QueryResponse> {
  const trimmed = query.trim();

  // 0. LAYER 0: CONVERSATIONAL INTENT GATE — Fast-path for greetings, thanks, small talk
  const intentGate = routeConversationalIntent(trimmed);
  if (intentGate.isConversational && intentGate.conversationalResponse) {
    return {
      query: trimmed,
      outcome: "answered",
      confidenceScore: 1.0,
      synthesis: intentGate.conversationalResponse,
      recommendations: [],
      activeEvidence: [],
      isSpeedGateHit: true,
      isConversational: true,
      starterActions: intentGate.starterActions,
      reasoningSteps: [
        { stage: "UNDERSTAND", status: "done", detail: `Intent Gate: Recognized ${intentGate.intent} intent` },
        { stage: "SYNTHESIZE", status: "done", detail: "Direct conversational response rendered without regulatory retrieval" },
      ],
    };
  }

  // Vague Product Scope Clarification Gate
  if (intentGate.clarificationRequired) {
    return {
      query: trimmed,
      outcome: "disambiguation_required",
      confidenceScore: 0.5,
      synthesis: intentGate.clarificationPrompt || "Please clarify your product scope.",
      recommendations: [],
      activeEvidence: [],
      disambiguation: {
        isAmbiguous: true,
        term: intentGate.clarificationTopic || trimmed,
        options: (intentGate.clarificationOptions || []).map((o) => ({
          label: o.label,
          standard: o.standardNumber,
          category: o.description,
        })),
      },
      isSpeedGateHit: false,
      reasoningSteps: [
        { stage: "UNDERSTAND", status: "done", detail: `Clarification Gate: Product scope "${intentGate.clarificationTopic}" is broad` },
        { stage: "RETRIEVE", status: "pending", detail: "Awaiting specific product scope selection" },
      ],
    };
  }

  // 1. LAYER 1: SPEED GATE (§6.4) — Fast-path (<150ms) for exact IS / CML / HUID / FAQ
  const speedGate = checkSpeedGate(trimmed);
  if (speedGate.hit && speedGate.response) {
    return speedGate.response;
  }

  // 2. LAYER 1: LANGUAGE GATEWAY & STATUTORY TERMINOLOGY LOCKING
  const langGate = processLanguageGateway(trimmed);
  const workingQuery = langGate.canonicalEnglishQuery;
  const hasDirectStandardCode =
    /\bIS\s*\d{1,5}(?:\s*(?:\([^)]+\)|Part\s*\d+))?(?::\d{4})?\b/i.test(workingQuery) ||
    Boolean(resolvedCtx?.activeStandard);

  // 3. LAYER 2: OUTDATED REFERENCE & SUPERSEDED STANDARDS CHECKER
  const outdatedAlert = checkOutdatedReference(trimmed);
  const effectiveQuery = outdatedAlert ? outdatedAlert.currentStandard : workingQuery;

  // 4. LAYER 4: PRE-RAG AMBIGUITY TRAP (bypassed if direct IS code provided)
  if (!hasDirectStandardCode) {
    const ambiguity = checkAmbiguity(effectiveQuery);
    if (ambiguity.isAmbiguous) {
      return {
        query: trimmed,
        outcome: "disambiguation_required",
        confidenceScore: 0.5,
        synthesis: `The query **"${ambiguity.term}"** covers multiple distinct product categories and Indian Standards. Please select your specific manufacturing scope below to retrieve exact statutory requirements:`,
        recommendations: [],
        activeEvidence: [],
        disambiguation: ambiguity,
        languageGateway: langGate,
        isSpeedGateHit: false,
        reasoningSteps: [
          { stage: "UNDERSTAND", status: "done", detail: `Language Gateway: ${langGate.detectedLanguage.toUpperCase()} parsed with ${langGate.lockedTerms.length} locked statutory tokens` },
          { stage: "RETRIEVE", status: "pending", detail: "Awaiting user product scope disambiguation selection" },
        ],
      };
    }
  }

  // 5. LAYER 4: HYBRID RETRIEVAL & SEARCH EXECUTION (incorporates real ingested pgvector documents)
  let retrieval = await retrieveEvidence(effectiveQuery);
  if (retrieval.recommendations.length === 0 && resolvedCtx?.activeStandard) {
    retrieval = await retrieveEvidence(resolvedCtx.activeStandard);
  }

  // 6. LAYER 4: 9-STEP EVIDENCE ADJUDICATOR (§9.8)
  const allStandards = standardsData as unknown as StandardRecord[];
  const rawHits = retrieval.recommendations.map((rec) => {
    const cleanNum = rec.standardNumber.replace(/\s+/g, "").toUpperCase();
    const existing = allStandards.find((s) => {
      const sClean = s.standard_number.replace(/\s+/g, "").toUpperCase();
      return sClean === cleanNum || sClean.startsWith(cleanNum) || cleanNum.startsWith(sClean);
    });

    const stdRecord: StandardRecord = existing
      ? {
          ...existing,
          document_url: rec.sourceUrl || existing.document_url,
          source_url: rec.sourceUrl || existing.source_url,
          source_type: rec.tier === "B" ? "PRODUCT_MANUAL" : rec.tier === "C" ? "FULL_TEXT" : existing.source_type,
          key_testing_parameters:
            rec.testingClauses.length > 0 ? rec.testingClauses.map((c) => c.verbatimText) : existing.key_testing_parameters,
        }
      : {
          standard_id: rec.standardNumber.replace(/\s+/g, "-").toLowerCase(),
          standard_number: rec.standardNumber,
          year: rec.year,
          full_title: rec.title,
          short_title: rec.title,
          product_category: "General",
          industry: "Manufacturing",
          scheme: rec.scheme,
          certification_route: "Standard",
          mandatory_qco: rec.mandatoryQco,
          status: "CURRENT" as const,
          scope: rec.scope,
          key_testing_parameters: rec.testingClauses.map((c) => c.verbatimText),
          keywords: [rec.title, rec.standardNumber],
          materials: [],
          document_url: rec.sourceUrl,
          source_url: rec.sourceUrl,
          source_type: rec.tier === "B" ? "PRODUCT_MANUAL" : rec.tier === "C" ? "FULL_TEXT" : "CATALOGUE",
          verification_status: "verified",
        };

    return {
      standard: stdRecord,
      chunkScores: [rec.relevanceScore],
      maxScore: rec.relevanceScore,
      matchedClauses: rec.testingClauses,
    };
  });

  const adjudicatedPackage = adjudicateEvidence(
    effectiveQuery,
    rawHits,
    { product: effectiveQuery },
    langGate.detectedLanguage
  );

  // 7. LAYER 6: EVIDENCE SUFFICIENCY & RELEVANCE FLOOR CHECK (§11.4 Axiom A1)
  // When authoritative evidence is absent or below the calibrated floor (0.45),
  // return a named-boundary refusal. Never invent standards or call ungrounded fallbacks.
  const top1Relevance = adjudicatedPackage.adjudication.relevance_top1 || retrieval.maxScore;
  if (
    adjudicatedPackage.adjudication.out_of_corpus ||
    retrieval.recommendations.length === 0 ||
    top1Relevance < 0.45
  ) {
    const refusalText = generateSafeRefusal("out_of_corpus");
    return {
      query: trimmed,
      outcome: "refused_insufficient_evidence",
      confidenceScore: top1Relevance,
      synthesis: refusalText,
      recommendations: [],
      activeEvidence: [],
      languageGateway: langGate,
      isSpeedGateHit: false,
      outdatedReferenceAlert: outdatedAlert || undefined,
      adjudicationReport: adjudicatedPackage.adjudication,
      reasoningSteps: [
        {
          stage: "UNDERSTAND",
          status: "done",
          detail: `L1 Gateway: Processed ${langGate.detectedLanguage.toUpperCase()} query (${langGate.lockedTerms.length} statutory terms locked)`,
        },
        {
          stage: "RETRIEVE",
          status: "done",
          detail: `L4 Search: Top relevance ${Math.round(top1Relevance * 100)}% below regulatory floor (0.45)`,
        },
        {
          stage: "VALIDATE",
          status: "done",
          detail: "L6 Trust Gate: Triggered out-of-corpus boundary refusal (§11.4 Axiom A1)",
        },
      ],
    };
  }

  // 8. LAYER 5: SPECIALIST AGENT DISPATCH
  const primary = retrieval.recommendations[0];
  const specialistResult = executeSpecialistAgent(
    workingQuery,
    primary,
    retrieval.recommendations,
    retrieval.qcoAlert,
    retrieval.labs
  );

  // 9. LAYER 5: FORM-I & APPLICATION DRAFT GENERATION (if applicable)
  let formDraft = undefined;
  if (
    specialistResult.agent.id === "form_agent" ||
    /\b(?:form|application|apply|schedule\s*ii|manakonline|licen[cs]e\s*application)\b/i.test(workingQuery)
  ) {
    formDraft = generateFormDraft({
      standardNumber: primary.standardNumber,
      productTitle: primary.title,
      scheme: primary.scheme,
      isMsme: true,
    });
  }

  // 10. LAYER 5: GROUNDED SYNTHESIS (LLM or Evidence-Only Mode §10.3)
  const liveLLMText = await generateWithLLM(workingQuery, primary, retrieval.recommendations, retrieval.qcoAlert, retrieval.labs);
  let baseSynthesis = "";

  if (liveLLMText) {
    baseSynthesis = liveLLMText;
  } else {
    // Evidence-Only deterministic fallback
    const evidenceOnly = renderEvidenceOnlySummary(adjudicatedPackage, adjudicatedPackage.adjudication.candidates[0], retrieval.qcoAlert, retrieval.labs);
    baseSynthesis = evidenceOnly.summaryProse || buildGroundedSynthesis(workingQuery, primary, retrieval.recommendations, retrieval.qcoAlert, retrieval.labs);
  }

  // Prepend Outdated Reference Notice if applicable
  if (outdatedAlert) {
    baseSynthesis = `> ⚠️ **OUTDATED STANDARD REFERENCE NOTICE**  \n` +
      `> You queried **${outdatedAlert.queriedStandard}**, which is **${outdatedAlert.status}**.  \n` +
      `> Operative Standard: **${outdatedAlert.currentStandard}**  \n` +
      `> *Regulatory Note:* ${outdatedAlert.enforcementNotice}\n\n` +
      baseSynthesis;
  }

  // Append bilingual note if Hindi / Hinglish detected
  if (langGate.detectedLanguage === "hi" && retrieval.qcoAlert) {
    const hindiNotice = formatStatutoryNoticeBilingual(
      retrieval.qcoAlert.orderTitle,
      primary.standardNumber,
      retrieval.qcoAlert.isMandatory,
      "hi"
    );
    baseSynthesis = `${baseSynthesis}\n\n---\n#### 🌐 द्विभाषी विनियामक सूचना (Bilingual Notice)\n${hindiNotice}`;
  }

  // 11. LAYER 6: TRUST GATE & CITATION INTEGRITY VALIDATION (§11.1)
  const validated = validateAndGuard(
    baseSynthesis,
    retrieval.recommendations,
    retrieval.activeEvidence,
    retrieval.maxScore,
    adjudicatedPackage.adjudication.candidates
  );

  // 12. LAYER 5: FULL COMPLIANCE DOSSIER ASSEMBLY (§10.1.3)
  const dossier = buildComplianceDossier(
    adjudicatedPackage,
    retrieval.qcoAlert,
    retrieval.labs,
    {
      proseSummary: validated.cleanText,
      caveats: validated.caveats,
    }
  );

  return {
    query: trimmed,
    outcome: "answered",
    confidenceScore:
      hasDirectStandardCode && primary && primary.relevanceScore >= 0.80
        ? Math.max(retrieval.maxScore, 0.95)
        : retrieval.maxScore,
    synthesis: validated.cleanText,
    recommendations: retrieval.recommendations,
    activeEvidence: retrieval.activeEvidence,
    qcoAlert: retrieval.qcoAlert,
    labs: retrieval.labs,
    languageGateway: langGate,
    specialistAgent: {
      ...specialistResult.agent,
      keyInsights: specialistResult.keyInsights,
      recommendedNextActions: specialistResult.recommendedNextActions,
    },
    outdatedReferenceAlert: outdatedAlert || undefined,
    isSpeedGateHit: false,
    formDraft,
    dossier,
    adjudicationReport: adjudicatedPackage.adjudication,
    reasoningSteps: [
      { stage: "UNDERSTAND", status: "done", detail: `L1 Gateway: ${langGate.detectedLanguage.toUpperCase()} normalized, ${langGate.lockedTerms.length} terms locked${hasDirectStandardCode ? " [Standard Code Detected]" : ""}` },
      { stage: "RETRIEVE", status: "done", detail: `L4 Hybrid Retrieval: Bound ${retrieval.recommendations.length} candidate standards from official registry` },
      { stage: "RERANK", status: "done", detail: `L4 Adjudicator (9-step): Selected ${primary.standardNumber} (${adjudicatedPackage.adjudication.candidates[0]?.applicability}, Grounding: ${adjudicatedPackage.adjudication.grounding_state})` },
      { stage: "VALIDATE", status: "done", detail: `L5 Specialist: Dispatched to ${specialistResult.agent.name}` },
      { stage: "SYNTHESIZE", status: "done", detail: `L6 Trust Gate: Citations verified against Gazette QCOs and testing clauses` },
    ],
  };
}

// In-memory synthesis cache to avoid wasting API quota on repeated queries
const querySynthesisCache = new Map<string, string>();

async function generateWithLLM(
  query: string,
  primary: RecommendationResult,
  allRecs: RecommendationResult[],
  qcoAlert?: { isMandatory: boolean; orderTitle: string; ministry: string },
  labs?: LaboratoryRecord[]
): Promise<string | null> {
  const cacheKey = `${query.trim().toLowerCase()}_${primary.standardNumber}`;
  if (querySynthesisCache.has(cacheKey)) {
    return querySynthesisCache.get(cacheKey)!;
  }

  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!groqKey && !openaiKey && !anthropicKey && !geminiKey) {
    return null; // Fallback immediately to deterministic synthesis
  }

  const promptContext = `
You are BISVEDA, the sovereign AI assistant for Indian Standards and BIS services.
Answer the user's inquiry strictly based on the following verified BIS regulatory evidence:

PRIMARY STANDARD: ${primary.standardNumber} (${primary.title})
APPLICABILITY: ${primary.applicability}
TIER: ${primary.tier}
QCO STATUS: ${qcoAlert?.isMandatory ? `Mandatory under ${qcoAlert.orderTitle} (${qcoAlert.ministry})` : "Voluntary / Under Review"}
TESTING CLAUSES:
${primary.testingClauses.map((c, i) => `[S${i + 1}] (${c.clauseTitle || c.standardNumber}): ${c.verbatimText}`).join("\n")}
CERTIFICATION SCHEME: ${primary.scheme} (30-day simplified MSME fast-track available with 80% fee concession)
RECOGNIZED LABS:
${(labs || []).slice(0, 3).map((l) => `- ${l.name} (${l.city}, ${l.state})`).join("\n")}

NON-NEGOTIABLE STATUTORY RULES (SlotSchema & Rule 2):
1. Respond in JSON strictly adhering to SlotSchema:
   {
     "summary": "2-5 sentence narrative synthesis connecting the applicable standard, QCO, and MSME subsidy. Must include [S#] citations.",
     "why_explanations": { "${primary.standardNumber}": "Explanation of why this standard applies with [S#] citations." },
     "step_explanations": [ "Step 1: ...", "Step 2: ...", "Step 3: ...", "Step 4: ..." ],
     "next_action_guidance": "Actionable next steps for the manufacturer."
   }
2. Only cite [S1], [S2], etc. from the testing clauses provided above.
3. If this is a Tier A standard, DO NOT invent numeric test limits.
4. Do NOT include decision fields (e.g. applicability, confidence, qco_status).
`;

  const formatSlotsToProse = (content: string): string => {
    try {
      const parsed = JSON.parse(content);
      const sections: string[] = [];
      if (parsed.summary) sections.push(parsed.summary);
      if (parsed.why_explanations) {
        const whyLines = Object.entries(parsed.why_explanations).map(([k, v]) => `* **${k}**: ${v}`);
        sections.push("#### Standard Applicability Rationale\n" + whyLines.join("\n"));
      }
      if (parsed.step_explanations && Array.isArray(parsed.step_explanations)) {
        sections.push("#### Licensing & Certification Roadmap\n" + parsed.step_explanations.map((s: string, idx: number) => `${idx + 1}. ${s}`).join("\n"));
      }
      if (parsed.next_action_guidance) {
        sections.push("#### Immediate Next Actions\n" + parsed.next_action_guidance);
      }
      return sections.join("\n\n");
    } catch {
      return content;
    }
  };

  // 1. Google Gemini (Preferred provider with gemini-flash-lite-latest)
  if (geminiKey) {
    const modelsToTry = [
      "gemini-flash-lite-latest",
      "gemini-flash-latest",
      "gemini-3.8-flash",
    ];

    for (const model of modelsToTry) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `User Query: "${query}"\n\n${promptContext}` }] }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1,
                maxOutputTokens: 1024,
              },
            }),
            signal: AbortSignal.timeout(6000),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const formatted = formatSlotsToProse(text);
            querySynthesisCache.set(cacheKey, formatted);
            return formatted;
          }
        }
      } catch {
        // Continue to next model if error or timeout
      }
    }
  }

  // 2. Groq (Ultra-low-latency open-weight fallback)
  if (groqKey) {
    const groqModels = ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"];
    for (const model of groqModels) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: "You are BISVEDA, the sovereign AI assistant for Indian Standards and BIS services." },
              { role: "user", content: `User Query: "${query}"\n\n${promptContext}` },
            ],
            temperature: 0.1,
            max_tokens: 1024,
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) {
            const formatted = formatSlotsToProse(text);
            querySynthesisCache.set(cacheKey, formatted);
            return formatted;
          }
        }
      } catch {
        // Fallback
      }
    }
  }

  // 3. OpenAI
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You are BISVEDA, the sovereign AI assistant for Indian Standards and BIS services." },
            { role: "user", content: `User Query: "${query}"\n\n${promptContext}` },
          ],
          temperature: 0.1,
          max_tokens: 1024,
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          const formatted = formatSlotsToProse(text);
          querySynthesisCache.set(cacheKey, formatted);
          return formatted;
        }
      }
    } catch {
      // Fallback
    }
  }

  return null;
}

/**
 * Generates an intelligent, conversational response for open-ended queries,
 * guidance inquiries, and general BIS questions that do not focus on a single product.
 */
export async function generateOpenConversationalResponse(query: string): Promise<string | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  const systemPrompt = `You are BISVEDA, the authoritative AI assistant for Indian Standards, the Bureau of Indian Standards (BIS), and conformity assessment under the BIS Act, 2016.
Answer the user's question accurately, informatively, and helpfully in GitHub-flavored Markdown.
- If asked about certification routes, explain Scheme-I (ISI Mark), Scheme-II (CRS), Scheme-IV (FMCS), or Gold Hallmarking (HUID).
- If asked about testing, explain Scheme of Testing and Inspection (STI), NABL/BIS accredited laboratories, and testing requirements.
- If asked about specific standards or products, cite genuine Indian Standards (e.g. IS 2347, IS 14543, IS 4151, IS 1786, IS 9873).
- If asked general questions, converse naturally and politely while grounding your guidance in quality, standards, and compliance.
- Keep the formatting clean with headings, bullet points, and actionable next steps.`;

  // 1. Try Gemini
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${systemPrompt}\n\nUser Question: "${query}"` },
                ],
              },
            ],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
          }),
          signal: AbortSignal.timeout(6000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim()) return text.trim();
      }
    } catch {}
  }

  // 2. Try Groq
  if (groqKey) {
    for (const model of ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"]) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: query },
            ],
            temperature: 0.2,
            max_tokens: 1024,
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text && text.trim()) return text.trim();
        }
      } catch {}
    }
  }

  return null;
}

function buildGroundedSynthesis(
  query: string,
  primary: RecommendationResult,
  allRecs: RecommendationResult[],
  qcoAlert?: { isMandatory: boolean; orderTitle: string; ministry: string },
  labs?: LaboratoryRecord[]
): string {
  const parts: string[] = [];

  // Summary header
  parts.push(`### Applicable Standard: ${primary.standardNumber} (${primary.title}) [S1]\n`);
  parts.push(`For the queried product scope, the primary governing standard is **${primary.standardNumber}**. Below is the verified compliance breakdown based on official BIS records [S1]:\n`);

  // QCO Notice
  if (qcoAlert?.isMandatory) {
    parts.push(`> 🚨 **Mandatory Quality Control Order (QCO) Alert**  \n> This product is governed under the **${qcoAlert.orderTitle}** issued by the **${qcoAlert.ministry}**. Manufacturing, importing, distributing, or selling this item without a valid BIS Standard Mark (ISI Mark) is a punishable offense under Section 29 of the BIS Act, 2016.\n`);
  }

  // Certification Scheme
  parts.push(`#### 1. Certification Scheme & Route`);
  parts.push(`* **Scheme:** ${primary.scheme}`);
  parts.push(`* **Route:** Product Certification Scheme-I (Standard In-House Testing Route) or **Simplified 30-Day MSME Fast-Track Procedure**.`);
  parts.push(`* **MSME Benefit:** 80% concession on application and marking fees for DPIIT-recognized Startups and Micro/Small Enterprises with valid Udyam registration.\n`);

  // Mandatory Testing Requirements
  if (primary.testingClauses && primary.testingClauses.length > 0) {
    parts.push(`#### 2. Mandated Technical Testing Requirements`);
    parts.push(`To obtain licensing, the product must satisfy the following statutory test parameters:\n`);
    primary.testingClauses.forEach((clause, idx) => {
      parts.push(`* [S${idx + 1}] **${clause.clauseTitle || clause.standardNumber}**: ${clause.verbatimText}`);
    });
    parts.push("");
  }

  // Related Standards if applicable
  const otherRecs = allRecs.slice(1, 3);
  if (otherRecs.length > 0) {
    parts.push(`#### 3. Allied & Referenced Standards`);
    otherRecs.forEach((r) => {
      const mismatchNote = r.applicability === "MATERIAL_MISMATCH" ? ` *(⚠️ ${r.applicabilityReason})*` : "";
      parts.push(`* **${r.standardNumber}**: ${r.title}${mismatchNote}`);
    });
    parts.push("");
  }

  // Laboratories
  if (labs && labs.length > 0) {
    parts.push(`#### 4. Recognized Testing Laboratories`);
    parts.push(`Preliminary testing and factory sample verification can be conducted at these BIS-recognized testing centres:`);
    labs.slice(0, 3).forEach((l) => {
      parts.push(`* **${l.name}** — ${l.city}, ${l.state} *(Accreditation: ${l.accreditation_number || "BIS Central Directory"})*`);
    });
    parts.push("");
  }

  // Next Steps
  parts.push(`#### 5. Next Steps for Licensing`);
  parts.push(`1. Verify in-house lab test equipment against the Scheme of Testing and Inspection (STI).`);
  parts.push(`2. File online application **Form-V** on the official [BIS Manakonline Portal](https://www.manakonline.in).`);
  parts.push(`3. Submit sample test reports from an accredited laboratory.`);

  return parts.join("\n");
}
