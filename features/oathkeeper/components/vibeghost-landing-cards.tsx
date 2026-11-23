"use client";

import { useState, type ReactNode } from "react";
import { WorkspaceMark } from "./vibeghost-workspace-icon";
import { isModifiedClick } from "@/lib/modified-click";
import { sessionActivity } from "./vibeghost-session-activity";
import { SessionStatusDot } from "./session-status-dot";
import { formatSessionRelativeTime, useSessionClock } from "./session-card-metadata";
import type { VibeGhostSession, VibeGhostWorkspace } from "./vibeghost-view";
import styles from "./vibeghost-landing-cards.module.css";

export { styles as landingCardStyles };

const SESSION_PREVIEW_LIMIT = 5;
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
export const countLabel = plural;

/** Home-relative, as in the session cards; the full path stays in tooltips. */
export const shortPath = (path: string) => path.replace(/^\/(?:Users|home)\/[^/]+(?=\/|$)/, "~");
export const sessionPath = (session: VibeGhostSession, fallback = "") => session.gitRepoPath || session.cwd || fallback;
const activityTime = (session: VibeGhostSession) => { const value = Date.parse(session.lastModified || session.startedAt || ""); return Number.isFinite(value) ? value : 0; };

/** Landing's short date: 10/31 this year, 10/31/2025 otherwise. */
export function shortDate(timestamp: number) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const value = `${date.getMonth() + 1}/${date.getDate()}`;
  return date.getFullYear() === new Date().getFullYear() ? value : `${value}/${date.getFullYear()}`;
}

/** Real numbers for a workspace's meta line and stats. */
export function workspaceSummary(workspace: VibeGhostWorkspace, sessions: VibeGhostSession[]) {
  const working = sessions.filter(session => sessionActivity(session).state === "working").length;
  const updated = sessions.reduce((latest, session) => Math.max(latest, activityTime(session)), 0);
  const paths = new Map<string, number>();
  for (const session of sessions) { const path = sessionPath(session, workspace.defaultWorkingDir); if (path) paths.set(path, (paths.get(path) || 0) + 1); }
  const path = workspace.defaultWorkingDir || [...paths].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  return { working, updated, path, directories: paths.size };
}

export function workspaceMeta(workspace: VibeGhostWorkspace, sessions: VibeGhostSession[]) {
  const { working, updated, path } = workspaceSummary(workspace, sessions);
  return [path ? shortPath(path) : "", plural(sessions.length, "session"), working ? `${working} working` : "", updated ? `Updated ${shortDate(updated)}` : ""].filter(Boolean).join(" · ");
}

/** Sessions grouped by directory, most recently active directory first. */
export function directoryGroups(sessions: VibeGhostSession[], fallback = "") {
  const groups = new Map<string, VibeGhostSession[]>();
  for (const session of sessions) { const path = sessionPath(session, fallback); groups.set(path, [...(groups.get(path) || []), session]); }
  return [...groups].map(([path, items]) => ({ path, sessions: [...items].sort((a, b) => activityTime(b) - activityTime(a)) }))
    .sort((a, b) => activityTime(b.sessions[0]) - activityTime(a.sessions[0]));
}

export function WorkspaceAvatar({ workspace, size = "row" }: { workspace: VibeGhostWorkspace; size?: "row" | "hero" }) {
  return <span className={size === "hero" ? styles.heroIcon : styles.avatar}>
    <WorkspaceMark workspace={workspace}/>
  </span>;
}

const AGENTS: Record<string, string> = { pi: "Pi", codex: "Codex", claude: "Claude" };
function sessionAgent(session: VibeGhostSession) {
  const tag = (session.tags || []).map(value => typeof value === "string" ? value.trim().toLowerCase() : "").find(value => AGENTS[value]);
  const provider = tag || session.agentIdentity?.provider;
  return provider ? AGENTS[provider] : "";
}

/** Agent · branch · last activity, on one muted line under the title. */
function SessionMeta({ session }: { session: VibeGhostSession }) {
  const now = useSessionClock();
  const agent = sessionAgent(session);
  const timestamp = session.lastModified || session.startedAt;
  const relative = formatSessionRelativeTime(timestamp, now);
  // No status words: the dot and the card's surface carry the state.
  const parts = [agent, session.gitBranch || "", relative || ""].filter(Boolean);
  return <span className={styles.sessionMeta}>{parts.join(" · ") || "Terminal"}</span>;
}

/** One session in Landing's unit card: dot on the title line, title, meta, ⋯. */
export function SessionCardRow({ session, href, onSelect, actions }: { session: VibeGhostSession; href?: string; onSelect: (id: string) => void; actions?: ReactNode }) {
  const label = `Session ${session.title}${session.status === "exited" ? ", exited" : ""}`;
  const body = <><SessionStatusDot session={session} bright className={styles.sessionDot}/><span className={styles.sessionTitle}>{session.title}</span><SessionMeta session={session}/></>;
  return <div className={styles.session} data-exited={session.status === "exited"} data-session-row>
    {href ? <a href={href} aria-label={label} title={session.title} className={styles.sessionLink} onClick={event => { if (isModifiedClick(event)) return; event.preventDefault(); onSelect(session.id); }}>{body}</a>
      : <button type="button" aria-label={label} title={session.title} className={styles.sessionLink} onClick={() => onSelect(session.id)}>{body}</button>}
    {actions ? <span className={styles.sessionActions}>{actions}</span> : null}
  </div>;
}

/** A directory's sessions, newest first, with Landing's "Show N more" row past five. */
export function SessionCardList({ sessions, hrefFor, onSelect, sessionActions }: { sessions: VibeGhostSession[]; hrefFor?: (session: VibeGhostSession) => string; onSelect: (id: string) => void; sessionActions?: (session: VibeGhostSession) => ReactNode }) {
  const [showAll, setShowAll] = useState(false);
  const truncated = sessions.length > SESSION_PREVIEW_LIMIT + 1;
  const shown = truncated && !showAll ? sessions.slice(0, SESSION_PREVIEW_LIMIT) : sessions;
  return <>
    {shown.map(session => <SessionCardRow key={session.id} session={session} href={hrefFor?.(session)} onSelect={onSelect} actions={sessionActions?.(session)}/>)}
    {truncated ? <button type="button" aria-expanded={showAll} onClick={() => setShowAll(value => !value)} className={styles.showMore}><span aria-hidden="true" className={styles.moreDot}/>{showAll ? "Show fewer" : `Show ${sessions.length - shown.length} more`}</button> : null}
  </>;
}
