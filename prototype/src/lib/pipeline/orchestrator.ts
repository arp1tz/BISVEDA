/**
 * BISVEDA — Conversational Orchestrator (lib/pipeline/orchestrator.ts, P3.5)
 *
 * runTurn() chains: understand -> (vision) -> retrieve -> fuse -> floor ->
 * adjudicate -> package -> answer -> trust -> respond. Stage events are
 * emitted only for stages that actually ran (A16).
 *
 * `find_labs` / `find_ahc` / `hallmark` / `mark_check` / `form_i` intents
 * fall back to the kb_question path until P5 builds their tools — an
 * honest "search what we have" rather than a broken feature.
 */

import { normalizeQuery } from "./normalize";
import { resolveContext, ConversationContext, ConversationTurn } from "./context";
import { understandTurn, ConversationTurnSummary } from "./understand";
import { retrieveMultiStore } from "./retrieve";
import { fuseRetrievalResults } from "./fuse";
import { checkRelevanceFloor } from "./floor";
import { adjudicateCandidates } from "./adjudicate";
import { buildEvidencePackage, EvidencePackage, Source } from "./package";
import { generateAnswer, evidenceOnlyAnswer } from "./answer";
import { runTrustGate } from "./trust";
import { BisvedaResponse, StageEvent, STAGE_LABELS, PipelineStage, buildFollowUps, ImageReadCard, MarkCard, HallmarkCard, LabsCard, AhcCard, FormICard } from "./respond";
import { getAllStandards, getChunksByStandard, getStandardById, isScopeChunk } from "../kb/store";
import { inspectImage, normalizeCmlNumber, validateHuid, parsePurity, VisionInspectionResult } from "../vision";
import { findLabs } from "../tools/labs";
import { findAhc } from "../tools/ahc";
import { processHallmarkOrMark } from "../tools/hallmark";
import { stepFormI, parseFormInputsFromText } from "../tools/form_i";
import { matchCanonicalFaq } from "./speedgate";

export type { BisvedaResponse, StageEvent, PipelineStage };
export { STAGE_LABELS, buildFollowUps };

export interface PipelineOptions {
  query: string;
  conversation_id?: string;
  sessionId?: string; // backwards compatibility with older callers
  history?: ConversationTurn[];
  userLocation?: { lat: number; lng: number };
  attachment?: { name: string; base64: string; type?: string };
  formState?: Record<string, unknown>;
  onStageEvent?: (event: StageEvent) => void;
}

function knownStandardsList(): string {
  return getAllStandards()
    .map((s) => s.id)
    .join(", ");
}

function summarizeHistoryForLLM(history: ConversationTurn[] = [], maxTurns = 3): ConversationTurnSummary[] {
  const recent = history.slice(-maxTurns);
  const out: ConversationTurnSummary[] = [];
  for (const turn of recent) {
    if (turn.query) out.push({ role: "user", text: turn.query });
    const respText = turn.response?.text;
    if (typeof respText === "string" && respText.trim()) {
      out.push({ role: "assistant", text: respText.slice(0, 200) });
    }
  }
  return out;
}

function refusalNotInSources(conversationId: string, language: string, extra?: string): BisvedaResponse {
  return {
    conversation_id: conversationId,
    kind: "refusal",
    language,
    grounding: "none",
    text: "",
    sources: [],
    refusal: {
      reason: "not_in_sources",
      message:
        (extra ? `${extra} ` : "") +
        `We couldn't find this in the documents we hold. Our knowledge base currently covers: ${knownStandardsList()}.`,
      next_steps: [
        { text: "Search the official BIS Standards Catalogue", url: "https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/knowyourstandards/indian_standards/isdetails" },
        { text: "National Consumer Helpline", url: "https://consumerhelpline.gov.in/" },
      ],
    },
    follow_ups: [],
  };
}

