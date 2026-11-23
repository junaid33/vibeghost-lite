import { CSSProperties } from 'react';
import { ForwardRefExoticComponent } from 'react';
import { HTMLAttributes } from 'react';
import { ReactNode } from 'react';
import { RefAttributes } from 'react';

/**
 * The page's shared AudioContext, created on first use. Call it from a
 * user gesture (the microphone button) where you can: Safari only lets a
 * context start inside one. It is resumed on every call, so a context the
 * browser suspended in the background picks up again.
 */
export declare function getAudioContext(): AudioContext | null;

/**
 * Web Audio plumbing shared by every VoiceBeam instance.
 *
 * One AudioContext for the page, one MediaStreamAudioSourceNode per stream
 * (reference-counted, so several beams can listen to the same microphone),
 * and one AnalyserNode per instance. Nothing is connected to the
 * destination, so the audio is analysed but never played back.
 */
/** True when this browser can analyse audio at all. */
export declare function isAudioSupported(): boolean;

/** Resting distance between neighbouring lobes, px. */
export declare const LOBE_SPACING = 36;

/** Width of the ring the lobes travel around, px — one full turn of the flow. */
export declare const LOBE_SPAN: number;

export declare type MicrophoneState = 'idle' | 'requesting' | 'live' | 'denied' | 'unsupported' | 'error';

/**
 * Colour parsing for the palette and band props: `#rgb`, `#rrggbb`,
 * `rgb(r, g, b)` and `rgba(r, g, b, a)` all resolve to an [r, g, b]
 * triple. Anything else returns null and the caller keeps its default.
 */
export declare function parseRgb(color: string): [number, number, number] | null;

export declare function pixelDomeDefault(type: VoiceBeamType): number;

export declare function pixelDustDefault(type: VoiceBeamType): number;

export declare function pixelGlowDefault(type: VoiceBeamType, look?: string): number;

/** The geometry defaults for a host, theme and look: the type's preset, and
 *  for the pixel looks (the dither, or a `VoiceLook` of kind 'pixel') their
 *  tuning on top. A surface look, the glow and unknown names keep the type's. */
export declare function resolveVoiceDefaults(type?: VoiceBeamType, theme?: 'dark' | 'light', look?: VoiceBeamLook | VoiceLook | string): VoiceGeometry;

/** The colour tuning for a type on a theme. */
export declare function resolveVoiceStyle(type?: VoiceBeamType, theme?: 'dark' | 'light'): VoiceTypeStyle;

/**
 * Per-theme presets. Tuned against border-beam's `line` type on the same
 * dark/light stages, so the two read as one family when used side by side.
 */
export declare const themePresets: Record<'dark' | 'light', VoiceThemeColors>;

/**
 * Microphone access for VoiceBeam.
 *
 * ```tsx
 * const mic = useMicrophone();
 * <button onClick={mic.start}>Listen</button>
 * <VoiceBeam stream={mic.stream}>…</VoiceBeam>
 * ```
 *
 * The stream is stopped on unmount, and when the browser ends the track
 * (device unplugged, permission revoked) the state falls back to 'idle'.
 */
export declare function useMicrophone(options?: UseMicrophoneOptions): UseMicrophoneResult;

export declare interface UseMicrophoneOptions {
    /**
     * Extra `getUserMedia` audio constraints. The defaults turn the browser's
     * voice processing off (echo cancellation, noise suppression, auto gain)
     * so the beam sees the real dynamics of the voice rather than a levelled
     * signal; pass `{}` to keep the browser defaults.
     */
    constraints?: MediaTrackConstraints;
    /** Ask for the microphone on mount rather than waiting for `start()`. */
    autoStart?: boolean;
}

export declare interface UseMicrophoneResult {
    /** The live stream to hand to `<VoiceBeam stream={…}>`, or null. */
    stream: MediaStream | null;
    state: MicrophoneState;
    /** The error behind a 'denied' / 'error' state, if any. */
    error: Error | null;
    /** True when this browser can capture audio at all. */
    supported: boolean;
    /** Request the microphone. Call it from a click so Safari lets audio start. */
    start: () => Promise<MediaStream | null>;
    /** Stop every track and drop the stream. */
    stop: () => void;
}

/**
 * VoiceBeam component — sound-reactive glow for React
 *
 * A centred, colourful beam along the bottom edge of the wrapped element
 * that rises and blooms with the level of a voice. Feed it a microphone
 * stream, or drive it yourself with `level`.
 *
 * @example
 * ```tsx
 * const mic = useMicrophone();
 *
 * <VoiceBeam stream={mic.stream}>
 *   <ChatInput />
 * </VoiceBeam>
 * ```
 */
declare const VoiceBeam: ForwardRefExoticComponent<VoiceBeamProps & RefAttributes<HTMLDivElement>>;
export { VoiceBeam }
export default VoiceBeam;

/**
 * Color variant for the beam — the same eight palettes as border-beam
 * - 'colorful': Full spectrum, Siri-like (default)
 * - 'mono': Monochromatic grayscale
 * - 'ocean': Blue and purple tones
 * - 'sunset': Warm orange, yellow, and red tones
 * - 'forest': Green and teal tones
 * - 'candy': Pink and magenta tones
 * - 'ice': Cyan and pale blue tones
 * - 'gold': Amber and yellow tones
 */
