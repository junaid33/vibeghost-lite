"use client";

import { Boxes, Circle, Columns3, Network, Share2, Sparkle, Sparkles } from "@/components/icons/duo";
import { AppPageHeading } from "./app-page-heading";
import { VibeGhostNavigationCard } from "./vibeghost-navigation-card";
import { vibeGhostAppName, vibeGhostActiveHref, vibeGhostHref, vibeGhostTimelineHref, vibeGhostWorkspacesHref } from "../lib/vibeghost-routes";

type LandingTool = {
  title: string;
  description: string;
  Icon: typeof Boxes;
};

const comingSoon: LandingTool[] = [
  { title: "Shared files", description: "Move files between connected workspaces.", Icon: Share2 },
  { title: "Remote hosts", description: "See and manage all available machines.", Icon: Network },
  { title: "Automations", description: "Run repeatable terminal tasks from VibeGhost.", Icon: Sparkle },
];

function LandingCard({ tool, disabled = false, href, onClick }: { tool: LandingTool; disabled?: boolean; href?: string; onClick?: () => void }) {
  return <VibeGhostNavigationCard title={tool.title} description={<span className="mt-0.5 block text-[12px] leading-4 text-[#919793] [overflow-wrap:anywhere]">{tool.description}</span>} icon={<tool.Icon className="size-4"/>} disabled={disabled} href={href} onClick={onClick}/>;
}

export function VibeGhostLanding({ onOpenWorkspaces, onOpenActive, onOpenTabs, onOpenTimeline }: { onOpenWorkspaces: () => void; onOpenActive: () => void; onOpenTabs: () => void; onOpenTimeline: () => void }) {
  const workspaces: LandingTool = { title: "Workspaces", description: "Browse connected workspaces and open their sessions.", Icon: Boxes };
  const active: LandingTool = { title: "Active Feed", description: "See every session grouped by what needs your attention.", Icon: Circle };
  return <section aria-label="VibeGhost home" className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
    <div className="mx-auto w-full max-w-[760px] px-3 pb-5 pt-5 font-mono text-[#f4f7f5] sm:px-5 sm:py-7">
    <AppPageHeading className="mb-5" title={vibeGhostAppName()} description="Connected workspaces and shared terminal tools."/>
    <div className="space-y-2"><LandingCard tool={workspaces} href={vibeGhostWorkspacesHref()} onClick={onOpenWorkspaces}/><LandingCard tool={active} href={vibeGhostActiveHref()} onClick={onOpenActive}/><LandingCard tool={{ title: 'Tabs', description: 'Keep sessions together. Switch tabs or split two side by side.', Icon: Columns3 }} href={vibeGhostHref(undefined, undefined, 'tabs')} onClick={onOpenTabs}/><LandingCard tool={{ title: 'Timeline', description: 'Running agents across connected workspaces.', Icon: Sparkles }} href={vibeGhostTimelineHref()} onClick={onOpenTimeline}/></div>
    <section aria-label="More VibeGhost tools coming soon" className="mt-6"><p className="mb-2 font-[family-name:var(--font-geist-mono)] text-[12px] font-medium uppercase tracking-[.04em] text-[#7c8880]">Coming soon</p><div className="space-y-2">{comingSoon.map((tool) => <LandingCard key={tool.title} tool={tool} disabled/>)}</div></section>
    <div data-dock-tail aria-hidden="true"/>
    </div>
  </section>;
}