async function answerForStandard(
  conversationId: string,
  question: string,
  standardId: string,
  language: string,
  historyText?: string,
  userProvidedText?: string
): Promise<BisvedaResponse | null> {
  const std = getStandardById(standardId);
  if (!std) return null;

  const chunks = getChunksByStandard(std.id);
  const scopeChunks = chunks.filter((c) => isScopeChunk(c.clause, c.clause_title)).slice(0, 4);
  const evidenceChunks = (scopeChunks.length > 0 ? scopeChunks : chunks.slice(0, 4)).map((c, i) => ({ ...c, similarity: undefined, rrfScore: 1000 - i }));

  const pkg: EvidencePackage = buildEvidencePackage(
    { primaryStandard: { id: std.id, title: std.title }, standards: [{ id: std.id, title: std.title, class: "applies", why: "Exact standard match.", source_url: `/api/docs/${std.doc_id}` }], grounding: "verified" },
    evidenceChunks
  );

  const generated = await generateAnswer({ question, pkg, language, historyText, userProvidedText });
  const trust = runTrustGate(generated.text, pkg);
  const finalText = trust.allDropped ? evidenceOnlyAnswer(pkg, language) : trust.text;

  return {
    conversation_id: conversationId,
    kind: "answer",
    language,
    grounding: "verified",
    text: finalText,
    standards: pkg.standards,
    sources: pkg.sources,
    follow_ups: buildFollowUps({ id: std.id, title: std.title }),
  };
}