export declare type VoiceBeamColorVariant = 'colorful' | 'mono' | 'ocean' | 'sunset' | 'forest' | 'candy' | 'ice' | 'gold';

/** A dot's shape, for the dots look (Libraries Pro). */
export declare type VoiceBeamDotShape = 'round' | 'square';

/**
 * A level source: a plain number, or a getter the driver samples every
 * frame. Pass a getter for anything that changes many times a second so
 * the component does not re-render per frame.
 */
export declare type VoiceBeamLevel = number | (() => number);

/**
 * Which way the lines run, for the lines look (Libraries Pro)
 * - 'rows': across the surface, one line per row — a ridgeline landscape (default)
 * - 'columns': into the depth, converging with the perspective
 * - 'grid': both, a wireframe sheet
 */
export declare type VoiceBeamLinePattern = 'rows' | 'columns' | 'grid';

/**
 * How the voice is drawn — the built-in looks
 * - 'glow': coloured light — soft gradients, a band of light along the
 *   glow's ceiling and a blurred bloom (default)
 * - 'dither': the glow as small square pixels, on or off by an ordered
 *   dither of its brightness, its blended colours cut to a few levels. It
 *   keeps every glow prop — palette, colours, hue drift, shape, flow — and
 *   adds the pixel props (`pixelSize`, `pixelGlow`, …).
 *
 * Other looks plug in as objects (`VoiceLook`, see look.ts). Libraries Pro
 * adds three this way: mosaic (a pixel look, like the dither), and dots and
 * lines (a surface the voice raises and gravity brings down, which use the
 * surface props below).
 */
export declare type VoiceBeamLook = 'glow' | 'dither';

/**
 * The glow's motion for one frame.
 * - `gather`: 0 the voice glow at rest … 1 the lobes gathered into one beam
 * - `offset`: where the beam sits, in half-widths of the lobe ring (0 = centre)
 * - `stretch`: extra width while it moves, 0–1
 * - `heldLevel`: the level the glow is held at while gathered, 0–1
 * - `cornerFollow`: how much the beam rides the element's corner arcs, 0–1
 */
export declare interface VoiceBeamMotion {
    gather: number;
    offset?: number;
    stretch?: number;
    heldLevel?: number;
    cornerFollow?: number;
}

/**
 * Props for the VoiceBeam component
 */
