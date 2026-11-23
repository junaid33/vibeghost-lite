"use client";
import { Shdr21 } from "@/components/ui/shdr-21";
import { OATHKEEPER_ORB_LOOKS } from "@/lib/orb-logo-catalog";
import { useOrbLogoPreferences } from "@/lib/orb-logo-preferences";
import { HOME_AGENTS, type HomeAgent } from "../lib/home-agents";

/** An agent's orb: Oathkeeper's Arcturus orb, held on the agent's colour instead of drifting
 *  through the accents. It animates unless `still` (or the orb setting pauses it), when it draws
 *  one frame. A paused orb doesn't redraw for a new colour, so it remounts per agent. */
export function AgentOrb({ agent, size, still = false }: { agent: HomeAgent; size: number; still?: boolean }) {
  const { running } = useOrbLogoPreferences();
  const tone = (HOME_AGENTS.find(item => item.id === agent) ?? HOME_AGENTS[0]).orb;
  return <Shdr21 key={agent} size={size} state="speaking" wrapper="none" paused={still || !running} pauseOffscreen maxDpr={3}
    stateColors={{ idle: tone, thinking: tone, speaking: tone }} statePresets={OATHKEEPER_ORB_LOOKS["shdr-21"]?.statePresets}/>;
}
