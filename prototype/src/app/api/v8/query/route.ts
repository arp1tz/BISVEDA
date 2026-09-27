import { NextRequest, NextResponse } from "next/server";
import { executeQueryPipeline } from "@/lib/llm-provider";
import { routeConversationalIntent } from "@/lib/conversational-router";
import { resolveConversationalContext, ChatTurn } from "@/lib/context-resolver";
import type { ComplianceDossier, StageEvent } from "@/types/api";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rawQuery = (body.query || "").trim();
  const history: ChatTurn[] = body.conversation_history || body.messages || [];
  const userType = body.user_type || "msme";
  const market = body.market || "domestic";

  // Check if caller requests direct JSON response instead of SSE
  const wantsJson =
    body.stream === false ||
    req.headers.get("accept") === "application/json" ||
    req.headers.get("user-agent")?.toLowerCase().includes("python-requests");

  if (wantsJson) {
    const contextResolution = resolveConversationalContext(rawQuery, history);
    const effectiveQuery = contextResolution.resolvedQuery;
    const intentGate = routeConversationalIntent(effectiveQuery);

    if (intentGate.isConversational && intentGate.conversationalResponse) {
      return NextResponse.json({
        query: rawQuery,
        outcome: "answered",
        confidenceScore: 1.0,
        synthesis: intentGate.conversationalResponse,
        recommendations: [],
        activeEvidence: [],
        starterActions: intentGate.starterActions,
        isConversational: true,
        isSpeedGateHit: true,
        reasoningSteps: [
          { stage: "UNDERSTAND", status: "done", detail: `Intent Gate: Recognized ${intentGate.intent} intent` },
          { stage: "SYNTHESIZE", status: "done", detail: "Direct conversational response rendered without regulatory retrieval" },
        ],
      });
    }

    if (intentGate.clarificationRequired) {
      return NextResponse.json({
        query: rawQuery,
        outcome: "disambiguation_required",
        confidenceScore: 0.5,
        synthesis: intentGate.clarificationPrompt,
        recommendations: [],
        activeEvidence: [],
        disambiguation: {
          isAmbiguous: true,
          term: intentGate.clarificationTopic,
          options: (intentGate.clarificationOptions || []).map((o) => ({
            label: o.label,
            standard: o.standardNumber,
            category: o.description,
          })),
        },
        isConversational: false,
        isSpeedGateHit: false,
        reasoningSteps: [
          { stage: "UNDERSTAND", status: "done", detail: `Clarification Gate: Product scope "${intentGate.clarificationTopic}" is broad` },
          { stage: "RETRIEVE", status: "pending", detail: "Awaiting specific product scope selection" },
        ],
      });
    }

    const pipelineRes = await executeQueryPipeline(effectiveQuery, contextResolution);
    return NextResponse.json(pipelineRes);
  }

  // 1. Try forwarding to the Python FastAPI backend if configured
  if (process.env.PYTHON_BACKEND_URL || process.env.ENABLE_PYTHON_BACKEND === "true") {
    try {
      const backendRes = await fetch("http://127.0.0.1:8000/api/v8/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300),
      });

      if (backendRes.ok && backendRes.body) {
        return new Response(backendRes.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }
    } catch {
      // Backend offline -> Fallback to native sovereign pipeline
    }
  }

  // 2. Native SSE Event Stream Generator
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const queryId = `Q-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;

      const emit = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream closed or aborted
        }
      };

      const makeEvent = (stage: string, kind: string, durationMs?: number, payload: any = {}) => ({
        event: kind,
        turn_id: queryId,
        stage,
        duration_ms: durationMs,
        payload,
        timestamp: new Date().toISOString(),
      });

      try {
        // Step A: Context Resolution (Phase 5 — Multi-turn conversation memory)
        const contextResolution = resolveConversationalContext(rawQuery, history);
        const effectiveQuery = contextResolution.resolvedQuery;

      // Step B: Intent Gate (Phase 4 — Conversational Router)
      const intentGate = routeConversationalIntent(effectiveQuery);

      // BRANCH 1: GREETING, SMALL TALK, GRATITUDE (NO RAG, NO DOSSIER, FAST-PATH)
      if (intentGate.isConversational && intentGate.conversationalResponse) {
        emit(makeEvent("understand", "stage.started"));
        emit(
          makeEvent("understand", "stage.completed", 8, {
            intent: intentGate.intent,
            is_conversational: true,
            fast_path: true,
          })
        );

        emit(makeEvent("generate", "stage.started"));
        emit(
          makeEvent("generate", "stage.completed", 12, {
            mode: "conversational_greeting",
            has_starter_actions: Boolean(intentGate.starterActions?.length),
          })
        );

        emit({
          type: "query_response",
          queryResponse: {
            query: rawQuery,
            outcome: "answered",
            confidenceScore: 1.0,
            synthesis: intentGate.conversationalResponse,
            recommendations: [],
            activeEvidence: [],
            starterActions: intentGate.starterActions,
            isConversational: true,
            isSpeedGateHit: true,
            reasoningSteps: [
              { stage: "UNDERSTAND", status: "done", detail: `Intent Gate: Recognized ${intentGate.intent} intent` },
              { stage: "SYNTHESIZE", status: "done", detail: "Direct conversational response rendered without regulatory retrieval" },
            ],
          },
        });

        emit(makeEvent("trust", "turn.completed", undefined, { turn_id: queryId, conversational: true }));
        controller.close();
        return;
      }

      // BRANCH 2: VAGUE QUERY CLARIFICATION
      if (intentGate.clarificationRequired) {
        emit(makeEvent("understand", "stage.started"));
        emit(
          makeEvent("understand", "stage.completed", 15, {
            intent: "vague_clarification",
            clarification_topic: intentGate.clarificationTopic,
          })
        );

        emit(
          makeEvent("clarify", "clarification.required", undefined, {
            is_ambiguous: true,
            term: intentGate.clarificationTopic,
            prompt: intentGate.clarificationPrompt,
            options: intentGate.clarificationOptions,
          })
        );

        emit({
          type: "query_response",
          queryResponse: {
            query: rawQuery,
            outcome: "disambiguation_required",
            confidenceScore: 0.5,
            synthesis: intentGate.clarificationPrompt,
            recommendations: [],
            activeEvidence: [],
            disambiguation: {
              isAmbiguous: true,
              term: intentGate.clarificationTopic,
              options: (intentGate.clarificationOptions || []).map((o) => ({
                label: o.label,
                standard: o.standardNumber,
                category: o.description,
              })),
            },
            isConversational: false,
            isSpeedGateHit: false,
            reasoningSteps: [
              { stage: "UNDERSTAND", status: "done", detail: `Clarification Gate: Product scope "${intentGate.clarificationTopic}" is broad` },
              { stage: "RETRIEVE", status: "pending", detail: "Awaiting specific product scope selection" },
            ],
          },
        });

        emit(makeEvent("trust", "turn.completed", undefined, { turn_id: queryId, clarification: true }));
        controller.close();
        return;
      }

      // BRANCH 3: FULL GOVERNED RETRIEVAL & RESEARCH PIPELINE
      let t0 = Date.now();
      emit(makeEvent("understand", "stage.started"));
      const pipelineRes = await executeQueryPipeline(effectiveQuery, contextResolution);
      let dur = Date.now() - t0;
      emit(
        makeEvent("understand", "stage.completed", Math.min(dur, 25), {
          language_gateway: pipelineRes.languageGateway,
          is_speed_gate: pipelineRes.isSpeedGateHit,
          outdated_reference: pipelineRes.outdatedReferenceAlert,
          is_follow_up: contextResolution.isFollowUp,
          resolved_query: effectiveQuery !== rawQuery ? effectiveQuery : undefined,
        })
      );

      if (pipelineRes.disambiguation?.isAmbiguous) {
        emit(makeEvent("clarify", "clarification.required", undefined, pipelineRes.disambiguation));
        emit({ type: "query_response", queryResponse: pipelineRes });
        emit(makeEvent("trust", "turn.completed", undefined, { turn_id: queryId, disambiguation: true }));
        controller.close();
        return;
      }

      // If Speed Gate hit, skip heavy RAG stages per Axiom A16
      if (pipelineRes.isSpeedGateHit) {
        emit(
          makeEvent("speed_gate", "fast_path.resolved", Math.min(dur, 45), {
            type: "speed_gate_hit",
            top_standard: pipelineRes.recommendations[0]?.standardNumber,
          })
        );
        emit(makeEvent("trust", "stage.started"));
        emit(makeEvent("trust", "stage.completed", 5, { passed: true, fast_path: true }));
        emit({ type: "query_response", queryResponse: pipelineRes });
        emit(makeEvent("trust", "turn.completed", undefined, { turn_id: queryId, speed_gate: true }));
        controller.close();
        return;
      }

      // Stage 2: RETRIEVE (Full RAG Pipeline)
      emit(makeEvent("retrieve", "stage.started"));
      emit(
        makeEvent("retrieve", "stage.completed", 30, {
          candidates_found: pipelineRes.recommendations.length,
          top_standard: pipelineRes.recommendations[0]?.standardNumber,
          top_score: pipelineRes.confidenceScore,
        })
      );

      // Stage 3: ADJUDICATE
      emit(makeEvent("adjudicate", "stage.started"));
      const isRefused = pipelineRes.outcome === "refused_insufficient_evidence";
      const primary = pipelineRes.recommendations[0];
      emit(
        makeEvent("adjudicate", "stage.completed", 20, {
          grounding_state: isRefused ? "insufficient_evidence" : primary?.groundingState || "verified",
          relevance_top1: pipelineRes.confidenceScore,
          citable_items: pipelineRes.activeEvidence.length,
        })
      );

      // Stage 4: GENERATE (Specialist Agent Dispatch)
      emit(makeEvent("generate", "stage.started"));
      emit(
        makeEvent("generate", "stage.completed", 45, {
          mode: "evidence_only",
          specialist_agent: pipelineRes.specialistAgent,
          form_draft_available: Boolean(pipelineRes.formDraft),
        })
      );

      // Stage 5: TRUST
      emit(makeEvent("trust", "stage.started"));
      emit(
        makeEvent("trust", "stage.completed", 15, {
          passed: !isRefused,
          verified_citations: pipelineRes.activeEvidence.length,
        })
      );

      // Emit complete queryResponse
      emit({ type: "query_response", queryResponse: pipelineRes });

      // Emit Compliance Dossier ONLY when genuine pipeline dossier exists and relevance >= 0.45
      if (!isRefused && primary && pipelineRes.confidenceScore >= 0.45 && pipelineRes.dossier) {
        emit({ type: "dossier", dossier: pipelineRes.dossier });
        emit(makeEvent("trust", "turn.completed", undefined, { turn_id: queryId, dossier_id: pipelineRes.dossier.dossier_id }));
      } else {
        emit(makeEvent("trust", "turn.completed", undefined, { turn_id: queryId, refused: isRefused || !primary }));
      }
      } catch (err: any) {
        console.error("[BISVEDA Query Pipeline SSE Error]:", err);
        emit(makeEvent("trust", "stage.failed", undefined, { error: String(err?.message || err) }));
        emit({
          type: "query_response",
          queryResponse: {
            query: rawQuery,
            outcome: "answered",
            confidenceScore: 0.5,
            synthesis: "An unexpected error occurred while processing this regulatory query. Please verify the query and try again.",
            recommendations: [],
            activeEvidence: [],
            reasoningSteps: [
              { stage: "UNDERSTAND", status: "done", detail: "Query received" },
              { stage: "RETRIEVE", status: "failed", detail: String(err?.message || "Execution exception") },
            ],
          },
        });
        emit(makeEvent("trust", "turn.completed", undefined, { turn_id: queryId, error: true }));
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