export declare interface VoiceBeamProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
    /** Content to wrap with the voice beam effect */
    children: ReactNode;
    /**
     * Host preset: 'default' (chat input), 'pill' (recording pill) or
     * 'mobile' (bottom of a phone screen). Sets the defaults of the
     * geometry props below for that host; any prop you pass still wins.
     * @default 'default'
     */
    type?: VoiceBeamType;
    /**
     * How the voice is drawn: coloured light, the glow as dithered pixels, or
     * a look that plugs in as an object (Libraries Pro's mosaic, dots and
     * lines). Pass a look object once, from module level: a new object each
     * render rebuilds the effect.
     * @default 'glow'
     */
    look?: VoiceBeamLook | VoiceLook;
    /**
     * Cell size of the pixel looks (the dither, mosaic), as a multiplier.
     * @default 1 (0.85 for the dither on the `default` type)
     */
    pixelSize?: number;
    /**
     * The pixel looks' glow, 0–1: a soft halo of their own
     * colours around the lit cells. 0 is crisp pixels on the bare surface.
     * The pixel looks only.
     * @default 0.6 (0.38 for the dither on the chat input)
     */
    pixelGlow?: number;
    /**
     * How long the pixel looks' dust lingers while processing,
     * seconds: the travelling beam leaves a trail of specks behind it that
     * thins out pixel by pixel, densest just behind the beam. Longer is a
     * longer tail; 0 turns it off. The pixel looks only.
     * @default 1.1 (1.5 on the phone screen, `type="mobile"`)
     */
    pixelDust?: number;
    /**
     * The pixel looks' dome, 0–1: how much lower the field stands
     * toward the host's sides than in its middle, so the pixels always rise
     * highest at the centre. 0 is level. The pixel looks
     * only.
     * @default 0 (0.6 on the phone screen, `type="mobile"`)
     */
    pixelDome?: number;
    /**
     * The pixel looks' magnet, 0–1: the few lit pixels (or cells)
     * nearest the pointer (up to sixteen at 1) leave their places and fly
     * toward it, each on its own spring, and spring home with a little
     * overshoot as it moves on; the rest of the field stays put. 0 turns it
     * off. Off under `prefers-reduced-motion`.
     * The pixel looks only.
     * @default 0.7 (the look's own, for a plugged-in pixel look: 0.4 for mosaic)
     */
    pixelMagnet?: number;
    /**
     * The button the pixel looks' pixels fly into and out of:
     * set an element (the close / start button, say) and, as `active` turns
     * false, a few of the wave's own pixels leave it and fly into the button
     * while the rest fades; as `active` turns true again, a few start out in
     * the button and fly to their places as the wave fades in. Unset, the
     * picture simply fades. The pixel looks only; off
     * under `prefers-reduced-motion`.
     */
    pixelExitTarget?: HTMLElement | null;
    /**
     * Dot radius, as a multiplier on the tuned size. The dots look only.
     * @default 1
     */
    dotSize?: number;
    /**
     * Spacing between dots, as a multiplier — below 1 is a denser, finer
     * surface, above 1 a sparser, coarser one. The dots look only.
     * @default 1
     */
    dotGap?: number;
    /**
     * The dots' shape: round, or square for a pixel grid. The dots look only.
     * @default 'round'
     */
    dotShape?: VoiceBeamDotShape;
    /**
     * Line width, as a multiplier on the tuned width (lines thin out into the
     * distance). The lines look only.
     * @default 1
     */
    lineWidth?: number;
    /**
     * Spacing between lines, as a multiplier — the rows and the columns alike.
     * The lines look only.
     * @default 1
     */
    lineGap?: number;
    /**
     * Which way the lines run: across the surface, into the depth, or both.
     * The lines look only.
     * @default 'rows'
     */
    linePattern?: VoiceBeamLinePattern;
    /**
     * Draw the lines as a wireframe: those behind a raised ridge show through
     * it instead of being hidden by it. The lines look only.
     * @default false
     */
    seeThrough?: boolean;
    /**
     * Organic texture, 0–1: a slow ripple the flow carries across the
     * surface. 0 is a still sheet that only the voice moves. The surface looks (dots, lines).
     * @default 0.6
     */
    texture?: number;
    /**
     * How hard the surface falls when the voice drops, as a multiplier on its
     * gravity. Lower floats down, higher drops like sand. The surface looks (dots, lines).
     * @default 1
     */
    gravity?: number;
    /**
     * How tall the surface stands along the bottom, as a multiplier — how far
     * back the sheet runs, and so how much of the host it covers. The surface looks (dots, lines).
     * @default 1
     */
    surfaceHeight?: number;
    /**
     * How far the surface arcs, as a multiplier: its sides and far edge fall
     * away like a horizon. 0 is a flat sheet; below 0 it cups upward instead.
     * The surface looks (dots, lines).
     * @default 1
     */
    surfaceCurve?: number;
    /**
     * The surface's tails: how far its ends rise toward the corners, as a share
     * of the sheet's height — the ends curl up into the host's corners instead
     * of running flat into its sides. Below 0 they drop away instead. The surface looks (dots, lines).
     * @default 0
     */
    surfaceTail?: number;
    /**
     * Where the tails start, as a share of the distance from the centre to
     * the side (0.8 = only the last 20%); they reach their full lift at the edge.
     * @default 0.6
     */
    surfaceTailPosition?: number;
    /**
     * Exponent of the tails' rise: 1 a straight ramp, 2 a parabola, higher a
     * hook that stays low and whips up at the edge.
     * @default 2.4
     */
    surfaceTailCurve?: number;
    /**
     * How far in from the sides the surface dissolves, as a share of its
     * half-width, 0–1. 0 runs it hard into the edges; 1 fades it from the
     * centre out. The surface looks (dots, lines).
     * @default 0.2
     */
    surfaceFade?: number;
    /**
     * Size of the whole effect. Multiplies every pixel dimension at once —
     * lobes, their spacing, the visible range, the bend, the band, the core,
     * the bloom blur, the flow speed — so the glow grows or shrinks as one
     * thing, on top of the type preset and the individual geometry props.
     * @default 1 (0.45 for `type="pill"`)
     */
    scale?: number;
    /**
     * Audio to react to. When set, the beam analyses this stream (level plus
     * low / mid / high bands) and ignores `level`. Get one from the
     * `useMicrophone` hook or any `getUserMedia` / WebRTC source.
     */
    stream?: MediaStream | null;
    /**
     * Manual drive, 0–1, used when no `stream` is given. A number re-renders
     * on change; a getter is sampled once per frame without re-rendering.
     * @default 0
     */
    level?: VoiceBeamLevel;
    /**
     * Input gain on the analysed audio. The default suits a laptop microphone
     * at conversational distance; raise it for quiet sources, lower it for a
     * close or hot one.
     * @default 3.1
     */
    sensitivity?: number;
    /**
     * Noise gate, 0–1. Levels below it read as silence, so room hum and
     * fan noise do not keep the beam twitching.
     * @default 0.015
     */
    threshold?: number;
    /**
     * Seconds the glow takes to rise toward a louder level.
     * @default 0.325
     */
    attack?: number;
    /**
     * Seconds the glow takes to settle after the sound drops.
     * @default 0.86
     */
    release?: number;
    /**
     * Resting presence, 0–1 — how much the beam breathes while silent so it
     * never looks dead. 0 hides it completely between sounds.
     * @default 0.23
     */
    idle?: number;
    /**
     * Period of the idle breathing in seconds.
     * @default 5.2
     */
    breatheDuration?: number;
    /**
     * How tall the glow grows at full level, as a multiple of its resting
     * height. The rise is centered on the bottom edge.
     * @default 1.2 (1.8 on the light theme; 1.35 for `pill`, 3 for `mobile`)
     */
    reach?: number;
    /**
     * How far the glow widens at full level, as a fraction of its resting
     * width. Side lobes drift outward as well, so a loud sound spreads.
     * @default 1.05 (0.8 on the light theme; 1.1 for `pill`, 0.45 for `mobile`)
     */
    spread?: number;
    /**
     * Let the low / mid / high bands move the colored lobes independently
     * (center follows the lows, the sides the mids and highs). With a
     * manual `level` the bands are synthesised from the level, so the lobes
     * still dance. Off, every lobe follows the one level.
     * @default true
     */
    bands?: boolean;
    /**
     * How fast the spectrum travels sideways, in px per second at full
     * level — the lobes slide left to right while a voice is heard and rest
     * when it stops, so every colour takes a turn at the centre. Negative
     * flows right to left; 0 holds the lobes in place.
     * @default 48
     */
    flow?: number;
    /**
     * The glow's large-scale motion, sampled every frame: how far the lobes
     * are gathered into one compact beam, where it sits, the level it is held
     * at. At rest (the default) the glow is the voice glow. Pass a getter for
     * anything that moves; the Pro processing state is one.
     */
    motion?: VoiceBeamMotion | (() => VoiceBeamMotion | null | undefined) | null;
    /**
     * Color variant for the beam
     * @default 'colorful'
     */
    colorVariant?: VoiceBeamColorVariant;
    /**
     * Your own lobe colours, centre first then the pairs outward — up to
     * seven, any CSS hex or rgb. Slots you leave out (or that fail to
     * parse) keep the variant's colour for the theme.
     */
    colors?: string[];
    /**
     * Dots and lines: the ink, grey or white on its own, tinted toward this
     * colour (any CSS hex or rgb), e.g. a mood. The glow and the pixel looks
     * take `colors` instead.
     */
    tint?: string;
    /** How far the ink takes `tint`, 0–1. Default 1. */
    tintAmount?: number;
    /**
     * The band's colours: the core ridge and its chromatic fringes above,
     * between and below. Any CSS hex or rgb; unset ones keep the theme's
     * defaults (white core with red / green / blue fringes on dark, a pink
     * core with rose / lavender / sky on light).
     */
    bandColors?: {
        core?: string;
        above?: string;
        mid?: string;
        below?: string;
    };
    /**
     * Theme mode — adapts beam colors for dark or light backgrounds;
     * 'auto' follows prefers-color-scheme
     * @default 'dark'
     */
    theme?: VoiceBeamTheme;
    /**
     * Disable the slow hue drift for static colors
     * @default false
     */
    staticColors?: boolean;
    /**
     * Hue drift range in degrees (the palette wanders ± this far)
     * @default 24 (dark) / 40 (light)
     */
    hueRange?: number;
    /**
     * Period of the hue drift in seconds
     * @default 12 (dark) / 8.5 (light)
     */
    hueDuration?: number;
    /**
     * Whether the effect is on. Off fades the beam out and stops the audio
     * analysis.
     * @default true
     */
    active?: boolean;
    /**
     * Freezes the effect where it is — the glow, the band and the audio
     * analysis all hold their last frame — without fading it out. Other
     * props still shape the held frame, and the clocks resume where they
     * stopped.
     * @default false
     */
    paused?: boolean;
    /**
     * Custom border radius in pixels. When omitted, the component
     * auto-detects the border-radius of the first child element.
     */
    borderRadius?: number;
    /**
     * Brightness multiplier for the glow
     * @default 1.15 (dark chat input) / 0.95 (light); the dark theme itself is 1.1, `pill` runs 1.35, `mobile` 1.2 on dark
     */
    brightness?: number;
    /**
     * Saturation multiplier for the glow
     * @default 1.2 (dark) / 1.6 (light); `pill` and `mobile` run 1.5 on dark
     */
    saturation?: number;
    /**
     * Multiplies the bloom blur radius, so the halo reads tighter (< 1) or
     * wider and softer (> 1).
     * @default 1
     */
    glowSize?: number;
    /**
     * Per-layer opacity multipliers on the theme's own: the crisp edge
     * stroke, the soft inner light and the blurred bloom. The same knobs
     * as the `--voice-stroke-opacity` / `--voice-inner-opacity` /
     * `--voice-bloom-opacity` CSS hooks.
     * @default 1
     */
    strokeOpacity?: number;
    innerOpacity?: number;
    bloomOpacity?: number;
    /**
     * Bend — how much, in px, the glow's top contour humps up at the centre
     * at full level. The ceiling the glow is masked to gains that height in
     * the middle and none at the ends, and a faint rim traces the curve, so
     * the glow's outline bows upward with the voice like space bending
     * around it. 0 keeps the contour at its plain ellipse.
     * @default 60
     */
    bend?: number;
    /** Opacity of the band, 0 hides it. @default 1.55 (1.8 for `mobile`; on light 1.7, or 2 for `pill`) */
    bandStrength?: number;
    /** Thickness of the band. @default 2.15 */
    bandWidth?: number;
    /** Height of the band's peak as a fraction of the glow's ceiling, 0.1–1.3. @default 0.35 */
    bandPosition?: number;
    /** Bell exponent: below 2 an exponential, cusp-like rise; 2 a gaussian; above, a flatter top. @default 1.75 */
    bandCurve?: number;
    /** Bell width as a fraction of the glow's half-range: small is a narrow spike with long tails, large a broad dome. @default 0.87 */
    bandSpread?: number;
    /** Asymmetry, −0.6–0.6: positive widens the right side and steepens the left. @default 0.12 */
    bandSkew?: number;
    /** Vertical shift of the whole band line in px; negative sinks it toward the edge. @default -27 */
    bandOffset?: number;
    /** How far the band's ends rise again toward the corners, as a fraction of its peak, 0–1 — the line opens upward at the edges instead of dying flat. @default 0.59 (0 for `pill`) */
    bandTail?: number;
    /** Where the tail's rise starts, as a share of the distance from the beam's centre to the element's edge (0.85 = only the last 15%); it always reaches the full lift exactly at the corner. @default 0.67 */
    bandTailPosition?: number;
    /** Exponent of the rise: 1 a straight ramp, 2 a parabola, higher a hook that stays low and whips up at the corner. @default 2.4 */
    bandTailCurve?: number;
    /** Px the band runs past each side of the element, so the hook peaks outside and is cropped by the component's edge. Scales with `scale`. @default 15 */
    bandTailOverflow?: number;
    /** Chromatic aberration — how far the red and blue fringes split from the core, 0–1. @default 0.89 */
    bandAberration?: number;
    /**
     * Distortion — how much the glow under the band warps sideways, 0–1.
     * A slowly drifting noise field displaces the inner light and the bloom
     * horizontally, stronger as the voice rises, so the colours shimmer and
     * stretch like light through bent space. Only the glow UNDER the band
     * line warps — the layers are split at the line — and it is independent
     * of `bandStrength`, so the line can be invisible and the warp strong.
     * The edge stroke stays crisp. 0 turns the filter off entirely.
     * @default 0.62
     */
    distortion?: number;
    /** Grain of the distortion's noise: below 1 broad slow waves, above 1 finer ripples. @default 2.3 */
    distortionDetail?: number;
    /** Width of every colour lobe, all layers — on the dots and lines, the width of each hill. @default 0.65 */
    glowWidth?: number;
    /** Height of every colour lobe, all layers. @default 1.25 */
    glowHeight?: number;
    /** Distance between the lobes (and the ring the flow travels) — on the dots and lines, between the hills. @default 0.85 */
    lobeSpacing?: number;
    /** Width of the visible ellipse the glow is masked to. @default 0.75 */
    rangeWidth?: number;
    /** Height of the visible ellipse the glow is masked to. @default 1 */
    rangeHeight?: number;
    /** Where each lobe fades out — below 1 crisper, above 1 softer. @default 1.07 */
    softness?: number;
    /** The white hot spot at the centre of the edge. @default 1 */
    coreSize?: number;
    /**
     * The epicentre: a soft white wash under the band line at the centre of
     * the edge, so the source reads lighter than the band. 0–3: up to 1 the
     * wash's opacity, past 1 its solid white core widens and the whole wash
     * grows, washing out more of the colour beneath.
     * @default 0 (1.8 on the light theme)
     */
    coreLight?: number;
    /** Width of the epicentre wash. @default 1 */
    coreLightWidth?: number;
    /** Height of the epicentre wash. @default 1 */
    coreLightHeight?: number;
    /** Size of the colours painted into the 1px edge stroke. @default 1 */
    strokeScale?: number;
    /** Size of the soft light inside the element. @default 1 */
    innerScale?: number;
    /** Extra height of the inner light — how far it reaches into the element. @default 1 */
    innerHeight?: number;
    /** Size of the blurred halo. @default 1 */
    bloomScale?: number;
    /** Extra height of the halo — how far the soft light climbs. @default 1 */
    bloomHeight?: number;
    /**
     * Overall strength/opacity of the effect (0–1).
     * Only affects the beam layers — not the children.
     * @default 1 (dark) / 0.8 (light); 1 on both for `type="mobile"`
     */
    strength?: number;
    /**
     * Additional class name for the container
     */
    className?: string;
    /**
     * Additional inline styles for the container
     */
    style?: CSSProperties;
    /**
     * Extra CSS appended after the beam's own generated stylesheet. Write
     * `{id}` wherever the instance id belongs — the root is
     * `[data-voice-beam="{id}"]`, its layers the `::before` / `::after`
     * pseudo-elements and `[data-voice-beam-bloom]`, and keyframes are named
     * `*-{id}` — and it is substituted per instance.
     */
    css?: string;
    /**
     * Called every frame with the smoothed level (0–1) the beam is showing.
     * Handy for a meter or a "listening" label; avoid setting React state
     * from it on every call.
     */
    onLevel?: (level: number) => void;
    /**
     * Callback when the fade-in completes
     */
    onActivate?: () => void;
    /**
     * Callback when the fade-out completes
     */
    onDeactivate?: () => void;
}

