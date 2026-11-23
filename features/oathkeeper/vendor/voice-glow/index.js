import { jsxs as $t, Fragment as nn, jsx as te } from "react/jsx-runtime";
import { forwardRef as Ko, useId as jo, useRef as Fe, useState as ge, useEffect as xe, useLayoutEffect as Qo, useCallback as Ct, useMemo as on } from "react";
function Ye(e) {
  const t = e.trim(), a = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (a) {
    const n = a[1].length === 3 ? a[1].split("").map((i) => i + i).join("") : a[1];
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  }
  const o = t.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  return o ? [Math.round(+o[1]), Math.round(+o[2]), Math.round(+o[3])] : null;
}
function Jo(e) {
  const t = Ye(e);
  return t ? `rgb(${t[0]}, ${t[1]}, ${t[2]})` : null;
}
function Mt(e) {
  const t = Ye(e);
  return t ? `${t[0]}, ${t[1]}, ${t[2]}` : null;
}
const Zo = {
  dark: {
    strokeOpacity: 1.16,
    innerOpacity: 0.47,
    bloomOpacity: 0.89,
    innerShadow: "rgba(255, 255, 255, 0.1)",
    saturation: 1.2,
    brightness: 1.1
  },
  // Light sits on a white surface: the deep light palettes at far higher
  // opacity than the dark preset's pastels need, a touch less saturation
  // and no brightness lift (which would wash them toward white).
  light: {
    strokeOpacity: 1.2,
    innerOpacity: 0.85,
    bloomOpacity: 0.5,
    innerShadow: "rgba(0, 0, 0, 0.08)",
    saturation: 1.6,
    brightness: 0.95,
    // A wider, quicker hue drift on white, nudged 5° warmer.
    hueRange: 40,
    hueDuration: 8.5,
    hueBase: 5,
    // Tuned in the Studio on the chat input.
    strength: 0.8,
    bandStrength: 1.7
  }
}, ne = [
  { x: 0, w: 74, h: 46, band: 0 },
  { x: -36, w: 54, h: 40, band: 1 },
  { x: 36, w: 54, h: 40, band: 1 },
  { x: -72, w: 48, h: 32, band: 2 },
  { x: 72, w: 48, h: 32, band: 2 },
  { x: -108, w: 42, h: 26, band: 1 },
  { x: 108, w: 42, h: 26, band: 1 }
], er = 36, tr = er * ne.length, Rn = {
  colorful: {
    dark: [
      "rgb(255, 70, 120)",
      "rgb(60, 190, 255)",
      "rgb(175, 70, 255)",
      "rgb(60, 220, 130)",
      "rgb(255, 150, 40)",
      "rgb(90, 100, 255)",
      "rgb(40, 200, 190)"
    ],
    // Candy on white: pinks, sky, lavender, mint, peach, periwinkle,
    // aqua — pastel bodies that the light preset's saturation lifts.
    // Candy on white: gold, sky, violet, rose, peach, periwinkle, aqua —
    // tuned in the Studio; the light preset's saturation lifts them.
    light: [
      "rgb(255, 201, 21)",
      "rgb(126, 196, 255)",
      "rgb(180, 40, 230)",
      "rgb(235, 100, 160)",
      "rgb(255, 176, 122)",
      "rgb(154, 160, 255)",
      "rgb(127, 217, 238)"
    ]
  },
  mono: {
    dark: [
      "rgb(215, 215, 215)",
      "rgb(180, 180, 180)",
      "rgb(190, 190, 190)",
      "rgb(160, 160, 160)",
      "rgb(170, 170, 170)",
      "rgb(150, 150, 150)",
      "rgb(155, 155, 155)"
    ],
    light: [
      "rgb(60, 60, 60)",
      "rgb(90, 90, 90)",
      "rgb(85, 85, 85)",
      "rgb(110, 110, 110)",
      "rgb(105, 105, 105)",
      "rgb(125, 125, 125)",
      "rgb(120, 120, 120)"
    ]
  },
  ocean: {
    dark: [
      "rgb(80, 140, 255)",
      "rgb(40, 200, 230)",
      "rgb(120, 90, 255)",
      "rgb(30, 170, 210)",
      "rgb(160, 80, 240)",
      "rgb(60, 110, 255)",
      "rgb(40, 190, 180)"
    ],
    light: [
      "rgb(40, 100, 240)",
      "rgb(20, 160, 200)",
      "rgb(90, 60, 230)",
      "rgb(20, 130, 180)",
      "rgb(130, 50, 220)",
      "rgb(40, 80, 230)",
      "rgb(20, 150, 150)"
    ]
  },
  sunset: {
    dark: [
      "rgb(255, 110, 60)",
      "rgb(255, 180, 40)",
      "rgb(255, 60, 90)",
      "rgb(255, 210, 80)",
      "rgb(240, 70, 140)",
      "rgb(255, 140, 50)",
      "rgb(230, 50, 110)"
    ],
    light: [
      "rgb(235, 80, 30)",
      "rgb(230, 150, 10)",
      "rgb(230, 30, 70)",
      "rgb(225, 175, 30)",
      "rgb(215, 40, 110)",
      "rgb(235, 110, 20)",
      "rgb(205, 30, 90)"
    ]
  },
  forest: {
    dark: [
      "rgb(70, 220, 120)",
      "rgb(40, 200, 180)",
      "rgb(140, 230, 80)",
      "rgb(30, 170, 140)",
      "rgb(190, 235, 70)",
      "rgb(50, 190, 110)",
      "rgb(30, 150, 120)"
    ],
    light: [
      "rgb(30, 170, 80)",
      "rgb(20, 150, 130)",
      "rgb(90, 180, 30)",
      "rgb(20, 130, 100)",
      "rgb(130, 180, 20)",
      "rgb(30, 150, 80)",
      "rgb(20, 120, 90)"
    ]
  },
  candy: {
    dark: [
      "rgb(255, 90, 170)",
      "rgb(255, 120, 220)",
      "rgb(210, 80, 255)",
      "rgb(255, 150, 190)",
      "rgb(180, 110, 255)",
      "rgb(255, 70, 140)",
      "rgb(230, 100, 240)"
    ],
    light: [
      "rgb(235, 40, 140)",
      "rgb(230, 70, 190)",
      "rgb(180, 40, 230)",
      "rgb(235, 100, 160)",
      "rgb(150, 70, 230)",
      "rgb(230, 30, 110)",
      "rgb(200, 60, 210)"
    ]
  },
  ice: {
    dark: [
      "rgb(150, 230, 255)",
      "rgb(90, 200, 255)",
      "rgb(190, 240, 255)",
      "rgb(120, 190, 255)",
      "rgb(160, 220, 250)",
      "rgb(80, 170, 255)",
      "rgb(200, 235, 255)"
    ],
    light: [
      "rgb(30, 160, 220)",
      "rgb(20, 130, 210)",
      "rgb(60, 180, 230)",
      "rgb(40, 120, 220)",
      "rgb(50, 160, 220)",
      "rgb(20, 110, 220)",
      "rgb(70, 170, 230)"
    ]
  },
  gold: {
    dark: [
      "rgb(255, 200, 70)",
      "rgb(255, 170, 40)",
      "rgb(255, 220, 110)",
      "rgb(240, 150, 30)",
      "rgb(255, 235, 140)",
      "rgb(230, 160, 40)",
      "rgb(250, 210, 90)"
    ],
    light: [
      "rgb(200, 140, 10)",
      "rgb(190, 120, 0)",
      "rgb(210, 160, 30)",
      "rgb(180, 110, 0)",
      "rgb(205, 170, 40)",
      "rgb(175, 115, 5)",
      "rgb(195, 150, 20)"
    ]
  }
};
function ar(e, t) {
  const a = e.match(/^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/);
  return a ? `rgba(${a[1]}, ${a[2]}, ${a[3]}, ${t.toFixed(2)})` : e;
}
function Zt(e, t = 1) {
  return Math.max(0.5, Math.round(e * t * 100) / 100);
}
function nr(e, t) {
  return `calc(50% + (var(--vb-cx-${t}) + var(--vb-x${e}-${t})) * var(--vb-w-${t}) * var(--vb-z-${t}, 1))`;
}
function ea({ id: e, colors: t, alpha: a, sw: o, sh: n, y: i, fade: r, count: l }) {
  return (l ? ne.slice(0, l) : ne).map((s, d) => {
    const b = a >= 1 ? t[d % t.length] : ar(t[d % t.length], a), f = `calc(${Math.round(s.w * o)}px * var(--vb-w-${e}) * var(--vb-z-${e}, 1))`, u = `calc(${Math.round(s.h * n)}px * var(--vb-h-${e}) * var(--vb-l${d}-${e}) * var(--vb-z-${e}, 1))`, p = `calc(100% + (${i}px + var(--vb-y${d}-${e})) * var(--vb-z-${e}, 1))`;
    return `radial-gradient(ellipse ${f} ${u} at ${nr(d, e)} ${p}, ${b} 0%, transparent ${r}%)`;
  }).join(`,
    `);
}
function rn(e, t, a = 1) {
  return `
@property --vb-opacity-${e} {
  syntax: "<number>";
  initial-value: 0;
  inherits: true;
}

[data-voice-beam="${e}"] {
  position: relative;
  border-radius: ${t}px;
  overflow: hidden;
  --vb-level-${e}: 0;
  --vb-glow-${e}: 0.4;
}

[data-voice-beam="${e}"][data-active] {
  animation: vb-fade-in-${e} 0.6s ease forwards;
}

[data-voice-beam="${e}"][data-fading] {
  animation: vb-fade-out-${e} 0.5s ease forwards;
}

/* The surface — under the host's content (z 5), above its background. */
[data-voice-beam="${e}"] [data-voice-beam-surface] {
  display: none;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  pointer-events: none;
  z-index: 4;
}

/* The pixels that fly into the closing button: above the content, and not
   faded with the effect — they outlive it by their flight. */
[data-voice-beam="${e}"] [data-voice-beam-flyers] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  /* With the surface, under the host's content (z 5): the flyers pass
     beneath the buttons' fills, as the wave does. Later in the DOM than
     the surface, so they still cross over the wave. */
  z-index: 4;
  /* The surface's strength, but not its fade: the flyers are its pixels. */
  opacity: var(--voice-strength, 1);
}

/* Opening from a button: the pixels fly out first and the wave fades in
   behind them, landing as they land. */
[data-voice-beam="${e}"][data-active][data-arriving] {
  animation-delay: 0.22s;
  animation-duration: 0.65s;
}

/* The pixel looks' halo: a small copy of the picture beneath
   it, stretched and blurred into a soft glow of its own colours. */
[data-voice-beam="${e}"] [data-voice-beam-pixel-glow] {
  display: none;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  pointer-events: none;
  z-index: 4;
  filter: blur(${Math.round(7 * Math.sqrt(a) * 10) / 10}px) saturate(1.3);
}

[data-voice-beam="${e}"][data-active] [data-voice-beam-pixel-glow],
[data-voice-beam="${e}"][data-fading] [data-voice-beam-pixel-glow] {
  display: block;
  opacity: calc(var(--vb-opacity-${e}, 1) * var(--voice-strength, 1) * var(--vb-pixel-glow-${e}, 0.6));
}

[data-voice-beam="${e}"][data-active] [data-voice-beam-surface],
[data-voice-beam="${e}"][data-fading] [data-voice-beam-surface] {
  display: block;
  opacity: calc(var(--vb-opacity-${e}, 1) * var(--voice-strength, 1));
}

@keyframes vb-fade-in-${e} {
  to { --vb-opacity-${e}: 1; }
}

@keyframes vb-fade-out-${e} {
  from { --vb-opacity-${e}: 1; }
  to { --vb-opacity-${e}: 0; }
}

[data-voice-beam="${e}"][data-paused] {
  animation-play-state: paused !important;
}
`;
}
function Cn(e) {
  if (e.look === "pixel") {
    const { id: I } = e;
    return `${Cn({ ...e, look: "glow", distortion: !1 })}
${rn(I, e.borderRadius, e.scale)}
[data-voice-beam="${I}"]::before,
[data-voice-beam="${I}"][data-active]::before,
[data-voice-beam="${I}"][data-fading]::before {
  content: none !important;
}
[data-voice-beam="${I}"][data-active]::after,
[data-voice-beam="${I}"][data-fading]::after {
  z-index: 4;
}
`;
  }
  if (e.look === "surface") return rn(e.id, e.borderRadius, e.scale);
  const {
    id: t,
    borderRadius: a,
    borderWidth: o,
    strokeOpacity: n,
    innerOpacity: i,
    bloomOpacity: r,
    innerShadow: l,
    colorVariant: c,
    colors: s,
    brightness: d,
    saturation: b,
    theme: f,
    hueBase: u = 0,
    glowSize: p = 1,
    glowWidth: w = 1,
    glowHeight: h = 1,
    strokeScale: m = 1,
    innerScale: $ = 1,
    innerHeight: y = 1,
    bloomScale: k = 1,
    bloomHeight: C = 1,
    coreSize: E = 1,
    coreLight: z = 0,
    coreLightWidth: W = 1,
    coreLightHeight: P = 1,
    rangeWidth: M = 1,
    rangeHeight: g = 1,
    softness: v = 1,
    distortion: S = !1,
    scale: T = 1
  } = e, L = Math.round(28 * T * 10) / 10, ae = Math.round(9 * T * 10) / 10, B = Math.max(0, a - o), O = Math.round(Math.max(40, Math.min(95, 70 * v))), X = (I) => w * I, R = (I) => h * I, V = (I) => Math.round(I * 10) / 10, D = `var(--vb-z-${t}, 1)`, _ = (I) => `calc(${V(I)}px * ${D})`, U = f === "dark", N = Rn[c][U ? "dark" : "light"].map((I, K) => {
    const oe = s == null ? void 0 : s[K];
    return oe && Jo(oe) || I;
  }), Y = c === "mono" ? 0.6 : 1, H = (n * Y).toFixed(2), le = (i * Y).toFixed(2), ce = (r * Y).toFixed(2), Z = d.toFixed(2), he = b.toFixed(2), be = `hue-rotate(calc(var(--voice-hue-base, ${u}deg) + var(--vb-hue-${t})))`, Qe = S ? ` url(#vb-distort-${t})` : "", Je = `filter: ${be} brightness(${Z}) saturate(${he});`, _t = `filter: ${be} brightness(${Z}) saturate(${he})${Qe};`, zt = `filter: blur(${_(Zt(10, p))}) ${be} brightness(${Z}) saturate(${he});`, Bt = `filter: blur(${_(Zt(10, p))}) ${be} brightness(${Z}) saturate(${he})${Qe};`, Re = `calc(50% + var(--vb-cx-${t}) * var(--vb-w-${t}) * ${D})`, Ze = `calc(100% + (2px + var(--vb-cy-${t})) * ${D})`, Nt = U ? `radial-gradient(ellipse calc(${V(30 * E)}px * var(--vb-w-${t}) * ${D}) calc(${V(30 * E)}px * var(--vb-h-${t}) * ${D}) at ${Re} ${Ze}, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.14) 30%, transparent 65%)` : `radial-gradient(ellipse calc(${V(40 * E)}px * var(--vb-w-${t}) * ${D}) calc(${V(30 * E)}px * var(--vb-h-${t}) * ${D}) at ${Re} ${Ze}, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.22) 35%, transparent 70%)`, Ht = ea({ id: t, colors: N, alpha: 1, sw: X(m), sh: R(m), y: 2, fade: O }), Gt = ea({ id: t, colors: N, alpha: 0.46, sw: X(0.9 * $), sh: R(0.9 * $ * y), y: 0, fade: O }), Vt = ea({ id: t, colors: N, alpha: U ? 0.9 : 0.7, sw: X(1.15 * k), sh: R(1.5 * k * C), y: 0, fade: Math.min(95, O + 2) }), we = (I, K, oe, me = 0) => `radial-gradient(ellipse calc(${V(I * M)}px * var(--vb-w-${t}) * var(--vb-mw-${t}) * ${D}) calc((${V(K * g)}px * var(--vb-h-${t}) + var(--vb-bh-${t})) * ${D}) at ${Re} calc(100% + var(--vb-cy-${t}) * ${D}), white 0%, rgba(255, 255, 255, 0.5) ${oe}%${me > 0 ? `, rgba(255, 255, 255, ${me}) 85%` : ""}, transparent 100%)`, Ce = (I, K) => `opacity: calc(var(--vb-opacity-${t}, 1) * var(--vb-glow-${t}) * ${K} * var(--voice-${I}-opacity, 1) * var(--voice-strength, 1));`, et = (I, K, oe, me) => `${I} {
  ${K}
  position: absolute;
  inset: 0;
  border-radius: ${_(a)};
  background: ${Gt};
  box-shadow: inset 0 0 ${_(ae)} 1px ${l};
  -webkit-mask-image:
    ${we(170, 64, 45, 0.3)},
    linear-gradient(white, transparent ${_(L)}, transparent calc(100% - ${L}px * ${D}), white),
    linear-gradient(to right, white, transparent ${_(L)}, transparent calc(100% - ${L}px * ${D}), white);
  -webkit-mask-composite: source-in, source-over;
  mask-image:
    ${we(170, 64, 45, 0.3)},
    linear-gradient(white, transparent ${_(L)}, transparent calc(100% - ${L}px * ${D}), white),
    linear-gradient(to right, white, transparent ${_(L)}, transparent calc(100% - ${L}px * ${D}), white);
  mask-composite: intersect, add;
  pointer-events: none;
  /* Its own compositing layer: WebKit otherwise re-rasterizes the
     filtered layer into the parent every frame on the CPU (a phone-sized
     host runs at a sixth of the frame rate without this). */
  will-change: transform;
  z-index: 1;
  ${oe}
  ${Ce("inner", le)}
  ${me}
}`;
  return `
@property --vb-opacity-${t} {
  syntax: "<number>";
  initial-value: 0;
  inherits: true;
}

[data-voice-beam="${t}"] {
  position: relative;
  border-radius: ${a}px;
  overflow: hidden;
  --vb-h-${t}: 0.8;
  --vb-w-${t}: 1;
${ne.map((I, K) => `  --vb-x${K}-${t}: ${I.x}px;
  --vb-l${K}-${t}: 1;
  --vb-y${K}-${t}: 0px;`).join(`
`)}
  --vb-glow-${t}: 0.4;
  --vb-z-${t}: 1;
  --vb-cx-${t}: 0px;
  --vb-cy-${t}: 0px;
  --vb-bh-${t}: 0px;
  --vb-bendA-${t}: 0;
  --vb-mw-${t}: 1;
  --vb-hue-${t}: 0deg;
  --vb-level-${t}: 0;
}

[data-voice-beam="${t}"][data-active] {
  animation: vb-fade-in-${t} 0.6s ease forwards;
}

[data-voice-beam="${t}"][data-fading] {
  animation: vb-fade-out-${t} 0.5s ease forwards;
}

/* Stroke — the colours painted into the 1px edge ring, masked to the centred ellipse. */
[data-voice-beam="${t}"][data-active]::after,
[data-voice-beam="${t}"][data-fading]::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: ${_(B)};
  padding: ${_(o)};
  clip-path: inset(0 round ${_(a)});
  background:
    ${Nt},
    ${Ht};
  -webkit-mask:
    ${we(170, 64, 45)},
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: source-in, xor;
  mask:
    ${we(170, 64, 45)},
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: intersect, exclude;
  pointer-events: none;
  /* Its own compositing layer: WebKit otherwise re-rasterizes the
     filtered layer into the parent every frame on the CPU (a phone-sized
     host runs at a sixth of the frame rate without this). */
  will-change: transform;
  z-index: 2;
  ${Ce("stroke", H)}
  ${Je}
}

/* Inner glow — soft light inside the element, faded off at the corners.
   With distortion on, this copy is clipped to ABOVE the band line (the
   polygon the driver writes each frame) and a mirror layer below carries
   the displacement filter, so only the glow under the line warps. */
${et(`[data-voice-beam="${t}"][data-active]::before,
[data-voice-beam="${t}"][data-fading]::before`, 'content: "";', S ? `clip-path: var(--vb-clip-above-${t}, inset(0 round ${a}px));` : `clip-path: inset(0 round ${a}px);`, Je)}
${S ? et(`[data-voice-beam="${t}"][data-active] [data-voice-beam-warp="inner"],
[data-voice-beam="${t}"][data-fading] [data-voice-beam-warp="inner"]`, "display: block;", `clip-path: var(--vb-clip-below-${t}, inset(0 round ${a}px));`, _t) : ""}

/* Bloom — the blurred halo, tallest of the three, above the content. */
[data-voice-beam="${t}"] [data-voice-beam-bloom],
[data-voice-beam="${t}"] [data-voice-beam-warp] {
  display: none;
  position: absolute;
  inset: 0;
  border-radius: ${_(B)};
  pointer-events: none;
  /* Its own compositing layer: WebKit otherwise re-rasterizes the
     filtered layer into the parent every frame on the CPU (a phone-sized
     host runs at a sixth of the frame rate without this). */
  will-change: transform;
  opacity: 0;
}

[data-voice-beam="${t}"] [data-voice-beam-bloom],
[data-voice-beam="${t}"] [data-voice-beam-warp="bloom"] {
  -webkit-mask: ${we(200, 130, 35)};
  mask: ${we(200, 130, 35)};
  background: ${Vt};
  z-index: 3;
}

[data-voice-beam="${t}"][data-active] [data-voice-beam-bloom],
[data-voice-beam="${t}"][data-fading] [data-voice-beam-bloom] {
  display: block;
  clip-path: ${S ? `var(--vb-clip-above-${t}, inset(0 round ${a}px))` : `inset(0 round ${a}px)`};
  ${Ce("bloom", ce)}
  ${zt}
}
${S ? `
[data-voice-beam="${t}"][data-active] [data-voice-beam-warp="bloom"],
[data-voice-beam="${t}"][data-fading] [data-voice-beam-warp="bloom"] {
  display: block;
  clip-path: var(--vb-clip-below-${t}, inset(0 round ${a}px));
  ${Ce("bloom", ce)}
  ${Bt}
}

/* Processing drops the distortion: the driver marks the wrapper once the
   warp has faded out, the warp layers leave the paint and the base layers
   give up their split at the band line. */
[data-voice-beam="${t}"][data-voice-warp="off"]::before,
[data-voice-beam="${t}"][data-voice-warp="off"] [data-voice-beam-bloom] {
  clip-path: inset(0 round ${a}px);
}

[data-voice-beam="${t}"][data-voice-warp="off"] [data-voice-beam-warp] {
  display: none;
}` : ""}

/* Epicentre — a soft white wash at the source, under the band line (the
   driver's clip; unclipped when no line is drawn), sitting above every
   glow layer and the band's halo so the centre reads lighter than the
   band (same z as the band canvases, painted after them). Sized by the voice like the
   other layers; off unless \`coreLight\` is set (the light theme sets it).
   Up to 1 it is the wash's opacity; past 1 the solid white core widens
   too, for a centre that stays lighter than a strong band. It follows the
   glow's presence but not \`strength\`, which would only dim it. */
${z > 0 ? (() => {
    const I = Math.max(0, Math.min(2, z - 1)), K = Math.min(1, I), oe = Math.max(0, I - 1), me = 1 + 0.3 * I, Xt = V(45 * K + 27 * oe), qt = V(40 + 25 * K + 15 * oe), Ut = Math.min(1, 0.55 + 0.35 * K + 0.1 * oe).toFixed(2), Yt = V(72 + 14 * K + 8 * oe);
    return `[data-voice-beam="${t}"] [data-voice-beam-core] {
  display: none;
  position: absolute;
  inset: 0;
  border-radius: ${_(B)};
  overflow: hidden;
  pointer-events: none;
  /* Its own compositing layer: WebKit otherwise re-rasterizes the
     filtered layer into the parent every frame on the CPU (a phone-sized
     host runs at a sixth of the frame rate without this). */
  will-change: transform;
  /* The blur sits on this wrapper and the band-line clip on the child,
     so the cut edge is blurred too rather than left hard. */
  filter: blur(${_(Zt(8, p))});
  z-index: 4;
}

[data-voice-beam="${t}"] [data-voice-beam-core] > div {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse calc(${V(120 * W * me * T)}px * var(--vb-w-${t}) * ${D}) calc((${V(70 * P * me * T)}px * var(--vb-h-${t}) + var(--vb-bh-${t})) * ${D}) at ${Re} calc(100% + var(--vb-cy-${t}) * ${D}), white 0%, white ${Xt}%, rgba(255, 255, 255, ${Ut}) ${qt}%, transparent ${Yt}%);
  clip-path: var(--vb-clip-below-${t}, none);
}

