/* Canvas theme and page bootstrap. The bootstrap design (theme variables injected before paint, a JSON-RPC host-context message to
 * re-theme, a size-changed message to size the frame) follows T3 Code's html_render (https://github.com/pingdotgg/t3code, MIT,
 * Copyright (c) 2025 T3 Tools Inc.). Colours come from Oathkeeper's tokens; no hue in 240-300. */

export type Appearance = "dark" | "light";

export const CANVAS_THEMES: Record<Appearance, Record<string, string>> = {
  dark: {
    "--background": "#08090a", "--foreground": "#f8f8fa", "--card": "#171619", "--card-foreground": "#f8f8fa", "--muted": "#201f22",
    "--muted-foreground": "#8a909a", "--popover": "#201f22", "--popover-foreground": "#f8f8fa", "--secondary": "#262528", "--secondary-foreground": "#f8f8fa",
    "--border": "rgba(255,255,255,0.09)", "--input": "#1f1f1f", "--ring": "#8bb8ff", "--primary": "#2684fc", "--primary-foreground": "#ffffff",
    "--accent": "#5aa2f5", "--accent-foreground": "#08090a", "--destructive": "#ff6a5f", "--warning": "#ffb340", "--success": "#30d158", "--info": "#5aa2f5",
    "--code-background": "#0e0e0f", "--code-foreground": "#d7dbd8",
    "--chart-1": "#5aa2f5", "--chart-2": "#2dd4bf", "--chart-3": "#ff7ab2", "--chart-4": "#e0a53a", "--chart-5": "#30d158", "--chart-6": "#ff8a5b",
  },
  light: {
    "--background": "#f4f4f5", "--foreground": "#111113", "--card": "#ffffff", "--card-foreground": "#111113", "--muted": "#ececee",
    "--muted-foreground": "#5d636e", "--popover": "#ffffff", "--popover-foreground": "#111113", "--secondary": "#e4e4e7", "--secondary-foreground": "#111113",
    "--border": "rgba(0,0,0,0.11)", "--input": "#ffffff", "--ring": "#1f6fd8", "--primary": "#1f6fd8", "--primary-foreground": "#ffffff",
    "--accent": "#1f6fd8", "--accent-foreground": "#ffffff", "--destructive": "#d6362b", "--warning": "#b86e00", "--success": "#1c8a3a", "--info": "#1f6fd8",
    "--code-background": "#ececee", "--code-foreground": "#26262a",
    "--chart-1": "#1f6fd8", "--chart-2": "#0d9488", "--chart-3": "#d6357a", "--chart-4": "#a8780f", "--chart-5": "#1c8a3a", "--chart-6": "#d4561f",
  },
};

const FONTS = {
  "--font-sans": '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  "--font-mono": '"SF Mono", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
  "--radius": "12px",
};

export const CANVAS_MEASURE_WIDTHS = [320, 402, 520, 728, 1000, 1440] as const;
export const CANVAS_DEFAULT_WIDTH = 402;
export const CANVAS_MIN_HEIGHT = 80;
export const CANVAS_MAX_HEIGHT = 20_000;

export const CANVAS_CSP = "default-src 'none'; img-src data:; media-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";

export const BASE_CSS =
  "html{box-sizing:border-box;padding:8px;background:var(--background);color:var(--foreground);font-family:var(--font-sans);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;scrollbar-width:none}" +
  "html::-webkit-scrollbar{display:none}*,*::before,*::after{box-sizing:inherit}body{margin:0}code,kbd,pre,samp{font-family:var(--font-mono)}" +
  ":where(:focus-visible){outline:2px solid var(--ring);outline-offset:-2px}";

export function themeRule(appearance: Appearance, variables: Record<string, string> = { ...CANVAS_THEMES[appearance], ...FONTS }) {
  const declarations = Object.entries(variables).map(([name, value]) => `${name}:${value};`).join("");
  return `:root{color-scheme:${appearance};${declarations}}`;
}

export function themeMessage(appearance: Appearance) {
  return { jsonrpc: "2.0", method: "ui/notifications/host-context-changed", params: { theme: appearance, styles: { variables: { ...CANVAS_THEMES[appearance], ...FONTS } } } } as const;
}

