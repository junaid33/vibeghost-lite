"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { canvasFrameHeight, readCanvasContentHeight, readCanvasError, readCanvasReady, type CanvasHeights, themeMessage } from "@/lib/oathkeeper-canvas/theme";
import { CanvasSkeleton, canvasShape, type CanvasShape } from "./canvas-skeleton";
import styles from "./canvas.module.css";

export type CanvasFrameProps = { id: string; title: string; height: number; heights?: CanvasHeights; inline?: boolean; kind?: string | null; component?: string | null; onClose?: () => void };
export type CanvasLoadState = "loading" | "ready" | "error";

/** After the iframe's load event, how long to wait for the page's own "ready" message. None means the browser showed its own
 *  error page (network or server failure), which a sandboxed frame cannot inspect, so the frame shows a calm error instead. */
const READY_GRACE_MS = 2500;
/** A page that never finishes loading (counted from when the frame scrolls into view, since frames load lazily) gets the same calm message. */
const LOAD_TIMEOUT_MS = 30_000;

/** Tracks one sandboxed canvas iframe from first byte to reveal: "loading" (skeleton shown, frame transparent), "ready" (fade in)
 *  or "error". Height messages from the page are passed to `onHeight`. Reset `key` on the iframe to start over. */
export function useCanvasLoad(frame: React.RefObject<HTMLIFrameElement | null>, onHeight?: (height: number) => void) {
  const [state, setState] = useState<CanvasLoadState>("loading");
  const grace = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heightRef = useRef(onHeight);
  useEffect(() => { heightRef.current = onHeight; }, [onHeight]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      if (readCanvasError(event.data)) { clearTimeout(grace.current); setState("error"); return; }
      if (readCanvasReady(event.data)) { clearTimeout(grace.current); setState(current => current === "error" ? current : "ready"); return; }
      const next = readCanvasContentHeight(event.data); if (next !== undefined) heightRef.current?.(next);
    };
    window.addEventListener("message", onMessage);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const seen = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || timeout) return;
      timeout = setTimeout(() => setState(current => current === "loading" ? "error" : current), LOAD_TIMEOUT_MS);
    });
    const node = frame.current?.parentElement; if (node) seen.observe(node);
    return () => { window.removeEventListener("message", onMessage); seen.disconnect(); clearTimeout(timeout); clearTimeout(grace.current); };
  }, [frame]);
  const onLoad = useCallback(() => {
    clearTimeout(grace.current);
    grace.current = setTimeout(() => setState(current => current === "loading" ? "error" : current), READY_GRACE_MS);
  }, []);
  return { state, onLoad, onError: () => setState("error") };
}

/** A stored page in a sandboxed iframe: sandbox="allow-scripts" with no allow-same-origin, so it runs on an opaque origin with no network.
 *  The page reports its own height (T3-style size-changed message); the stored heights size it until then. Until the page has loaded,
 *  a dark skeleton shaped like the content covers the frame at its final size, then the page fades in: never a white flash. */
export function CanvasFrame({ id, title, height, heights, inline = false, kind, component }: CanvasFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null), box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(402), [live, setLive] = useState<number | undefined>(), [expanded, setExpanded] = useState(false);
  const { state, onLoad, onError } = useCanvasLoad(frame, setLive);
  useEffect(() => {
    const node = box.current; if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width) || 402));
    observer.observe(node); return () => observer.disconnect();
  }, [expanded]);
  useEffect(() => { if (!expanded) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [expanded]);
  const send = useCallback(() => { frame.current?.contentWindow?.postMessage(themeMessage("dark"), "*"); onLoad(); }, [onLoad]);
  const h = canvasFrameHeight(heights, height, width, live);
  const shape: CanvasShape = canvasShape(kind, component);
  const iframe = <iframe ref={frame} title={title} src={`/api/canvas/${encodeURIComponent(id)}/page?appearance=dark`} sandbox="allow-scripts" referrerPolicy="no-referrer" loading="lazy" onLoad={send} onError={onError}
    className={styles.iframe} data-state={state} style={expanded ? undefined : { height: h }} />;
  const cover = state === "ready" ? null : <CanvasSkeleton shape={shape} heading state={state === "error" ? "error" : "loading"}/>;
  return <>
    <div ref={box} className={inline ? styles.inline : styles.frameBox} data-canvas-frame={id} data-state={state} aria-busy={state === "loading" || undefined}>
      {expanded ? <div style={{ height: h }} aria-hidden="true"/> : <>{iframe}{cover}</>}
      {state === "error" ? null : <button type="button" className={styles.expand} onClick={() => setExpanded(true)} aria-label={`Expand ${title}`}>Expand</button>}
    </div>
    {expanded && typeof document !== "undefined" ? createPortal(<div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title} onClick={event => { if (event.target === event.currentTarget) setExpanded(false); }}>
      <div className={styles.sheet}><div className={styles.sheetBar}><span className={styles.sheetTitle}>{title}</span><button type="button" className={styles.expand} style={{ position: "static", opacity: 1 }} onClick={() => setExpanded(false)}>Close</button></div><div className={styles.sheetBody}>{iframe}{cover}</div></div>
    </div>, document.body) : null}
  </>;
}
