/**
 * BISVEDA — Text-to-speech (lib/voice/tts.ts, P11.3)
 *
 * Wraps the browser's speechSynthesis so read-aloud actually works:
 *  - waits for the (asynchronously loaded) voice list and picks a real voice for the reply language;
 *  - cleans the text (no [S1], markdown, emoji or URLs read out);
 *  - speaks in sentence-sized chunks, because Chrome silently stops long utterances after ~15 s;
 *  - only one thing speaks at a time, and a new speak() cleanly replaces the previous one.
 *
 * Client-side only. Every function is safe to call during SSR (it just reports "unsupported").
 */

export type SpeakResult =
  | { ok: true; interrupted?: boolean }
  | { ok: false; reason: "unsupported" | "no_voice" | "error"; language?: string };

const BCP47: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
  ta: "ta-IN",
  te: "te-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
  or: "or-IN",
  ur: "ur-IN",
  as: "as-IN",
};

/** Languages whose voices are close enough to stand in for one another when the exact voice is missing. */
const VOICE_STAND_INS: Record<string, string[]> = {
  mr: ["hi"],
  as: ["bn"],
  pa: ["hi"],
  gu: ["hi"],
};

const LANGUAGE_LABELS: Record<string, string> = {
  hi: "Hindi",
  mr: "Marathi",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  or: "Odia",
  ur: "Urdu",
  as: "Assamese",
  en: "English",
};

export function languageLabel(tag: string | undefined): string {
  const base = (tag || "en").split("-")[0].toLowerCase();
  return LANGUAGE_LABELS[base] || base;
}

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/** Speech language for a reply tag: Roman-letter text is read by an English (India) voice. */
export function speechLangFor(tag: string | undefined): { bcp47: string; base: string; roman: boolean } {
  const [baseRaw, sub] = (tag || "en").split("-");
  const base = (baseRaw || "en").toLowerCase();
  const roman = !!sub && /^latn$/i.test(sub);
  if (roman) return { bcp47: "en-IN", base: "en", roman: true };
  return { bcp47: BCP47[base] || "en-IN", base, roman: false };
}

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

/** Resolves with the voice list, waiting for `voiceschanged` (Chrome loads voices lazily). */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isTtsSupported()) return Promise.resolve([]);
  const now = window.speechSynthesis.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  if (voicesPromise) return voicesPromise;
  voicesPromise = new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const done = () => {
      synth.removeEventListener("voiceschanged", done);
      voicesPromise = null;
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", done);
    // Some browsers never fire the event when there are genuinely no voices.
    setTimeout(done, 2000);
  });
  return voicesPromise;
}

function normLang(l: string): string {
  return l.replace("_", "-").toLowerCase();
}

function scoreVoice(v: SpeechSynthesisVoice): number {
  let s = 0;
  if (/natural|neural|online/i.test(v.name)) s += 3;
  if (/google/i.test(v.name)) s += 2;
  if (v.localService) s += 1;
  return s;
}

