"use client";

import type { VibeGhostSession } from "./vibeghost-view";

// Keep backend activity precedence for polling and accessibility metadata, while
// rendering a quiet navigation dot instead of a thinking/square status glyph.
export function sessionActivity(session: Pick<VibeGhostSession, "status" | "state" | "agentStatus" | "agentPhase">) {
  if (session.status?.toLowerCase() === "exited") return { state: "idle", label: "Exited" } as const;
  if (session.agentStatus === "working" || session.agentPhase === "working") return { state: "working", label: "Working" } as const;
  if (session.agentPhase === "blocked") return { state: "blocked", label: "Needs you" } as const;
  // An agent whose last turn failed reports status idle with phase error; it is not idle.
  if (session.agentPhase === "error") return { state: "error", label: "Error" } as const;
  if (session.agentPhase === "waiting") return { state: "finished", label: "Finished" } as const;
  if (session.agentStatus === "idle" || session.agentPhase === "idle") return { state: "idle", label: "Idle" } as const;
  return { state: "idle", label: session.status || session.state } as const;
}

export function VibeGhostSessionActivity({ session }: { session: VibeGhostSession }) {
  const activity = sessionActivity(session);
  return <span role="img" aria-label="Session" title="Session" data-activity={activity.state} className="inline-flex size-5 shrink-0 items-center justify-center">
    <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-55"/>
  </span>;
}
