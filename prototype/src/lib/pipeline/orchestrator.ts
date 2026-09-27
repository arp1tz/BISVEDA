/**
 * BISVEDA V9 — Master Pipeline Orchestrator (lib/pipeline/orchestrator.ts)
 * 
 * Chains the 12 pure stages:
 *  1. normalize
 *  2. route
 *  3. resolveContext
 *  4. resolveProduct
 *  5. retrieve (multi-store parallel)
 *  6. fuse (RRF, k=60)
 *  7. floorCheck (calibrated semantic threshold)
 *  8. adjudicate (deterministic, default not_applicable)
 *  9. buildPackage (frozen evidence package, S1..Sn)
 * 10. generate (LLM slot filling, temp 0.1)
 * 11. trustGate (number support & hallucination drop)
 * 12. respond (unified BisvedaResponse contract)
 */

import { normalizeQuery, NormalizedInput } from "./normalize";
import { routeQuery, RouteOutcome } from "./route";
import { resolveContext, ConversationContext, ConversationTurn } from "./context";
import { resolveProduct, ProductResolution } from "./product";
import { retrieveMultiStore, MultiStoreRetrievalResult } from "./retrieve";
import { fuseRetrievalResults, FusedResults } from "./fuse";
import { checkRelevanceFloor, FloorCheckResult } from "./floor";
import { adjudicateCandidates, AdjudicationPackage } from "./adjudicate";
import { buildEvidencePackage, EvidencePackage } from "./package";
import { generateAnswerProse, GeneratedProse } from "./generate";
import { runTrustGate, TrustGateReport } from "./trust";
import {
  BisvedaResponse,
  StageEvent,
  STAGE_LABELS,
  PipelineStage,
  buildFollowUps,
} from "./respond";
import { graphRepo } from "../knowledge/graph-repository";
import { checkOutdatedReference } from "../outdated-checker";
import { runRealVisionOcr, normalizeCmlNumber } from "../vision-inspector";

export type { BisvedaResponse, StageEvent, PipelineStage };
export { STAGE_LABELS, buildFollowUps };

export interface PipelineOptions {
  query: string;
  conversation_id?: string;
  sessionId?: string; // backwards compatibility
  history?: ConversationTurn[];
  userLocation?: { lat: number; lng: number };
  attachment?: { name: string; base64: string; type?: string };
  onStageEvent?: (event: StageEvent) => void;
}

