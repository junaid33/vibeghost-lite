"use client";

import { useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowUpRight, X } from "@/components/icons/duo";
import { OathkeeperOrb } from "@/components/OathkeeperOrb";
import { AgentLanes, type LaneAgent, type LaneStatus, type LaneTask } from "./affectui/agent-lanes";
import { ClaudeLogo, OpenAILogo } from "./affectui/agent-lanes-logos";
import { useVibeGhostTimeline } from "../hooks/use-vibeghost-timeline";
import { navigateVibeGhost } from "../lib/vibeghost-navigation";
import { sharedSessionId } from "../lib/shared-workspace-model";
import { MiniSession } from "./mini-chat";
import type { WorkspaceViewChromeProps } from "./workspace-view-shell";
import type { TimelineAgent } from "../lib/vibeghost-timeline";
import styles from "./vibeghost-timeline.module.css";

// The Timeline is affectUI's Agent Lanes, unchanged: one lane per running agent session, in
// Timeline order, with its stretches of work as tasks. This file only maps VibeGhost data onto
// the component's props and places it; the look and motion are the component's own. Opening a
// lane shows that session's mini terminal (MiniSession, as in the Kanban card sidebar) on this
// page: a side panel on desktop, a bottom sheet on phones.

const avatars = { claude: <ClaudeLogo/>, codex: <OpenAILogo/> } as const;
const labels: Record<LaneStatus, string> = { running: "Working", waiting: "Needs you", failed: "Failed", done: "Done" };

export function toLanes(sessions: TimelineAgent[]) {
  const agents: LaneAgent[] = sessions.map(session => ({
    id: session.id,
    name: session.title,
    model: `${session.providerName} · ${session.workspace}`,
    avatar: session.provider === "pi" ? undefined : avatars[session.provider],
  }));
  const tasks: LaneTask[] = sessions.flatMap(session => session.segments.flatMap(segment => {
    const open = segment.end === null;
    // A wait that has ended is not work; the work around it carries the timeline.
    if (segment.kind === "blocked" && !open) return [];
    const status: LaneStatus = segment.kind === "working" ? open ? "running" : "done" : segment.kind === "blocked" ? "waiting" : "failed";
    const summary = open ? [session.activity, session.tool].filter((line): line is string => Boolean(line)) : [];
    return [{
      id: `${session.id}:${segment.start}`,
      agentId: session.id,
      title: (open ? session.activity ?? session.tool : null) ?? segment.title ?? labels[status],
      status,
      start: Date.parse(segment.start),
      end: segment.end ? Date.parse(segment.end) : undefined,
      ask: status === "waiting" ? session.activity ?? undefined : undefined,
      summary: summary.length ? summary : undefined,
    }];
  }));
  return { agents, tasks };
}

export function VibeGhostTimeline({ chrome }: { chrome: WorkspaceViewChromeProps }) {
  const { agents, loading, error, hasMore, loadMoreRef } = useVibeGhostTimeline();
  const lanes = useMemo(() => toLanes(agents), [agents]);
  // The open session, by its Oathkeeper id (iroh-<workspace>-<session>).
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = agents.find(item => sharedSessionId(item.workspaceId, item.id) === openId) ?? null;
  // Open, Approve and Reject all open the session here, where the decision is made.
  const open = (task: LaneTask) => {
    const session = agents.find(item => item.id === task.agentId);
    if (session) setOpenId(sharedSessionId(session.workspaceId, session.id));
  };

  if (loading) return <div role="status" className={styles.state}><OathkeeperOrb size={44}/><span className="sr-only">Loading timeline</span></div>;
  if (error) return <p role="alert" className={styles.state}>{error}</p>;
  return <section aria-label="Timeline" className={styles.timeline}>
    {/* Phones scroll the whole board sideways (axis with the lanes); the component itself is unchanged. */}
    <div className={styles.scroller}>
      <div data-theme="dark" className={styles.lanes}>
        <AgentLanes agents={lanes.agents} tasks={lanes.tasks} onOpen={open} onApprove={open} onReject={open}/>
      </div>
    </div>
    {hasMore ? <div ref={loadMoreRef} aria-hidden="true" className={styles.more}/> : null}
    <DialogPrimitive.Root open={Boolean(openId)} onOpenChange={next => { if (!next) setOpenId(null); }} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content aria-describedby={undefined} className={styles.panel} onOpenAutoFocus={event => event.preventDefault()} onInteractOutside={event => event.preventDefault()}>
          <header className={styles.head}>
            <span aria-hidden="true" className={styles.grabber}/>
            <DialogPrimitive.Title className={styles.headTitle}>{opened?.title ?? "Session"}</DialogPrimitive.Title>
            {opened ? <button type="button" className={styles.icon} aria-label="Open session" title="Open session" onClick={() => { setOpenId(null); navigateVibeGhost(opened.workspaceId, opened.id, "timeline"); }}><ArrowUpRight aria-hidden="true"/></button> : null}
            <DialogPrimitive.Close className={styles.icon} aria-label="Close" title="Close"><X aria-hidden="true"/></DialogPrimitive.Close>
          </header>
          {openId ? <MiniSession key={openId} sessionId={openId} chrome={chrome} onSelect={setOpenId}/> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  </section>;
}