function bestVoiceFor(voices: SpeechSynthesisVoice[], bcp47: string): SpeechSynthesisVoice | null {
  const want = normLang(bcp47);
  const base = want.split("-")[0];
  const exact = voices.filter((v) => normLang(v.lang) === want);
  const sameBase = voices.filter((v) => normLang(v.lang).split("-")[0] === base);
  const pool = exact.length > 0 ? exact : sameBase;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

/** Picks a voice for the reply language, or null if the device has none that can read it. */
export async function pickVoice(tag: string | undefined): Promise<{ voice: SpeechSynthesisVoice | null; bcp47: string }> {
  const { bcp47, base } = speechLangFor(tag);
  const voices = await loadVoices();
  let voice = bestVoiceFor(voices, bcp47);
  if (!voice) {
    for (const alt of VOICE_STAND_INS[base] || []) {
      voice = bestVoiceFor(voices, BCP47[alt]);
      if (voice) break;
    }
  }
  return { voice, bcp47 };
}

/** Removes everything that shouldn't be read aloud. */
export function cleanForSpeech(text: string, roman = false): string {
  let t = text || "";
  t = t.replace(/\[S\d+\]/g, "");
  t = t.replace(/【S\d+】/g, "");
  t = t.replace(/https?:\/\/\S+/g, "");
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/`([^`]*)`/g, "$1");
  t = t.replace(/^\s{0,3}#{1,6}\s*/gm, "");
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1");
  t = t.replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|[.,;:!?]|$)/g, "$1$2");
  t = t.replace(/^\s*(?:[-*•▪◦]|\d+[.)])\s+/gm, "");
  t = t.replace(/^\s*>\s?/gm, "");
  t = t.replace(/\p{Extended_Pictographic}/gu, "");
  t = t.replace(/[✓✔✅→←•|]/g, " ");
  // "IS 4151" reads better as "I S 4151" for English voices.
  if (roman) t = t.replace(/\bIS\s+(\d)/g, "I S $1");
  t = t.replace(/\s*\n+\s*/g, ". ").replace(/\s{2,}/g, " ");
  t = t.replace(/\s+([.,;:!?।॥])/g, "$1").replace(/([.!?।॥])\s*\./g, "$1").replace(/\.{2,}/g, ".");
  return t.trim();
}

/** Splits into chunks of at most `maxLen` characters, preferring sentence and then comma boundaries. */
export function splitForSpeech(text: string, maxLen = 180): string[] {
  const sentences = text.split(/(?<=[.!?।॥])\s+/).map((s) => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= maxLen) {
      chunks.push(sentence);
      continue;
    }
    let current = "";
    for (const part of sentence.split(/(?<=[,;:])\s+/)) {
      if ((current + " " + part).trim().length > maxLen && current) {
        chunks.push(current.trim());
        current = part;
      } else {
        current = (current + " " + part).trim();
      }
      while (current.length > maxLen) {
        const cut = current.lastIndexOf(" ", maxLen);
        const at = cut > 40 ? cut : maxLen;
        chunks.push(current.slice(0, at).trim());
        current = current.slice(at).trim();
      }
    }
    if (current) chunks.push(current.trim());
  }
  return chunks;
}

let runToken = 0;
const listeners = new Set<(speaking: boolean, owner: string | undefined) => void>();
let speaking = false;
let currentOwner: string | undefined;

function setSpeaking(v: boolean, owner: string | undefined) {
  const prevOwner = currentOwner;
  const nextOwner = v ? owner : undefined;
  if (speaking === v && prevOwner === nextOwner) return;
  speaking = v;
  currentOwner = nextOwner;
  // A stop is reported with the owner who WAS speaking (not undefined), so that owner's own
  // listener (filtering on `owner === myId`) can see it was the one that stopped. If a new
  // speaker displaces a previous one without an explicit stop in between, the previous owner
  // gets an implicit stop notification first, so it doesn't end up stuck showing "speaking".
  if (v && prevOwner && prevOwner !== nextOwner) {
    listeners.forEach((l) => l(false, prevOwner));
  }
  listeners.forEach((l) => l(v, v ? nextOwner : prevOwner));
}

export function isSpeaking(): boolean {
  return speaking;
}

/** Who `speak()` is currently reading for, e.g. an AnswerCard's message id. Undefined when idle. */
export function speakingOwner(): string | undefined {
  return currentOwner;
}

/**
 * Subscribe to speaking start/stop. `owner` identifies which caller's speech is active (e.g. a chat
 * message id) so a UI showing several answers can tell which one is currently talking, instead of
 * every "Read aloud" button reacting to any speech on the page.
 */
export function onSpeakingChange(cb: (speaking: boolean, owner: string | undefined) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function stopSpeaking(): void {
  runToken++;
  if (isTtsSupported()) window.speechSynthesis.cancel();
  setSpeaking(false, undefined);
}

export interface SpeakOptions {
  /** Identifies this call so `onSpeakingChange`/`speakingOwner` can report who is talking. */
  owner?: string;
}

/**
 * Reads `text` aloud in the reply language. Resolves when finished, interrupted (a newer speak()/stop()),
 * or when it can't speak. Never throws.
 */
export async function speak(text: string, tag: string | undefined, opts: SpeakOptions = {}): Promise<SpeakResult> {
  if (!isTtsSupported()) return { ok: false, reason: "unsupported" };

  const { bcp47, base, roman } = speechLangFor(tag);
  const chunks = splitForSpeech(cleanForSpeech(text, roman || base === "en"));
  if (chunks.length === 0) return { ok: true };

  const myToken = ++runToken;
  window.speechSynthesis.cancel();

  const { voice } = await pickVoice(tag);
  if (myToken !== runToken) return { ok: true, interrupted: true };
  if (!voice && base !== "en") {
    setSpeaking(false, undefined);
    return { ok: false, reason: "no_voice", language: base };
  }

  setSpeaking(true, opts.owner);
  const synth = window.speechSynthesis;

  for (const chunk of chunks) {
    if (myToken !== runToken) return { ok: true, interrupted: true };
    const outcome = await new Promise<"done" | "error">((resolve) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = voice?.lang || bcp47;
      if (voice) u.voice = voice;
      u.rate = base === "en" ? 1 : 0.95;
      u.onend = () => resolve("done");
      u.onerror = (e) => resolve(e.error === "canceled" || e.error === "interrupted" ? "done" : "error");
      synth.speak(u);
    });
    if (myToken !== runToken) return { ok: true, interrupted: true };
    if (outcome === "error") {
      setSpeaking(false, undefined);
      return { ok: false, reason: "error" };
    }
  }

  if (myToken === runToken) setSpeaking(false, undefined);
  return { ok: true };
}
