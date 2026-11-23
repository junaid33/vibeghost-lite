"use client";

// A line-for-line port of VibeGhost's `WorkspaceIcon`
// (vibeghost/components/brand/workspace-avatar.tsx): the user-chosen shape
// (circle, squircle, square, triangle, diamond, hexagon, octagon, shield, star)
// and mode (gradient or dither), with Hashvatar 0.1.2 colours from the
// workspace id. Like VibeGhost, a workspace's accent colour never changes them.
import { useId, useSyncExternalStore, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { getVibeGhostWorkspaceGradient, hashToVibeGhostSeeds } from "@/lib/vibeghost-workspace-gradient";
import styles from "./vibeghost-workspace-icon.module.css";

export type WorkspaceIconShape = "circle" | "squircle" | "square" | "triangle" | "diamond" | "hexagon" | "octagon" | "shield" | "star";
export type WorkspaceAvatarMode = "gradient" | "dither";

const SHAPES: readonly WorkspaceIconShape[] = ["circle", "squircle", "square", "triangle", "diamond", "hexagon", "octagon", "shield", "star"];
const MODES: readonly WorkspaceAvatarMode[] = ["gradient", "dither"];
// VibeGhost: the literal "default" hash lands in a yellow-brown palette, so it uses this violet seed.
const DEFAULT_WORKSPACE_AVATAR_SEED = "qv";
// VibeGhost's shared logo-animation preference; animation is on unless it is "false".
const ANIMATION_KEY = "vibeghost:logo-animation";

export function workspaceAvatarSeed(workspaceId?: string | null, name?: string | null) {
  const id = workspaceId?.trim();
  if (id === "default") return DEFAULT_WORKSPACE_AVATAR_SEED;
  return id || name?.trim() || "Workspace";
}
const avatarShape = (shape?: string | null): WorkspaceIconShape => SHAPES.includes(shape as WorkspaceIconShape) ? shape as WorkspaceIconShape : "circle";
const avatarMode = (mode?: string | null): WorkspaceAvatarMode => MODES.includes(mode as WorkspaceAvatarMode) ? mode as WorkspaceAvatarMode : "gradient";

function shapePath(shape: WorkspaceIconShape) {
  switch (shape) {
    case "squircle": return "M50 5C18 5 5 18 5 50S18 95 50 95 95 82 95 50 82 5 50 5Z";
    case "square": return "M7 7H93V93H7Z";
    case "triangle": return "M50 6L96 91H4Z";
    case "diamond": return "M50 3L97 50 50 97 3 50Z";
    case "hexagon": return "M50 4L90 27V73L50 96 10 73V27Z";
    case "octagon": return "M31 4H69L96 31V69L69 96H31L4 69V31Z";
    case "shield": return "M50 4L92 19V49C92 72 75 89 50 97 25 89 8 72 8 49V19Z";
    case "star": return "M50 3L61 35 95 35 68 55 78 89 50 69 22 89 32 55 5 35 39 35Z";
    default: return "M50 4A46 46 0 1 1 49.99 4Z";
  }
}

const BAYER_4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]] as const;

function DitherArtwork({ colors, seeds, animated }: { colors: string[]; seeds: number[]; animated: boolean }) {
  const cells = 24;
  const cellSize = 100 / cells;
  const angle = seeds[0] * Math.PI * 2;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  return <>
    <rect width="100" height="100" fill={colors[0]}/>
    {Array.from({ length: cells * cells }, (_, index) => {
      const x = index % cells, y = Math.floor(index / cells);
      const position = ((x * dx + y * dy) / cells + 1) / 2;
      const threshold = BAYER_4[y % 4][x % 4] / 16;
      if (!(position + (seeds[(x + y) % seeds.length] - 0.5) * 0.22 > threshold)) return null;
      const colorIndex = 1 + ((x + y + Math.floor(seeds[2] * 7)) % (colors.length - 1));
      const inset = 0.95 + BAYER_4[x % 4][y % 4] * 0.018;
      return <rect key={index} className={styles.ditherCell} data-animated={animated || undefined} x={x * cellSize + inset} y={y * cellSize + inset}
        width={Math.max(0.8, cellSize - inset * 2)} height={Math.max(0.8, cellSize - inset * 2)} rx="0.45" fill={colors[colorIndex]}
        style={{
          animationDelay: `${-((x * 0.13 + y * 0.09 + seeds[index % seeds.length]) % 2.8)}s`,
          animationDuration: `${2.2 + seeds[(x + y) % seeds.length] * 1.8}s`,
        }}/>;
    })}
  </>;
}

