import { useEffect, useState, type ComponentType } from "react";
import type { ShaderOrbProps } from "@/components/ui/orbkit-core";
import { OATHKEEPER_ORB_CATALOG, OATHKEEPER_ORB_LOOKS, normalizeOrbLogoKey, type OathkeeperOrbKey } from "@/lib/orb-logo-catalog";
import { Shdr11 } from "@/components/ui/shdr-11";
import { Shdr12 } from "@/components/ui/shdr-12";
import { Shdr13 } from "@/components/ui/shdr-13";
import { Shdr14 } from "@/components/ui/shdr-14";
import { Shdr16 } from "@/components/ui/shdr-16";
import { Shdr17 } from "@/components/ui/shdr-17";
import { Shdr21 } from "@/components/ui/shdr-21";
import { Shdr23 } from "@/components/ui/shdr-23";
import { Shdr24 } from "@/components/ui/shdr-24";
import { Shdr27 } from "@/components/ui/shdr-27";
import { Shdr29 } from "@/components/ui/shdr-29";
import { Shdr30 } from "@/components/ui/shdr-30";
import { Shdr32 } from "@/components/ui/shdr-32";
import { Shdr33 } from "@/components/ui/shdr-33";

export type OrbLogoComponent = ComponentType<Omit<ShaderOrbProps, "variant">>;
export type { OathkeeperOrbKey } from "@/lib/orb-logo-catalog";

// Explicit imports only: never bundle every upstream shader automatically.
const components = {
  "shdr-11": Shdr11, "shdr-12": Shdr12, "shdr-13": Shdr13, "shdr-14": Shdr14,
  "shdr-16": Shdr16, "shdr-17": Shdr17, "shdr-21": Shdr21, "shdr-23": Shdr23,
  "shdr-24": Shdr24, "shdr-27": Shdr27, "shdr-29": Shdr29, "shdr-30": Shdr30,
  "shdr-32": Shdr32, "shdr-33": Shdr33,
} satisfies Record<OathkeeperOrbKey, OrbLogoComponent>;

/** Applies Oathkeeper's look (callers can still pass their own stateColors/statePresets). */
function withPalette(key: OathkeeperOrbKey, Orb: OrbLogoComponent): OrbLogoComponent {
  const look = OATHKEEPER_ORB_LOOKS[key];
  if (!look) return Orb;
  const cycle = look.cycle;
  const Palette = (props: Omit<ShaderOrbProps, "variant">) => {
    const [step, setStep] = useState(0);
    // Drift through the accents while the orb runs; still under reduced motion.
    useEffect(() => {
      if (!cycle || props.paused || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const timer = setInterval(() => setStep(value => (value + 1) % cycle.colors.length), cycle.everyMs);
      return () => clearInterval(timer);
    }, [props.paused]);
    const colors = cycle?.colors[step];
    const stateColors = colors && step > 0 ? { idle: colors, thinking: colors, speaking: colors } : look.stateColors;
    return <Orb stateColors={stateColors} statePresets={look.statePresets} {...props}/>;
  };
  Palette.displayName = `Oathkeeper(${key})`;
  return Palette;
}

export const OATHKEEPER_ORB_OPTIONS = OATHKEEPER_ORB_CATALOG.map(option => ({
  ...option, Component: withPalette(option.key, components[option.key]),
}));

export function getOrbOption(key: string) {
  const safeKey = normalizeOrbLogoKey(key);
  return OATHKEEPER_ORB_OPTIONS.find(option => option.key === safeKey)!;
}
