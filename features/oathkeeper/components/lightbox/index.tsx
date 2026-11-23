"use client";
import { useCallback, useEffect, useRef, useSyncExternalStore, type ButtonHTMLAttributes, type ElementType, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { imageKey, renditions } from "@/lib/lightbox";
import { ZoomGlyph } from "./lightbox";
import { lightboxServerSnapshot, lightboxSnapshot, openLightbox, refreshLightbox, registerLightboxSet, subscribeLightbox, type LightboxItem } from "./store";
import styles from "./lightbox.module.css";

export { LightboxHost } from "./lightbox";
export { closeLightbox, openLightbox, type LightboxItem } from "./store";
export const lightboxStyles = styles;

/** A Curator picture as a lightbox item: the 1600px preview, the original on zoom. Null for links, videos and missing items. */
export function curatorPicture(item: { id: string; kind: string; title: string; altText?: string | null; asset?: { id: string } | null } | null | undefined, title?: string, caption?: string): LightboxItem | null {
  if (!item?.asset || item.kind !== "image") return null;
  const base = `/api/curator/assets/${encodeURIComponent(item.asset.id)}`;
  return { key: item.id, src: `${base}?variant=preview`, thumb: `${base}?variant=thumbnail`, original: `${base}?variant=original`, href: `${base}?variant=preview`, alt: item.altText || item.title, title: title ?? item.title, caption };
}

/** A page's pictures as one set: `open(key)` shows that picture, and prev / next walk the whole set.
 *  The set also answers `?image=<key>` in the address (a deep link, Back, Forward). */
export function useLightboxSet(items: LightboxItem[]) {
  const latest = useRef(items);
  useEffect(() => { latest.current = items; refreshLightbox(latest, items); });
  const signature = items.map(item => item.key).join("|");
  useEffect(() => signature ? registerLightboxSet(() => latest.current, latest) : undefined, [signature]);
  return useCallback((key: string | null | undefined) => { if (key) openLightbox(latest.current, key, latest); }, []);
}
/** The key of the picture the lightbox is showing, or null while it is closed. */
export function useLightboxKey() {
  const state = useSyncExternalStore(subscribeLightbox, lightboxSnapshot, lightboxServerSnapshot);
  return state ? state.items[state.index]?.key ?? null : null;
}

/** A picture that is itself the button. */
export function LightboxTrigger({ className, children, label, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" {...props} className={cn(styles.trigger, className)} aria-label={label} title={props.title ?? "View full screen"}>{children}</button>;
}
/** "View full screen" in the corner of a card whose face is already a link. Its parent needs `lightboxStyles.expandHost`. */
export function LightboxExpand({ label, onOpen, className }: { label: string; onOpen: () => void; className?: string }) {
  return <button type="button" className={cn(styles.expand, className)} aria-label={label} title="View full screen" onClick={event => { event.preventDefault(); event.stopPropagation(); onOpen(); }}><ZoomGlyph/></button>;
}

const CLAIMED = "a, button, [role=button]:not(img), [data-lightbox-skip]";
/** Written text and other content whose pictures arrive as plain `<img>`: every one inside opens the
 *  lightbox, and together they are one set. Pictures inside a link or a button are left to that control,
 *  unless the control is marked `data-lightbox-open` (a real link that plain clicks open full screen).
 *  `set` names a wider set (and `current` the picture of it shown here): the picture opens in that set,
 *  so prev / next walk all of it. */
export function LightboxZone<Tag extends ElementType = "div">({ as, title, set, current, children, ...props }: { as?: Tag; title?: string; set?: LightboxItem[]; current?: string | null; children: ReactNode } & Omit<HTMLAttributes<HTMLElement>, "title">) {
  const Component = (as ?? "div") as ElementType;
  const root = useRef<HTMLElement>(null), titleRef = useRef(title), setRef = useRef(set), currentRef = useRef(current);
  useEffect(() => { titleRef.current = title; setRef.current = set; currentRef.current = current; });
  const collect = useCallback(() => {
    const zone = root.current; if (!zone) return [];
    const seen = new Map<string, number>();
    return [...zone.querySelectorAll("img")].filter(image => {
      if (!(image.currentSrc || image.src)) return false;
      const claim = image.closest(CLAIMED);
      return !claim || !zone.contains(claim) || claim.closest("[data-lightbox-open]") !== null;
    }).map(image => {
      const shown = image.getAttribute("src") || image.currentSrc, full = renditions(image.dataset.lightboxSrc || shown), count = seen.get(full.src) ?? 0; seen.set(full.src, count + 1);
      const item: LightboxItem = { key: image.dataset.lightboxKey || imageKey(full.src, count), ...full, thumb: shown, alt: image.alt, title: image.dataset.lightboxTitle || image.alt || titleRef.current,
        caption: image.dataset.lightboxCaption || (image.alt && titleRef.current && image.alt !== titleRef.current ? titleRef.current : undefined) };
      return { image, item };
    });
  }, []);
  const signature = set?.map(item => item.key).join("|") ?? "";
  // Pictures become keyboard buttons; the set answers ?image=.
  useEffect(() => {
    const zone = root.current; if (!zone) return;
    const mark = () => { for (const { image } of collect()) { if (image.dataset.lightbox !== undefined || image.closest("[data-lightbox-open]")) continue; image.tabIndex = 0; image.setAttribute("role", "button"); image.dataset.lightbox = ""; if (!image.title) image.title = "View full screen"; } };
    mark();
    const observer = new MutationObserver(mark); observer.observe(zone, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    const unregister = registerLightboxSet(() => setRef.current?.length ? setRef.current : collect().map(entry => entry.item));
    return () => { observer.disconnect(); unregister(); };
  }, [collect, signature]);
  const open = (target: EventTarget, event: { preventDefault: () => void; stopPropagation: () => void }) => {
    const zone = root.current;
    if (!zone || !(target instanceof Element) || !zone.contains(target)) return false;
    const opener = target.closest("[data-lightbox-open]"), image = target instanceof HTMLImageElement ? target : opener?.querySelector("img") ?? null;
    if (!image) return false;
    const entries = collect(), entry = entries.find(value => value.image === image);
    if (!entry) return false;
    event.preventDefault(); event.stopPropagation();
    const wider = setRef.current?.find(item => item.key === currentRef.current) ?? setRef.current?.find(item => item.key === entry.item.key || item.src === entry.item.src || item.src === entry.item.thumb);
    if (wider) openLightbox(setRef.current!, wider.key); else openLightbox(entries.map(value => value.item), entry.item.key);
    return true;
  };
  // Capture: the lightbox answers before any handler the picture has of its own.
  return <Component ref={root} {...props} className={cn(styles.zone, props.className)}
    onClickCapture={(event: MouseEvent<HTMLElement>) => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return; open(event.target, event); }}
    onKeyDownCapture={(event: KeyboardEvent<HTMLElement>) => { if ((event.key === "Enter" || event.key === " ") && event.target instanceof HTMLImageElement) open(event.target, event); }}>{children}</Component>;
}
