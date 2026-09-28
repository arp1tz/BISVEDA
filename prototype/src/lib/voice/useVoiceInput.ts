"use client";

/**
 * BISVEDA — Voice input hook (lib/voice/useVoiceInput.ts, P11.4)
 *
 * Records the microphone with MediaRecorder, stops by itself after the speaker goes quiet, sends the
 * audio to /api/stt (Groq Whisper) and hands back the transcript. Works in every modern browser
 * (unlike the Web Speech API) and understands Hindi, Marathi, Hinglish and the other Indian languages.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceInputState = "idle" | "listening" | "transcribing";

interface Options {
  onTranscript: (text: string, language?: string) => void;
  onError?: (message: string) => void;
  /** Stop this long after the speaker last spoke. */
  silenceMs?: number;
  /** Give up if nothing is said within this time after the mic opens. */
  noSpeechMs?: number;
  /** Hard cap on one recording. */
  maxMs?: number;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

export function isVoiceInputSupported(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function useVoiceInput({ onTranscript, onError, silenceMs = 1500, noSpeechMs = 8000, maxMs = 30000 }: Options) {
  const [state, setState] = useState<VoiceInputState>("idle");
  const stateRef = useRef<VoiceInputState>("idle");
  const cbRef = useRef({ onTranscript, onError });
  cbRef.current = { onTranscript, onError };

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const timersRef = useRef<{ poll?: ReturnType<typeof setInterval>; max?: ReturnType<typeof setTimeout> }>({});
  const discardRef = useRef(false);
  const startingRef = useRef(false);

  const update = (s: VoiceInputState) => {
    stateRef.current = s;
    setState(s);
  };

  const teardown = useCallback(() => {
    if (timersRef.current.poll) clearInterval(timersRef.current.poll);
    if (timersRef.current.max) clearTimeout(timersRef.current.max);
    timersRef.current = {};
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }, []);

  /** Stop recording. `discard` throws the audio away instead of transcribing it. */
  const stop = useCallback((discard = false) => {
    discardRef.current = discard;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    else {
      teardown();
      if (stateRef.current === "listening") update("idle");
    }
  }, [teardown]);

  const start = useCallback(async () => {
    if (stateRef.current !== "idle" || startingRef.current) return;
    if (!isVoiceInputSupported()) {
      cbRef.current.onError?.("Voice input isn't supported in this browser.");
      return;
    }

    let stream: MediaStream;
    startingRef.current = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      startingRef.current = false;
    } catch (err) {
      startingRef.current = false;
      const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      cbRef.current.onError?.(denied ? "Microphone access was blocked. Allow the microphone in your browser and try again." : "No microphone was found.");
      return;
    }

    streamRef.current = stream;
    discardRef.current = false;
    const chunks: Blob[] = [];
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    let heardSpeech = false;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      teardown();
      recorderRef.current = null;
      if (discardRef.current) {
        update("idle");
        return;
      }
      if (!heardSpeech || chunks.length === 0) {
        update("idle");
        cbRef.current.onError?.("I didn't hear anything. Tap the mic and try again.");
        return;
      }

      update("transcribing");
      try {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const form = new FormData();
        form.append("audio", new Blob(chunks, { type }), `speech.${ext}`);
        const res = await fetch("/api/stt", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Couldn't understand the audio. Please try again.");
        if (!data.text) {
          cbRef.current.onError?.("I couldn't make out any words. Please try again.");
        } else {
          cbRef.current.onTranscript(data.text, data.language);
        }
      } catch (err) {
        cbRef.current.onError?.(err instanceof Error ? err.message : "Voice input failed.");
      } finally {
        update("idle");
      }
    };

    // Level meter → speech / silence detection.
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      const startedAt = Date.now();
      let lastVoiceAt = 0;
      let noiseFloor = Infinity;

      timersRef.current.poll = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const now = Date.now();

        // First ~500 ms: learn the room's background level (the quietest sample, so a speaker who starts
        // talking immediately doesn't raise the bar above their own voice).
        if (now - startedAt < 500) {
          noiseFloor = Math.min(noiseFloor, rms);
          return;
        }
        const threshold = Math.min(0.05, Math.max(0.02, noiseFloor * 3));
        if (rms > threshold) {
          heardSpeech = true;
          lastVoiceAt = now;
        }
        if (heardSpeech && now - lastVoiceAt > silenceMs) stop();
        else if (!heardSpeech && now - startedAt > noSpeechMs) stop();
      }, 100);
    } catch {
      // No analyser available: fall back to a fixed-length recording that always counts as speech.
      heardSpeech = true;
      timersRef.current.max = setTimeout(() => stop(), Math.min(maxMs, 8000));
    }

    if (!timersRef.current.max) timersRef.current.max = setTimeout(() => stop(), maxMs);
    recorder.start();
    update("listening");
  }, [maxMs, noSpeechMs, silenceMs, stop, teardown]);

  useEffect(() => {
    return () => {
      discardRef.current = true;
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
      teardown();
    };
  }, [teardown]);

  return { state, start, stop, supported: typeof window !== "undefined" ? isVoiceInputSupported() : true };
}