/**
 * Theme mode for adapting beam colors to the background
 */
export declare type VoiceBeamTheme = 'dark' | 'light' | 'auto';

/**
 * Host preset — retunes the glow's geometry for the element it wraps
 * - 'default': a chat input or card, ~350px wide
 * - 'pill': a small recording pill, ~150×44 — glow pulled in, shallower bend
 * - 'mobile': the bottom of a phone screen — wider range, taller rise
 *
 * A preset only supplies defaults; every geometry prop still overrides it.
 */
export declare type VoiceBeamType = 'default' | 'pill' | 'mobile';

/**
 * The tuned defaults — the `default` type, a ~350px chat input.
 */
export declare const voiceDefaults: VoiceGeometry;

/**
 * Shared driver for the voice reaction.
 *
 * Every registered instance is stepped from a SINGLE requestAnimationFrame
 * loop (capped at ~60 fps so 120 Hz displays do not double the paint work).
 * Each frame the driver reads the instance's source — an AnalyserNode on a
 * MediaStream, or a plain level getter — shapes the raw level (gain, noise
 * gate, soft saturation), follows it with an attack/release envelope,
 * advances the flow (the lobes sliding sideways at a speed set by the
 * level, so the spectrum travels while a voice is heard and rests when it
 * stops), gathers the lobes into a beam where a motion getter asks for it,
 * folds in the idle breathing and the slow hue drift, and writes
 * the result as
 * CSS custom properties on the element. The generated stylesheet multiplies
 * every lobe size and position by those, so the paint work is the
 * browser's and this loop stays a few arithmetic ops per instance.
 */
