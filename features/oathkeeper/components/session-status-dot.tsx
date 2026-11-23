"use client";

import { useEffect, useRef } from "react";
import { sessionActivity } from "./vibeghost-session-activity";
import type { VibeGhostSession } from "./vibeghost-view";
import styles from "./session-status-dot.module.css";
import { sessionOrbitFrames } from "./session-orbit-frames";

export type SessionDotSource = Pick<VibeGhostSession, "status" | "state" | "agentStatus" | "agentPhase">;
type Pose = { transform: string; opacity: string; filter: string; zIndex: string | number };
const rest = (index: number): Pose => ({ transform: "none", opacity: index === 0 ? "1" : "0", filter: "blur(0px)", zIndex: 1 });

export function SessionStatusDot({ session, selected = false, bright = false, className = "" }: {
  session: SessionDotSource; selected?: boolean; bright?: boolean; className?: string;
}) {
  const activity = sessionActivity(session);
  const exited = session.status?.toLowerCase() === "exited";
  const working = activity.state === "working";
  const root = useRef<HTMLSpanElement>(null);
  const poses = useRef<Pose[]>(sessionOrbitFrames.map((_, index) => rest(index)));

  useEffect(() => {
    const nodes = Array.from(root.current?.children ?? []) as HTMLElement[];
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let animations: Animation[] = [];
    const capture = () => {
      poses.current = nodes.map(node => {
        const style = getComputedStyle(node);
        return { transform: style.transform, opacity: style.opacity, filter: style.filter, zIndex: style.zIndex === "auto" ? 1 : style.zIndex };
      });
      animations.forEach(animation => { animation.onfinish = null; animation.cancel(); });
      animations = [];
    };
    const start = () => {
      if (reduced.matches) return;
      nodes.forEach((node, index) => {
        const frames = sessionOrbitFrames[index];
        const target = working ? frames[0] : rest(index);
        // Gather from the currently visible pose, not a reset animation frame.
        const entrance = node.animate([poses.current[index], target], {
          duration: 300, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards",
        });
        animations.push(entrance);
        entrance.onfinish = () => {
          if (working) {
            const loop = node.animate(frames, { duration: 3300, iterations: Infinity, easing: "linear" });
            animations.push(loop);
          }
          entrance.cancel();
        };
      });
    };
    const onMotionChange = () => { capture(); start(); };
    start();
    reduced.addEventListener("change", onMotionChange);
    return () => { capture(); reduced.removeEventListener("change", onMotionChange); };
  }, [working]);

  return <span ref={root} data-session-dot data-activity={exited ? "exited" : activity.state} data-orb={working ? "B2" : undefined} data-selected={selected || undefined} data-bright={bright || undefined} className={`${styles.dot} ${className}`} role="img" aria-label={activity.label} title={activity.label}>
    {sessionOrbitFrames.map((_, index) => <span key={index} aria-hidden="true" className={styles.circle}/>)}
  </span>;
}
