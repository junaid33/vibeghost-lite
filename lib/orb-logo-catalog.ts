/** Commercial-use allowlist: Orbkit's 14 MIT originals, NOT its XorDev ports.
 * Verified against upstream 5dbd641ee0d08a9135a2c13b75c4685c36b02150.
 * Review CREDITS.md + LICENSE-SHADERS.md before adding anything here.
 * Source hashes and license evidence: components/orbkit/provenance.json.
 */
export const OATHKEEPER_ORB_CATALOG = [
  { key: "shdr-21", label: "Arcturus" },
  { key: "shdr-11", label: "Cygnus" },
  { key: "shdr-12", label: "Draco" },
  { key: "shdr-13", label: "Phoenix" },
  { key: "shdr-14", label: "Carina" },
  { key: "shdr-16", label: "Aquila" },
  { key: "shdr-17", label: "Perseus" },
  { key: "shdr-23", label: "Capella" },
  { key: "shdr-24", label: "Polaris" },
  { key: "shdr-27", label: "Bellatrix" },
  { key: "shdr-29", label: "Alnilam" },
  { key: "shdr-30", label: "Mintaka" },
  { key: "shdr-32", label: "Hyperion" },
  { key: "shdr-33", label: "Umbriel" },
] as const;

export type OathkeeperOrbKey = (typeof OATHKEEPER_ORB_CATALOG)[number]["key"];
export const DEFAULT_OATHKEEPER_ORB: OathkeeperOrbKey = "shdr-21";

/** Removed, missing and unknown saved selections must never load another shader. */
export function normalizeOrbLogoKey(key: unknown): OathkeeperOrbKey {
  return OATHKEEPER_ORB_CATALOG.find(option => option.key === key)?.key ?? DEFAULT_OATHKEEPER_ORB;
}

type OrbStates<T> = Partial<Record<"idle" | "thinking" | "speaking", T>>;
/** Oathkeeper's look for an orb: a colour and exposure override, so the audited
 *  shader sources stay byte-identical. Arcturus upstream runs amber into purple;
 *  ours starts emerald, then cycles through one blue, plum, crimson and orange, with the
 *  exposure pulled down (the shader's tanh tone curve brightens any palette at
 *  full exposure). The live orb (orb-logo-registry), the logo picker thumbnail
 *  and the frozen favicon (scripts/generate-orb-icons.mjs) all read this. */
type OrbLook = {
  stateColors: OrbStates<Record<string, string>>;
  statePresets: OrbStates<Record<string, number>>;
  /** Optional slow drift through accents; the engine's spring glides between them.
   *  The first entry should match stateColors.speaking (the frozen favicon frame). */
  cycle?: { colors: Record<string, string>[]; everyMs: number };
};
export const OATHKEEPER_ORB_LOOKS: Partial<Record<OathkeeperOrbKey, OrbLook>> = {
  "shdr-21": {
    stateColors: {
      idle: { light: "#2a68c8", shadow: "#081a50" },
      thinking: { light: "#2a68c8", shadow: "#081a50" },
      speaking: { light: "#2a68c8", shadow: "#081a50" },
    },
    statePresets: { idle: { exposure: .46 }, thinking: { exposure: .44 }, speaking: { exposure: .38 } },
    // Starts on blue (the favicon frame), then plum, crimson, orange and emerald; warm plum
    // avoids a second blue-heavy violet. Dark takes on the workspace gradient accents (blue,
    // plum, crimson, emerald) and Oathkeeper's own orange (its workspace icon, oklch(0.745 0.205 69.7) over
    // a #510000–#731600 base), burnt down to sit with the others.
    cycle: {
      everyMs: 7000,
      colors: [
        { light: "#2a68c8", shadow: "#081a50" },
        { light: "#8a2f8e", shadow: "#300c30" },
        { light: "#9a1a26", shadow: "#2a0612" },
        { light: "#b85a00", shadow: "#4a1400" },
        { light: "#0b6e55", shadow: "#062e19" },
      ],
    },
  },
};