declare interface VoiceDriverConfig {
    id: string;
    sensitivity: number;
    threshold: number;
    attack: number;
    release: number;
    idle: number;
    breatheDuration: number;
    reach: number;
    spread: number;
    bands: boolean;
    /** Flow speed in px/s at full level; negative flows right-to-left. */
    flow: number;
    /** Multiplies the resting distance between lobes (and so the flow ring). */
    lobeSpacing: number;
    /** Bend: px of extra height the glow's top gains at the centre at full level. */
    bend: number;
    /** The band: opacity, thickness, height as a fraction of the ceiling,
     *  bell exponent, bell width, skew, chromatic split. */
    bandStrength: number;
    bandWidth: number;
    bandPosition: number;
    bandCurve: number;
    bandSpread: number;
    bandSkew: number;
    /** Vertical shift of the whole band line, px (negative lowers it). */
    bandOffset: number;
    /** Rise of the band's ends toward the corners, as a fraction of the peak. */
    bandTail: number;
    /** Where the rise starts, as a share of the centre-to-edge distance. */
    bandTailPosition: number;
    /** Exponent of the rise. */
    bandTailCurve: number;
    /** Px the band runs past each side of the element. */
    bandTailOverflow: number;
    bandAberration: number;
    /** The ceiling's tuned size multipliers, so the band can sit on it. */
    rangeWidth: number;
    rangeHeight: number;
    theme: 'dark' | 'light';
    /** Dots and lines: the ink's tint as an `[r, g, b]` triple (null: plain
     *  grey / white) and how far the ink takes it, 0–1. */
    tint: [number, number, number] | null;
    tintAmount: number;
    /** Band colours as `r, g, b` triples: the core and its fringes. */
    bandColors: {
        core: string;
        above: string;
        mid: string;
        below: string;
    };
    /** Horizontal distortion of the glow under the band, 0–1. */
    distortion: number;
    /** The epicentre wash's opacity; above 0 the band-line clips are written even without distortion. */
    coreLight: number;
    /** The effect's overall scale, for the few px values not carried by the geometry props. */
    scale: number;
    /** The element's corner radius, px — a gathered beam follows its arc. */
    radius: number;
    hueRange: number;
    hueDuration: number;
    staticColors: boolean;
    reducedMotion: boolean;
    /** Hold the frame: the clock stops and the source is not read, but a changed config still repaints. */
    paused: boolean;
    /** How the voice is drawn: the stylesheet's glow, the glow dithered into
     *  pixels, or a plugged-in look's name (`lookPlugin`) — all but the glow
     *  painted on a canvas. */
    look: string;
    /** The plugged-in look (look.ts), or null for the glow and the dither. */
    lookPlugin: VoiceLook | null;
    /** The pixel looks: the lobes' colours as [r, g, b] 0–255 (the palette with
     *  any custom colours), the filter the stylesheet runs on them, the theme's
     *  hue base, and the cell size multiplier. */
    palette: Array<[number, number, number]>;
    saturation: number;
    hueBase: number;
    pixelSize: number;
    /** The pixel looks' halo, 0–1. */
    pixelGlow: number;
    /** How long processing's dust lingers, s (0 off). */
    pixelDust: number;
    /** How much the pixel looks' field dips toward the sides, 0–1+. */
    pixelDome: number;
    /** How strongly the pixel looks' pixels follow the pointer, 0–1. */
    pixelMagnet: number;
    /** Surface looks (Libraries Pro's dots and lines). The dots: radius and spacing multipliers, and their shape. */
    dotSize: number;
    dotGap: number;
    dotShape: 'round' | 'square';
    /** The lines: width and spacing multipliers, which way they run, and whether a raised ridge hides the lines behind it. */
    lineWidth: number;
    lineGap: number;
    linePattern: 'rows' | 'columns' | 'grid';
    seeThrough: boolean;
    /** The surface's ripple, 0–1, and how hard it falls when the voice drops, as a multiplier on its gravity. */
    texture: number;
    gravity: number;
    /** The surface's shape: its height (×), its arc (×, below 0 it cups), its
     *  tails (lift × its height, where the rise starts, its exponent) and how
     *  far in its sides dissolve (share of the half-width). */
    surfaceHeight: number;
    surfaceCurve: number;
    surfaceTail: number;
    surfaceTailPosition: number;
    surfaceTailCurve: number;
    surfaceFade: number;
    /** The glow's layer shapes and weights, which the surface rebuilds (the stylesheet carries them for the glow). */
    layers: {
        glowWidth: number;
        glowHeight: number;
        innerScale: number;
        innerHeight: number;
        bloomScale: number;
        bloomHeight: number;
        strokeScale: number;
        softness: number;
        coreSize: number;
        innerOpacity: number;
        bloomOpacity: number;
        strokeOpacity: number;
        brightness: number;
    };
}

