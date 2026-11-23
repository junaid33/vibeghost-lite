"use client";

import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "@/components/icons/duo";
import { WorkspaceMark } from "./vibeghost-workspace-icon";
import { cn } from "@/lib/utils";
import { AppPageHeading } from "./app-page-heading";
import { WorkspaceDirectoryControls } from "./workspace-directory-controls";
import styles from "./vibeghost-active-feed.module.css";
import { SessionPathMenu } from "./session-path-menu";
import { sessionActivity } from "./vibeghost-session-activity";
import type { VibeGhostSession, VibeGhostWorkspace } from "./vibeghost-view";
import { useScrollFade } from "../hooks/use-horizontal-scroll-fade";
import { vibeGhostHref, vibeGhostSessionTarget } from "../lib/vibeghost-routes";

const activeSessionHref = (session: VibeGhostSession) => { const target = vibeGhostSessionTarget(session); return vibeGhostHref(target.workspace, target.session, "active"); };

const groups = [
  { state: "blocked", title: "Needs you", subtitle: "Waiting for your input" },
  { state: "error", title: "Error", subtitle: "The last turn failed" },
  { state: "working", title: "Working", subtitle: "In progress now" },
  { state: "finished", title: "Finished", subtitle: "Completed and waiting" },
  { state: "idle", title: "Idle", subtitle: "Open and ready" },
  { state: "stopped", title: "Stopped", subtitle: "Exited sessions" },
] as const;

type ActivityState = typeof groups[number]["state"];

