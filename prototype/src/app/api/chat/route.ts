import { NextRequest, NextResponse } from "next/server";
import { runPipeline, type StageEvent } from "@/lib/pipeline/orchestrator";
import type { BisvedaResponse } from "@/lib/pipeline/respond";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const conversationId = body.conversation_id || body.sessionId || `conv-${Date.now()}`;
    const history = Array.isArray(body.history) ? body.history : [];
    const userLocation = body.userLocation || undefined;
    const attachment = body.attachment || undefined;
    const formState = body.formState || undefined;
    const preferredLanguage = typeof body.preferred_language === "string" ? body.preferred_language : undefined;
    const wantsStream = body.stream !== false && req.headers.get("accept")?.includes("text/event-stream") !== false;

    if (!query && !attachment) {
      return NextResponse.json({ error: "Query parameter or attachment is required" }, { status: 400 });
    }

    // Direct JSON response mode
    if (!wantsStream) {
      const response = await runPipeline({
        query,
        conversation_id: conversationId,
        history,
        userLocation,
        attachment,
        formState,
        preferredLanguage,
      });
      return NextResponse.json(response);
    }

    // SSE Streaming mode
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendEvent = async (eventName: string, data: any) => {
      try {
        const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
        await writer.write(encoder.encode(payload));
      } catch {
        // Stream may have closed
      }
    };

    // Execute pipeline in background and stream events
    (async () => {
      try {
        const response: BisvedaResponse = await runPipeline({
          query,
          conversation_id: conversationId,
          history,
          userLocation,
          attachment,
          formState,
          preferredLanguage,
          onStageEvent: (event: StageEvent) => {
            sendEvent("stage", event);
          },
        });

        // Send final response payload
        await sendEvent("response", response);
      } catch (err: any) {
        console.error("[Chat Pipeline Error]:", err);
        await sendEvent("error", { message: err.message || "Failed to process query" });
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal processing error in BISVEDA pipeline" },
      { status: 500 }
    );
  }
}
