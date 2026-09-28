"use client";

/**
 * BISVEDA — Page translator (components/a11y/PageTranslator.tsx, P12.4)
 *
 * Works like the classic "Translate this page" browser feature: when a non-English interface
 * language is chosen, it walks the visible page, swaps text nodes and a few attributes
 * (placeholder/title/aria-label) for a translated version, and swaps them back when the language
 * returns to English. It never replaces or unmounts a DOM node (React keeps owning the tree), it
 * only edits `nodeValue`/attribute values, so React re-renders are safe.
 *
 * Cached translations apply instantly and synchronously. New ones are fetched in a few small
 * batches that run in parallel (capped) and each apply to the page the moment they land, rather
 * than waiting for the whole page to finish — so it updates live instead of appearing stuck.
 * `translatingStatus.ts` tracks how many batches are in flight so `LanguagePicker` can show a
 * visible "Translating..." indicator instead of the switch looking like it did nothing.
 *
 * What it never touches: anything under an element carrying `translate="no"` or
 * `data-no-translate` (the answer body, [S#] citation pills, standard pills, source drawer
 * excerpts, user messages — these already arrive in the right language, or are facts that must
 * not be paraphrased), `<script>`/`<style>`/`<code>`/`<pre>`, and text that is only digits/
 * punctuation (IS numbers, prices, dates).
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useUiLanguage } from "@/lib/ui-i18n/LanguageContext";
import { beginTranslating, endTranslating } from "@/lib/ui-i18n/translatingStatus";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA"]);
const TRANSLATABLE_ATTRS = ["placeholder", "title", "aria-label"] as const;
const BATCH_SIZE = 40;
const MAX_CONCURRENT_BATCHES = 3;
const CACHE_PREFIX = "bisveda.uiTranslateCache.";
const MUTATION_DEBOUNCE_MS = 400;

interface TranslateTarget {
  value: string;
  apply: (translated: string) => void;
}

/** True for text that carries no meaning to translate: blank, or only digits/punctuation/symbols (no letter in any script). */
function isUntranslatable(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return !/\p{L}/u.test(t);
}

function isNoTranslate(el: Element | null): boolean {
  let node: Element | null = el;
  while (node) {
    if (node.getAttribute("translate") === "no" || node.hasAttribute("data-no-translate")) return true;
    if (SKIP_TAGS.has(node.tagName)) return true;
    node = node.parentElement;
  }
  return false;
}

function loadCache(lang: string): Map<string, string> {
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + lang);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, string>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function saveCache(lang: string, cache: Map<string, string>) {
  try {
    // Cap stored size so this never grows unbounded across a long session.
    const entries = Array.from(cache.entries()).slice(-2000);
    window.localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Non-fatal: translations still work this session, just re-fetched next time.
  }
}

async function fetchBatch(texts: string[], lang: string): Promise<string[]> {
  try {
    const res = await fetch("/api/translate-ui", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang, texts }),
    });
    const data = await res.json().catch(() => ({}));
    const got = Array.isArray(data.texts) ? data.texts : texts;
    return texts.map((s, j) => (typeof got[j] === "string" ? got[j] : s));
  } catch {
    return texts; // fail open: keep English for this batch
  }
}

/** Runs async `tasks` with at most `limit` running at once. */
async function runWithConcurrency(tasks: Array<() => Promise<void>>, limit: number): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const task = tasks[next++];
      await task();
    }
  });
  await Promise.all(workers);
}