/**
 * The geometry and response knobs a `type` preset may retune. Everything
 * here is a prop on the component; the preset only supplies the default,
 * so an explicit prop always wins.
 */
export declare interface VoiceGeometry {
    /** Size of the whole effect (see the `scale` prop). */
    scale: number;
    /** Bloom blur multiplier (see the `glowSize` prop). */
    glowSize: number;
    /** Per-layer opacity multipliers on the theme preset. */
    strokeOpacity: number;
    innerOpacity: number;
    bloomOpacity: number;
    idle: number;
    reach: number;
    spread: number;
    flow: number;
    bend: number;
    bandStrength: number;
    bandWidth: number;
    bandPosition: number;
    bandCurve: number;
    bandSpread: number;
    bandSkew: number;
    bandOffset: number;
    /** How far the band's ends rise again toward the corners, as a fraction of its peak. */
    bandTail: number;
    /** Where the tail's rise starts, as a share of the centre-to-edge distance; it always reaches full lift at the corner. */
    bandTailPosition: number;
    /** Exponent of the rise: 1 a straight ramp, higher a hook that stays low then whips up at the corner. */
    bandTailCurve: number;
    /** Px the band runs past each side of the element, so the hook is cropped by the component. */
    bandTailOverflow: number;
    bandAberration: number;
    distortion: number;
    distortionDetail: number;
    glowWidth: number;
    glowHeight: number;
    lobeSpacing: number;
    rangeWidth: number;
    rangeHeight: number;
    softness: number;
    coreSize: number;
    /** The epicentre: a white wash under the band line at the centre of the edge, 0–1 (light theme only by default). */
    coreLight: number;
    coreLightWidth: number;
    coreLightHeight: number;
    strokeScale: number;
    innerScale: number;
    innerHeight: number;
    bloomScale: number;
    bloomHeight: number;
    /** Cell size of the pixel looks, as a multiplier (see the `pixelSize` prop). */
    pixelSize: number;
}