/** Static status marks from the reference, not animated loading indicators. */
function StatusMark({ state }: { state: ActivityState }) {
  return <svg className={styles.statusIcon} data-status-mark={state} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    {state === "finished" ? <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.6" opacity=".5"/> :
      state === "working" ? <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeDasharray="1 3" strokeLinecap="round"/> :
      state === "blocked" ? <><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.6" opacity=".22"/><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeDasharray="32 12" strokeDashoffset="5" strokeLinecap="round" transform="rotate(-90 10 10)"/></> :
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.6" opacity={state === "stopped" ? ".5" : ".65"}/>}
  </svg>;
}

function activeState(session: VibeGhostSession) {
  if (session.status?.toLowerCase() === "exited") return "stopped" as const;
  return sessionActivity(session).state;
}

function activityTime(session: VibeGhostSession) {
  const value = Date.parse(session.lastModified || session.startedAt || "");
  return Number.isFinite(value) ? value : 0;
}

export function VibeGhostActiveFeed({ workspaces, sessions, loading, refreshing, error, onRefresh, onSelect, sessionActions }: {
  workspaces: VibeGhostWorkspace[];
  sessions: VibeGhostSession[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  onRefresh: () => void | Promise<void>;
  onSelect: (session: VibeGhostSession) => void;
  sessionActions?: (session: VibeGhostSession) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const groupId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  useScrollFade(listRef, "vertical");
  const [collapsed, setCollapsed] = useState<Set<ActivityState>>(() => new Set());
  // Workspace cards collapse per status group, independently of the group itself.
  const [closedWorkspaces, setClosedWorkspaces] = useState<Set<string>>(() => new Set());
  const toggleWorkspace = (key: string) => setClosedWorkspaces(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const [workspaceId, setWorkspaceId] = useState("all");
  const filter = workspaces.some(workspace => workspace.id === workspaceId) ? workspaceId : "all";
  const visibleGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = sessions.filter(session => {
      const workspace = workspaces.find(item => item.id === session.workspaceId);
      return (filter === "all" || session.workspaceId === filter) &&
        (!needle || `${session.title} ${session.cwd} ${session.gitRepoPath || ""} ${workspace?.name || ""}`.toLowerCase().includes(needle));
    }).sort((left, right) => activityTime(right) - activityTime(left));
    return groups.map(group => {
      const matching = filtered.filter(session => activeState(session) === group.state);
      const byWorkspace = new Map<string, VibeGhostSession[]>();
      for (const session of matching) {
        const key = session.workspaceId || "";
        const items = byWorkspace.get(key) || [];
        items.push(session);
        byWorkspace.set(key, items);
      }
      return { ...group, sessions: matching, workspaces: [...byWorkspace].map(([id, items]) => ({ id, workspace: workspaces.find(workspace => workspace.id === id), sessions: items })) };
    }).filter(group => group.sessions.length);
  }, [query, sessions, filter, workspaces]);

  return <section aria-label="Active Feed" className="mx-auto flex min-h-0 w-full min-w-0 max-w-[960px] flex-1 flex-col px-3 font-sans text-[#f4f7f5] sm:px-5">
    <AppPageHeading className="shrink-0 pb-5 pt-5 sm:pt-7" title="Active Feed" description="Sessions across every workspace, grouped by what needs your attention."/>
    <WorkspaceDirectoryControls label="Active Feed controls" query={query} onQueryChange={setQuery} searchLabel="Search sessions" placeholder="Search sessions…" filter={filter} onFilterChange={setWorkspaceId} groups={[{ label: "Workspaces", items: workspaces }]} refreshing={refreshing} error={error} refreshLabel="Refresh Active Feed" onRefresh={() => void onRefresh()}/>
    {/* Refresh failures show as the red refresh control; no inline error line. */}
    {/* Spacing below the search lives inside the scroller so the shared fade reaches the bar. */}
    <div ref={listRef} className="scroll-fade-y min-h-0 flex-1 overflow-y-auto pb-5 pt-3">
      {visibleGroups.map(group => <section key={group.state} aria-label={`${group.title} sessions`} className={styles.statusCard}>
        <h2 className={styles.statusHeading}>
          <button type="button" className={styles.statusHeader} data-active-status={group.state} title={group.subtitle} aria-expanded={!collapsed.has(group.state)} aria-controls={`${groupId}-${group.state}`} onClick={() => setCollapsed(previous => {
            const next = new Set(previous);
            if (next.has(group.state)) next.delete(group.state); else next.add(group.state);
            return next;
          })}>
            <StatusMark state={group.state}/>
            <span>{group.title}</span>
            <span className={styles.statusCount} aria-label={`${group.sessions.length} ${group.sessions.length === 1 ? "session" : "sessions"}`}>{group.sessions.length}</span>
          </button>
        </h2>
        <div id={`${groupId}-${group.state}`} hidden={collapsed.has(group.state)} className={styles.workspaces}>{group.workspaces.map(item => <section key={item.id} data-active-workspace={item.id || "local"} aria-label={`${item.workspace?.name || (item.id ? "Unknown workspace" : "Local sessions")} workspace`} className={styles.workspace}>
          <header className={styles.workspaceHeader}>{item.workspace ? <WorkspaceMark workspace={item.workspace} className="size-4 shrink-0"/> : null}<h3><button type="button" className={styles.workspaceToggle} aria-expanded={!closedWorkspaces.has(`${group.state}:${item.id}`)} aria-controls={`${groupId}-${group.state}-${item.id || "local"}`} onClick={() => toggleWorkspace(`${group.state}:${item.id}`)}>{item.workspace?.name || (item.id ? "Unknown workspace" : "Local sessions")}</button></h3>{new Set(item.sessions.map(session => session.gitRepoPath || session.cwd || item.workspace?.defaultWorkingDir || "")).size > 1 ? <span>{item.sessions.length} {item.sessions.length === 1 ? "session" : "sessions"}</span> : null}<ChevronRight aria-hidden="true" className={cn(styles.workspaceChevron, !closedWorkspaces.has(`${group.state}:${item.id}`) && styles.workspaceChevronOpen)}/></header>
          <div id={`${groupId}-${group.state}-${item.id || "local"}`} hidden={closedWorkspaces.has(`${group.state}:${item.id}`)} className={styles.directories}><SessionPathMenu sessionActions={sessionActions} sessions={item.sessions} defaultPath={item.workspace?.defaultWorkingDir} activeId="" onSelect={id => { const session = item.sessions.find(session => session.id === id); if (session) onSelect(session); }} hrefFor={activeSessionHref} variant="workspace" titleMode="path" showGroupControls={false}/></div>
        </section>)}</div>
      </section>)}
      {loading ? <p role="status" className="px-1 py-8 text-center text-[12px] text-[#919793]">Loading sessions…</p> : null}
      {!loading && !visibleGroups.length ? <p className="px-1 py-8 text-center text-[12px] text-[#919793]">{query || filter !== "all" ? "No matching sessions." : "No sessions yet."}</p> : null}
      <div data-dock-tail aria-hidden="true"/>
    </div>
  </section>;
}

// Shared with the sidebar Active Feed so both group and mark sessions identically.
export { groups as activeFeedGroups, StatusMark as ActiveStatusMark, activeState as activeFeedState, activityTime as activeFeedActivityTime };
