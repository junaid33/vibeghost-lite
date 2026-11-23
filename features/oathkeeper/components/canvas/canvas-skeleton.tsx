/* Canvas loading placeholders: a dark shimmer shaped like the page while its sandboxed iframe loads, so a canvas never flashes white.
 * The block is laid over the frame at its final size (no layout shift) and fades out once the page reports it loaded.
 * Skeleton material follows TuffUI loading-skeleton (https://tuffui.com, MIT, Copyright (c) 2026 TUFFUI contributors) as CRM v2 uses it,
 * with a slow shimmer sweep instead of the pulse (owner: "image skeleton loader"); static under reduced motion. */
import styles from "./canvas.module.css";

/** How the placeholder is drawn: the catalog component when known, else a generic page. */
export type CanvasShape = "chart" | "table" | "stats" | "gauge" | "page";
export function canvasShape(kind?: string | null, component?: string | null): CanvasShape {
  if (kind === "html") return "page";
  switch (component) {
    case "chart-card": case "dot-histogram": case "radar-chart": return "chart";
    case "data-table": case "slot-picker": return "table";
    case "stat-grid": case "result-carousel": return "stats";
    case "tick-gauge": return "gauge";
    default: return "page";
  }
}

const BARS = [38, 72, 46, 90, 58, 30, 66];
const LINES = [62, 88, 74, 81, 52];

/** `heading` draws the page's own title lines (the detail and chat frames); library thumbnails hide the page title, so they skip it. */
export function CanvasSkeleton({ shape, heading = false, state = "loading", message }: { shape: CanvasShape; heading?: boolean; state?: "loading" | "error"; message?: string }) {
  if (state === "error") return <div className={styles.skeleton} data-state="error" role="status"><span className={styles.skelError}>{message ?? "This canvas could not be loaded."}</span></div>;
  return <div className={styles.skeleton} role="status" aria-label="Loading canvas" data-shape={shape}>
    {heading ? <div className={styles.skelHead}><i style={{ width: "46%", height: 14 }}/><i style={{ width: "30%", height: 10 }}/></div> : null}
    {shape === "chart" ? <>
      <i style={{ width: 88, height: 22 }}/>
      <div className={styles.skelBars}>{BARS.map((h, n) => <i key={n} style={{ height: `${h}%` }}/>)}</div>
      <div className={styles.skelAxis}>{BARS.map((_, n) => <i key={n}/>)}</div>
    </> : shape === "table" ? <div className={styles.skelRows}>
      {[0, 1, 2, 3, 4, 5].map(n => <div key={n} className={styles.skelRow} data-head={n === 0 || undefined}><i style={{ width: `${[40, 54, 36, 48, 30, 44][n]}%` }}/><i/><i/></div>)}
    </div> : shape === "stats" ? <div className={styles.skelTiles}>
      {[0, 1, 2, 3].map(n => <div key={n}><i style={{ width: "55%", height: 10 }}/><i style={{ width: "70%", height: 20 }}/></div>)}
    </div> : shape === "gauge" ? <>
      <i style={{ width: 110, height: 28 }}/><i style={{ width: "40%", height: 10 }}/>
      <div className={styles.skelTicks}>{Array.from({ length: 24 }, (_, n) => <i key={n}/>)}</div>
    </> : <div className={styles.skelLines}>
      <i style={{ width: "58%", height: 18 }}/>
      {LINES.map((w, n) => <i key={n} style={{ width: `${w}%` }}/>)}
    </div>}
  </div>;
}
