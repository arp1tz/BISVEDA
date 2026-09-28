import { NextRequest, NextResponse } from "next/server";
import { groqTranscribe } from "@/lib/llm";
import { LANGUAGE_NAMES } from "@/lib/i18n";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** Whisper sometimes "hears" these phrases in near-silence; they are never a real BIS question. */
const SILENCE_HALLUCINATIONS = /^(?:thank you\.?|thanks for watching[.!]?|you|bye\.?|\.+|subtitles? by .*|please subscribe.*)$/i;

/** Whisper reports the language as an English name ("marathi"); we use ISO codes. */
function toIsoCode(name?: string): string | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase();
  return Object.entries(LANGUAGE_NAMES).find(([, n]) => n.toLowerCase() === lower)?.[0] ?? (lower.length === 2 ? lower : undefined);
}

/**
 * POST multipart/form-data with an `audio` file. Returns { text, language }.
 * Speech-to-text runs on Groq Whisper (model id from GROQ_STT_MODEL).
 */
export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "Voice input is not configured on this server." }, { status: 503 });
  }

  let audio: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("audio");
    if (f instanceof File) audio = f;
  } catch {
    return NextResponse.json({ error: "Expected multipart form data with an audio file." }, { status: 400 });
  }
  if (!audio || audio.size === 0) {
    return NextResponse.json({ error: "No audio received." }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "That recording is too long. Please keep it under a minute." }, { status: 413 });
  }

  try {
    const result = await groqTranscribe(audio, audio.name || "speech.webm");
    const text = result.text.trim();
    if (!text || SILENCE_HALLUCINATIONS.test(text)) {
      return NextResponse.json({ text: "", language: undefined });
    }
    return NextResponse.json({ text, language: toIsoCode(result.language) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[stt] transcription failed:", msg);
    const busy = /HTTP 429/.test(msg);
    return NextResponse.json(
      { error: busy ? "Voice service is busy. Please try again in a moment." : "Couldn't understand the audio. Please try again." },
      { status: busy ? 429 : 502 }
    );
  }
}
