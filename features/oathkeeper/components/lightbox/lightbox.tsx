"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, X } from "@/components/icons/duo";
import { clampPan, swipeIntent, wrapIndex } from "@/lib/lightbox";
import { closeLightbox, goLightbox, lightboxMissed, lightboxMissedServer, lightboxServerSnapshot, lightboxSnapshot, stepLightbox, subscribeLightbox, syncLightboxWithAddress, type LightboxItem } from "./store";
import styles from "./lightbox.module.css";

const MAX_SCALE = 5, ZOOM_STEP = 2.5;
type View = { scale: number; x: number; y: number };
const FIT: View = { scale: 1, x: 0, y: 0 };

export function ZoomGlyph({ out = false }: { out?: boolean }) {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.25"/><path d="M10.2 10.2 13.5 13.5M5.2 7h3.6"/>{out ? null : <path d="M7 5.2v3.6"/>}</svg>;
}

/** Mounted once for the whole app. Every surface opens it through `useLightboxSet` or `LightboxZone`. */
export function LightboxHost() {
  const state = useSyncExternalStore(subscribeLightbox, lightboxSnapshot, lightboxServerSnapshot);
  const pathname = usePathname();
  useEffect(() => { const onPop = () => syncLightboxWithAddress(true); window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop); }, []);
  // Leaving the page by any other route closes it too.
  useEffect(() => { syncLightboxWithAddress(true); }, [pathname]);
  // A shared link whose picture isn't on this page: said once, and the address is already clean.
  const missed = useSyncExternalStore(subscribeLightbox, lightboxMissed, lightboxMissedServer);
  const [told, setTold] = useState(0);
  useEffect(() => { if (missed === told) return; const timer = setTimeout(() => setTold(missed), 5000); return () => clearTimeout(timer); }, [missed, told]);
  if (!state || !state.items[state.index]) return missed !== told ? <p className={styles.missed} role="status">That picture isn&rsquo;t on this page.</p> : null;
  return <Lightbox items={state.items} index={state.index}/>;
}