/** The in-frame script: applies a re-theme message, reports content height to the host. Inline, no network. */
const BOOTSTRAP_SCRIPT = `(function(){var s=document.getElementById("canvas-theme");if(!s)return;var b=${JSON.stringify(BASE_CSS)};` +
  `function a(t){if(!t||typeof t!=="object"||!t.variables||typeof t.variables!=="object")return;var c=":root{color-scheme:"+(t.appearance==="light"?"light":"dark")+";";for(var k in t.variables){if(/^--[a-z0-9-]+$/.test(k))c+=k+":"+String(t.variables[k]).replace(/[;{}<>]/g,"")+";";}s.textContent=c+"}"+b;}` +
  `window.addEventListener("message",function(e){var d=e.data,p=d&&d.params;if(e.source===window.parent&&d&&d.jsonrpc==="2.0"&&d.method==="ui/notifications/host-context-changed"&&p&&p.styles)a({appearance:p.theme,variables:p.styles.variables});});` +
  `if(window.parent!==window){var h,o,z=function(){var r=document.documentElement,v=Math.ceil(r.scrollHeight>r.clientHeight?r.scrollHeight:r.getBoundingClientRect().height);if(v===h)return;h=v;window.parent.postMessage({jsonrpc:"2.0",method:"ui/notifications/size-changed",params:{height:v}},"*");};` +
  `if(window.ResizeObserver){o=new ResizeObserver(z);o.observe(document.documentElement);}document.addEventListener("DOMContentLoaded",function(){if(o&&document.body)o.observe(document.body);z();});window.addEventListener("load",z);}` +
  `function f(){document.querySelectorAll("svg.cv-svg").forEach(function(s){var vb=s.viewBox&&s.viewBox.baseVal,w=s.getBoundingClientRect().width;if(!vb||!vb.width||!w)return;var k=vb.width/w;s.querySelectorAll("text").forEach(function(x){x.style.fontSize=(12*k)+"px";x.style.visibility=""});var last=null;s.querySelectorAll("text").forEach(function(x){var r=x.getBoundingClientRect();if(last&&Math.abs(r.top-last.top)<4&&r.left<last.right+6&&r.right>last.left-6){x.style.visibility="hidden";return}last=r})})}` +
  `if(window.parent!==window)window.addEventListener("load",function(){window.parent.postMessage({jsonrpc:"2.0",method:"ui/notifications/canvas-ready"},"*")});` +
  `document.addEventListener("DOMContentLoaded",function(){f();if(window.ResizeObserver&&document.body)new ResizeObserver(f).observe(document.body)});window.addEventListener("resize",f);` +
  `})();`;

/** Canvas library thumbnails: the card is the frame, so the page drops its own catalog card (border, fill, padding) and its title,
 *  and paints the thumbnail well's colour from the first byte. */
export const CANVAS_THUMB_BACKGROUND = "#151517";
// `html body` outranks the catalog page's own `.cv-card` rule, which comes later in the document.
const THUMB_CSS = `:root{--background:${CANVAS_THUMB_BACKGROUND}}html{padding:14px 14px 0}html body .cv-card{background:transparent;border:0;box-shadow:none;padding:0}html body .cv-card>.cv-h{display:none}`;

export type CanvasVariant = "page" | "thumb";

/** Thumbnails show the title under the card, so an HTML page's own leading heading with the same text is hidden (title shown once). */
const thumbTitleScript = (title: string) => `<script>document.addEventListener("DOMContentLoaded",function(){var t=${JSON.stringify(title.trim().toLowerCase()).replace(/</g, "\\u003c")};` +
  `var h=document.querySelector("body h1,body h2,body h3");if(h&&h.textContent.trim().toLowerCase()===t){var r=h.getBoundingClientRect(),b=document.body.getBoundingClientRect();if(r.top-b.top<40)h.style.display="none";}});</script>`;