export function PageTranslator() {
  const { lang } = useUiLanguage();
  const pathname = usePathname();
  const originalText = useRef(new WeakMap<Text, string>());
  const originalAttrs = useRef(new WeakMap<Element, Partial<Record<string, string>>>());
  const trackedTextNodes = useRef(new Set<Text>());
  const trackedAttrElements = useRef(new Set<Element>());
  const runTokenRef = useRef(0);
  const observerRef = useRef<MutationObserver | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Never translates the admin console — it isn't in the router tree it's mounted from, but this
  // guards against the component ever being reused there.
  const disabled = pathname?.startsWith("/admin") ?? false;

  useEffect(() => {
    if (disabled) return;
    const myToken = ++runTokenRef.current;

    const restoreAll = () => {
      trackedTextNodes.current.forEach((node) => {
        const original = originalText.current.get(node);
        if (original !== undefined && node.isConnected) node.nodeValue = original;
      });
      trackedTextNodes.current.clear();
      trackedAttrElements.current.forEach((el) => {
        const attrs = originalAttrs.current.get(el);
        if (attrs && el.isConnected) {
          for (const [name, value] of Object.entries(attrs)) {
            if (value !== undefined) el.setAttribute(name, value);
          }
        }
      });
      trackedAttrElements.current.clear();
    };

    // Collect untracked, translatable text nodes and attributes currently in the DOM, each as a
    // target with its own `apply` so a batch can update the page the moment it lands.
    const collect = (): TranslateTarget[] => {
      const targets: TranslateTarget[] = [];

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const text = node.nodeValue || "";
          if (isUntranslatable(text)) return NodeFilter.FILTER_REJECT;
          if (trackedTextNodes.current.has(node as Text)) return NodeFilter.FILTER_REJECT;
          if (isNoTranslate(node.parentElement)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let n = walker.nextNode();
      while (n) {
        const textNode = n as Text;
        const original = textNode.nodeValue || "";
        targets.push({
          value: original,
          apply: (translated) => {
            if (!textNode.isConnected) return;
            if (!originalText.current.has(textNode)) originalText.current.set(textNode, original);
            textNode.nodeValue = translated;
            trackedTextNodes.current.add(textNode);
          },
        });
        n = walker.nextNode();
      }

      document.body.querySelectorAll("[placeholder], [title], [aria-label]").forEach((el) => {
        if (isNoTranslate(el)) return;
        for (const attr of TRANSLATABLE_ATTRS) {
          const value = el.getAttribute(attr);
          if (!value || isUntranslatable(value)) continue;
          if (trackedAttrElements.current.has(el) && originalAttrs.current.get(el)?.[attr] !== undefined) continue;
          targets.push({
            value,
            apply: (translated) => {
              if (!el.isConnected) return;
              const existing = originalAttrs.current.get(el) || {};
              if (existing[attr] === undefined) existing[attr] = value;
              originalAttrs.current.set(el, existing);
              el.setAttribute(attr, translated);
              trackedAttrElements.current.add(el);
            },
          });
        }
      });

      return targets;
    };

    const translatePass = async () => {
      if (lang === "en") return;
      const targets = collect();
      if (targets.length === 0) return;

      const cache = loadCache(lang);
      const needFetch: TranslateTarget[] = [];

      // Cached hits apply immediately, no network round trip, no flicker.
      for (const target of targets) {
        const hit = cache.get(target.value);
        if (hit) target.apply(hit);
        else needFetch.push(target);
      }

      if (needFetch.length === 0) return;

      const batches: TranslateTarget[][] = [];
      for (let i = 0; i < needFetch.length; i += BATCH_SIZE) batches.push(needFetch.slice(i, i + BATCH_SIZE));

      let cacheDirty = false;
      const tasks = batches.map((batch) => async () => {
        beginTranslating();
        try {
          const translated = await fetchBatch(
            batch.map((t) => t.value),
            lang
          );
          if (runTokenRef.current !== myToken) return; // a newer language switch superseded this run
          batch.forEach((target, i) => {
            const result = translated[i];
            if (!result) return;
            target.apply(result);
            if (result !== target.value) {
              cache.set(target.value, result);
              cacheDirty = true;
            }
          });
        } finally {
          endTranslating();
        }
      });

      await runWithConcurrency(tasks, MAX_CONCURRENT_BATCHES);
      if (cacheDirty && runTokenRef.current === myToken) saveCache(lang, cache);
    };

    observerRef.current?.disconnect();

    if (lang === "en") {
      restoreAll();
      return;
    }

    void translatePass();

    const observer = new MutationObserver(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (runTokenRef.current === myToken) void translatePass();
      }, MUTATION_DEBOUNCE_MS);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, disabled]);

  return null;
}