function Lightbox({ items, index }: { items: LightboxItem[]; index: number }) {
  const item = items[index], many = items.length > 1;
  const content = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null), picture = useRef<HTMLImageElement>(null);
  const [view, setView] = useState<View>(FIT), [drag, setDrag] = useState<{ x: number; y: number } | null>(null), [moving, setMoving] = useState(false);
  const [loaded, setLoaded] = useState<string | null>(null), [failed, setFailed] = useState<string | null>(null), [sharp, setSharp] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  // A finger's single tap on the picture hides the bars (the picture gets the whole screen) and brings them back.
  const [chrome, setChrome] = useState(true);
  const [shown, setShown] = useState(item.key);
  if (shown !== item.key) { setShown(item.key); setView(FIT); setDrag(null); setMoving(false); }
  const viewRef = useRef(view);
  useLayoutEffect(() => { viewRef.current = view; });
  const zoomed = view.scale > 1.01;

  // The neighbours are fetched ahead, so a step paints at once.
  useEffect(() => {
    if (!many) return;
    const ahead = [items[wrapIndex(index + 1, items.length)], items[wrapIndex(index - 1, items.length)]].map(neighbour => { const image = new Image(); image.decoding = "async"; image.src = neighbour.src; return image; });
    return () => { for (const image of ahead) image.src = ""; };
  }, [items, index, many]);
  // Zoomed in: bring the original's pixels, when the fitted picture is a smaller rendition.
  useEffect(() => {
    if (!zoomed || !item.original || item.original === item.src || sharp === item.key) return;
    let live = true; const image = new Image(); image.src = item.original;
    image.decode().then(() => { if (live) setSharp(item.key); }, () => undefined);
    return () => { live = false; };
  }, [zoomed, item, sharp]);

  const bounds = useCallback((next: View): View => {
    const box = stage.current, image = picture.current;
    if (!box || !image || next.scale <= 1.01) return FIT;
    const scale = Math.min(MAX_SCALE, next.scale);
    return { scale, x: clampPan(next.x, image.offsetWidth, scale, box.clientWidth), y: clampPan(next.y, image.offsetHeight, scale, box.clientHeight) };
  }, []);
  /** Zooms to `scale`, keeping the point under the pointer where it is. */
  const zoomAt = useCallback((scale: number, clientX?: number, clientY?: number) => {
    const box = stage.current?.getBoundingClientRect(), current = viewRef.current;
    if (!box) return;
    const px = clientX === undefined ? 0 : clientX - (box.left + box.width / 2), py = clientY === undefined ? 0 : clientY - (box.top + box.height / 2);
    const ratio = Math.max(1, Math.min(MAX_SCALE, scale)) / current.scale;
    setView(bounds({ scale: current.scale * ratio, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio }));
  }, [bounds]);
  const toggleZoom = useCallback((clientX?: number, clientY?: number) => { if (viewRef.current.scale > 1.01) setView(FIT); else zoomAt(ZOOM_STEP, clientX, clientY); }, [zoomAt]);

  // Wheel and trackpad pinch zoom (the listener must not be passive to keep the page from zooming).
  useEffect(() => {
    const box = stage.current; if (!box) return;
    const onWheel = (event: WheelEvent) => { event.preventDefault(); zoomAt(viewRef.current.scale * Math.exp(-event.deltaY * (event.ctrlKey ? .012 : .0025)), event.clientX, event.clientY); };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [zoomAt]);
  useLayoutEffect(() => { const onResize = () => setView(current => bounds(current)); window.addEventListener("resize", onResize); return () => window.removeEventListener("resize", onResize); }, [bounds]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; base: View; moved: boolean; onPicture: boolean; pinch?: { distance: number; scale: number } } | null>(null);
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null);
  const spread = () => { const [a, b] = [...pointers.current.values()]; return { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button, a"))) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const onPicture = event.target === picture.current;
    if (pointers.current.size === 2) { gesture.current = { x: 0, y: 0, base: viewRef.current, moved: true, onPicture, pinch: { distance: spread().distance, scale: viewRef.current.scale } }; setDrag(null); }
    else gesture.current = { x: event.clientX, y: event.clientY, base: viewRef.current, moved: false, onPicture };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (current.pinch) { if (pointers.current.size >= 2) { const now = spread(); setMoving(true); zoomAt(current.pinch.scale * now.distance / current.pinch.distance, now.x, now.y); } return; }
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < 6) return;
    current.moved = true; setMoving(true);
    if (current.base.scale > 1.01) setView(bounds({ scale: current.base.scale, x: current.base.x + dx, y: current.base.y + dy }));
    else setDrag(Math.abs(dx) >= Math.abs(dy) ? { x: many ? dx : dx / 4, y: 0 } : { x: 0, y: Math.max(0, dy) });
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!pointers.current.delete(event.pointerId) || !current) return;
    if (current.pinch) { if (pointers.current.size === 0) { gesture.current = null; setMoving(false); setView(now => bounds(now)); } return; }
    gesture.current = null; setMoving(false); setDrag(null);
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (event.type === "pointercancel") return;
    if (current.moved) {
      if (current.base.scale > 1.01) return;
      const intent = swipeIntent(dx, dy);
      if (intent === "close") closeLightbox(); else if (intent && many) stepLightbox(intent === "next" ? 1 : -1);
      return;
    }
    // A tap. Off the picture: close. On it: a mouse click zooms; a finger needs a double tap.
    if (!current.onPicture) { closeLightbox(); return; }
    if (event.pointerType === "mouse") { toggleZoom(event.clientX, event.clientY); return; }
    const now = performance.now(), before = lastTap.current;
    // The second tap of a double tap undoes the first tap's toggle, then zooms.
    setChrome(value => !value);
    if (before && now - before.at < 320 && Math.hypot(event.clientX - before.x, event.clientY - before.y) < 40) { lastTap.current = null; toggleZoom(event.clientX, event.clientY); }
    else lastTap.current = { at: now, x: event.clientX, y: event.clientY };
  };

  const keys = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (!chrome) setChrome(true);
    const act = (run: () => void) => { event.preventDefault(); run(); };
    if (event.key === "ArrowLeft" && many) act(() => stepLightbox(-1));
    else if (event.key === "ArrowRight" && many) act(() => stepLightbox(1));
    else if (event.key === "Home" && many) act(() => goLightbox(0));
    else if (event.key === "End" && many) act(() => goLightbox(items.length - 1));
    else if (event.key === "+" || event.key === "=") act(() => zoomAt(viewRef.current.scale * 1.5));
    else if (event.key === "-") act(() => zoomAt(viewRef.current.scale / 1.5));
    else if (event.key === "0") act(() => setView(FIT));
  };

  const src = sharp === item.key && item.original ? item.original : item.src;
  const pending = loaded !== item.key, broken = failed === item.key || Boolean(item.unavailable);
  const pull = drag ? Math.min(1, drag.y / 320) : 0;
  const transform = zoomed ? `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` : drag ? `translate3d(${drag.x}px, ${drag.y}px, 0) scale(${1 - pull * .12})` : undefined;
  const title = item.title || item.alt || "Picture";
  return <DialogPrimitive.Root open onOpenChange={open => { if (!open) closeLightbox(); }}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={styles.overlay} style={pull ? { opacity: 1 - pull * .5 } : undefined}/>
      <DialogPrimitive.Content ref={content} className={styles.root} aria-describedby={undefined} data-lightbox="" data-chrome={chrome ? undefined : "off"} data-index={index} data-total={items.length} data-key={item.key}
        onOpenAutoFocus={event => { event.preventDefault(); content.current?.focus(); }} onKeyDown={keys}>
        <header className={styles.bar} onClick={event => { if (event.target === event.currentTarget) closeLightbox(); }}>
          <div className={styles.copy}>
            <DialogPrimitive.Title className={styles.title} title={title}>{title}</DialogPrimitive.Title>
            {item.caption ? <p className={styles.caption}>{item.caption}</p> : null}
            {item.note ? <p className={styles.note} title={item.note}>{item.note}</p> : null}
          </div>
          {[item.link, ...(item.links ?? [])].map(link => link ? <Link key={link.href} className={styles.textPill} href={link.href} scroll={false}>{link.label}<ArrowRight aria-hidden="true"/></Link> : null)}
          <div className={styles.track} role="group" aria-label="Picture">
            <button type="button" className={styles.pill} aria-pressed={zoomed} aria-label={zoomed ? "Zoom out" : "Zoom in"} title={zoomed ? "Zoom out (0)" : "Zoom in (+)"} onClick={() => toggleZoom()}><ZoomGlyph out={zoomed}/></button>
            <a className={styles.pill} href={item.href || item.original || item.src} target="_blank" rel="noopener noreferrer" aria-label="Open the picture in a new tab" title="Open in a new tab"><ArrowUpRight aria-hidden="true"/></a>
            <button type="button" className={styles.pill} aria-label="Close" title="Close (Esc)" onClick={closeLightbox}><X aria-hidden="true"/></button>
          </div>
        </header>
        <div ref={stage} className={styles.stage} data-zoomed={zoomed || undefined} data-moving={moving || undefined}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {many ? <button type="button" className={styles.side} data-side="previous" aria-label="Previous picture" title="Previous (←)" tabIndex={-1} onClick={() => stepLightbox(-1)}><ArrowLeft aria-hidden="true"/></button> : null}
          <div className={styles.frame}>
            {broken ? <div className={styles.failed} role="status"><span>{item.unavailable ?? "Picture unavailable"}</span>{item.unavailable ? null : <button type="button" onClick={() => { setFailed(null); setAttempt(value => value + 1); }}>Retry</button>}</div> : <>
              {/* eslint-disable @next/next/no-img-element */}
              {pending && item.thumb && item.thumb !== src ? <img className={`${styles.picture} ${styles.under}`} src={item.thumb} alt="" aria-hidden="true" draggable={false}/> : null}
              <img ref={picture} key={`${item.key}:${attempt}`} className={styles.picture} src={src} alt={item.alt ?? title} draggable={false} style={transform ? { transform } : undefined}
                onLoad={() => setLoaded(item.key)} onError={() => { if (src !== item.src) setSharp(null); else setFailed(item.key); }}/>
              {/* eslint-enable @next/next/no-img-element */}
            </>}
          </div>
          {many ? <button type="button" className={styles.side} data-side="next" aria-label="Next picture" title="Next (→)" tabIndex={-1} onClick={() => stepLightbox(1)}><ArrowRight aria-hidden="true"/></button> : null}
        </div>
        <footer className={styles.foot} data-single={many || item.action ? undefined : ""} onClick={event => { if (event.target === event.currentTarget) closeLightbox(); }}>
          {many ? <div className={styles.track} role="group" aria-label="Browse pictures">
            <button type="button" className={styles.pill} aria-label="Previous picture" title="Previous (←)" onClick={() => stepLightbox(-1)}><ArrowLeft aria-hidden="true"/></button>
            <span className={styles.counter} role="status" aria-label={`Picture ${index + 1} of ${items.length}`}>{index + 1} / {items.length}</span>
            <button type="button" className={styles.pill} aria-label="Next picture" title="Next (→)" onClick={() => stepLightbox(1)}><ArrowRight aria-hidden="true"/></button>
          </div> : null}
          {item.action ? <button type="button" className={styles.textPill} data-primary="" data-active={item.action.active || undefined} aria-pressed={Boolean(item.action.active)} disabled={item.action.busy} onClick={item.action.onRun}>
            {item.action.active ? <Check aria-hidden="true"/> : null}{item.action.busy ? "Saving…" : item.action.active ? item.action.activeLabel ?? item.action.label : item.action.label}</button> : null}
          {item.action?.message ? <p className={styles.said} role="status" data-tone={item.action.message.tone}>{item.action.message.text}</p> : null}
        </footer>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