export async function runPipeline(options: PipelineOptions): Promise<BisvedaResponse> {
  const conversationId = options.conversation_id || options.sessionId || `conv-${Date.now()}`;
  const emit = (stage: PipelineStage, status: "active" | "done", duration_ms?: number) => {
    if (options.onStageEvent) {
      options.onStageEvent({
        stage,
        label: STAGE_LABELS[stage],
        status,
        duration_ms,
      });
    }
  };

  const t0 = Date.now();
  let effectiveQuery = (options.query || "").trim();
  let visualEvidence: BisvedaResponse["visual_evidence"] = undefined;

  // ── Stage 0: Multimodal Visual Inspection (if image attached) ────────────────
  if (options.attachment?.base64) {
    emit("understand", "active");
    const visionOutput = await runRealVisionOcr(options.attachment.base64);

    if (!visionOutput) {
      emit("understand", "done", Date.now() - t0);
      return {
        conversation_id: conversationId,
        kind: "refusal",
        language: "en",
        grounding: "none",
        refusal: {
          reason: "not_in_sources",
          message:
            "Could not read the uploaded image. Please provide a clear, well-lit photograph showing the product rating plate, packaging label, or ISI mark.",
          next_steps: [
            { text: "Take a closer photo of the product marking" },
            { text: "Type the standard code (e.g. IS 4151) or product name directly" },
          ],
        },
        sources: [],
        follow_ups: [],
      };
    }

    const isCoffeeOrNegative =
      !visionOutput.is_product_image ||
      visionOutput.product_guess.toLowerCase().includes("coffee") ||
      visionOutput.product_guess.toLowerCase().includes("cup") ||
      visionOutput.product_guess.toLowerCase().includes("landscape") ||
      visionOutput.product_guess.toLowerCase().includes("blurry") ||
      visionOutput.product_guess.toLowerCase().includes("scenery");

    const hasAnyBisMarkers =
      visionOutput.is_numbers.length > 0 ||
      visionOutput.licence_numbers.length > 0 ||
      visionOutput.huid.length > 0 ||
      visionOutput.isi_mark_seen === true;

    if (isCoffeeOrNegative && !hasAnyBisMarkers) {
      emit("understand", "done", Date.now() - t0);
      return {
        conversation_id: conversationId,
        kind: "refusal",
        language: "en",
        grounding: "none",
        refusal: {
          reason: "not_in_sources",
          message: `I cannot identify an Indian Standard or BIS mark in this image. This appears to be ${visionOutput.product_guess || "an unknown object"}. Please provide a clear photo of the product rating plate, packaging label, or ISI mark.`,
          next_steps: [
            { text: "Upload a photo of a manufactured product or rating plate" },
            { text: "Search by standard number or product name in the search bar" },
          ],
        },
        sources: [],
        follow_ups: [],
      };
    }

    // Check for Ambiguous Product (e.g. helmet without visible standard code)
    if (
      visionOutput.product_guess.toLowerCase().includes("helmet") &&
      visionOutput.is_numbers.length === 0 &&
      !effectiveQuery.toLowerCase().includes("2925") &&
      !effectiveQuery.toLowerCase().includes("4151")
    ) {
      emit("understand", "done", Date.now() - t0);
      return {
        conversation_id: conversationId,
        kind: "clarify",
        language: "en",
        grounding: "verified",
        clarify: {
          question:
            "I see a helmet in the photo, but no standard number or ISI mark is clearly legible. Which type of helmet is this?",
          options: [
            { label: "Two-Wheeler Motorcycle Riding (IS 4151)", value: "Which standard applies to motorcycle rider helmets?" },
            { label: "Industrial & Construction Safety (IS 2925)", value: "Which standard applies to industrial safety helmets?" },
          ],
        },
        sources: [],
        follow_ups: [
          "Is IS 4151 mandatory for motorcycle helmets?",
          "Is IS 2925 mandatory for industrial helmets?",
        ],
      };
    }

    visualEvidence = {
      product_guess: visionOutput.product_guess,
      label_text: visionOutput.label_text,
      licence_number: normalizeCmlNumber(visionOutput.licence_numbers[0]) || undefined,
      isi_mark_seen: visionOutput.isi_mark_seen,
    };

    if (!effectiveQuery) {
      effectiveQuery = visionOutput.is_numbers[0]
        ? `Which standard applies to ${visionOutput.is_numbers[0]} and is it mandatory?`
        : `Which Indian Standard applies to ${visionOutput.product_guess}?`;
    } else if (visionOutput.is_numbers[0] && !effectiveQuery.includes("IS ")) {
      effectiveQuery = `${effectiveQuery} (${visionOutput.is_numbers[0]})`;
    }
  }

  // ── Stage 1: Normalize ───────────────────────────────────────────────────────
  emit("understand", "active");
  const normalized = normalizeQuery(effectiveQuery);

  // ── Stage 2: Route ───────────────────────────────────────────────────────────
  const context = resolveContext(conversationId, effectiveQuery, options.history);
  const route = routeQuery(normalized, Boolean(context.activeProduct));

  // Branch 2.1: Identifier (Speed Gate)
  if (route.kind === "identifier") {
    emit("understand", "done", Date.now() - t0);
    const std = await graphRepo.getStandard(route.identifier);
    if (std) {
      const qcos = await graphRepo.qcosForStandard(std.id);
      const activeQco = qcos.find((q) => q.status === "in_force");
      const schemes = await graphRepo.schemesForStandard(std.id);
      const labs = await graphRepo.labsForStandard(std.id);

      const s1 = {
        label: "S1",
        kind: "catalogue" as const,
        standard_id: std.id,
        title: `${std.id}${std.year ? `:${std.year}` : ""} — ${std.title}`,
        has_file: false,
        url: std.source_url,
        text: `${std.id}${std.year ? `:${std.year}` : ""} establishes the official Indian Standard requirements for ${std.title}.`,
      };

      return {
        conversation_id: conversationId,
        kind: "answer",
        language: normalized.detectedLanguage,
        grounding: "verified",
        primary_standard: { id: std.id, title: std.title },
        qco: activeQco ? { status: "mandatory", order_title: activeQco.title, source: activeQco.source_url } : { status: "unknown", source: std.source_url },
        standards: [{ id: std.id, title: std.title, class: "applies", why: `Exact standard number match for ${std.id}.`, source: std.source_url }],
        certification: schemes[0] ? { scheme_name: schemes[0].name, steps: schemes[0].steps } : null,
        labs: labs.slice(0, 3).map((l) => ({ id: l.id, name: l.name, city: l.city, state: l.state, source: l.source_url })),
        sources: [s1],
        answer: {
          headline: `The operative Indian Standard is ${std.id} — ${std.title} [S1].`,
          points: [
            `Standard status: ${std.status.toUpperCase()} under technical committee ${std.committee || "BIS"} [S1].`,
            activeQco ? `BIS certification is mandatory under the ${activeQco.title} [S1].` : `Check official BIS notifications for mandatory certification status [S1].`,
          ],
          next_steps: schemes[0]?.steps?.slice(0, 2).map((s) => s.text) || [],
        },
        follow_ups: buildFollowUps({ id: std.id, title: std.title }, labs.length > 0, Boolean(schemes[0])),
        visual_evidence: visualEvidence,
      };
    }
  }

  // Branch 2.2: Smalltalk
  if (route.kind === "smalltalk") {
    emit("understand", "done", Date.now() - t0);
    return {
      conversation_id: conversationId,
      kind: "smalltalk",
      language: route.lang,
      grounding: "none",
      answer: {
        headline: route.reply,
        points: [],
        next_steps: [],
      },
      sources: [],
      follow_ups: [
        "Which standard applies to two-wheeler helmets?",
        "Is BIS mandatory for pressure cookers?",
        "What are the standards for children's toys?",
      ],
    };
  }

  // Branch 2.3: Gibberish
  if (route.kind === "gibberish") {
    emit("understand", "done", Date.now() - t0);
    return {
      conversation_id: conversationId,
      kind: "refusal",
      language: normalized.detectedLanguage,
      grounding: "none",
      refusal: {
        reason: "gibberish",
        message: route.message,
        next_steps: [
          { text: "Ask about a specific product, such as helmets, toys, or pressure cookers." },
        ],
      },
      sources: [],
      follow_ups: [],
    };
  }

  // Branch 2.4: Out of Scope
  if (route.kind === "out_of_scope") {
    emit("understand", "done", Date.now() - t0);
    return {
      conversation_id: conversationId,
      kind: "refusal",
      language: normalized.detectedLanguage,
      grounding: "none",
      refusal: {
        reason: "out_of_scope",
        message: route.message,
        next_steps: [
          { text: "Visit National Consumer Helpline", url: "https://consumerhelpline.gov.in/" },
          { text: "Visit Official BIS Portal", url: "https://www.bis.gov.in/" },
        ],
      },
      sources: [],
      follow_ups: [],
    };
  }

  // Branch 2.5: Needs Clarification (Fixes B3)
  if (route.kind === "needs_clarification") {
    emit("understand", "done", Date.now() - t0);
    return {
      conversation_id: conversationId,
      kind: "clarify",
      language: normalized.detectedLanguage,
      grounding: "none",
      clarify: {
        question: route.prompt,
        options: route.options,
      },
      sources: [],
      follow_ups: [],
    };
  }

  // Branch 2.6: Explain Simply Follow-up
  const isExplainSimply = /\b(?:explain\s*(?:this\s*)?(?:simply|in\s*simple|plain)|simplify|everyday\s*language|without\s*technical\s*jargon|samjhao|samjhaiye)\b/i.test(normalized.normalizedText);
  if (isExplainSimply && context.activeStandards.length > 0) {
    const std = await graphRepo.getStandard(context.activeStandards[0]);
    if (std) {
      emit("understand", "done", Date.now() - t0);
      const qcos = await graphRepo.qcosForStandard(std.id);
      const activeQco = qcos.find((q) => q.status === "in_force");
      const schemes = await graphRepo.schemesForStandard(std.id);
      const labs = await graphRepo.labsForStandard(std.id);

      return {
        conversation_id: conversationId,
        kind: "answer",
        language: normalized.detectedLanguage,
        grounding: "verified",
        primary_standard: { id: std.id, title: std.title },
        qco: activeQco
          ? { status: "mandatory", order_title: activeQco.title, source: activeQco.source_url }
          : { status: "unknown", source: std.source_url },
        standards: [{ id: std.id, title: std.title, class: "applies", why: `Current operative Indian Standard for ${std.title}.`, source: std.source_url }],
        certification: schemes[0] ? { scheme_name: schemes[0].name, steps: schemes[0].steps } : null,
        labs: labs.slice(0, 5).map((l) => ({ id: l.id, name: l.name, city: l.city, state: l.state, source: l.source_url })),
        sources: [{
          label: "S1",
          kind: "catalogue",
          standard_id: std.id,
          title: `${std.id} — ${std.title}`,
          has_file: false,
          url: std.source_url,
          text: `Official Indian Standard ${std.id} establishes safety requirements for ${std.title}.`,
        }],
        answer: {
          headline: `In Simple Everyday Terms: What You Need to Know About ${std.id}`,
          points: [
            `If you make, import, or sell this product in India, it must strictly meet Indian Standard ${std.id}.`,
            activeQco
              ? `BIS certification is legally mandatory under government orders. You cannot sell this item without the official ISI mark.`
              : `Compliance ensures consumer safety and durability.`,
            `To get certified, a manufacturer submits test samples to a BIS recognized lab, undergoes a factory inspection, and receives a CM/L licence number.`,
          ],
          next_steps: [
            `Obtain the official specifications for ${std.id} from the BIS portal.`,
            `Contact an accredited lab from the list below to test sample batches.`,
            `Apply online on the Manakonline portal under Scheme-I for factory verification.`,
          ],
        },
        follow_ups: [
          `Which labs can test ${std.id}?`,
          `What are the certification steps for ${std.id}?`,
          `How much does BIS certification cost?`,
        ],
      };
    }
  }

  emit("understand", "done", Date.now() - t0);

  // ── Stage 4: Product Resolution ──────────────────────────────────────────────
  const productRes = resolveProduct(normalized.workingEnglishText);
  // Follow-up context inheritance: if query names no product, inherit from context
  if (!productRes.preferredStandardId && context.activeStandards.length > 0) {
    productRes.preferredStandardId = context.activeStandards[0];
  }
  if (!productRes.matchedTerm && context.activeProduct) {
    productRes.matchedTerm = context.activeProduct;
  }

  // ── Stage 5: Multi-Store Retrieval ───────────────────────────────────────────
  emit("search", "active");
  const tSearch = Date.now();
  const rawRetrieval = await retrieveMultiStore(
    normalized.workingEnglishText,
    normalized.canonicalStandards,
    productRes,
    context.activeStandards
  );

  // ── Stage 6: Reciprocal Rank Fusion ─────────────────────────────────────────
  const fused = fuseRetrievalResults(rawRetrieval, 60);
  emit("search", "done", Date.now() - tSearch);

  // ── Stage 7: Semantic Floor Check ───────────────────────────────────────────
  const floorCheck = checkRelevanceFloor(fused, rawRetrieval);
  if (!floorCheck.passed) {
    return {
      conversation_id: conversationId,
      kind: "refusal",
      language: normalized.detectedLanguage,
      grounding: "none",
      refusal: {
        reason: "not_in_sources",
        message: floorCheck.refusalMessage || "I couldn't find this in the BIS sources I have in this prototype.",
        next_steps: floorCheck.officialRoutes || [],
      },
      sources: [],
      follow_ups: [
        "Search BIS Standards Catalogue",
        "Which product categories are mandatory under BIS?",
      ],
    };
  }

  // ── Stage 8: Adjudicate Candidates ──────────────────────────────────────────
  emit("check", "active");
  const tCheck = Date.now();
  const adjudicated = await adjudicateCandidates(
    normalized.workingEnglishText,
    fused,
    productRes,
    normalized.canonicalStandards,
    options.userLocation,
    context.activeStandards
  );
  emit("check", "done", Date.now() - tCheck);

  if (!adjudicated.primaryStandard && adjudicated.standards.length === 0) {
    return {
      conversation_id: conversationId,
      kind: "refusal",
      language: normalized.detectedLanguage,
      grounding: "none",
      refusal: {
        reason: "not_in_sources",
        message: "No applicable Indian Standard was confirmed for this product in our current verified sources.",
        next_steps: [
          { text: "Check the official BIS Catalogue", url: "https://www.services.bis.gov.in/" },
        ],
      },
      sources: [],
      follow_ups: [],
    };
  }

  // ── Stage 9: Build Evidence Package ─────────────────────────────────────────
  const evidencePkg = buildEvidencePackage(adjudicated, fused.rankedChunks);

  // ── Stage 10: Generate Prose Slots ──────────────────────────────────────────
  emit("write", "active");
  const tWrite = Date.now();
  const rawProse = await generateAnswerProse(
    effectiveQuery,
    evidencePkg,
    normalized.detectedLanguage
  );

  // ── Stage 11: Trust Gate Filtering ──────────────────────────────────────────
  const trustReport = runTrustGate(rawProse, evidencePkg, normalized.detectedLanguage);
  emit("write", "done", Date.now() - tWrite);

  // ── Stage 12: Unified Response ──────────────────────────────────────────────
  const finalProse = trustReport.sanitizedProse;
  const outdatedAlert = checkOutdatedReference(effectiveQuery);
  if (outdatedAlert) {
    finalProse.headline = `${outdatedAlert.queriedStandard} is superseded by ${outdatedAlert.currentStandard}.`;
    finalProse.points = [
      outdatedAlert.enforcementNotice,
      ...finalProse.points,
    ].slice(0, 4);
  }

  return {
    conversation_id: conversationId,
    kind: "answer",
    language: normalized.detectedLanguage,
    grounding: adjudicated.grounding,
    answer: finalProse,
    primary_standard: adjudicated.primaryStandard || undefined,
    qco: adjudicated.qco || undefined,
    standards: adjudicated.standards.map((s) => ({
      id: s.id,
      title: s.title,
      class: s.class as any,
      why: s.why,
      source: s.source,
    })),
    certification: adjudicated.scheme,
    labs: adjudicated.labs.length > 0 ? adjudicated.labs : null,
    sources: evidencePkg.sources,
    follow_ups: buildFollowUps(
      adjudicated.primaryStandard,
      adjudicated.labs.length > 0,
      Boolean(adjudicated.scheme)
    ),
    visual_evidence: visualEvidence,
  };
}
