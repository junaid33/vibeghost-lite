"use client";

import { useCallback, useState, type ReactNode } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "@/components/icons/duo";
import { ChevronRight } from "@/components/icons/duo";
import styles from "./session-picker-menu.module.css";
import { SessionStatusDot, type SessionDotSource } from "./session-status-dot";
import { plural } from "@/lib/plural";

export type PickerAction = { label: string; displayLabel?: string; icon: ReactNode; run: () => void; disabled?: boolean; keepOpen?: boolean };
/** `unavailable` keeps a session visible but unselectable, with the reason shown in its row. */
export type PickerSession = { id: string; title: string; path: string; metadata: ReactNode; activity?: SessionDotSource; exited?: boolean; actions?: PickerAction[]; unavailable?: string };
export type PickerWorkspace = { id: string; name: string; avatar: ReactNode; detail?: string; pinned?: boolean; sessions: PickerSession[]; actions: PickerAction[] };

const homeRelative = (path: string) => path.replace(/^\/(?:Users|home)\/[^/]+(?=\/|$)/, '~');

/** Active Feed aesthetic: a fixed title row over one scrolling body; each
 *  workspace is a noisy card with a recessed title band, directories are flat
 *  rows, and sessions are raised rows. All rows stay real Radix menu items. */
export function SessionPickerMenu({ workspaces, activeId, onSelect, headerAction, notice, search, footer, side = "top", align = "start" }: {
  workspaces: PickerWorkspace[]; activeId: string; onSelect: (id: string) => void; headerAction?: PickerAction; notice?: ReactNode;
  /** Items pinned under the scroll body (the Kanban card's Unlink). */
  footer?: PickerAction[];
  /** A search field under the title row; the caller filters `workspaces` by its value. */
  search?: { value: string; onChange: (value: string) => void; label: string };
  side?: "top" | "bottom"; align?: "start" | "end";
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  // The rows mount afresh on every open, so the current session's row brings itself into view as it appears.
  const showCurrent = useCallback((row: HTMLDivElement | null) => { row?.scrollIntoView({ block: "center" }); }, []);
  const hasPinned = workspaces.some(workspace => workspace.pinned);
  return <DropdownMenuContent data-session-picker aria-label="Workspaces and sessions" side={side} align={align} sideOffset={8} collisionPadding={8} className={styles.menu}>
    {/* Outside the scroll body, so it can never scroll away. */}
    <div className={styles.heading}><span>Workspaces</span>{headerAction ? <ActionButton action={headerAction}/> : null}</div>
    {/* Typing stays in the field: the menu's own typeahead and arrow keys don't see it (Arrow Down, Tab and Escape still reach the menu). */}
    {search ? <div className={styles.search}><input type="search" value={search.value} placeholder="Search" aria-label={search.label} autoComplete="off" spellCheck={false}
      onChange={event => search.onChange(event.target.value)} onKeyDown={event => { if (!["ArrowDown", "Tab", "Escape"].includes(event.key)) event.stopPropagation(); }}/></div> : null}
    <div data-session-picker-body className={styles.body}>
      {notice}
      {[true, false].map(pinned => {
        const section = workspaces.filter(workspace => Boolean(workspace.pinned) === pinned);
        if (!section.length) return null;
        return <div role="group" aria-label={pinned ? "Pinned workspaces" : "Workspaces"} key={String(pinned)} className={styles.section}>
          {hasPinned ? <DropdownMenuItem textValue={pinned ? "Pinned" : "Workspaces"} className={styles.sectionLabel} data-section={pinned ? "pinned" : "workspaces"} aria-expanded={!collapsedSections.has(String(pinned))} onSelect={event => { event.preventDefault(); setCollapsedSections(previous => { const next = new Set(previous); const key = String(pinned); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }}>
            {/* Same heading treatment as the Active Feed status groups: mark, title, count. */}
            <svg className={styles.sectionMark} viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.6" opacity=".65"/></svg>
            <span>{pinned ? "Pinned" : "Workspaces"}</span>
            <span className={styles.sectionCount}>{section.length}</span>
          </DropdownMenuItem> : null}
          {hasPinned && collapsedSections.has(String(pinned)) ? null : section.map(workspace => {
            const open = !collapsed.has(workspace.id);
            const groups = new Map<string, PickerSession[]>();
            workspace.sessions.forEach(session => groups.set(session.path, [...(groups.get(session.path) || []), session]));
            return <div role="group" aria-label={workspace.name} key={workspace.id} className={styles.workspace}>
              <div className={styles.workspaceHeader} data-has-actions={workspace.actions.length > 0 || undefined}>
                <DropdownMenuItem textValue={workspace.name} className={styles.workspaceToggle} aria-expanded={open} onSelect={event => { event.preventDefault(); setCollapsed(previous => { const next = new Set(previous); if (next.has(workspace.id)) next.delete(workspace.id); else next.add(workspace.id); return next; }); }}>
                  {workspace.avatar}<span className={styles.workspaceCopy}><span>{workspace.name}</span><small>{workspace.detail || plural(workspace.sessions.length, "session")}</small></span><ChevronRight className={styles.chevron} style={{transform: open ? "rotate(90deg)" : undefined}}/>
                </DropdownMenuItem>
                {workspace.actions.length ? <WorkspaceActionMenu actions={workspace.actions}/> : null}
              </div>
              {open ? [...groups].map(([directory, sessions]) => <div role="group" aria-label={directory || "Sessions"} key={directory} className={styles.path}>
                {directory ? <DropdownMenuLabel className={styles.pathLabel} title={directory}><span>{directory.replace(/\/+$/, '').split('/').filter(Boolean).at(-1) || directory}</span><small>{homeRelative(directory)}</small></DropdownMenuLabel> : null}
                {sessions.map(session => <div key={session.id} ref={session.id === activeId ? showCurrent : undefined} className={styles.sessionRow}>
                  <DropdownMenuItem textValue={session.title} className={styles.session} disabled={Boolean(session.unavailable)} data-unavailable={session.unavailable ? true : undefined} data-selected={session.id === activeId} data-exited={session.exited || undefined} aria-current={session.id === activeId ? "page" : undefined} aria-label={`${session.title}${session.exited ? ", exited" : ""}${session.unavailable ? `. ${session.unavailable}` : ""}`} onSelect={() => onSelect(session.id)}>
                    <SessionStatusDot session={session.activity ?? { status: session.exited ? 'exited' : 'running', state: 'Running' }} selected={session.id === activeId}/>
                    <span className={styles.sessionCopy}><span className={styles.sessionTitle}>{session.title}</span>{session.metadata}{session.unavailable ? <span className={styles.unavailable}>{session.unavailable}</span> : null}</span>
                  </DropdownMenuItem>
                  {session.actions?.map(action => <Action key={action.label} action={action}/>)}
                </div>)}
              </div>) : null}
              {open && !workspace.sessions.length ? <p className={styles.empty}>No sessions yet.</p> : null}
            </div>;
          })}
        </div>;
      })}
    </div>
    {footer?.length ? <div className={styles.footer}>{footer.map(action => <DropdownMenuItem key={action.label} textValue={action.label} disabled={action.disabled} className={styles.footerItem} onSelect={action.run}>{action.icon}<span>{action.displayLabel ?? action.label}</span></DropdownMenuItem>)}</div> : null}
  </DropdownMenuContent>;
}
function Action({ action }: { action: PickerAction }) {
  return <DropdownMenuItem textValue={action.label} aria-label={action.label} title={action.label} disabled={action.disabled} onSelect={event => { if (action.keepOpen) event.preventDefault(); action.run(); }}>{action.icon}<span className={styles.actionLabel}>{action.displayLabel ?? action.label}</span></DropdownMenuItem>;
}
function ActionButton({ action }: { action: PickerAction }) {
  return <button type="button" aria-label={action.label} title={action.label} disabled={action.disabled} className={styles.headerAction} onClick={action.run}>{action.icon}</button>;
}
function WorkspaceActionMenu({ actions }: { actions: PickerAction[] }) {
  return <DropdownMenu modal={false}><DropdownMenuTrigger asChild><button type="button" aria-label="Workspace actions" title="Workspace actions" className={styles.action}><MoreHorizontal className="size-3.5"/></button></DropdownMenuTrigger><DropdownMenuContent aria-label="Workspace actions" side="right" align="start" sideOffset={6} collisionPadding={8} className={styles.actionsMenu}>{actions.map(action => <Action key={action.label} action={action}/>)}</DropdownMenuContent></DropdownMenu>;
}
