/**
 * BISVEDA — shared "page is translating" status (lib/ui-i18n/translatingStatus.ts, P12.4 follow-up)
 *
 * PageTranslator can have several translation batches in flight at once (it now fires them in
 * parallel, applying each as it lands, instead of blocking on the whole page). This is a simple
 * counter: as long as any batch is in flight, the page counts as "translating". LanguagePicker
 * subscribes to show a visible indicator, so switching language never looks stuck while it's
 * actually working in the background.
 */

let inFlight = 0;
const listeners = new Set<(translating: boolean) => void>();

function notify() {
  const translating = inFlight > 0;
  listeners.forEach((l) => l(translating));
}

export function beginTranslating(): void {
  inFlight++;
  if (inFlight === 1) notify();
}

export function endTranslating(): void {
  inFlight = Math.max(0, inFlight - 1);
  if (inFlight === 0) notify();
}

export function isTranslatingNow(): boolean {
  return inFlight > 0;
}

export function onTranslatingChange(cb: (translating: boolean) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
