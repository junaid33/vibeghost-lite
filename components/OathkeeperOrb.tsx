"use client";

import type { ShaderOrbProps } from "@/components/ui/orbkit-core";
import { getOrbOption } from "@/components/orbkit/orb-logo-registry";
import { useOrbLogoPreferences } from "@/lib/orb-logo-preferences";

export type OathkeeperOrbProps = Omit<ShaderOrbProps, "variant" | "state" | "paused">;

/** The user-selected animated Oathkeeper brand mark (MIT originals only). */
export function OathkeeperOrb({ size = 28, ...props }: OathkeeperOrbProps) {
  const { orb, running } = useOrbLogoPreferences();
  const option = getOrbOption(orb);
  const Orb = option.Component;

  return (
    <Orb
      key={option.key}
      size={size}
      state="speaking"
      wrapper="none"
      paused={!running}
      pauseOffscreen
      maxDpr={3}
      {...props}
    />
  );
}
