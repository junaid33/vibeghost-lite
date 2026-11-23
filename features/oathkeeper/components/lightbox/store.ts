"use client";
import { lightboxKey, lightboxUrl, wrapIndex } from "@/lib/lightbox";

/** One picture in a set. `key` is unique within the page and is what the address carries (`?image=<key>`). */
export type LightboxItem = {
  key: string;
  /** Shown fitted to the screen. */
  src: string;
  /** Painted first while `src` loads (usually the thumbnail already on the page). */
  thumb?: string;
  /** Loaded once the picture is zoomed, and linked as "Open original". */
  original?: string;
  /** "Open in a new tab" goes here (defaults to the original, else `src`). */
  href?: string;
  alt?: string;
  title?: string;
  caption?: string;
  /** One more line under the caption: what this picture's design is ("Black and yellow. The price board is the page."). */
  note?: string;
  /** The picture can't be shown and trying again won't help (its file is gone): said in its place, with no Retry. */
  unavailable?: string;
  /** A page to go to from here ("Open theme"); a real link. */
  link?: { href: string; label: string };
  /** More pages to go to, after `link`. */
  links?: { href: string; label: string }[];
  /** One thing to do with this picture ("Choose this design"). `active` shows it as done. */
  action?: { label: string; activeLabel?: string; active?: boolean; busy?: boolean; onRun: () => void;
    /** What the last press did, said beside the button (the page's own notice is under the overlay). */
    message?: { text: string; tone?: "good" | "bad" } };
};
export type LightboxState = { items: LightboxItem[]; index: number; pushed: boolean; source?: object };

let state: LightboxState | null = null;
/** A key still in the address while Back is on its way; it must not reopen. */
let leaving: string | null = null;
const listeners = new Set<() => void>();
const sets = new Map<symbol, () => LightboxItem[]>();
const sources = new WeakMap<() => LightboxItem[], object>();
const emit = () => { for (const listener of listeners) listener(); };
/** `?image=` named a picture no set on the page has: the address is cleaned and the host says so once. */
let missed = 0, missTimer: ReturnType<typeof setTimeout> | null = null;
export const lightboxMissed = () => missed;
export const lightboxMissedServer = () => 0;
const MISS_AFTER = 3500;
/** Sets register as their page's data arrives, so "nothing matched" is only decided once they have been quiet a while. */
function watchForMiss(key: string) {
  if (missTimer) clearTimeout(missTimer);
  missTimer = setTimeout(() => {
    missTimer = null;
    if (state || typeof window === "undefined" || lightboxKey(window.location.search) !== key || key === leaving) return;
    for (const read of sets.values()) if (read().some(item => item.key === key)) return syncLightboxWithAddress();
    write(null, false); missed++; emit();
  }, MISS_AFTER);
}

export const subscribeLightbox = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const lightboxSnapshot = () => state;
export const lightboxServerSnapshot = () => null;

const write = (key: string | null, push: boolean) => {
  const url = lightboxUrl(window.location.href, key);
  if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
  // Next's router follows pushState / replaceState, so usePathname and useSearchParams stay right.
  if (push) window.history.pushState(null, "", url); else window.history.replaceState(null, "", url);
};

/** Opens `key` among `items`. The address gains `?image=<key>` as a new history entry, so Back closes it. */
export function openLightbox(items: LightboxItem[], key: string, source?: object) {
  const index = items.findIndex(item => item.key === key);
  if (index < 0) return;
  const pushed = state ? state.pushed : true;
  write(key, !state);
  state = { items, index, pushed, source }; leaving = null; emit();
}
/** The page's set changed while it is open (a status was saved): show the new facts, on the same picture. */
export function refreshLightbox(source: object, items: LightboxItem[]) {
  if (!state || state.source !== source) return;
  const key = state.items[state.index]?.key, index = items.findIndex(item => item.key === key);
  if (index < 0) return;
  state = { ...state, items, index }; emit();
}
/** Moves to another picture of the open set; past either end it comes round. */
export function goLightbox(target: number) {
  if (!state || !state.items.length) return;
  const index = wrapIndex(target, state.items.length);
  if (index === state.index) return;
  state = { ...state, index }; write(state.items[index].key, false); emit();
}
export const stepLightbox = (direction: -1 | 1) => { if (state) goLightbox(state.index + direction); };
/** Closes it. An entry this lightbox added is left with Back; a deep link just drops `?image=`. */
export function closeLightbox() {
  if (!state) return;
  const { pushed, items, index } = state;
  state = null; emit();
  if (pushed) { leaving = items[index]?.key ?? null; window.history.back(); } else write(null, false);
}

/** A page's set, so `?image=<key>` in the address (a deep link, Back, Forward) can open it. */
export function registerLightboxSet(items: () => LightboxItem[], source?: object) {
  const id = Symbol("lightbox-set");
  if (source) sources.set(items, source);
  sets.set(id, items); syncLightboxWithAddress();
  return () => { sets.delete(id); };
}
/** Makes the lightbox match the address: called when a set appears and on Back / Forward. */
export function syncLightboxWithAddress(navigated = false) {
  if (typeof window === "undefined") return;
  const key = lightboxKey(window.location.search);
  if (navigated) leaving = null;
  if (!key) { if (state && navigated) { state = null; emit(); } return; }
  if (key === leaving) return;
  if (state) {
    const index = state.items.findIndex(item => item.key === key);
    if (index >= 0 && index !== state.index) { state = { ...state, index }; emit(); }
    return;
  }
  for (const read of sets.values()) {
    const items = read(), index = items.findIndex(item => item.key === key);
    if (index >= 0) { if (missTimer) { clearTimeout(missTimer); missTimer = null; } state = { items, index, pushed: false, source: sources.get(read) }; emit(); return; }
  }
  watchForMiss(key);
}
