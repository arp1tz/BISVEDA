import { NextRequest, NextResponse } from "next/server";
import { translateUiBatch } from "@/lib/i18n";

export const runtime = "nodejs";

const MAX_BATCH = 60;

/**
 * POST { lang, texts: string[] } -> { texts: string[] }
 * Used by the page translator (components/a11y/PageTranslator.tsx) to translate a page's visible
 * UI chrome into the chosen interface language. `texts` is capped per request; the client
 * batches larger pages itself. English in, English back out (no-op).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const lang = typeof body.lang === "string" ? body.lang : "en";
  const texts: unknown = body.texts;

  if (!Array.isArray(texts) || texts.length === 0) {
    return NextResponse.json({ error: "texts must be a non-empty array of strings." }, { status: 400 });
  }
  if (texts.length > MAX_BATCH || !texts.every((t) => typeof t === "string")) {
    return NextResponse.json({ error: `texts must be up to ${MAX_BATCH} strings.` }, { status: 400 });
  }

  try {
    const translated = await translateUiBatch(texts as string[], lang);
    return NextResponse.json({ texts: translated });
  } catch (err) {
    console.warn("[translate-ui] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ texts }); // fail open: show the original English rather than an error
  }
}