export function bootstrapMarkup(html: string, appearance: Appearance, variant: CanvasVariant = "page", title?: string) {
  const head = html.slice(0, 4096);
  return [
    // Theme first, so the document's first paint is already the right colour (no white frame).
    `<meta name="color-scheme" content="${appearance}">`,
    `<style id="canvas-ground">html{color-scheme:${appearance};background:${variant === "thumb" ? CANVAS_THUMB_BACKGROUND : CANVAS_THEMES[appearance]["--background"]}}</style>`,
    `<meta http-equiv="Content-Security-Policy" content="${CANVAS_CSP}">`,
    /<meta\s[^>]*charset/i.test(head) ? "" : '<meta charset="utf-8">',
    /<meta\s[^>]*name\s*=\s*["']?viewport/i.test(html) ? "" : '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<style id="canvas-theme">${themeRule(appearance)}${BASE_CSS}</style>`,
    variant === "thumb" ? `<style id="canvas-thumb">${THUMB_CSS}</style>${title ? thumbTitleScript(title) : ""}` : "",
    `<script>${BOOTSTRAP_SCRIPT}</script>`,
  ].join("");
}

/** A failed page, served in place of a blank or plain-text error: themed from the first paint, and it tells the host so the frame can
 *  show its own calm error state. */
export function canvasErrorPage(appearance: Appearance, message: string, variant: CanvasVariant = "page") {
  const text = message.replace(/[<>&"]/g, c => `&#${c.charCodeAt(0)};`);
  return injectCanvasBootstrap(`<!doctype html><html><head></head><body><p style="margin:0;padding:24px 8px;text-align:center;font-size:13px;color:var(--muted-foreground)">${text}</p>` +
    `<script>if(window.parent!==window)window.parent.postMessage({jsonrpc:"2.0",method:"ui/notifications/canvas-error",params:{message:${JSON.stringify(message)}}},"*");</script></body></html>`, appearance, variant);
}

/** The page finished loading inside the frame (posted by the bootstrap on window load). */
export function readCanvasReady(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as Record<string, unknown>).jsonrpc === "2.0" && (data as Record<string, unknown>).method === "ui/notifications/canvas-ready";
}

export function readCanvasError(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as Record<string, unknown>).jsonrpc === "2.0" && (data as Record<string, unknown>).method === "ui/notifications/canvas-error";
}

/** Inject the CSP, theme and bootstrap at the very start of the document head (before any agent script). */
export function injectCanvasBootstrap(html: string, appearance: Appearance = "dark", variant: CanvasVariant = "page", title?: string): string {
  const markup = bootstrapMarkup(html, appearance, variant, title);
  const headOpen = /<head(?:\s[^>]*)?>/i.exec(html);
  if (headOpen) { const at = headOpen.index + headOpen[0].length; return html.slice(0, at) + markup + html.slice(at); }
  const htmlOpen = /<html(?:\s[^>]*)?>/i.exec(html);
  if (htmlOpen) { const at = htmlOpen.index + htmlOpen[0].length; return `${html.slice(0, at)}<head>${markup}</head>${html.slice(at)}`; }
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  if (doctype) { const at = doctype[0].length; return `${html.slice(0, at)}<head>${markup}</head>${html.slice(at)}`; }
  return `<!doctype html><head>${markup}</head>${html}`;
}

export function readCanvasContentHeight(data: unknown): number | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const { jsonrpc, method, params } = data as Record<string, unknown>;
  if (jsonrpc !== "2.0" || method !== "ui/notifications/size-changed") return undefined;
  const height = typeof params === "object" && params !== null ? (params as { height?: unknown }).height : undefined;
  return typeof height === "number" && Number.isFinite(height) && height > 0 ? height : undefined;
}

export type CanvasHeights = ReadonlyArray<readonly [width: number, height: number]>;
export function clampCanvasHeight(height: number) { return Math.min(CANVAS_MAX_HEIGHT, Math.max(CANVAS_MIN_HEIGHT, Math.round(height))); }

/** The frame height for a width: the live measurement wins; otherwise the taller of the two stored neighbours (breakpoints can pick either). */
export function canvasFrameHeight(heights: CanvasHeights | undefined, fallback: number, width: number, live?: number) {
  if (live !== undefined) return clampCanvasHeight(live);
  if (!heights?.length) return clampCanvasHeight(fallback);
  const sorted = [...heights].sort((a, b) => a[0] - b[0]);
  const above = sorted.findIndex(([w]) => w >= width);
  const high = above === -1 ? sorted.length - 1 : above;
  const low = sorted[high][0] === width ? high : Math.max(0, high - 1);
  return clampCanvasHeight(Math.max(sorted[low][1], sorted[high][1]));
}

/** What a tool result carries so a client can show a published page. */
export type CanvasReference = { id: string; title: string; height: number; heights?: [number, number][]; kind: string };
export function readCanvasReference(output: unknown): CanvasReference | undefined {
  const direct = (value: unknown): CanvasReference | undefined => {
    if (typeof value !== "object" || value === null) return undefined;
    const c = (value as { canvas?: unknown }).canvas;
    if (typeof c !== "object" || c === null) return undefined;
    const { id, title, height, heights, kind } = c as Record<string, unknown>;
    if (typeof id !== "string" || !/^cv_[A-Za-z0-9-]{8,64}$/.test(id) || typeof title !== "string" || typeof height !== "number" || !Number.isFinite(height)) return undefined;
    const measured = Array.isArray(heights) && heights.length <= 24 && heights.every(e => Array.isArray(e) && e.length === 2 && e.every(n => typeof n === "number" && Number.isFinite(n))) ? heights as [number, number][] : undefined;
    return { id, title: title.slice(0, 200), height: clampCanvasHeight(height), kind: typeof kind === "string" ? kind : "html", ...(measured ? { heights: measured } : {}) };
  };
  if (typeof output === "string") { try { return direct(JSON.parse(output)); } catch { return undefined; } }
  const found = direct(output) ?? direct((output as { structuredContent?: unknown } | null)?.structuredContent);
  if (found) return found;
  const content = (output as { content?: unknown } | null)?.content;
  if (Array.isArray(content)) for (const part of content) {
    const text = (part as { type?: string; text?: unknown })?.type === "text" ? (part as { text: unknown }).text : undefined;
    if (typeof text === "string" && text.includes('"canvas"')) { try { const parsed = direct(JSON.parse(text)); if (parsed) return parsed; } catch { /* not JSON */ } }
  }
  return undefined;
}