function subscribe(listener: () => void) { window.addEventListener("storage", listener); return () => window.removeEventListener("storage", listener); }
function readAnimation() { try { return window.localStorage.getItem(ANIMATION_KEY); } catch { return null; } }
const useStoredAnimation = () => useSyncExternalStore(subscribe, readAnimation, () => null);

export function VibeGhostWorkspaceIcon({ name, workspaceId, shape, mode, animated, className }: {
  name: string;
  /** The workspace's VibeGhost id (not Oathkeeper's peer-scoped id). */
  workspaceId?: string | null;
  shape?: string | null;
  mode?: string | null;
  animated?: boolean;
  className?: string;
}) {
  const stored = useStoredAnimation();
  const isAnimating = animated ?? (stored === null || stored === "true");
  const hash = workspaceAvatarSeed(workspaceId, name);
  const resolvedShape = avatarShape(shape);
  const resolvedMode = avatarMode(mode);
  const { colors } = getVibeGhostWorkspaceGradient(hash);
  const seeds = hashToVibeGhostSeeds(hash, 12);
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const uid = `workspace-avatar-${instanceId}-${hashToVibeGhostSeeds(`${hash}:${resolvedShape}:${resolvedMode}`, 2).map(seed => Math.floor(seed * 1_000_000).toString(36)).join("-")}`;
  const clipId = `${uid}-clip`, gradientAId = `${uid}-gradient-a`, gradientBId = `${uid}-gradient-b`;
  const gradientStyle = {
    "--workspace-gradient-source-0": colors[0],
    "--workspace-gradient-source-1": colors[1],
    "--workspace-gradient-source-2": colors[2],
    "--workspace-gradient-source-3": colors[3],
  } as CSSProperties;
  return <svg aria-hidden="true" data-workspace-icon={resolvedShape} data-avatar-mode={resolvedMode}
    className={cn("vibeghost-workspace-gradient aspect-square shrink-0", className)} data-animation-state={isAnimating ? "running" : "paused"}
    style={gradientStyle} viewBox="0 0 100 100" fill="none" preserveAspectRatio="xMidYMid meet">
    <defs>
      <clipPath id={clipId}><path d={shapePath(resolvedShape)}/></clipPath>
      <radialGradient id={gradientAId} gradientUnits="userSpaceOnUse" cx={18 + seeds[0] * 64} cy={18 + seeds[1] * 64} r={54 + seeds[2] * 24}>
        <stop offset="0" stopColor="var(--workspace-gradient-1)"/>
        <stop offset="0.58" stopColor="var(--workspace-gradient-2)" stopOpacity="0.82"/>
        <stop offset="1" stopColor="var(--workspace-gradient-0)" stopOpacity="0"/>
      </radialGradient>
      <radialGradient id={gradientBId} gradientUnits="userSpaceOnUse" cx={18 + seeds[3] * 64} cy={18 + seeds[4] * 64} r={42 + seeds[5] * 22}>
        <stop offset="0" stopColor="var(--workspace-gradient-3)" stopOpacity="0.94"/>
        <stop offset="1" stopColor="var(--workspace-gradient-0)" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <g clipPath={`url(#${clipId})`}>
      {resolvedMode === "dither" ? <DitherArtwork colors={colors} seeds={seeds} animated={isAnimating}/> : <>
        <rect width="100" height="100" fill="var(--workspace-gradient-0)"/>
        <rect className={styles.gradientA} width="100" height="100" fill={`url(#${gradientAId})`} data-animated={isAnimating || undefined}/>
        <rect className={styles.gradientB} width="100" height="100" fill={`url(#${gradientBId})`} data-animated={isAnimating || undefined}/>
      </>}
    </g>
  </svg>;
}

type IconWorkspace = { id: string; remoteId?: string; name: string; iconShape?: string; avatarMode?: string };
/** A connected workspace's chosen VibeGhost icon. Oathkeeper ids are peer-scoped
 *  (`peer:workspace`); VibeGhost seeds the artwork from the bare workspace id. */
export function WorkspaceMark({ workspace, className }: { workspace: IconWorkspace; className?: string }) {
  const id = workspace.remoteId || workspace.id.slice(workspace.id.lastIndexOf(":") + 1);
  return <VibeGhostWorkspaceIcon name={workspace.name} workspaceId={id} shape={workspace.iconShape} mode={workspace.avatarMode} className={className}/>;
}