/**
 * Lobe geometry, in px for a ~350px-wide reference element. Seven soft
 * ellipses fan out from the bottom center: the centre lobe follows the low
 * band, its neighbours the mids, the outer pair the highs and the far pair
 * the mids again, so a voice makes the colours ripple outward instead of
 * one blob pumping. `x` is the resting offset from centre; the driver
 * slides every lobe along by the flow phase (wrapping at ±LOBE_SPAN/2 so
 * the colours cycle through the centre) and it scales with the spread so
 * a loud sound pushes the side lobes apart.
 */
export declare interface VoiceLobe {
    x: number;
    w: number;
    h: number;
    band: 0 | 1 | 2;
}

export declare const voiceLobes: readonly VoiceLobe[];

export declare type VoiceLook = VoicePixelLook | VoiceSurfaceLook<any>;

/**
 * Looks that plug in from outside the package.
 *
 * `look="glow"` and `look="dither"` are built in. Any other look is an
 * object passed as the `look` prop, and it is drawn by one of two engines:
 *
 * - a pixel look paints the glow onto the pixel canvas, as the dither does,
 *   and gets the dither's machinery with it: the glow sampled at any point,
 *   its blended colours, the halo, the magnet, processing's dust and the
 *   pixels that fly into and out of `pixelExitTarget`;
 * - a surface look owns its canvas and paints the voice its own way from
 *   the lobes, the level and the clock.
 *
 * Libraries Pro adds mosaic (a pixel look), and dots and lines (surface
 * looks) this way. Pass the same object on every render (define it once at
 * module level); a new object rebuilds the effect.
 */
/** Everything a look is drawn with: every prop, resolved, clamped and scaled. */
export declare type VoiceLookConfig = VoiceDriverConfig;

/**
 * Seven colours per palette, one per lobe (centre first, then pairs). Light
 * palettes use deeper values because they sit on a white surface at far
 * lower opacity.
 */
export declare const voicePalettes: Record<VoiceBeamColorVariant, {
    dark: string[];
    light: string[];
}>;

/** One frame of a pixel look. Read the glow with `light()`, then its colour
 *  with `blend()`; lay a grid out with `grid()`, and for each cell take the
 *  magnet's offset with `pull()` and report what was drawn with `lit()`. */
