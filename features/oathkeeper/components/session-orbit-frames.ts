// Working orbit: three circles on a ring tilted away from the viewer, so the
// path is a flat ellipse (wide, shallow) and depth reads through size, fade and
// blur: circles swell and sharpen as they pass in front, shrink and soften behind.
// Sized for the 6px dot slot: it spills ~6px either side into the row's padding
// and gap, never reaching the title.
const RADIUS_X = 6;   // px, half the ellipse's width
const RADIUS_Y = 1.8; // px, half its height: the tilt
const STEPS = 48;

export const sessionOrbitFrames = [0, 1, 2].map(index => Array.from({ length: STEPS + 1 }, (_, step) => {
  const angle = (index / 3 + step / STEPS) * Math.PI * 2;
  const depth = (Math.sin(angle) + 1) / 2; // 0 behind, 1 in front
  const x = Math.cos(angle) * RADIUS_X, y = Math.sin(angle) * RADIUS_Y;
  return {
    transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${(.58 + .42 * depth).toFixed(3)})`,
    opacity: (.3 + .7 * depth).toFixed(3),
    // Like the original orbit, only the lead circle is sharp: blur rises as soon as a
    // circle leaves the front (≈1.6px at the sides, ≈2.1px behind).
    filter: `blur(${(2.1 * (1 - depth * depth)).toFixed(2)}px)`,
    zIndex: depth > .5 ? 2 : 1,
  };
}));