[data-voice-beam="${t}"][data-active] [data-voice-beam-core],
[data-voice-beam="${t}"][data-fading] [data-voice-beam-core] {
  display: block;
  opacity: calc(var(--vb-opacity-${t}, 1) * min(1, var(--vb-glow-${t}) * ${Math.min(1, z).toFixed(2)} * ${(1.6 + 1.4 * I).toFixed(2)}) * var(--voice-core-light-opacity, 1));
}
`;
  })() : ""}
/* Band — the canvas the driver draws the bend's contour on: an organic
   bell with chromatic fringes. Fades with the root, follows the strength
   and turns with the hue drift like the other layers. */
[data-voice-beam="${t}"] [data-voice-beam-band],
[data-voice-beam="${t}"] [data-voice-beam-band-halo] {
  display: none;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  /* Its own compositing layer: WebKit otherwise re-rasterizes the
     filtered layer into the parent every frame on the CPU (a phone-sized
     host runs at a sixth of the frame rate without this). */
  will-change: transform;
  z-index: 4;
}

[data-voice-beam="${t}"][data-active] [data-voice-beam-band],
[data-voice-beam="${t}"][data-fading] [data-voice-beam-band],
[data-voice-beam="${t}"][data-active] [data-voice-beam-band-halo],
[data-voice-beam="${t}"][data-fading] [data-voice-beam-band-halo] {
  display: block;
  opacity: calc(var(--vb-opacity-${t}, 1) * var(--voice-band-opacity, 1) * var(--voice-strength, 1));
  /* The blur vars are 0 where the canvas blurs its own strokes; where the
     2D context has no filter (WebKit) the driver sets them and the layers
     are blurred here instead — the ridge on the band canvas, its wider
     halo on the canvas beneath. */
  filter: blur(var(--vb-band-blur-${t}, 0px)) ${be} brightness(${Z}) saturate(${he});
}

[data-voice-beam="${t}"][data-active] [data-voice-beam-band-halo],
[data-voice-beam="${t}"][data-fading] [data-voice-beam-band-halo] {
  filter: blur(var(--vb-band-halo-blur-${t}, 0px)) ${be} brightness(${Z}) saturate(${he});
}

/* Resolution. The soft layers — inner light and its warp mirror, bloom and
   its mirror, the epicentre — are rastered at half size and scaled back
   up by the compositor: the box is halved, every length inside rides the
   layer's factor \`--vb-z\` at 0.5 (the driver also writes the band-line
   clips at half scale), and the will-change transform is rastered
   pre-scale where the engine does that (Chromium, Safari 18). For blurred
   gradients that is the same picture at a quarter of the raster and
   filter work, which is what a phone at 3x runs out of. The 1px stroke
   stays full-res on every screen: at half size it is half a CSS pixel,
   which a 3x phone rasters into a faint smear instead of the hairline,
   and the layer is cheap (no blur). The component sets
   \`data-voice-halfres\`. */
[data-voice-beam="${t}"][data-voice-halfres]::before,
[data-voice-beam="${t}"][data-voice-halfres] [data-voice-beam-warp],
[data-voice-beam="${t}"][data-voice-halfres] [data-voice-beam-bloom],
[data-voice-beam="${t}"][data-voice-halfres] [data-voice-beam-core] {
  --vb-z-${t}: 0.5;
  inset: auto;
  left: 0;
  top: 0;
  width: 50%;
  height: 50%;
  transform: translateZ(0) scale(2);
  transform-origin: 0 0;
}
${S ? `[data-voice-beam="${t}"][data-voice-halfres][data-active]::before,
[data-voice-beam="${t}"][data-voice-halfres][data-fading]::before,
[data-voice-beam="${t}"][data-voice-halfres][data-active] [data-voice-beam-bloom],
[data-voice-beam="${t}"][data-voice-halfres][data-fading] [data-voice-beam-bloom] {
  clip-path: var(--vb-clip-above-z-${t}, inset(0 round ${_(a)}));
}
[data-voice-beam="${t}"][data-voice-halfres][data-active] [data-voice-beam-warp],
[data-voice-beam="${t}"][data-voice-halfres][data-fading] [data-voice-beam-warp] {
  clip-path: var(--vb-clip-below-z-${t}, inset(0 round ${_(a)}));
}
/* Processing (warp off): the mirrors are gone, so the base layers paint
   the whole box again — this must outweigh the split above. */