export declare interface VoicePixelKit {
    ctx: CanvasRenderingContext2D;
    config: VoiceLookConfig;
    /** The canvas, CSS px (the context is already scaled for the device). */
    cw: number;
    ch: number;
    /** Nothing is lit above this y, so a bottom-up row loop can stop there. */
    top: number;
    /** The glow's light at a point, 0–1: its lobes inside its range, and its
     *  band. Sets `lobes` and what `blend()` reads, for that point. */
    light(x: number, y: number): number;
    /** Each lobe's pull on the colour at the last point read (7 lobes). */
    lobes: Float32Array;
    /** The glow's blended colour at the last point read, 0–1 per channel into
     *  `rgb`; false where no lobe reaches. */
    blend(): boolean;
    rgb: Float32Array;
    /** A fixed 0–1 value per cell, so a cell's choices hold frame to frame. */
    hash(c: number, r: number): number;
    /** The cell's 4×4 ordered-dither threshold, in (0, 1). */
    bayer(c: number, r: number): number;
    /** Starts the frame's grid: `cols` × `rows` cells `cell` px apart from
     *  (x0, y0). Call once per frame before the cells. */
    grid(cols: number, rows: number, cell: number, x0: number, y0: number): void;
    /** The magnet's offset for cell `m` (row × cols + column) at (x, y), px. */
    pull(m: number, c: number, r: number, x: number, y: number): [number, number];
    /** Whether the cell's pixel is in flight (into or out of the button):
     *  report it with `lit()`, but leave it out of the picture. */
    away(m: number): boolean;
    /** Reports a drawn cell — where, how big, how bright (0–1), its colour as
     *  0xRRGGBB — for the magnet and the flying pixels; it leaves processing's
     *  dust there too. */
    lit(x: number, y: number, size: number, v: number, rgb: number, m: number): void;
    /** Draws the cell's speck of processing's dust, if it has one; true if drawn. */
    dust(m: number, c: number, r: number, x: number, y: number, size: number): boolean;
}

/** A look painted on the pixel canvas, as the dither is. */
export declare interface VoicePixelLook {
    kind: 'pixel';
    /** Its name: set on the host as `data-voice-look`. */
    name: string;
    /** Paints one frame. */
    paint(kit: VoicePixelKit): void;
    /** How many times its picture feeds the halo (the dither's: 1). */
    halo?: number;
    /** The magnet's default strength (the dither's: 0.7). */
    magnet?: number;
    /** Tuning by host over the pixel looks' shared defaults; props still win. */
    types?: Partial<Record<VoiceBeamType, Partial<VoiceGeometry>>>;
}

/** One frame of the voice for a surface look. */
export declare interface VoiceSurfaceFrame {
    /** The canvas, CSS px. */
    cw: number;
    ch: number;
    /** Each lobe's centre along the edge (element px), and its amplitude from the band it follows. */
    lobeX: Float32Array;
    lobeL: Float32Array;
    /** The spread multiplier (0.85 at rest, wider with the voice). */
    w: number;
    /** How high the voice stands, 0–1: the level on a fast envelope, or the held level while processing. */
    lift: number;
    /** Overall presence, 0.15–1. */
    glow: number;
    /** Seconds: the clock, and since the last frame (0 while paused). */
    t: number;
    dt: number;
    /** Unwrapped flow travel, px. */
    drift: number;
    /** Processing's gather, 0–1. */
    gather?: number;
}

/** A look that owns its canvas: `create` once per canvas, `draw` every frame. */
export declare interface VoiceSurfaceLook<S = unknown> {
    kind: 'surface';
    /** Its name: set on the host as `data-voice-look`. */
    name: string;
    create(canvas: HTMLCanvasElement): S | null;
    draw(state: S, config: VoiceLookConfig, frame: VoiceSurfaceFrame): void;
}

/**
 * Theme color configuration
 */
export declare interface VoiceThemeColors {
    strokeOpacity: number;
    innerOpacity: number;
    bloomOpacity: number;
    innerShadow: string;
    saturation: number;
    brightness: number;
    /** Optional per-theme hue drift defaults; fall back to 24° / 12 s / 0°. */
    hueRange?: number;
    hueDuration?: number;
    hueBase?: number;
    /** Optional per-theme overall strength (falls back to 1). */
    strength?: number;
    /** Optional per-theme band strength for types that do not set their own. */
    bandStrength?: number;
}

/**
 * Per-type overrides on the defaults. The glow is authored in px for the
 * default host, so a smaller or larger host needs its lobes, range and
 * band rescaled to read the same.
 *
 * - `pill`: a ~150×44 recording pill — everything pulled in, a lower
 *   reach, a shallower bend, a thinner band.
 * - `mobile`: the bottom of a phone screen (~400px wide, tall) — a wider
 *   range and lobe ring, a taller rise, a broader band.
 */
export declare const voiceTypePresets: Record<VoiceBeamType, Partial<VoiceGeometry>>;

/**
 * Colour tuning a type may carry on top of the theme preset (brightness
 * and saturation default per theme, so these are optional overrides).
 */
export declare type VoiceTypeStyle = {
    brightness?: number;
    saturation?: number;
    strength?: number;
};

export declare const voiceTypeStyle: Record<VoiceBeamType, VoiceTypeStyle>;

export { }
