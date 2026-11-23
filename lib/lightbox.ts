/** Pure helpers for the shared Lightbox (features/oathkeeper/components/lightbox). */

/** Stepping past either end comes round to the other one. */
export const wrapIndex = (index: number, total: number) => total > 0 ? ((index % total) + total) % total : 0;

/** The picture named in the address (`?image=<key>`), or null. */
export function lightboxKey(search: string, param = "image"): string | null {
  return new URLSearchParams(search).get(param) || null;
}

/** The same address with the picture set (or removed), as path + query + hash. */
export function lightboxUrl(href: string, key: string | null, param = "image"): string {
  const url = new URL(href, "http://local");
  if (key) url.searchParams.set(param, key); else url.searchParams.delete(param);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** A short stable key for a picture known only by its address (pictures inside written text). */
export function imageKey(src: string, occurrence = 0): string {
  let hash = 5381;
  const text = src.length > 4096 ? `${src.slice(0, 2048)}${src.slice(-2048)}${src.length}` : src;
  for (let index = 0; index < text.length; index++) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  return `${(hash >>> 0).toString(36)}${occurrence ? `-${occurrence + 1}` : ""}`;
}

/** What a finished drag means: a step sideways, a pull down to close, or nothing. */
export function swipeIntent(dx: number, dy: number, threshold = 56): "next" | "previous" | "close" | null {
  if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.5) return dx < 0 ? "next" : "previous";
  if (dy >= threshold * 1.6 && dy > Math.abs(dx) * 1.5) return "close";
  return null;
}

/** Keeps a zoomed picture from being dragged off the stage. */
export function clampPan(offset: number, size: number, scale: number, stage: number): number {
  const limit = Math.max(0, (size * scale - stage) / 2);
  return Math.min(limit, Math.max(-limit, offset));
}

/** Curator serves three renditions of a picture. A thumbnail on the page opens as the 1600px preview,
 *  and the original's pixels arrive on zoom. Any other address is shown as it is. */
export function renditions(src: string): { src: string; original?: string; href?: string } {
  const match = src.match(/^(?:https?:\/\/[^/]+)?(\/api\/curator\/assets\/[^/?#]+)\?variant=(thumbnail|preview|original)$/);
  if (!match) return { src };
  const preview = `${match[1]}?variant=preview`;
  return { src: preview, original: `${match[1]}?variant=original`, href: preview };
}