[data-voice-beam="${t}"][data-voice-halfres][data-voice-warp="off"]::before,
[data-voice-beam="${t}"][data-voice-halfres][data-voice-warp="off"] [data-voice-beam-bloom] {
  clip-path: inset(0 round ${_(a)});
}` : `[data-voice-beam="${t}"][data-voice-halfres][data-active]::before,
[data-voice-beam="${t}"][data-voice-halfres][data-fading]::before,
[data-voice-beam="${t}"][data-voice-halfres][data-active] [data-voice-beam-bloom],
[data-voice-beam="${t}"][data-voice-halfres][data-fading] [data-voice-beam-bloom] {
  clip-path: inset(0 round ${_(a)});
}`}
[data-voice-beam="${t}"][data-voice-halfres] [data-voice-beam-core] > div {
  clip-path: var(--vb-clip-below-z-${t}, none);
}
@keyframes vb-fade-in-${t} {
  to { --vb-opacity-${t}: 1; }
}

@keyframes vb-fade-out-${t} {
  from { --vb-opacity-${t}: 1; }
  to { --vb-opacity-${t}: 0; }
}

[data-voice-beam="${t}"][data-paused],
[data-voice-beam="${t}"][data-paused]::after,
[data-voice-beam="${t}"][data-paused]::before,
[data-voice-beam="${t}"][data-paused] [data-voice-beam-bloom] {
  animation-play-state: paused !important;
}
`;
}
let qe = null;
function Pn() {
  if (typeof window > "u") return null;
  const e = window;
  return e.AudioContext ?? e.webkitAudioContext ?? null;
}
function Ci() {
  return Pn() != null;
}
function Wn() {
  const e = Pn();
  return e ? (qe || (qe = new e()), qe.state === "suspended" && qe.resume().catch(() => {
  }), qe) : null;
}
const ta = /* @__PURE__ */ new WeakMap();
function or(e) {
  const t = Wn();
  if (!t || e.getAudioTracks().length === 0) return null;
  let a = ta.get(e);
  a || (a = { node: t.createMediaStreamSource(e), refs: 0 }, ta.set(e, a)), a.refs += 1;
  const o = t.createAnalyser();
  o.fftSize = 1024, o.smoothingTimeConstant = 0.5, a.node.connect(o);
  let n = !1;
  return {
    analyser: o,
    release: () => {
      if (!n) {
        n = !0;
        try {
          a.node.disconnect(o);
        } catch {
        }
        if (a.refs -= 1, a.refs <= 0) {
          try {
            a.node.disconnect();
          } catch {
          }
          ta.delete(e);
        }
      }
    }
  };
}
const In = 2, rr = 3.2, Se = 6;
function ua(e, t) {
  let a = Math.imul(e, 668265261) ^ Math.imul(t, 374761393);
  return a = Math.imul(a ^ a >>> 15, 2246822507), a ^= a >>> 13, (a >>> 0) / 4294967296;
}
const Dn = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((e) => (e + 0.5) / 16), sn = 4, ir = 0.16, Pt = /* @__PURE__ */ new WeakMap();
function _n(e) {
  const t = Pt.get(e.canvas);
  if (!t) return null;
  const a = performance.now(), o = /* @__PURE__ */ new Set();
  return t.forEach((n, i) => {
    a > n ? t.delete(i) : o.add(i);
  }), t.size || Pt.delete(e.canvas), o.size ? o : null;
}
function zn(e, t, a) {
  let o = Pt.get(e.canvas);
  o || Pt.set(e.canvas, o = /* @__PURE__ */ new Map()), o.set(t, Math.max(o.get(t) ?? 0, a));
}
function oa(e, t, a, o, n, i, r = -1) {
  if (e.litN >= e.litX.length) {
    const c = Math.max(1024, e.litX.length * 2), s = (d, b) => {
      const f = b(c);
      return f.set(d), f;
    };
    e.litX = s(e.litX, (d) => new Float32Array(d)), e.litY = s(e.litY, (d) => new Float32Array(d)), e.litS = s(e.litS, (d) => new Float32Array(d)), e.litV = s(e.litV, (d) => new Float32Array(d)), e.litC = s(e.litC, (d) => new Int32Array(d)), e.litM = s(e.litM, (d) => new Int32Array(d));
  }
  const l = e.litN++;
  e.litX[l] = t, e.litY[l] = a, e.litS[l] = o, e.litV[l] = n, e.litC[l] = i, e.litM[l] = r;
}
const sr = 140, lr = 16, ln = 0.95, cr = 170, dr = 13;
function hr(e, t) {
  const a = e.getContext("2d");
  if (!a) return null;
  const o = (t == null ? void 0 : t.getContext("2d")) ?? null, n = new Float32Array(0);
  return {
    canvas: e,
    ctx: a,
    glowCanvas: o ? t : null,
    glowCtx: o,
    magnetKey: "",
    mx: n,
    my: n,
    mvx: n,
    mvy: n,
    litX: n,
    litY: n,
    litS: n,
    litV: n,
    litC: new Int32Array(0),
    litM: new Int32Array(0),
    litN: 0,
    dust: n,
    dustC: new Int32Array(0),
    dustCols: 0,
    dustAny: !1,
    travelX: NaN,
    travelV: 0
  };
}
const de = ne.length, Tt = new Float32Array(de * 3), Bn = new Float32Array(de), Nn = new Float32Array(de), br = new Float32Array(de), fa = new Float32Array(de), cn = 0.62, aa = 1.35, Lt = new Float32Array(9);
let ra = 0, Hn = 1, Ee = new Float32Array(0), Be = 0, Ne = 0, Wt = 1, It = 0, Gn = 0.18, ue = 0;
const fe = new Float32Array(3), Ke = /* @__PURE__ */ new Map();
let Vn = () => "";
const ur = 0.12, fr = 2, dn = 0.6, pr = 2.5;
function Xn(e) {
  const t = e * Math.PI / 180, a = Math.cos(t), o = Math.sin(t);
  return [
    0.213 + a * 0.787 - o * 0.213,
    0.715 - a * 0.715 - o * 0.715,
    0.072 - a * 0.072 + o * 0.928,
    0.213 - a * 0.213 + o * 0.143,
    0.715 + a * 0.285 + o * 0.14,
    0.072 - a * 0.072 - o * 0.283,
    0.213 - a * 0.213 - o * 0.787,
    0.715 - a * 0.715 + o * 0.715,
    0.072 + a * 0.928 + o * 0.072
  ];
}
function qn(e) {
  return [
    0.213 + 0.787 * e,
    0.715 - 0.715 * e,
    0.072 - 0.072 * e,
    0.213 - 0.213 * e,
    0.715 + 0.285 * e,
    0.072 - 0.072 * e,
    0.213 - 0.213 * e,
    0.715 - 0.715 * e,
    0.072 + 0.928 * e
  ];
}
function Dt(e, t, a, o, n, i) {
  n[i] = Math.min(1, Math.max(0, e[0] * t + e[1] * a + e[2] * o)), n[i + 1] = Math.min(1, Math.max(0, e[3] * t + e[4] * a + e[5] * o)), n[i + 2] = Math.min(1, Math.max(0, e[6] * t + e[7] * a + e[8] * o));
}
function gr(e, t) {
  Ne = 0;
  const a = t.band;
  if (!a || a.length < 2 || e.bandWidth <= 0 || (Ne = Math.min(1, 0.6 * e.bandStrength * t.bandAlpha) * 0.85, Ne <= 4e-3)) return;
  Ee.length < a.length && (Ee = new Float32Array(a.length)), Be = a.length, ra = a[0][0], Hn = (a[a.length - 1][0] - ra) / (a.length - 1) || 1;
  for (let c = 0; c < a.length; c++) Ee[c] = a[c][1];
  Wt = Math.max(0.9, 1.5 * e.bandWidth * (1 + 0.35 * t.level)), It = t.bandSplit * 0.55, Gn = e.bandTail > 0 ? 0.015 : 0.18;
  const o = Xn(t.hue), n = qn(e.saturation), i = e.layers.brightness, r = new Float32Array(3), l = [e.bandColors.core, e.bandColors.above, e.bandColors.below];
  for (let c = 0; c < 3; c++) {
    const [s, d, b] = l[c].split(",").map((f) => Number(f) / 255);
    Dt(o, s, d, b, r, 0), Dt(n, Math.min(1, r[0] * i), Math.min(1, r[1] * i), Math.min(1, r[2] * i), Lt, c * 3);
  }
}
function mr(e, t) {
  const a = Xn(t), o = qn(e.saturation), n = e.layers.brightness, i = new Float32Array(3);
  for (let r = 0; r < de; r++) {
    const [l, c, s] = e.palette[r % e.palette.length];
    Dt(a, l / 255, c / 255, s / 255, i, 0), Dt(o, Math.min(1, i[0] * n), Math.min(1, i[1] * n), Math.min(1, i[2] * n), Tt, r * 3);
  }
}
let Ft = 0, Oe = 0, Un = 0, Yn = 1;
const vr = 0.5;
let ia = 0, Kn = 0, jn = 0;
function Qn(e) {
  if (ia <= 0) return 1;
  const t = (e - Kn) * jn;
  return 1 + ia * t * t;
}
function Ot(e, t, a, o) {
  let n = 1;
  const i = Qn(e);
  for (let r = 0; r < de; r++) {
    const l = (e - a.lobeX[r]) * Bn[r], c = (t - (a.ch + a.lobeY[r])) * Nn[r] * i, s = l * l + c * c, d = Math.sqrt(s) / o, b = d < 1 ? 1 - d : 0;
    br[r] = b, fa[r] = a.lobeL[r] > 0.01 ? Math.exp(-s / (cn * cn)) * Math.min(1, a.lobeL[r]) : 0, n *= 1 - b * 0.92;
  }
  return 1 - n;
}
function Jn(e, t, a, o, n, i) {
  let r = e, l = 1;
  if (Oe !== 0) {
    const f = Math.abs(Oe) * vr, u = Ft + Oe * Un * 0.85, p = (e - u) * Oe;
    let w, h;
    p > 0 ? (w = Ft + Oe * p * 4, h = 1) : (w = Ft, h = Math.pow(Math.max(0, 1 + p / Yn), 1.35)), r = e + (w - e) * f, l = 1 + (h - 1) * f;
  }
  xr(r, t), l < 1 && (ue *= l, fe[0] *= l, fe[1] *= l, fe[2] *= l);
  const c = (r - a.beamX) / n, s = (t - (a.ch + a.cy)) / i * Qn(r), d = Math.sqrt(c * c + s * s);
  if (d >= 1) return 0;
  const b = d < 0.45 ? 1 - 0.5 * d / 0.45 : 0.5 * (1 - (d - 0.45) / 0.55);
  return Ot(r, t, a, o) * b * l;
}
function xr(e, t) {
  if (ue = 0, fe[0] = fe[1] = fe[2] = 0, Ne <= 4e-3 || Be < 2) return;
  const a = (e - ra) / Hn;
  if (a < 0 || a > Be - 1) return;
  const o = Math.min(Be - 2, Math.floor(a)), n = Ee[o] + (Ee[o + 1] - Ee[o]) * (a - o), i = a / (Be - 1), r = Math.min(1, Math.min(i, 1 - i) / Gn), l = Ne * r;
  if (l <= 4e-3) return;
  const c = 1 / (Wt * Wt), s = t - n, d = t - (n - It), b = t - (n + It), f = Math.exp(-s * s * c), u = Math.exp(-d * d * c) * 0.6, p = Math.exp(-b * b * c) * 0.6;
  fe[0] = f * l, fe[1] = u * l, fe[2] = p * l, ue = Math.min(1, Math.max(f, u, p) * l);
}
const ie = new Float32Array(3);
function Zn() {
  let e = 0, t = 0, a = 0, o = 0;
  for (let i = 0; i < de; i++) {
    const r = fa[i];
    e += r, t += Tt[i * 3] * r, a += Tt[i * 3 + 1] * r, o += Tt[i * 3 + 2] * r;
  }
  for (let i = 0; i < 3; i++) {
    const r = fe[i] * pr;
    r <= 0 || (e += r, t += Lt[i * 3] * r, a += Lt[i * 3 + 1] * r, o += Lt[i * 3 + 2] * r);
  }
  if (e <= 1e-6) return !1;
  t /= e, a /= e, o /= e;
  const n = 0.2126 * t + 0.7152 * a + 0.0722 * o;
  return ie[0] = Math.min(1, Math.max(0, n + (t - n) * aa)), ie[1] = Math.min(1, Math.max(0, n + (a - n) * aa)), ie[2] = Math.min(1, Math.max(0, n + (o - n) * aa)), !0;
}
function wr(e, t, a) {
  var M;
  pa.set(e.canvas, e);
  const { cw: o, ch: n } = a, i = Math.min(In, typeof window < "u" && window.devicePixelRatio || 1), r = Math.round(o * i), l = Math.round(n * i), { canvas: c, ctx: s } = e;
  (c.width !== r || c.height !== l) && (c.width = r, c.height = l), s.setTransform(i, 0, 0, i, 0, 0), s.clearRect(0, 0, o, n), mr(t, a.hue), gr(t, a);
  const d = t.layers, b = d.glowWidth * 1.15 * d.bloomScale, f = d.glowHeight * 1.5 * d.bloomScale * d.bloomHeight;
  for (let g = 0; g < de; g++) {
    const v = ne[g];
    Bn[g] = 1 / Math.max(1, Math.round(v.w * b) * a.w), Nn[g] = 1 / Math.max(1, Math.round(v.h * f) * a.h * Math.max(0.02, a.lobeL[g]));
  }
  const u = Math.max(40, Math.min(95, 70 * d.softness)) / 100, p = Math.max(1, 170 * t.rangeWidth * a.w * a.maskWidth), w = Math.max(1, 64 * t.rangeHeight * a.h + a.lift), h = Math.min(1, a.glow * 1.15);
  ia = Math.max(0, t.pixelDome) * 2.2, Kn = o / 2, jn = 2 / Math.max(1, o);
  let m = 0, $ = 0;
  for (let g = 0; g < de; g++)
    m += a.lobeL[g], $ += a.lobeX[g] * a.lobeL[g];
  const y = m > 1e-4 ? $ / m : o / 2, k = Math.max(0, a.dt);
  if (e.travelX === e.travelX && k > 0) {
    const g = (y - e.travelX) / k;
    e.travelV += (g - e.travelV) * (1 - Math.exp(-k / 0.08));
  }
  e.travelX = y;
  const C = a.gather ?? 0;
  if (Ft = y, Oe = C > 0.02 && !t.reducedMotion ? Math.max(-1, Math.min(1, e.travelV / (o * 0.33))) * C : 0, Oe !== 0) {
    let g = 0;
    for (let L = 0; L < de; L++) g += a.lobeY[L] * a.lobeL[L];
    const v = a.ch + (m > 1e-4 ? g / m : 0), S = Ot(y, v, a, u);
    let T = 8;
    if (S > 0.01)
      for (let L = 4; L < o / 2 && !(Ot(y + L, v, a, u) + Ot(y - L, v, a, u) < S); L += 4)
        T = L;
    Un = T, Yn = Math.max(24, T * 3.2);
  }
  let E = Math.max(0, a.ch + a.cy - w);
  if (Ne > 4e-3) for (let g = 0; g < Be; g++) E = Math.min(E, Ee[g] - 3 * Wt - It);
  E = Math.max(0, E);
  const z = ((M = t.lookPlugin) == null ? void 0 : M.kind) === "pixel" ? t.lookPlugin : null;
  z ? z.paint(Mr(e, s, t, a, u, p, w, h, E)) : $r(e, s, t, a, u, p, w, h, E);
  const { glowCanvas: W, glowCtx: P } = e;
  if (W && P) {
    const g = Math.max(1, Math.ceil(o / sn)), v = Math.max(1, Math.ceil(n / sn));
    if ((W.width !== g || W.height !== v) && (W.width = g, W.height = v), P.clearRect(0, 0, g, v), t.pixelGlow > 0) {
      if (P.imageSmoothingEnabled = !0, P.imageSmoothingQuality = "high", P.drawImage(c, 0, 0, g, v), z) {
        const S = Math.max(1, Math.min(4, Math.round(z.halo ?? 1)));
        if (S > 1) {
          P.globalCompositeOperation = "lighter";
          for (let T = 1; T < S; T++) P.drawImage(c, 0, 0, g, v);
          P.globalCompositeOperation = "source-over";
        }
      } else if (Ke.size) {
        P.save(), P.setTransform(g / o, 0, 0, v / n, 0, 0), P.globalCompositeOperation = "lighter";
        for (let S = 0; S < fr; S++)
          Ke.forEach((T, L) => {
            P.fillStyle = Vn(L), P.fill(T);
          });
        P.restore();
      }
    }
  }
}
const yr = 0.3;
function eo(e, t, a, o, n) {
  const i = t * a;
  if (e.dust.length !== i || e.dustCols !== t) {
    e.dust = new Float32Array(i), e.dustC = new Int32Array(i), e.dustCols = t, e.dustAny = !1;
    return;
  }
  if (!e.dustAny || o <= 0) return;
  const r = n > 0 ? Math.exp(-o / n) : 0, l = e.dust;
  let c = !1;
  for (let s = 0; s < i; s++)
    l[s] <= 0 || (l[s] *= r, l[s] < 0.02 ? l[s] = 0 : c = !0);
  e.dustAny = c;
}
function to(e, t, a, o, n) {
  if (o <= 0.05 || a < yr) return;
  const i = Math.min(1, a * o);
  i > e.dust[t] && (e.dust[t] = i, e.dustC[t] = n, e.dustAny = !0);
}
function sa(e, t, a, o, n, i, r, l) {
  const c = t.dust[a];
  if (!(c > 0)) return !1;
  const s = 0.22 + 0.78 * ua(o + 17, n + 31);
  if (c < s) return !1;
  const d = Math.min(1, (c - s) * 5) * 0.9, b = t.dustC[a];
  return e.fillStyle = `rgba(${b >> 16 & 255},${b >> 8 & 255},${b & 255},${d.toFixed(3)})`, e.fillRect(i - l / 2, r - l / 2, l, l), !0;
}
function ao(e, t, a, o, n, i, r, l) {
  const c = t.reducedMotion ? 0 : Math.max(0, Math.min(1, t.pixelMagnet)), s = `${o}x${n}@${i.toFixed(2)}`;
  e.magnetKey !== s && (e.magnetKey = s, e.mx = new Float32Array(o * n), e.my = new Float32Array(o * n), e.mvx = new Float32Array(o * n), e.mvy = new Float32Array(o * n));
  const d = Math.sqrt(Math.max(0.05, t.scale)), b = sr * d * (0.55 + 0.45 * c), f = a.pointer && c > 0 ? a.pointer.x : NaN, u = a.pointer && c > 0 ? a.pointer.y : NaN;
  if (ca.clear(), f === f) {
    const h = Math.max(1, Math.round(lr * c)), m = [];
    for (let $ = 0; $ < e.litN; $++) {
      const y = e.litM[$];
      if (y < 0 || y >= o * n) continue;
      const k = r + (y % o + 0.5) * i, C = l + (Math.floor(y / o) + 0.5) * i, E = Math.hypot(f - k, u - C);
      E > b || (m.length < h ? (m.push([E, y]), m.sort((z, W) => z[0] - W[0])) : E < m[h - 1][0] && (m[h - 1] = [E, y], m.sort((z, W) => z[0] - W[0])));
    }
    for (let $ = 0; $ < m.length; $++) {
      const [y, k] = m[$], C = y / b;
      ca.set(k, (1 - C * C) * (1 - 0.35 * $ / Math.max(1, m.length)));
    }
  }
  const p = Math.min(0.05, a.dt), w = p > 0 ? Math.max(1, Math.ceil(p / (1 / 120))) : 0;
  return { px: f, py: u, steps: w, h: w ? p / w : 0 };
}
function no(e, t, a, o, n, i, r) {
  const { mx: l, my: c, mvx: s, mvy: d } = e;
  let b = l[a], f = c[a];
  const u = ca.get(a) ?? 0, p = u > 0 ? (t.px - i) * ln * u : 0, w = u > 0 ? (t.py - r) * ln * u : 0;
  if (t.steps && (u > 1e-3 || b !== 0 || f !== 0 || s[a] !== 0 || d[a] !== 0)) {
    const h = 0.8 + 0.4 * ua(o, n), m = cr / h, $ = dr / h;
    let y = s[a], k = d[a];
    const C = t.h;
    for (let E = 0; E < t.steps; E++)
      y += ((p - b) * m - y * $) * C, k += ((w - f) * m - k * $) * C, b += y * C, f += k * C;
    u <= 1e-3 && Math.abs(b) + Math.abs(f) < 0.02 && Math.abs(y) + Math.abs(k) < 0.05 && (b = f = y = k = 0), l[a] = b, c[a] = f, s[a] = y, d[a] = k;
  }
  return [b, f];
}
function $r(e, t, a, o, n, i, r, l, c) {
  const { cw: s, ch: d } = o, b = rr * Math.sqrt(Math.max(0.05, a.scale)) * Math.max(0.3, a.pixelSize), f = Math.max(1, b - Math.max(0.6, b * 0.22)), u = Math.ceil(s / b), p = Math.ceil(d / b), w = d - p * b, h = (s - u * b) / 2, m = Se - 1, $ = /* @__PURE__ */ new Map(), y = /* @__PURE__ */ new Map();
  Ke.clear();
  const k = f * 0.42, C = ao(e, a, o, u, p, b, h, w);
  eo(e, u, p, o.dt, a.pixelDust);
  const E = a.pixelDust > 0 ? o.gather ?? 0 : 0, z = f * 0.8;
  e.litN = 0;
  const W = _n(e);
  for (let M = p - 1; M >= 0; M--) {
    const g = w + (M + 0.5) * b;
    if (g + b < c) break;
    for (let v = 0; v < u; v++) {
      const S = h + (v + 0.5) * b, T = M * u + v, [L, ae] = no(e, C, T, v, M, S, g), B = S + L, O = g + ae, X = 1 - (1 - Jn(S, g, o, n, i, r) * l) * (1 - ue);
      if (X <= 4e-3) {
        sa(t, e, T, v, M, S, g, z);
        continue;
      }
      const R = Math.min(1, Math.pow(X, 0.65) * 1.15), V = Dn[(M & 3) * 4 + (v & 3)], D = R >= V * 0.92 + 0.03;
      if (!D && (sa(t, e, T, v, M, S, g, z) || R < 0.06) || !Zn()) continue;
      const _ = Math.max(0, R - 0.7) / 0.3, U = (H) => Math.min(m, Math.floor((H + (1 - H) * _ * 0.6) * m + V)), x = (U(ie[0]) * Se + U(ie[1])) * Se + U(ie[2]);
      if (W && W.has(T)) {
        if (D) {
          const H = (ce) => Math.round(U(ce) / m * 255), le = f * (1 + dn * ue);
          oa(e, B, O, le, Math.max(R, ue), H(ie[0]) << 16 | H(ie[1]) << 8 | H(ie[2]), T);
        }
        continue;
      }
      const N = D ? $ : y;
      let F = N.get(x);
      F || (F = new Path2D(), N.set(x, F));
      const Y = D ? f * (1 + dn * ue) : k;
      if (F.rect(B - Y / 2, O - Y / 2, Y, Y), D && ue > ur) {
        let H = Ke.get(x);
        H || (H = new Path2D(), Ke.set(x, H)), H.rect(B - Y / 2, O - Y / 2, Y, Y);
      }
      if (D) {
        const H = (ce) => Math.round(U(ce) / m * 255), le = H(ie[0]) << 16 | H(ie[1]) << 8 | H(ie[2]);
        oa(e, B, O, Y, Math.max(R, ue), le, T), to(e, T, R, E, le);
      }
    }
  }
  const P = (M) => {
    const g = M % Se, v = Math.floor(M / Se) % Se, S = Math.floor(M / (Se * Se)), T = (L) => Math.round(L / m * 255);
    return `rgb(${T(S)},${T(v)},${T(g)})`;
  };
  Vn = P, t.globalAlpha = ir, y.forEach((M, g) => {
    t.fillStyle = P(g), t.fill(M);
  }), t.globalAlpha = 1, $.forEach((M, g) => {
    t.fillStyle = P(g), t.fill(M);
  });
}
let Ie = null, la = null, oo = 1, ro = 1, io = 1, so = 1, hn = 0, bn = { px: NaN, py: NaN, steps: 0, h: 0 }, De = null;
const pe = {
  ctx: null,
  config: null,
  cw: 0,
  ch: 0,
  top: 0,
  lobes: fa,
  rgb: ie,
  light(e, t) {
    return 1 - (1 - Jn(e, t, la, oo, ro, io) * so) * (1 - ue);
  },
  blend: Zn,
  hash: ua,
  bayer: (e, t) => Dn[(t & 3) * 4 + (e & 3)],
  grid(e, t, a, o, n) {
    const i = Ie, r = la;
    bn = ao(i, pe.config, r, e, t, a, o, n), eo(i, e, t, r.dt, pe.config.pixelDust), hn = pe.config.pixelDust > 0 ? r.gather ?? 0 : 0, i.litN = 0, De = _n(i);
  },
  pull: (e, t, a, o, n) => no(Ie, bn, e, t, a, o, n),
  away: (e) => De !== null && De.has(e),
  lit(e, t, a, o, n, i) {
    oa(Ie, e, t, a, o, n, i), De && De.has(i) || to(Ie, i, o, hn, n);
  },
  dust: (e, t, a, o, n, i) => sa(pe.ctx, Ie, e, t, a, o, n, i)
};
function Mr(e, t, a, o, n, i, r, l, c) {
  return Ie = e, la = o, oo = n, ro = i, io = r, so = l, pe.ctx = t, pe.config = a, pe.cw = o.cw, pe.ch = o.ch, pe.top = c, e.litN = 0, De = null, pe;
}
const ca = /* @__PURE__ */ new Map(), lo = 26, pa = /* @__PURE__ */ new WeakMap();
function Sr(e, t) {
  const a = /* @__PURE__ */ new Map(), o = pa.get(e);
  if (!o || !t.size) return a;
  for (let n = 0; n < o.litN; n++) t.has(o.litM[n]) && a.set(o.litM[n], n);
  return a;
}
const un = /* @__PURE__ */ new WeakMap();
function co(e, t) {
  const a = e.getContext("2d");
  if (!a || !t.length) return;
  let o = un.get(e);
  if (o || un.set(e, o = { flyers: [], running: !1 }), o.flyers.push(...t), o.running) return;
  o.running = !0;
  const n = o, i = (r) => {
    var w;
    const l = e.clientWidth, c = e.clientHeight, s = Math.min(In, typeof window < "u" && window.devicePixelRatio || 1), d = Math.round(l * s), b = Math.round(c * s);
    (e.width !== d || e.height !== b) && (e.width = d, e.height = b), a.setTransform(s, 0, 0, s, 0, 0), a.clearRect(0, 0, l, c);
    const f = ((w = n.flyers.find((h) => h.surface)) == null ? void 0 : w.surface) ?? null, u = f ? pa.get(f) : void 0, p = f ? Sr(f, new Set(n.flyers.filter((h) => h.arrive).map((h) => h.cell))) : /* @__PURE__ */ new Map();
    n.flyers = n.flyers.filter((h) => {
      const m = ((r - h.t0) / 1e3 - h.delay) / h.dur, $ = h.arrive ? p.get(h.cell) : void 0;
      if (h.arrive && u && $ !== void 0 && (h.x1 = u.litX[$], h.y1 = u.litY[$], h.s = Math.max(1.5, u.litS[$]), h.rgb = ga(u.litC[$])), m >= 1) {
        if (!h.arrive || r >= h.hold) return !1;
        if ($ === void 0) {
          h.gone || (h.gone = r);
          const v = 1 - (r - h.gone) / 150;
          if (v <= 0) return !1;
          a.fillStyle = `rgba(${h.rgb},${v.toFixed(3)})`;
        } else
          h.gone = 0, a.fillStyle = `rgb(${h.rgb})`;
        return a.fillRect(h.x1 - h.s / 2, h.y1 - h.s / 2, h.s, h.s), !0;
      }
      if (m <= 0)
        return h.arrive || (a.fillStyle = `rgb(${h.rgb})`, a.fillRect(h.x0 - h.s / 2, h.y0 - h.s / 2, h.s, h.s)), !0;
      const y = (v) => v * v * (2.2 - 1.2 * v), k = h.arrive ? 1 - y(1 - m) : y(m), C = (v) => {
        const S = 1 - v, T = S * S * h.x0 + 2 * S * v * h.cx + v * v * h.x1, L = S * S * h.y0 + 2 * S * v * h.cy + v * v * h.y1;
        if (!h.wa) return [T, L];
        const ae = 2 * S * (h.cx - h.x0) + 2 * v * (h.x1 - h.cx), B = 2 * S * (h.cy - h.y0) + 2 * v * (h.y1 - h.cy), O = Math.hypot(ae, B) || 1, X = h.wa * Math.sin(Math.PI * v) * Math.sin(2 * Math.PI * h.wf * v + h.wp);
        return [T - B / O * X, L + ae / O * X];
      }, [E, z] = C(k), [W, P] = C(Math.max(0, k - 0.07)), M = h.s * (h.arrive ? 0.35 + 0.65 * k : 1 - 0.65 * k), g = h.arrive ? Math.min(1, m / 0.15) : m > 0.85 ? (1 - m) / 0.15 : 1;
      return a.strokeStyle = `rgba(${h.rgb},${(0.35 * g).toFixed(3)})`, a.lineWidth = M * 0.7, a.beginPath(), a.moveTo(W, P), a.lineTo(E, z), a.stroke(), a.fillStyle = `rgba(${h.rgb},${g.toFixed(3)})`, a.fillRect(E - M / 2, z - M / 2, M, M), !0;
    }), n.flyers.length ? requestAnimationFrame(i) : (a.clearRect(0, 0, l, c), n.running = !1);
  };
  requestAnimationFrame(i);
}
function ho(e, t, a) {
  const o = e.litN, n = /* @__PURE__ */ new Set();
  let i = 0;
  for (let l = 0; l < o; l++) i += 0.15 + e.litV[l] * e.litV[l];
  const r = Math.min(t, o);
  for (let l = 0; n.size < r && l < r * 12; l++) {
    let c = a() * i, s = 0;
    for (; s < o - 1 && (c -= 0.15 + e.litV[s] * e.litV[s], !(c <= 0)); s++)
      ;
    n.add(s);
  }
  return [...n];
}
function bo() {
  let e = Math.random() * 4294967295 >>> 0 || 2654435769;
  return () => (e ^= e << 13, e ^= e >>> 17, e ^= e << 5, (e >>> 0) / 4294967296);
}
function Ar(e) {
  return { x: e.x, y: e.y + (e.h ?? 0) * 0.3 };
}
function uo(e, t, a, o) {
  const n = Ar(a), i = a.w ?? a.h ?? 0;
  n.x += (o() - 0.5) * i * 0.5, n.y += (o() - 0.5) * (a.h ?? 0) * 0.25;
  const r = a.y + (a.h ?? 0) / 2, l = n.x - e, c = n.y - t, s = Math.sqrt(l * l + c * c) || 1;
  return {
    dist: s,
    ex: n.x,
    ey: n.y,
    // The bend anywhere from close under the button to well out toward the
    // pixel, and pushed a little to either side: loose, varied arcs.
    cx: n.x - l * (0.02 + 0.4 * o()) + (o() - 0.5) * s * 0.22,
    cy: Math.max(r + 4, Math.min(t, r + (t - r) * (0.25 + 0.55 * o()))),
    // A few px of wander for most, none for some.
    wa: o() < 0.25 ? 0 : (o() - 0.5) * Math.min(18, 4 + s * 0.05) * 2,
    wf: 0.6 + o() * 1.4,
    wp: o() * Math.PI * 2
  };
}
const ga = (e) => `${e >> 16 & 255},${e >> 8 & 255},${e & 255}`;
function kr(e, t, a, o) {
  if (o || e.litN === 0) return;
  const n = bo(), i = performance.now(), r = ho(e, lo, n), l = r.map((s) => {
    const d = e.litX[s], b = e.litY[s], { dist: f, cx: u, cy: p, ex: w, ey: h, wa: m, wf: $, wp: y } = uo(d, b, a, n);
    return {
      x0: d,
      y0: b,
      cx: u,
      cy: p,
      x1: w,
      y1: h,
      wa: m,
      wf: $,
      wp: y,
      s: Math.max(1.5, e.litS[s]),
      rgb: ga(e.litC[s]),
      // The nearer leave first; each takes longer the further it has to go.
      delay: Math.min(0.22, f / 2400) + n() * 0.14,
      dur: 0.38 + Math.min(0.4, f / 900) + n() * 0.26,
      t0: i,
      arrive: !1,
      cell: -1,
      surface: null,
      hold: 0,
      gone: 0
    };
  });
  if (!l.length) return;
  const c = i + (Math.max(...l.map((s) => s.delay + s.dur)) + 0.05) * 1e3 + 600;
  for (const s of r) zn(e, e.litM[s], c);
  co(t, l);
}
function Tr(e, t, a, o, n) {
  if (o || e.litN === 0) return;
  const i = bo(), r = performance.now(), l = [];
  for (const c of ho(e, lo, i)) {
    const s = e.litX[c], d = e.litY[c], { dist: b, cx: f, cy: u, ex: p, ey: w, wa: h, wf: m, wp: $ } = uo(s, d, a, i), y = Math.min(0.08, b / 4e3) + i() * 0.1, k = 0.38 + Math.min(0.4, b / 900) + i() * 0.26;
    l.push({
      x0: p,
      y0: w,
      cx: f,
      cy: u,
      x1: s,
      y1: d,
      wa: h,
      wf: m,
      wp: $,
      s: Math.max(1.5, e.litS[c]),
      rgb: ga(e.litC[c]),
      delay: y,
      dur: k,
      t0: r,
      arrive: !0,
      cell: e.litM[c],
      surface: e.canvas,
      hold: Math.max(n, r + (y + k) * 1e3),
      gone: 0
    }), zn(e, e.litM[c], r + (y + k) * 1e3);
  }
  co(t, l);
}
const fo = { gather: 0, offset: 0, stretch: 0, heldLevel: 0, cornerFollow: 0 }, da = /* @__PURE__ */ new WeakMap();
function Lr(e) {
  let t = da.get(e);
  return t || (t = { level: 0, bands: [0, 0, 0], phase: 0, motion: { ...fo }, t: 0, lastTs: 0, warp: 1, drift: 0, fast: 0, fastBands: [0, 0, 0] }, da.set(e, t)), t;
}
const je = /* @__PURE__ */ new Set(), fn = new Float32Array(ne.length), pn = new Float32Array(ne.length), gn = new Float32Array(ne.length), mn = new Float32Array(ne.length), vn = new Float32Array(ne.length);
let He = null, ha = 0;
const Fr = 1e3 / 60 - 2, Or = 22, Er = 500, Rr = 4e3;
let Et = 0, na = !1, St = !1, _e = 0, xn = 0;
const po = Math.PI * 2, Cr = 5, Pr = 1.7, Wr = [
  [80, 300],
  [300, 2e3],
  [2e3, 6e3]
];
function ze(e) {
  return e < 0 ? 0 : e > 1 ? 1 : e;
}
function wn(e, t) {
  const a = t / 2;
  return ((e + a) % t + t) % t - a;
}
function yn(e, t) {
  const a = e / (t / 2 + 4);
  return Math.max(0, 1 - a * a);
}
function $n(e, t) {
  if (e <= t) return 0;
  const a = (e - t) / Math.max(1e-3, 1 - t);
  return ze((1 - Math.exp(-3 * a)) / (1 - Math.exp(-3)));
}
function Ue(e, t, a, o, n) {
  const i = t > e ? o : n, r = 1 - Math.exp(-a / Math.max(1e-3, i));
  return e + (t - e) * r;
}
const Ir = 2, Dr = 0.06, _r = 0.35, zr = 0.03, Mn = 0.03, Br = !(typeof navigator < "u" && /AppleWebKit/.test(navigator.userAgent) && !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(navigator.userAgent)), Sn = 0.05, Nr = 6, Hr = 12, Gr = 0.1, An = 0.1, Vr = 170, Xr = 64, kn = 56;
function qr(e, t, a, o) {
  const n = e < 0 ? 1 - o : 1 + o, i = Math.max(0.05, a * n), r = Math.exp(-Math.pow(Math.abs(e) / i, t)), l = Math.exp(-Math.pow(1 / i, t));
  return Math.max(0, (r - l) / (1 - l));
}
function Ur(e, t, a, o, n) {
  if (a <= 0 || t <= 0) return 0;
  const i = t * Math.max(0, Math.min(0.98, o));
  if (e <= i) return 0;
  const r = Math.min(1, (e - i) / Math.max(1, t - i));
  return a * Math.pow(r, Math.max(0.5, n));
}
function go(e, t, a) {
  return Math.max(0, Math.min(e, t / 2, a / 2));
}
function Rt(e, t, a, o = 0) {
  if (a <= 0) return 0;
  const n = Math.min(e, t - e) - o;
  if (n >= a) return 0;
  if (n <= 0) return a;
  const i = a - n;
  return a - Math.sqrt(Math.max(0, a * a - i * i));
}
function Tn(e, t, a, o) {
  const n = a / 2 + t.cx * t.w, i = Vr * e.rangeWidth * t.w * t.mw, r = o * 0.82 * Math.min(1, e.scale), l = Math.min(r, (Xr * e.rangeHeight * t.h + t.lift) * e.bandPosition), c = o - e.bandOffset, s = Math.min(1, t.corner * 4), d = e.bandTail * (1 - s * s * (3 - 2 * s)), b = d > 1e-3, f = b ? e.bandTailOverflow : 0, u = b ? -f : n - i, p = b ? a + f : n + i, w = [];
  for (let h = 0; h <= kn; h++) {
    const m = u + (p - u) * h / kn, $ = Math.max(-1, Math.min(1, (m - n) / Math.max(1, i))), y = (m < n ? n : a - n) + f, k = qr($, e.bandCurve, e.bandSpread, e.bandSkew) + Ur(Math.abs(m - n), y, d, e.bandTailPosition, e.bandTailCurve), C = t.corner > 0 ? Rt(m, a, go(e.radius, a, o)) * t.corner : 0;
    w.push([m, c - l * k - C]);
  }
  return w;
}
function Yr(e, t, a, o, n) {
  for (const [i, r] of [["", 1], ["-z", 0.5]]) {
    const l = (b) => (b * r).toFixed(1) + "px", c = a.map(([b, f]) => `${l(b)} ${l(f)}`), s = `polygon(0 ${l(n)}, ${c.join(", ")}, ${l(o)} ${l(n)})`, d = `polygon(0 0, ${l(o)} 0, ${l(o)} ${l(n)}, ${c.slice().reverse().join(", ")}, 0 ${l(n)})`;
    e.style.setProperty(`--vb-clip-below${i}-${t}`, s), e.style.setProperty(`--vb-clip-above${i}-${t}`, d);
  }
}
function Kr(e, t, a) {
  let o = a;
  for (let l = 0; l < t.length; l++) t[l][1] < o && (o = t[l][1]);
  const n = Math.max(0, Math.min(0.9, Math.floor((o - Nr) / a / Sn) * Sn));
  if (n === e.filterTop) return;
  e.filterTop = n;
  const i = 1 + Math.max(Gr, Hr / a), r = e.filter;
  r.setAttribute("x", `${-An * 100}%`), r.setAttribute("width", `${(1 + 2 * An) * 100}%`), r.setAttribute("y", `${(n * 100).toFixed(0)}%`), r.setAttribute("height", `${((i - n) * 100).toFixed(1)}%`);
}
function jr(e, t, a) {
  const { canvas: o, ctx: n, el: i, config: r } = e;
  if (!o || !n) return;
  const l = i.clientWidth, c = i.clientHeight;
  if (!l || !c) return;
  const s = Math.min(Ir, typeof window < "u" && window.devicePixelRatio || 1), d = Math.round(l * s), b = Math.round(c * s);
  (o.width !== d || o.height !== b) && (o.width = d, o.height = b), n.setTransform(s, 0, 0, s, 0, 0), n.clearRect(0, 0, l, c);
  const f = e.haloCanvas, u = e.haloCtx;
  f && u && ((f.width !== d || f.height !== b) && (f.width = d, f.height = b), u.setTransform(s, 0, 0, s, 0, 0), u.clearRect(0, 0, l, c));
  const p = Math.min(1, 0.6 * r.bandStrength * t.strength);
  if (p < 5e-3 || r.bandWidth <= 0) return;
  const w = r.theme === "dark", h = r.bandWidth * (1 + 0.35 * t.level), m = r.bandAberration * (0.35 + 0.65 * t.level), $ = (4 + 12 * m) * r.scale, y = 4 * m * r.scale, k = (O, X) => {
    n.beginPath(), n.moveTo(a[0][0] + O, a[0][1] + X);
    for (let R = 1; R < a.length; R++) n.lineTo(a[R][0] + O, a[R][1] + X);
  }, C = { r: r.bandColors.above, g: r.bandColors.mid, c: r.bandColors.core, b: r.bandColors.below }, E = (w ? 0.42 : 0.4) * p, z = 14 * h, W = 3.5 * r.bandWidth / 2, P = W * s, M = typeof n.filter == "string", g = M ? "0px" : `${W.toFixed(2)}px`;
  e.cssBlur !== g && (i.style.setProperty(`--vb-band-blur-${r.id}`, g), i.style.setProperty(`--vb-band-halo-blur-${r.id}`, M ? "0px" : `${(W * 3).toFixed(2)}px`), e.cssBlur = g);
  const v = [
    [1, 0.16],
    [0.72, 0.2],
    [0.46, 0.26],
    [0.22, 0.34]
  ], S = [
    { rgb: C.r, a: 1, ox: y, oy: -$ },
    { rgb: C.g, a: 0.55, ox: y * 0.35, oy: -$ * 0.35 },
    { rgb: C.b, a: 1, ox: -y, oy: $ },
    { rgb: C.c, a: 0.9, ox: 0, oy: 0 }
  ];
  n.lineCap = "round", n.lineJoin = "round", n.globalCompositeOperation = "source-over";
  const T = a[0][0], L = a[a.length - 1][0], ae = (O, X) => {
    const R = n.createLinearGradient(T, 0, L, 0), V = r.bandTail > 0 ? 0.015 : 0.18;
    return R.addColorStop(0, `rgba(${O}, 0)`), R.addColorStop(V, `rgba(${O}, ${X.toFixed(3)})`), R.addColorStop(1 - V, `rgba(${O}, ${X.toFixed(3)})`), R.addColorStop(1, `rgba(${O}, 0)`), R;
  }, B = !M && u ? u : n;
  M && (n.filter = `blur(${(P * 3).toFixed(1)}px)`), B.lineCap = "round", B.lineJoin = "round", B.strokeStyle = ae(C.c, E * 0.3), B.lineWidth = z * 2.2, B.beginPath(), B.moveTo(a[0][0], a[0][1]);
  for (let O = 1; O < a.length; O++) B.lineTo(a[O][0], a[O][1]);
  B.stroke(), M && (n.filter = `blur(${P.toFixed(1)}px)`);
  for (const O of S)
    for (const [X, R] of v)
      n.strokeStyle = ae(O.rgb, E * O.a * R), n.lineWidth = Math.max(0.6, z * X), k(O.ox, O.oy), n.stroke();
  M && (n.filter = "none"), n.globalCompositeOperation = "source-over";
}
function Qr(e) {
  return (1 - Math.cos(po * e)) / 2;
}
function Jr(e, t) {
  const a = e.analyser, o = e.time, n = e.freq;
  a.getFloatTimeDomainData(o);
  let i = 0;
  for (let l = 0; l < o.length; l++) i += o[l] * o[l];
  t.level = Math.sqrt(i / o.length) * Cr * e.config.sensitivity, a.getByteFrequencyData(n);
  const r = a.context.sampleRate / a.fftSize;
  for (let l = 0; l < 3; l++) {
    const [c, s] = Wr[l], d = Math.max(0, Math.floor(c / r)), b = Math.min(n.length - 1, Math.ceil(s / r));
    let f = 0;
    for (let p = d; p <= b; p++) f += n[p];
    const u = b >= d ? f / (b - d + 1) / 255 : 0;
    t.bands[l] = u * Pr * e.config.sensitivity;
  }
}
const Le = { level: 0, bands: [0, 0, 0] };
function mo(e) {
  He = requestAnimationFrame(mo);
  const t = Et ? e - Et : 0;
  if (Et = e, na) {
    if (St = !St, St) return;
    e >= xn && (na = !1, _e = 0);
  } else t > Or ? _e ? e - _e > Er && (na = !0, St = !1, xn = e + Rr) : _e = e : _e = 0;
  e - ha < Fr || (ha = e, je.forEach((a) => {
    var D, _, U;
    const { el: o, config: n, source: i, s: r } = a, l = n.paused;
    if (l && a.paintedConfig === n) return;
    const c = l ? 0 : r.lastTs ? Math.min(0.05, (e - r.lastTs) / 1e3) : 1 / 60;
    r.lastTs = e, r.t += c;
    const s = r.t;
    if (!l) if (a.analyser)
      Jr(a, Le);
    else {
      const x = i.getLevel ? ze(i.getLevel()) : 0;
      Le.level = x, Le.bands[0] = x, Le.bands[1] = x * (0.72 + 0.28 * Math.sin(s * 9.1)), Le.bands[2] = x * (0.6 + 0.4 * Math.sin(s * 13.7 + 2));
    }
    const d = $n(Le.level, n.threshold);
    r.level = Ue(r.level, d, c, n.attack, n.release);
    for (let x = 0; x < 3; x++) {
      const N = $n(Le.bands[x], n.threshold * 0.6);
      r.bands[x] = Ue(r.bands[x], N, c, n.attack, n.release * 1.15), a.surface && (r.fastBands[x] = Ue(r.fastBands[x], N, c, n.attack * 0.6, Mn));
    }
    a.surface && (r.fast = Ue(r.fast, d, c, n.attack * 0.6, Mn));
    const b = tr * n.lobeSpacing;
    if (!l) {
      const x = (D = i.getMotion) == null ? void 0 : D.call(i);
      r.motion = x ? {
        gather: ze(x.gather),
        offset: x.offset ?? 0,
        stretch: ze(x.stretch ?? 0),
        heldLevel: ze(x.heldLevel ?? 0),
        cornerFollow: ze(x.cornerFollow ?? 0)
      } : fo;
    }
    const f = r.motion, u = f.gather, p = o.clientWidth, w = o.clientHeight, h = n.reducedMotion ? 0 : f.offset * b / 2, m = 1 - u * 0.6, $ = 1 - u * 0.45, y = 1 + u * 0.3 * f.stretch, k = n.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(po * s / n.breatheDuration), C = r.level + (1 - r.level) * n.idle * k, E = Math.max(0, Math.min(1, (u - 0.25) / 0.75)), z = E * E * (3 - 2 * E), W = Math.max(C, f.heldLevel * z), P = 0.15 + 0.85 * W, M = 0.5 + n.reach * W, g = (0.85 + n.spread * W) * y;
    if (n.flow !== 0 && !n.reducedMotion && (r.phase = ((r.phase + n.flow * W * c) % b + b) % b, r.drift += n.flow * W * c), a.surface) {
      for (let N = 0; N < ne.length; N++) {
        const F = ne[N], Y = wn(F.x * n.lobeSpacing + r.phase, b);
        mn[N] = p / 2 + (h + Y * m) * g;
        const H = n.bands ? 0.6 + 0.7 * r.fastBands[F.band] : 1;
        vn[N] = (H + (1 - H) * u) * yn(Y, b);
      }
      const x = r.fast + (1 - r.fast) * n.idle * k;
      p && w && a.surface.look.draw(a.surface.state, n, {
        cw: p,
        ch: w,
        lobeX: mn,
        lobeL: vn,
        w: g,
        lift: Math.max(x, f.heldLevel * z),
        glow: P,
        t: s,
        dt: c,
        drift: r.drift,
        gather: u
      }), o.style.setProperty(`--vb-level-${n.id}`, r.level.toFixed(3)), o.style.setProperty(`--vb-glow-${n.id}`, P.toFixed(3)), (_ = a.onLevel) == null || _.call(a, r.level), a.paintedConfig = n;
      return;
    }
    o.style.setProperty(`--vb-level-${n.id}`, r.level.toFixed(3)), o.style.setProperty(`--vb-cx-${n.id}`, `${h.toFixed(1)}px`), o.style.setProperty(`--vb-mw-${n.id}`, $.toFixed(3));
    const v = n.bend * W;
    o.style.setProperty(`--vb-bh-${n.id}`, `${Math.max(0, v).toFixed(1)}px`);
    const S = n.bend > 0 ? Math.min(1, v / n.bend) : 0;
    o.style.setProperty(`--vb-bendA-${n.id}`, S.toFixed(3));
    const T = { cx: h, w: g, h: M, mw: $, lift: v, strength: S, level: r.level, corner: u }, L = p / 2 + h * g, ae = 30 * n.scale * g, B = go(n.radius, p, w), O = u * f.cornerFollow;
    o.style.setProperty(`--vb-cy-${n.id}`, `${(-Rt(L, p, B, ae * 1.4) * O).toFixed(1)}px`), r.warp = Ue(r.warp, u > 0.02 ? 0 : 1, c, _r, Dr);
    const X = r.warp, R = a.displace != null && X < zr;
    if (R !== a.warpOff && (a.warpOff = R, R ? o.setAttribute("data-voice-warp", "off") : o.removeAttribute("data-voice-warp")), p && w && (a.ctx || a.displace)) {
      const x = Tn(n, T, p, w);
      (a.displace && !R || n.coreLight > 0) && Yr(o, n.id, x, p, w), a.filter && !R && Br && Kr(a, x, w), a.ctx && jr(a, T, x);
    }
    if (a.displace && !R) {
      const x = n.reducedMotion ? 0 : n.distortion * 120 * n.scale * (0.15 + 0.85 * W) * X;
      a.displace.scale.baseVal = x, a.noiseShift && (a.noiseShift.dx.baseVal = 8 * n.scale * Math.sin(s * 0.9), a.noiseShift.dy.baseVal = 4 * n.scale * Math.sin(s * 0.6 + 1.3));
    }
    o.style.setProperty(`--vb-glow-${n.id}`, P.toFixed(3)), o.style.setProperty(`--vb-h-${n.id}`, M.toFixed(3)), o.style.setProperty(`--vb-w-${n.id}`, g.toFixed(3));
    for (let x = 0; x < ne.length; x++) {
      const N = ne[x], F = wn(N.x * n.lobeSpacing + r.phase, b), H = (n.bands ? 0.6 + 0.7 * r.bands[N.band] : 1) * yn(F, b);
      o.style.setProperty(`--vb-x${x}-${n.id}`, `${(F * m).toFixed(1)}px`), o.style.setProperty(`--vb-l${x}-${n.id}`, H.toFixed(3));
      const le = p / 2 + (h + F * m) * g, ce = -Rt(le, p, B, ae) * O;
      o.style.setProperty(`--vb-y${x}-${n.id}`, `${ce.toFixed(1)}px`), fn[x] = le, pn[x] = ce, gn[x] = H;
    }
    const V = n.staticColors || n.reducedMotion || n.hueRange === 0 ? 0 : -n.hueRange + 2 * n.hueRange * Qr(s / n.hueDuration);
    if (o.style.setProperty(`--vb-hue-${n.id}`, `${V.toFixed(2)}deg`), a.pixel && p && w) {
      if (e - a.hueBaseReadAt > 500) {
        a.hueBaseReadAt = e;
        const N = getComputedStyle(o).getPropertyValue("--voice-hue-base").trim(), F = N ? parseFloat(N) : NaN;
        a.hueBaseOverride = Number.isFinite(F) ? F : null;
      }
      wr(a.pixel, n, {
        cw: p,
        ch: w,
        lobeX: fn,
        lobeY: pn,
        lobeL: gn,
        w: g,
        h: M,
        maskWidth: $,
        lift: v,
        cy: -Rt(L, p, B, ae * 1.4) * O,
        glow: P,
        beamX: L,
        hue: (a.hueBaseOverride ?? n.hueBase) + V,
        // The band, drawn into the cells too, so its height, width, tail
        // and fringes shape these looks as they do the glow.
        band: n.bandStrength > 0 ? Tn(n, T, p, w) : null,
        bandAlpha: S,
        bandSplit: (4 + 12 * n.bandAberration * (0.35 + 0.65 * r.level)) * n.scale,
        level: r.level,
        dt: c,
        pointer: a.pointer,
        gather: u
      });
      const x = ba.get(a.el);
      if (x && a.pixel.litN > 0) {
        ba.delete(a.el);
        const N = a.el.querySelector(":scope > [data-voice-beam-flyers]");
        N && performance.now() - x.at < 1500 && Tr(a.pixel, N, x.origin, n.reducedMotion, x.at + ai);
      }
    }
    (U = a.onLevel) == null || U.call(a, r.level), a.paintedConfig = n;
  }));
}
function Zr() {
  He == null && (ha = 0, Et = 0, _e = 0, He = requestAnimationFrame(mo));
}
function ei() {
  je.size === 0 && He != null && (cancelAnimationFrame(He), He = null);
}
function ti(e) {
  const t = da.get(e);
  t && (t.level = 0, t.fast = 0, t.bands = [0, 0, 0], t.fastBands = [0, 0, 0]);
}
const ai = 950, ba = /* @__PURE__ */ new WeakMap();
function ni(e, t) {
  ba.set(e, { origin: t, at: performance.now() });
}
function oi(e, t) {
  for (const a of je) {
    if (a.el !== e || !a.pixel) continue;
    const o = e.querySelector(":scope > [data-voice-beam-flyers]");
    o && kr(a.pixel, o, t, a.config.reducedMotion);
    return;
  }
}
function ri(e, t, a, o) {
  var l, c;
  const n = {
    el: e,
    config: t,
    source: a,
    onLevel: o,
    analyser: null,
    releaseAnalyser: null,
    time: null,
    freq: null,
    canvas: null,
    ctx: null,
    haloCanvas: null,
    haloCtx: null,
    displace: null,
    noiseShift: null,
    filter: null,
    filterTop: -1,
    s: Lr(e),
    paintedConfig: null,
    cssBlur: null,
    // Match the mark a previous registration may have left on the element.
    warpOff: e.hasAttribute("data-voice-warp"),
    surface: null,
    pixel: null,
    pointer: null,
    hueBaseOverride: null,
    hueBaseReadAt: 0
  };
  if (t.look === "dither" || ((l = t.lookPlugin) == null ? void 0 : l.kind) === "pixel") {
    const s = e.querySelector(":scope > [data-voice-beam-surface]"), d = e.querySelector(":scope > [data-voice-beam-pixel-glow]");
    s && (n.pixel = hr(s, d)), e.style.setProperty(`--vb-pixel-glow-${t.id}`, t.pixelGlow.toFixed(3));
  } else if (((c = t.lookPlugin) == null ? void 0 : c.kind) === "surface") {
    const s = e.querySelector(":scope > [data-voice-beam-surface]"), d = s ? t.lookPlugin.create(s) : null;
    d && (n.surface = { look: t.lookPlugin, state: d });
  }
  t.distortion > 0 && (n.displace = e.querySelector(":scope > svg feDisplacementMap"), n.noiseShift = e.querySelector(":scope > svg feOffset"), n.filter = e.querySelector(":scope > svg filter"));
  const i = e.querySelector(":scope > [data-voice-beam-band]");
  if (i) {
    n.canvas = i, n.ctx = i.getContext("2d");
    const s = e.querySelector(":scope > [data-voice-beam-band-halo]");
    s && (n.haloCanvas = s, n.haloCtx = s.getContext("2d"));
  }
  if (n.s.lastTs = 0, a.stream) {
    const s = or(a.stream);
    s && (n.analyser = s.analyser, n.releaseAnalyser = s.release, n.time = new Float32Array(s.analyser.fftSize), n.freq = new Uint8Array(s.analyser.frequencyBinCount));
  }
  let r = null;
  if (n.pixel && t.pixelMagnet > 0) {
    const s = (b) => {
      const f = e.getBoundingClientRect();
      n.pointer = { x: b.clientX - f.left, y: b.clientY - f.top };
    }, d = () => {
      n.pointer = null;
    };
    e.addEventListener("pointermove", s, { passive: !0 }), e.addEventListener("pointerdown", s, { passive: !0 }), e.addEventListener("pointerleave", d, { passive: !0 }), e.addEventListener("pointercancel", d, { passive: !0 }), r = () => {
      e.removeEventListener("pointermove", s), e.removeEventListener("pointerdown", s), e.removeEventListener("pointerleave", d), e.removeEventListener("pointercancel", d);
    };
  }
  return je.add(n), Zr(), () => {
    var s;
    r == null || r(), je.delete(n), (s = n.releaseAnalyser) == null || s.call(n), ei();
  };
}
const ii = {
  scale: 1,
  glowSize: 1,
  strokeOpacity: 1,
  innerOpacity: 1,
  bloomOpacity: 1,
  idle: 0.18,
  reach: 1.2,
  spread: 1.05,
  flow: 48,
  bend: 60,
  bandStrength: 1.55,
  bandWidth: 2.15,
  bandPosition: 0.35,
  bandCurve: 1.75,
  bandSpread: 0.87,
  bandSkew: 0.12,
  bandOffset: -27,
  bandTail: 0.59,
  bandTailPosition: 0.67,
  bandTailCurve: 2.4,
  bandTailOverflow: 15,
  bandAberration: 0.89,
  distortion: 0.62,
  distortionDetail: 2.3,
  glowWidth: 0.65,
  glowHeight: 1.25,
  lobeSpacing: 0.85,
  rangeWidth: 0.75,
  rangeHeight: 1,
  softness: 1.07,
  coreSize: 1,
  coreLight: 0,
  coreLightWidth: 1,
  coreLightHeight: 1,
  strokeScale: 1,
  innerScale: 1,
  innerHeight: 1,
  bloomScale: 1,
  bloomHeight: 1,
  pixelSize: 1
}, si = {
  default: {},
  pill: {
    scale: 0.45,
    glowSize: 0.95,
    strokeOpacity: 1.2,
    innerOpacity: 0.85,
    reach: 1.35,
    spread: 1.1,
    flow: 0,
    bend: 23,
    bandStrength: 1.55,
    bandWidth: 1.85,
    bandCurve: 1.95,
    bandSpread: 0.38,
    bandOffset: -16,
    bandTail: 0,
    distortion: 0.45,
    distortionDetail: 3,
    glowWidth: 0.65,
    glowHeight: 0.95,
    lobeSpacing: 0.45,
    rangeWidth: 0.8,
    rangeHeight: 0.7,
    softness: 0.88,
    coreSize: 0.25,
    strokeScale: 1.25,
    innerScale: 0.95,
    bloomScale: 1.05,
    bloomHeight: 2.25
  },
  mobile: {
    scale: 1.25,
    spread: 0.45,
    reach: 3,
    flow: 60,
    bend: 70,
    bandWidth: 2.4,
    bandCurve: 1.55,
    bandSpread: 0.9,
    bandOffset: -50,
    bandTail: 0.62,
    bandTailPosition: 0.42,
    bandTailCurve: 2.7,
    bandTailOverflow: 22,
    bandStrength: 1.8,
    distortionDetail: 2,
    glowWidth: 1.15,
    glowHeight: 2.1,
    lobeSpacing: 1.35,
    rangeWidth: 1.25,
    rangeHeight: 1.2,
    softness: 1.1
  }
}, li = {
  // The chat input sits on a dark card, so it runs a touch brighter than
  // the theme's 1.1 (light keeps the theme's own, see below).
  default: { brightness: 1.15 },
  pill: { brightness: 1.35, saturation: 1.5 },
  // The phone screen is large and the glow sits far from the content, so
  // it carries full strength on either theme (light otherwise dims to 0.8)
  // and, on dark, a brighter and richer glow than the theme's 1.1 / 1.2.
  mobile: { strength: 1, brightness: 1.2, saturation: 1.5 }
}, ci = {
  default: {},
  pill: {},
  mobile: { strength: 1 }
};
function di(e = "default", t = "dark") {
  return (t === "light" ? ci[e] : void 0) ?? li[e];
}
const hi = {
  // The band on white, whatever the dark strengths: 1.7 for the chat
  // input and the phone, 2 for the pill.
  default: { bandStrength: 1.7 },
  pill: { bandStrength: 2 },
  mobile: { bandStrength: 1.7 }
}, Ln = {
  scale: 1.05,
  spread: 0.6,
  bandStrength: 3,
  bandPosition: 0.44,
  glowWidth: 1.2,
  rangeHeight: 0.85,
  softness: 1.09,
  innerHeight: 1.2,
  bloomHeight: 0.35
}, bi = {
  bend: 68,
  bandStrength: 1.3,
  bandWidth: 2.45,
  bandSkew: 0
}, ui = {
  // The ratio left the pill's dither too small to read; tuned in the Studio.
  // The phone's own dither, tuned in the Studio as a whole: only the phone
  // takes it (the other hosts keep their ratios on the shared tuning).
  default: { pixelSize: 0.85 },
  mobile: {
    scale: 1,
    spread: 0.9,
    flow: 56,
    bend: 19,
    bandStrength: 1.05,
    bandWidth: 3,
    bandPosition: 0.5,
    bandTailPosition: 0.21,
    glowWidth: 1.6,
    glowHeight: 3,
    lobeSpacing: 1.2,
    softness: 0.84,
    coreSize: 0.85,
    innerHeight: 1.6,
    bloomHeight: 0.3
  }
}, fi = { default: 0.38 };
function pi(e, t) {
  return (t === "dither" ? fi[e] : void 0) ?? 0.6;
}
const gi = { mobile: 1.5 };
function mi(e) {
  return gi[e] ?? 1.1;
}
const vi = { mobile: 0.6 };
function xi(e) {
  return vi[e] ?? 0;
}
function Fn(e, t, a, o) {
  var s;
  const n = o === "dither", i = n ? { ...Ln, ...bi } : Ln, r = n ? ui[t] : o.kind === "pixel" ? (s = o.types) == null ? void 0 : s[t] : void 0;
  if (t === "mobile" && a === "dark") return { ...e, ...i, ...r };
  const l = vo("mobile", "dark"), c = { ...e };
  for (const d of Object.keys(i)) {
    const b = i[d];
    c[d] = l[d] ? Math.round(e[d] * (b / l[d]) * 1e3) / 1e3 : b;
  }
  return { ...c, ...r };
}
function vo(e = "default", t = "dark", a = "glow") {
  const o = wi(e, t);
  return a === "dither" ? Fn(o, e, t, "dither") : typeof a == "object" && a.kind === "pixel" ? Fn(o, e, t, a) : o;
}
function wi(e, t) {
  const a = si[e], o = {};
  return t === "light" && (a.reach === void 0 && (o.reach = 1.8), a.spread === void 0 && (o.spread = 0.8), a.coreLight === void 0 && (o.coreLight = 1.8)), { ...ii, ...o, ...a, ...t === "light" ? hi[e] : void 0 };
}
const At = {
  dark: { core: "255, 255, 255", above: "255, 70, 80", mid: "90, 255, 150", below: "80, 140, 255" },
  light: { core: "197, 139, 255", above: "255, 122, 182", mid: "126, 196, 255", below: "45, 255, 171" }
}, yi = 1, $i = 16, Mi = 6e4, On = typeof navigator < "u" && /AppleWebKit/.test(navigator.userAgent) && !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(navigator.userAgent), Si = (() => {
  if (typeof document > "u") return !0;
  const e = document.createElement("canvas").getContext("2d");
  return !!e && typeof e.filter == "string";
})(), En = /* @__PURE__ */ new Set();
function Ai(e) {
  En.has(e) || typeof console > "u" || (En.add(e), console.warn(
    `voice-glow: look="${e}" is not built in; drawing the glow. Built in: "glow", "dither". ` + (e === "mosaic" || e === "dots" || e === "lines" ? "Mosaic, dots and lines are Libraries Pro looks since 0.5.0: pass the look object (look={mosaic})." : "Other looks plug in as objects (VoiceLook).")
  ));
}
function ki() {
  const [e, t] = ge(() => typeof window > "u" || window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  return xe(() => {
    if (typeof window > "u") return;
    const a = window.matchMedia("(prefers-color-scheme: dark)"), o = (n) => t(n.matches ? "dark" : "light");
    return a.addEventListener("change", o), () => a.removeEventListener("change", o);
  }, []), e;
}
function Ti() {
  const [e, t] = ge(() => typeof window > "u" || !window.matchMedia ? !1 : window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  return xe(() => {
    if (typeof window > "u" || !window.matchMedia) return;
    const a = window.matchMedia("(prefers-reduced-motion: reduce)"), o = (n) => t(n.matches);
    return a.addEventListener("change", o), () => a.removeEventListener("change", o);
  }, []), e;
}
function Li(e, t) {
  return e === "auto" ? t : e;
}
const Pi = Ko(
  function({
    children: t,
    type: a = "default",
    look: o = "glow",
    pixelSize: n,
    pixelGlow: i,
    pixelDust: r,
    pixelDome: l,
    pixelMagnet: c,
    pixelExitTarget: s,
    dotSize: d = 1,
    dotGap: b = 1,
    dotShape: f = "round",
    lineWidth: u = 1,
    lineGap: p = 1,
    linePattern: w = "rows",
    seeThrough: h = !1,
    texture: m = 0.6,
    gravity: $ = 1,
    surfaceHeight: y = 1,
    surfaceCurve: k = 1,
    surfaceTail: C = 0,
    surfaceTailPosition: E = 0.6,
    surfaceTailCurve: z = 2.4,
    surfaceFade: W = 0.2,
    scale: P,
    stream: M = null,
    level: g = 0,
    sensitivity: v = 3.1,
    threshold: S = 0.015,
    attack: T = 0.325,
    release: L = 0.86,
    idle: ae,
    breatheDuration: B = 5.2,
    reach: O,
    spread: X,
    bands: R = !0,
    flow: V,
    motion: D = null,
    colorVariant: _ = "colorful",
    colors: U,
    tint: x,
    tintAmount: N = 1,
    bandColors: F,
    theme: Y = "dark",
    staticColors: H = !1,
    hueRange: le,
    hueDuration: ce,
    active: Z = !0,
    paused: he = !1,
    borderRadius: be,
    brightness: Qe,
    saturation: Je,
    glowSize: _t,
    strokeOpacity: zt,
    innerOpacity: Bt,
    bloomOpacity: Re,
    bend: Ze,
    bandStrength: Nt,
    bandWidth: Ht,
    bandPosition: Gt,
    bandCurve: Vt,
    bandSpread: we,
    bandSkew: Ce,
    bandOffset: et,
    bandTail: I,
    bandTailPosition: K,
    bandTailCurve: oe,
    bandTailOverflow: me,
    bandAberration: Xt,
    distortion: qt,
    distortionDetail: Ut,
    glowWidth: Yt,
    glowHeight: xo,
    lobeSpacing: wo,
    rangeWidth: yo,
    rangeHeight: $o,
    softness: Mo,
    coreSize: So,
    coreLight: Ao,
    coreLightWidth: ko,
    coreLightHeight: To,
    strokeScale: Lo,
    innerScale: Fo,
    innerHeight: Oo,
    bloomScale: Eo,
    bloomHeight: Ro,
    strength: Co,
    className: Po,
    style: Wo,
    css: ma,
    onLevel: va,
    onActivate: tt,
    onDeactivate: at,
    onAnimationEnd: nt,
    ...Io
  }, Ge) {
    const Ae = jo().replace(/:/g, "-"), Do = ki(), se = Li(Y, Do), xa = U ? U.join("|") : "", _o = F ? [F.core, F.above, F.mid, F.below].join("|") : "", ee = typeof o == "object" && o !== null ? o : null, ke = ee ? ee.name : o === "dither" ? "dither" : "glow";
    !ee && o !== ke && Ai(String(o));
    const A = vo(a, se, ee ?? ke), Q = Math.max(0.05, P ?? A.scale), wa = _t ?? A.glowSize, ya = n ?? A.pixelSize, $a = c ?? ((ee == null ? void 0 : ee.kind) === "pixel" ? ee.magnet ?? 0.7 : 0.7), Ma = i ?? pi(a, ke), Sa = r ?? mi(a), Aa = l ?? xi(a), ot = zt ?? A.strokeOpacity, rt = Bt ?? A.innerOpacity, it = Re ?? A.bloomOpacity, ka = ae ?? A.idle, Ta = O ?? A.reach, La = X ?? A.spread, Fa = (V ?? A.flow) * Q, Oa = (Ze ?? A.bend) * Q, Ea = Nt ?? A.bandStrength, Ra = (Ht ?? A.bandWidth) * Q, Ca = Gt ?? A.bandPosition, Pa = Vt ?? A.bandCurve, Wa = we ?? A.bandSpread, Ia = Ce ?? A.bandSkew, Da = (et ?? A.bandOffset) * Q, _a = I ?? A.bandTail, za = K ?? A.bandTailPosition, Ba = oe ?? A.bandTailCurve, Na = (me ?? A.bandTailOverflow) * Q, Ha = Xt ?? A.bandAberration, zo = qt ?? A.distortion, Ga = (Ut ?? A.distortionDetail) / Q, st = (Yt ?? A.glowWidth) * Q, lt = (xo ?? A.glowHeight) * Q, Va = (wo ?? A.lobeSpacing) * Q, ct = (yo ?? A.rangeWidth) * Q, dt = ($o ?? A.rangeHeight) * Q, ht = Mo ?? A.softness, bt = (So ?? A.coreSize) * Q, Ve = Math.max(0, Math.min(3, Ao ?? A.coreLight)), Xa = ko ?? A.coreLightWidth, qa = To ?? A.coreLightHeight, ut = Lo ?? A.strokeScale, ft = Fo ?? A.innerScale, pt = Oo ?? A.innerHeight, gt = Eo ?? A.bloomScale, mt = Ro ?? A.bloomHeight, Kt = Ti(), Pe = Fe(null), [Te, Ua] = ge(Z), [ye, Ya] = ge(!1), [jt, Bo] = ge(!0), [No, Ho] = ge(null), [Go, Vo] = ge(0);
    xe(() => {
      if (!On) return;
      const G = Pe.current;
      if (!G) return;
      const J = () => Vo(G.clientWidth * G.clientHeight);
      if (J(), typeof ResizeObserver > "u") return;
      const q = new ResizeObserver(J);
      return q.observe(G), () => q.disconnect();
    }, []);
    const Ka = (ee == null ? void 0 : ee.kind) === "surface", Xe = ke === "dither" || (ee == null ? void 0 : ee.kind) === "pixel", $e = Ka || Xe, ja = Xe ? "pixel" : Ka ? "surface" : "glow", We = $e || On && Go > Mi ? 0 : zo;
    xe(() => {
      if (be != null) return;
      const G = Pe.current;
      if (!G) return;
      const J = () => {
        const Me = G.firstElementChild;
        if (!Me) return;
        const j = getComputedStyle(Me), ve = parseFloat(j.borderTopLeftRadius);
        !isNaN(ve) && ve > 0 && Ho(ve);
      };
      J();
      const q = new MutationObserver(J);
      return q.observe(G, { childList: !0, subtree: !1 }), () => q.disconnect();
    }, [be, t]), xe(() => {
      Z && !Te && !ye ? Ua(!0) : !Z && Te && !ye && Ya(!0);
    }, [Z, Te, ye]);
    const Qt = Fe(Z);
    Qo(() => {
      const G = Qt.current && !Z, J = !Qt.current && Z;
      Qt.current = Z;
      const q = Pe.current;
      if (J && q && ti(q), !(G || J) || !Xe || !q || !s) return;
      const Me = q.getBoundingClientRect(), j = s.getBoundingClientRect(), ve = { x: j.left + j.width / 2 - Me.left, y: j.top + j.height / 2 - Me.top, w: j.width, h: j.height };
      G ? oi(q, ve) : Kt || (ni(q, ve), q.setAttribute("data-arriving", ""), window.setTimeout(() => q.removeAttribute("data-arriving"), 1200));
    }, [Z]), xe(() => {
      const G = Pe.current;
      if (!G || typeof IntersectionObserver > "u") return;
      const J = new IntersectionObserver(
        (q) => {
          for (const Me of q) Bo(Me.isIntersecting);
        },
        { rootMargin: "256px" }
      );
      return J.observe(G), () => J.disconnect();
    }, []);
    const Xo = Ct(
      (G) => {
        const J = G.animationName;
        J.includes("fade-out") ? (Ua(!1), Ya(!1), at == null || at()) : J.includes("fade-in") && (tt == null || tt()), nt == null || nt(G);
      },
      [tt, at, nt]
    ), re = Zo[se], vt = be ?? No ?? $i, Jt = di(a, se), qo = Co ?? Jt.strength ?? re.strength ?? 1, Qa = le ?? re.hueRange ?? 24, Ja = ce ?? re.hueDuration ?? 12, xt = Qe ?? Jt.brightness ?? re.brightness, wt = Je ?? Jt.saturation ?? re.saturation, Za = on(
      () => Cn({
        id: Ae,
        borderRadius: vt,
        borderWidth: yi,
        strokeOpacity: re.strokeOpacity * ot,
        innerOpacity: re.innerOpacity * rt,
        bloomOpacity: re.bloomOpacity * it,
        innerShadow: re.innerShadow,
        colorVariant: _,
        colors: U,
        brightness: xt,
        saturation: wt,
        theme: se,
        hueBase: re.hueBase ?? 0,
        glowSize: wa * Q,
        glowWidth: st,
        glowHeight: lt,
        strokeScale: ut,
        innerScale: ft,
        innerHeight: pt,
        bloomScale: gt,
        bloomHeight: mt,
        coreSize: bt,
        coreLight: Ve,
        coreLightWidth: Xa,
        coreLightHeight: qa,
        rangeWidth: ct,
        rangeHeight: dt,
        softness: ht,
        distortion: We > 0,
        scale: Q,
        look: ja
      }),
      [
        Ae,
        vt,
        re,
        _,
        xa,
        xt,
        wt,
        se,
        A,
        wa,
        ot,
        rt,
        it,
        Q,
        st,
        lt,
        ut,
        ft,
        pt,
        gt,
        mt,
        bt,
        Ve,
        Xa,
        qa,
        ct,
        dt,
        ht,
        We > 0,
        ja
      ]
    ), en = on(
      () => ({
        id: Ae,
        sensitivity: Math.max(0, v),
        threshold: Math.max(0, Math.min(0.95, S)),
        attack: Math.max(0, T),
        release: Math.max(0, L),
        idle: Math.max(0, Math.min(1, ka)),
        breatheDuration: Math.max(0.2, B),
        reach: Math.max(0, Ta),
        spread: Math.max(0, La),
        bands: R,
        flow: Fa,
        lobeSpacing: Math.max(0.1, Va),
        bend: Math.max(0, Oa),
        bandStrength: Math.max(0, Ea),
        bandWidth: Math.max(0, Ra),
        bandPosition: Math.max(0, Ca),
        bandCurve: Math.max(0.3, Pa),
        bandSpread: Math.max(0.05, Wa),
        bandSkew: Math.max(-0.9, Math.min(0.9, Ia)),
        bandOffset: Da,
        bandTail: Math.max(0, Math.min(1.5, _a)),
        bandTailPosition: Math.max(0, Math.min(0.98, za)),
        bandTailCurve: Math.max(0.5, Ba),
        bandTailOverflow: Math.max(0, Na),
        bandAberration: Math.max(0, Math.min(1, Ha)),
        rangeWidth: ct,
        rangeHeight: dt,
        theme: se,
        tint: x && Ye(x) || null,
        tintAmount: Math.max(0, Math.min(1, N)),
        bandColors: {
          core: (F == null ? void 0 : F.core) && Mt(F.core) || At[se].core,
          above: (F == null ? void 0 : F.above) && Mt(F.above) || At[se].above,
          mid: (F == null ? void 0 : F.mid) && Mt(F.mid) || At[se].mid,
          below: (F == null ? void 0 : F.below) && Mt(F.below) || At[se].below
        },
        distortion: Math.max(0, Math.min(1, We)),
        coreLight: Ve,
        scale: Q,
        radius: vt,
        hueRange: Math.max(0, Qa),
        hueDuration: Math.max(0.5, Ja),
        staticColors: _ === "mono" ? !0 : H,
        reducedMotion: Kt,
        paused: he,
        look: ke,
        lookPlugin: ee,
        // The pixel looks paint the palette themselves: the variant's
        // colours with any custom ones in their slots, as the stylesheet has.
        palette: Rn[_][se].map((G, J) => {
          const q = U == null ? void 0 : U[J];
          return q && Ye(q) || Ye(G) || [255, 255, 255];
        }),
        saturation: wt,
        hueBase: re.hueBase ?? 0,
        pixelSize: Math.max(0.3, ya),
        pixelGlow: Math.max(0, Math.min(1, Ma)),
        pixelDust: Math.max(0, Sa),
        pixelDome: Math.max(0, Aa),
        pixelMagnet: Math.max(0, Math.min(1, $a)),
        dotSize: Math.max(0.1, d),
        dotGap: Math.max(0.3, b),
        dotShape: f === "square" ? "square" : "round",
        lineWidth: Math.max(0.05, u),
        lineGap: Math.max(0.3, p),
        linePattern: w === "columns" || w === "grid" ? w : "rows",
        seeThrough: h,
        texture: Math.max(0, Math.min(1, m)),
        gravity: Math.max(0.05, $),
        surfaceHeight: Math.max(0.1, y),
        surfaceCurve: Math.max(-3, Math.min(5, k)),
        surfaceTail: Math.max(-2, Math.min(3, C)),
        surfaceTailPosition: Math.max(0, Math.min(0.98, E)),
        surfaceTailCurve: Math.max(0.5, z),
        surfaceFade: Math.max(0, Math.min(1, W)),
        layers: {
          glowWidth: st,
          glowHeight: lt,
          innerScale: ft,
          innerHeight: pt,
          bloomScale: gt,
          bloomHeight: mt,
          strokeScale: ut,
          softness: ht,
          coreSize: bt,
          innerOpacity: rt,
          bloomOpacity: it,
          strokeOpacity: ot,
          brightness: xt
        }
      }),
      [
        Ae,
        v,
        S,
        T,
        L,
        ka,
        B,
        Ta,
        La,
        R,
        Fa,
        Va,
        Oa,
        Ea,
        Ra,
        Ca,
        Pa,
        Wa,
        Ia,
        Da,
        _a,
        za,
        Ba,
        Na,
        Ha,
        ct,
        dt,
        se,
        x,
        N,
        _o,
        We,
        Ve,
        Q,
        vt,
        Qa,
        Ja,
        H,
        _,
        Kt,
        he,
        ke,
        ee,
        ya,
        Ma,
        Sa,
        Aa,
        $a,
        xa,
        wt,
        re,
        d,
        b,
        f,
        u,
        p,
        w,
        h,
        m,
        $,
        y,
        k,
        C,
        E,
        z,
        W,
        st,
        lt,
        ft,
        pt,
        gt,
        mt,
        ut,
        ht,
        bt,
        rt,
        it,
        ot,
        xt
      ]
    ), tn = Fe(g);
    tn.current = g;
    const yt = Fe(va);
    yt.current = va;
    const an = Fe(D);
    an.current = D, xe(() => {
      if (!(Te || ye) || !jt) return;
      const G = Pe.current;
      return G ? ri(G, en, { stream: M, getLevel: () => {
        const j = tn.current;
        return typeof j == "function" ? j() : j;
      }, getMotion: () => {
        const j = an.current;
        return typeof j == "function" ? j() : j;
      } }, (j) => {
        var ve;
        return (ve = yt.current) == null ? void 0 : ve.call(yt, j);
      }) : void 0;
    }, [en, M, Te, ye, jt]);
    const Uo = Ct(
      (G) => {
        Pe.current = G, typeof Ge == "function" ? Ge(G) : Ge && (Ge.current = G);
      },
      [Ge]
    ), Yo = {
      ...Wo ?? {},
      "--voice-strength": Math.max(0, Math.min(1, qo))
    };
    return /* @__PURE__ */ $t(nn, { children: [
      /* @__PURE__ */ te("style", { children: ma ? `${Za}
${ma.split("{id}").join(Ae)}` : Za }),
      /* @__PURE__ */ $t(
        "div",
        {
          ...Io,
          ref: Uo,
          "data-voice-beam": Ae,
          "data-voice-type": a,
          "data-voice-look": ke,
          "data-voice-halfres": "",
          "data-active": Te && !ye ? "" : void 0,
          "data-fading": ye ? "" : void 0,
          "data-paused": Te && !ye && (!jt || he) ? "" : void 0,
          "data-listening": M ? "" : void 0,
          className: Po,
          style: Yo,
          onAnimationEnd: Xo,
          children: [
            t,
            Xe && /* @__PURE__ */ te("canvas", { "data-voice-beam-pixel-glow": !0, "aria-hidden": "true" }),
            $e && /* @__PURE__ */ te("canvas", { "data-voice-beam-surface": !0, "aria-hidden": "true" }),
            Xe && /* @__PURE__ */ te("canvas", { "data-voice-beam-flyers": !0, "aria-hidden": "true" }),
            !$e && /* @__PURE__ */ te("div", { "data-voice-beam-bloom": !0 }),
            !$e && We > 0 && /* @__PURE__ */ $t(nn, { children: [
              /* @__PURE__ */ te("div", { "data-voice-beam-warp": "inner" }),
              /* @__PURE__ */ te("div", { "data-voice-beam-warp": "bloom" })
            ] }),
            !$e && !Si && /* @__PURE__ */ te("canvas", { "data-voice-beam-band-halo": !0, "aria-hidden": "true" }),
            !$e && /* @__PURE__ */ te("canvas", { "data-voice-beam-band": !0, "aria-hidden": "true" }),
            !$e && Ve > 0 && /* @__PURE__ */ te("div", { "data-voice-beam-core": !0, children: /* @__PURE__ */ te("div", {}) }),
            !$e && We > 0 && /* The distortion filter: drifting fractal noise, its green
            channel pinned to 0.5 so only x displaces, driven per frame by
            the driver (scale and offset), which also narrows the region
            to the strip under the band line once it runs — the full box
            here is only the first frame. Zero-sized, so it takes no room. */
            /* @__PURE__ */ te("svg", { "aria-hidden": "true", width: "0", height: "0", style: { position: "absolute", pointerEvents: "none" }, children: /* @__PURE__ */ $t(
              "filter",
              {
                id: `vb-distort-${Ae}`,
                x: "-20%",
                y: "-20%",
                width: "140%",
                height: "140%",
                colorInterpolationFilters: "sRGB",
                children: [
                  /* @__PURE__ */ te(
                    "feTurbulence",
                    {
                      type: "fractalNoise",
                      baseFrequency: `${(0.012 * Ga).toFixed(4)} ${(0.05 * Ga).toFixed(4)}`,
                      numOctaves: 2,
                      seed: 7,
                      result: "noise"
                    }
                  ),
                  /* @__PURE__ */ te("feOffset", { in: "noise", dx: "0", dy: "0", result: "moved" }),
                  /* @__PURE__ */ te(
                    "feColorMatrix",
                    {
                      in: "moved",
                      type: "matrix",
                      values: "1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1",
                      result: "map"
                    }
                  ),
                  /* @__PURE__ */ te("feDisplacementMap", { in: "SourceGraphic", in2: "map", scale: 0, xChannelSelector: "R", yChannelSelector: "G" })
                ]
              }
            ) })
          ]
        }
      )
    ] });
  }
), Fi = {
  echoCancellation: !1,
  noiseSuppression: !1,
  autoGainControl: !1
};
function kt() {
  return typeof navigator < "u" && typeof navigator.mediaDevices < "u" && typeof navigator.mediaDevices.getUserMedia == "function";
}
function Wi(e = {}) {
  const { constraints: t, autoStart: a = !1 } = e, [o, n] = ge(null), [i, r] = ge(() => kt() ? "idle" : "unsupported"), [l, c] = ge(null), s = Fe(null), d = Fe(t);
  d.current = t;
  const b = Ct(() => {
    const u = s.current;
    s.current = null, u && u.getTracks().forEach((p) => p.stop()), n(null), r(kt() ? "idle" : "unsupported");
  }, []), f = Ct(async () => {
    if (!kt())
      return r("unsupported"), null;
    if (s.current) return s.current;
    Wn(), r("requesting"), c(null);
    try {
      const u = await navigator.mediaDevices.getUserMedia({
        audio: { ...Fi, ...d.current ?? {} }
      });
      s.current = u, n(u), r("live");
      const p = () => {
        s.current === u && (s.current = null, n(null), r("idle"));
      };
      return u.getAudioTracks().forEach((w) => w.addEventListener("ended", p)), u;
    } catch (u) {
      const p = u instanceof Error ? u : new Error(String(u));
      return c(p), r(p.name === "NotAllowedError" || p.name === "SecurityError" ? "denied" : "error"), null;
    }
  }, []);
  return xe(() => {
    a && f();
  }, [a]), xe(
    () => () => {
      const u = s.current;
      s.current = null, u && u.getTracks().forEach((p) => p.stop());
    },
    []
  ), { stream: o, state: i, error: l, supported: kt(), start: f, stop: b };
}
export {
  er as LOBE_SPACING,
  tr as LOBE_SPAN,
  Pi as VoiceBeam,
  Pi as default,
  Wn as getAudioContext,
  Ci as isAudioSupported,
  Ye as parseRgb,
  xi as pixelDomeDefault,
  mi as pixelDustDefault,
  pi as pixelGlowDefault,
  vo as resolveVoiceDefaults,
  di as resolveVoiceStyle,
  Zo as themePresets,
  Wi as useMicrophone,
  ii as voiceDefaults,
  ne as voiceLobes,
  Rn as voicePalettes,
  si as voiceTypePresets,
  li as voiceTypeStyle
};