export async function runPipeline(options: PipelineOptions): Promise<BisvedaResponse> {
  const conversationId = options.conversation_id || options.sessionId || `conv-${Date.now()}`;
  const emit = (stage: PipelineStage, status: "active" | "done", duration_ms?: number) => {
    options.onStageEvent?.({ stage, label: STAGE_LABELS[stage], status, duration_ms });
  };

  const t0 = Date.now();
  let effectiveQuery = (options.query || "").trim();
  let imageCard: ImageReadCard | undefined;
  let markCard: MarkCard | undefined;
  let hallmarkCard: HallmarkCard | undefined;
  let ahcCard: AhcCard | undefined;
  let formICard: FormICard | undefined;
  let userProvidedText: string | undefined;

  const buildCards = (): BisvedaResponse["cards"] => {
    const cards: Record<string, unknown> = {};
    if (imageCard) cards.image = imageCard;
    if (markCard) cards.mark = markCard;
    if (hallmarkCard) cards.hallmark = hallmarkCard;
    if (ahcCard) cards.ahc = ahcCard;
    if (formICard) cards.form_i = formICard;
    return Object.keys(cards).length > 0 ? (cards as BisvedaResponse["cards"]) : undefined;
  };

  // ── Stage 0: Vision (if an image is attached) ───────────────────────────
  if (options.attachment?.base64) {
    emit("understand", "active");
    const vision = await inspectImage(options.attachment.base64, options.attachment.type);

    if (!vision) {
      emit("understand", "done", Date.now() - t0);
      return {
        conversation_id: conversationId,
        kind: "refusal",
        language: "en",
        grounding: "none",
        text: "",
        sources: [],
        refusal: {
          reason: "not_in_sources",
          message: "I couldn't read the uploaded image. Please provide a clear, well-lit photo of the product label, rating plate, or ISI/hallmark.",
          next_steps: [{ text: "Take a clearer photo of the product marking" }],
        },
        follow_ups: [],
      };
    }

    imageCard = {
      category: vision.category,
      product_guess: vision.product_guess,
      description: vision.description,
      label_text: vision.label_text,
      isi_mark_seen: vision.isi_mark_seen,
      bis_hallmark_seen: vision.bis_hallmark_seen,
      purity_mark: vision.purity_mark,
      huid: vision.huid,
      cml_number: vision.cml_number,
      confidence_note: vision.confidence_note,
    };

    // 1. Not a product or unreadable
    if (vision.category === "not_a_product" || vision.category === "unreadable") {
      emit("understand", "done", Date.now() - t0);
      return {
        conversation_id: conversationId,
        kind: "refusal",
        language: "en",
        grounding: "none",
        text: "",
        sources: [],
        cards: buildCards(),
        refusal: {
          reason: "not_in_sources",
          message: `This image appears to be ${vision.product_guess || "an object without commercial product labeling"}. Please provide a clear, well-lit photo of a product label, rating plate, or official BIS certification mark.`,
          next_steps: [{ text: "Upload a clear photo of a product label or BIS mark" }],
        },
        follow_ups: [],
      };
    }

    // 2. Other product (outside our 3 domains)
    if (vision.category === "other_product") {
      emit("understand", "done", Date.now() - t0);
      return {
        conversation_id: conversationId,
        kind: "refusal",
        language: "en",
        grounding: "none",
        text: "",
        sources: [],
        cards: buildCards(),
        refusal: {
          reason: "not_in_sources",
          message: `This looks like ${vision.product_guess}. We currently only hold official BIS standards for helmets (IS 4151, IS 2925), toys (IS 9873 series, IS 15644), and gold hallmarking (IS 1417, IS 1418, IS 15820).`,
          next_steps: [
            { text: "Search the official BIS Standards Catalogue", url: "https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/knowyourstandards/indian_standards/isdetails" },
          ],
        },
        follow_ups: [],
      };
    }

    // 3. Helmet without standard number or mark
    if (
      vision.category === "helmet" &&
      vision.is_numbers.length === 0 &&
      vision.isi_mark_seen !== true &&
      !vision.cml_number &&
      !/\bIS\s?\d/i.test(effectiveQuery)
    ) {
      emit("understand", "done", Date.now() - t0);
      return {
        conversation_id: conversationId,
        kind: "clarify",
        language: "en",
        grounding: "none",
        text: "I see a helmet, but no standard number or ISI mark is clearly legible. Which type is it?",
        sources: [],
        cards: buildCards(),
        clarify: {
          question: "Which type of helmet is this?",
          options: [
            { label: "Motorcycle / Two-Wheeler (IS 4151)", value: "Which standard applies to motorcycle rider helmets?" },
            { label: "Industrial / Construction Safety (IS 2925)", value: "Which standard applies to industrial safety helmets?" },
          ],
        },
        follow_ups: [],
      };
    }

    // 4. Gold jewellery
    if (vision.category === "gold_jewellery") {
      const parsedPurity = parsePurity(vision.purity_mark);
      const huidValid = vision.huid ? validateHuid(vision.huid) : undefined;
      hallmarkCard = {
        purity_karat: parsedPurity?.carat,
        purity_fineness: parsedPurity?.fineness,
        huid: vision.huid || undefined,
        huid_format_valid: huidValid?.valid,
      };

      userProvidedText = [
        vision.description ? `Visual observation: ${vision.description}` : "",
        vision.label_text ? `Markings read from jewellery: ${vision.label_text}` : "",
        vision.purity_mark ? `Purity mark: ${vision.purity_mark}${parsedPurity ? ` (${parsedPurity.standardGrade})` : ""}` : "",
        vision.huid ? `HUID code: ${vision.huid} (format: ${huidValid?.valid ? "valid 6-character alphanumeric" : "invalid format"})` : "",
        vision.bis_hallmark_seen === true ? "BIS hallmark triangular logo visible" : "",
      ]
        .filter(Boolean)
        .join("\n");

      if (!effectiveQuery) {
        effectiveQuery = "What are the BIS gold jewellery hallmarking requirements, purity grades, and marking rules under IS 1417?";
      }
    }

    // 5. Helmet or Toy with mark or CM/L
    if (vision.category === "helmet" || vision.category === "toy") {
      if (vision.cml_number) {
        markCard = {
          cml_number: vision.cml_number,
          note: `Licence number read: ${vision.cml_number}. Verify authenticity on the BIS Care app or Manak Online portal.`,
        };
      }

      userProvidedText = [
        vision.description ? `Visual observation: ${vision.description}` : "",
        vision.label_text ? `Label text read from photo: ${vision.label_text}` : "",
        vision.cml_number ? `Licence number: ${vision.cml_number}` : "",
        vision.isi_mark_seen === true ? "BIS Standard Mark (ISI) visible" : "",
      ]
        .filter(Boolean)
        .join("\n");

      if (!effectiveQuery) {
        const isMatch = vision.is_numbers.find((n) => /\bIS\s?\d/i.test(n));
        if (isMatch) {
          effectiveQuery = `Which standard applies to ${isMatch} and what does it cover?`;
        } else if (vision.category === "helmet") {
          effectiveQuery = `Which standard applies to ${vision.product_guess}?`;
        } else {
          effectiveQuery = `Which standards apply to ${vision.product_guess}?`;
        }
      } else if (vision.is_numbers[0] && !/\bIS\s?\d/i.test(effectiveQuery)) {
        effectiveQuery = `${effectiveQuery} (${vision.is_numbers[0]})`;
      }
    }
  }

  // ── Stage 1: Context (multi-turn) ────────────────────────────────────────
  const context: ConversationContext = resolveContext(conversationId, effectiveQuery, options.history);
  const historyForLLM = summarizeHistoryForLLM(options.history);
  const historyText = historyForLLM.map((h) => `${h.role}: ${h.text}`).join("\n");

  // ── Stage 2: Understand ───────────────────────────────────────────────────
  if (!options.attachment?.base64) emit("understand", "active");
  const understood = await understandTurn({
    message: effectiveQuery,
    history: historyForLLM,
    imageSummary: userProvidedText,
    formState: options.formState,
  });
  emit("understand", "done", Date.now() - t0);

  const normalized = normalizeQuery(effectiveQuery);

  // ── Canonical Verified FAQ Match (Speedgate Layer) ───────────────────────
  if (
    understood.intent !== "smalltalk" &&
    understood.intent !== "gibberish" &&
    understood.intent !== "out_of_scope" &&
    understood.intent !== "form_i"
  ) {
    const canonicalFaqMatch = matchCanonicalFaq(effectiveQuery, understood.language, conversationId);
    if (canonicalFaqMatch) {
      return {
        ...canonicalFaqMatch,
        cards: { ...buildCards(), ...(canonicalFaqMatch.cards || {}) },
      };
    }
  }

  // ── Branch: identifier (exact IS/CM-L/HUID pattern) ──────────────────────
  if (understood.intent === "identifier") {
    const stdId = understood.standards[0];
    const resp = stdId ? await answerForStandard(conversationId, effectiveQuery, stdId, understood.language, historyText, userProvidedText) : null;
    if (resp) return { ...resp, cards: buildCards() };
    return refusalNotInSources(conversationId, understood.language, `"${stdId}" is not one of the standards we hold.`);
  }

  // ── Branch: smalltalk / gibberish / out_of_scope ─────────────────────────
  if (understood.intent === "smalltalk" || understood.intent === "gibberish" || understood.intent === "out_of_scope") {
    return {
      conversation_id: conversationId,
      kind: understood.intent === "smalltalk" ? "smalltalk" : "refusal",
      language: understood.language,
      grounding: "none",
      text: understood.intent === "smalltalk" ? understood.fastReply || "" : "",
      sources: [],
      refusal:
        understood.intent === "smalltalk"
          ? undefined
          : {
              reason: understood.intent,
              message: understood.fastReply || "This is outside what BISVEDA covers.",
              next_steps: [{ text: "Visit the official BIS Portal", url: "https://www.bis.gov.in/" }],
            },
      follow_ups: understood.intent === "smalltalk" ? [`Which standard applies to helmets?`, `What are the gold hallmarking grades?`] : [],
    };
  }

  // ── Branch: needs clarification ──────────────────────────────────────────
  if (understood.intent === "clarify" && understood.clarify) {
    return {
      conversation_id: conversationId,
      kind: "clarify",
      language: understood.language,
      grounding: "none",
      text: understood.clarify.prompt,
      sources: [],
      clarify: { question: understood.clarify.prompt, options: understood.clarify.options },
      follow_ups: [],
    };
  }

  // ── Branch: find_labs (P5.1) ─────────────────────────────────────────────
  if (understood.intent === "find_labs") {
    let targetStd = understood.standards[0] || context.activeStandards[0];
    if (!targetStd && understood.product) {
      if (/helmet/i.test(understood.product)) targetStd = "IS 4151";
      else if (/toy/i.test(understood.product)) targetStd = "IS 9873 (Part 1)";
      else if (/gold/i.test(understood.product)) targetStd = "IS 1417";
    }

    const labsResult = findLabs({
      standard: targetStd,
      city: understood.city,
      location: options.userLocation,
    });

    const labsCard: LabsCard = {
      standard_id: labsResult.standardId || targetStd || "General",
      labs: labsResult.labs,
      retrieved_note: labsResult.retrievedNote,
    };

    let answerText = labsResult.textPrefix;
    let sources: Source[] = [];
    let standardsList = targetStd
      ? [{ id: targetStd, title: getStandardById(targetStd)?.title || targetStd, class: "applies", why: "Standard in scope for lab testing." }]
      : undefined;

    try {
      const canonicalForRetrieval = targetStd ? [{ id: targetStd } as any] : normalized.canonicalStandards;
      const rawRetrieval = await retrieveMultiStore(
        understood.standalone_query || effectiveQuery,
        canonicalForRetrieval,
        context.activeStandards
      );
      const fused = fuseRetrievalResults(rawRetrieval, 60);
      const adjudicated = adjudicateCandidates(fused, rawRetrieval);
      if (adjudicated.primaryStandard) {
        const pkg = buildEvidencePackage(adjudicated, fused.rankedChunks);
        if (pkg.sources.length > 0) {
          const generated = await generateAnswer({
            question: understood.standalone_query || effectiveQuery,
            pkg,
            language: understood.language,
            historyText,
            userProvidedText: labsResult.retrievedNote,
          });
          const trust = runTrustGate(generated.text, pkg);
          if (!trust.allDropped && trust.text) {
            answerText = `${labsResult.textPrefix}\n\n${trust.text}`;
            sources = pkg.sources;
            standardsList = pkg.standards;
          }
        }
      }
    } catch {
      // Use clean text prefix
    }

    if (labsResult.labs.length === 0) {
      answerText = `No active BIS-recognised laboratories listing ${targetStd || "this product"} in scope were found${understood.city ? ` near ${understood.city}` : ""}.`;
    }

    const allCards = {
      ...buildCards(),
      labs: labsCard,
    };

    return {
      conversation_id: conversationId,
      kind: "answer",
      language: understood.language,
      grounding: sources.length > 0 ? "verified" : "none",
      text: answerText,
      standards: standardsList,
      sources,
      cards: allCards,
      follow_ups: targetStd ? [`What tests are required under ${targetStd}?`, `Where else can I test ${targetStd}?`] : [],
    };
  }

  // ── Branch: find_ahc (P5.2) ──────────────────────────────────────────────
  if (understood.intent === "find_ahc") {
    const ahcResult = findAhc({
      city: understood.city,
      location: options.userLocation,
    });

    const ahcCardData: AhcCard = {
      ahcs: ahcResult.ahcs,
    };

    let answerText = `${ahcResult.textPrefix}\n\n`;
    if (ahcResult.ahcs.length > 0) {
      answerText += ahcResult.ahcs
        .slice(0, 5)
        .map((a, i) => `${i + 1}. **${a.name}** — ${a.district || ""}, ${a.state || ""} (Status: ${a.status})`)
        .join("\n");
      answerText += `\n\n_${ahcResult.retrievedNote}_`;
    } else {
      answerText = `No Operative Assaying and Hallmarking Centres (AHCs) were found in the current directory${understood.city ? ` near ${understood.city}` : ""}.`;
    }

    const allCards = {
      ...buildCards(),
      ahc: ahcCardData,
    };

    return {
      conversation_id: conversationId,
      kind: "answer",
      language: understood.language,
      grounding: "none",
      text: answerText,
      sources: [],
      cards: allCards,
      follow_ups: [`What are the hallmarking competence requirements under IS 15820?`, `How do I register my jewellery shop for hallmarking?`],
    };
  }

  // ── Branch: hallmark / mark_check (P5.3) ─────────────────────────────────
  if (understood.intent === "hallmark" || understood.intent === "mark_check") {
    const markResult = processHallmarkOrMark({
      query: effectiveQuery,
      purityRaw: imageCard?.purity_mark,
      huidRaw: imageCard?.huid,
      cmlRaw: imageCard?.cml_number,
    });

    if (markResult) {
      if (markResult.hallmarkCard) hallmarkCard = markResult.hallmarkCard;
      if (markResult.markCard) markCard = markResult.markCard;

      let answerText = markResult.text;
      let sources: Source[] = [];
      let standardsList: BisvedaResponse["standards"] = undefined;

      const stdToRetrieve = markResult.targetStandardId || "IS 1417";
      const stdObj = getStandardById(stdToRetrieve);
      if (stdObj) {
        try {
          const rawRetrieval = await retrieveMultiStore(effectiveQuery, [{ id: stdObj.id } as any], [stdObj.id]);
          const fused = fuseRetrievalResults(rawRetrieval, 60);
          const adjudicated = adjudicateCandidates(fused, rawRetrieval);
          if (adjudicated.primaryStandard) {
            const pkg = buildEvidencePackage(adjudicated, fused.rankedChunks);
            if (pkg.sources.length > 0) {
              const generated = await generateAnswer({
                question: effectiveQuery,
                pkg,
                language: understood.language,
                historyText,
                userProvidedText: markResult.text,
              });
              const trust = runTrustGate(generated.text, pkg);
              if (!trust.allDropped && trust.text) {
                answerText = `${markResult.text}\n\n${trust.text}`;
                sources = pkg.sources;
                standardsList = pkg.standards;
              }
            }
          }
        } catch {}
      }

      return {
        conversation_id: conversationId,
        kind: "answer",
        language: understood.language,
        grounding: sources.length > 0 ? "verified" : "none",
        text: answerText,
        standards: standardsList,
        sources,
        cards: buildCards(),
        follow_ups: [`What are the gold purity grades under IS 1417?`, `How to verify HUID in the BIS Care app?`],
      };
    }
  }

  // ── Branch: form_i (P5.4) ────────────────────────────────────────────────
  if (understood.intent === "form_i") {
    const deterministic = parseFormInputsFromText(effectiveQuery);
    const combinedUpdates = {
      ...(understood.form_updates || {}),
      ...deterministic,
    };
    const stepResult = stepFormI(options.formState, combinedUpdates);
    formICard = stepResult.card;

    let sources: Source[] = [];
    let standardsList: BisvedaResponse["standards"] = undefined;
    try {
      const rawRetrieval = await retrieveMultiStore(effectiveQuery, [{ id: "Form I" } as any], ["form-i-jeweller"]);
      const fused = fuseRetrievalResults(rawRetrieval, 60);
      const adjudicated = adjudicateCandidates(fused, rawRetrieval);
      if (adjudicated.primaryStandard) {
        const pkg = buildEvidencePackage(adjudicated, fused.rankedChunks);
        if (pkg.sources.length > 0) {
          sources = pkg.sources;
          standardsList = pkg.standards;
        }
      }
    } catch {}

    return {
      conversation_id: conversationId,
      kind: stepResult.isComplete ? "answer" : "form_question",
      language: understood.language,
      grounding: sources.length > 0 ? "verified" : "none",
      text: stepResult.text,
      standards: standardsList,
      sources,
      cards: buildCards(),
      follow_ups: stepResult.isComplete
        ? [`How to submit Form I on Manak Online?`, `What fees are required for jeweller registration?`]
        : [`What documents are needed for Form I?`, `Which standards apply to jeweller registration?`],
    };
  }

  // ── Branch: kb_question ──
  emit("search", "active");
  const tSearch = Date.now();
  const standardsFromUnderstand = understood.standards.filter((id) => getStandardById(id));
  const canonicalForRetrieval = standardsFromUnderstand.length > 0 ? standardsFromUnderstand.map((id) => ({ id } as any)) : normalized.canonicalStandards;

  const rawRetrieval = await retrieveMultiStore(understood.standalone_query || effectiveQuery, canonicalForRetrieval, context.activeStandards);
  const fused = fuseRetrievalResults(rawRetrieval, 60);
  emit("search", "done", Date.now() - tSearch);

  const floorCheck = checkRelevanceFloor(fused, rawRetrieval);
  if (!floorCheck.passed) {
    return {
      ...refusalNotInSources(conversationId, understood.language),
      cards: buildCards(),
    };
  }

  emit("check", "active");
  const tCheck = Date.now();
  const adjudicated = adjudicateCandidates(fused, rawRetrieval);
  emit("check", "done", Date.now() - tCheck);

  if (!adjudicated.primaryStandard) {
    return { ...refusalNotInSources(conversationId, understood.language), cards: buildCards() };
  }

  const pkg = buildEvidencePackage(adjudicated, fused.rankedChunks);
  if (pkg.sources.length === 0) {
    return { ...refusalNotInSources(conversationId, understood.language), cards: buildCards() };
  }

  emit("write", "active");
  const tWrite = Date.now();
  const generated = await generateAnswer({
    question: understood.standalone_query || effectiveQuery,
    pkg,
    language: understood.language,
    historyText,
    userProvidedText,
  });
  const trust = runTrustGate(generated.text, pkg);
  emit("write", "done", Date.now() - tWrite);

  if (trust.allDropped) {
    return { ...refusalNotInSources(conversationId, understood.language), cards: buildCards() };
  }

  return {
    conversation_id: conversationId,
    kind: "answer",
    language: understood.language,
    grounding: adjudicated.grounding,
    text: trust.text,
    standards: pkg.standards,
    sources: pkg.sources,
    cards: buildCards(),
    follow_ups: buildFollowUps(adjudicated.primaryStandard),
  };
}
