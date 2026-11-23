"use client";
import { AppPageHeading } from './app-page-heading';
import { RecordsEmptyState } from './records-empty-state';
import { useId, useRef, useState, type ReactNode } from "react";
import { AddCircle, ArrowUpRightCircle, Copy, IconSquarePlusFillDuo18, MoreHorizontal, Pin, PinFilled, Plus, Unplug, RefreshCw } from "@/components/icons/duo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { promptToolbarControlClass } from "./dual-sidebar/prompt-control-popover";
import type { VibeGhostSession, VibeGhostWorkspace } from "./vibeghost-view";
import { instancePlatformLabel } from "../lib/shared-workspace-model";
import { AppSearchToolbar, ToolbarAction, ToolbarSearch } from './app-search-toolbar';
import { WorkspaceRefreshControl } from './workspace-refresh-control';
import toolbarStyles from './app-search-toolbar.module.css';
import type { WorkspacePins } from '../hooks/use-workspace-pins';
import { partitionWorkspacesByPin } from '../lib/workspace-pins';
import type { WorkspaceRefreshSnapshot } from '../lib/workspace-refresh-status';
import { useScrollFade } from "../hooks/use-horizontal-scroll-fade";
import { isModifiedClick } from '@/lib/modified-click';
import { vibeGhostHref, vibeGhostSessionHref } from '../lib/vibeghost-routes';
import { countLabel, directoryGroups, landingCardStyles as styles, SessionCardList, shortPath, workspaceMeta, workspaceSummary, WorkspaceAvatar } from './vibeghost-landing-cards';

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bb8ff]/70";
// Open rows survive navigating into a workspace and back, like Landing's property rows.
const openWorkspaceRows = new Set<string>();

type Row = { workspace: VibeGhostWorkspace; sessions: VibeGhostSession[] };
type SubGroup = { key: string; label: string; rows: Row[] };
type Group = { key: string; label: string; title?: string; subGroups: SubGroup[] };

/** Landing's state → city → property, as computer → pinned/workspaces → workspace.
 *  With one computer the computer level drops away: Pinned and Workspaces are the cards. */
function groupRows(rows: Row[], pinnedIds: readonly string[]): Group[] {
  const split = (items: Row[]) => {
    const { pinned, unpinned } = partitionWorkspacesByPin(items.map(row => row.workspace), pinnedIds);
    const byId = new Map(items.map(row => [row.workspace.id, row]));
    return { pinned: pinned.map(w => byId.get(w.id)!), unpinned: unpinned.map(w => byId.get(w.id)!) };
  };
  const computers = new Map<string, Row[]>();
  for (const row of rows) { const id = row.workspace.instance?.id || 'unknown-computer'; computers.set(id, [...(computers.get(id) || []), row]); }
  if (computers.size <= 1) {
    const { pinned, unpinned } = split(rows);
    return [{ key: 'pinned', label: 'Pinned', rows: pinned }, { key: 'workspaces', label: 'Workspaces', rows: unpinned }]
      .filter(group => group.rows.length).map(group => ({ key: group.key, label: group.label, subGroups: [{ key: group.key, label: '', rows: group.rows }] }));
  }
  return [...computers].map(([id, items]) => {
    const instance = items[0].workspace.instance;
    const { pinned, unpinned } = split(items);
    return { key: id, label: instance?.name || 'Unknown computer', title: instance ? `${instance.name} · ${instancePlatformLabel(instance.platform)}` : undefined,
      subGroups: [{ key: 'pinned', label: 'Pinned', rows: pinned }, { key: 'workspaces', label: 'Workspaces', rows: unpinned }].filter(group => group.rows.length) };
  });
}
const groupRowCount = (group: Group) => group.subGroups.reduce((count, sub) => count + sub.rows.length, 0);

export function VibeGhostWorkspaceOverview({ workspaces, sessions, loading, error, onSelect, onConnect, onRefresh, onRemove, onRetry, onOpenWorkspace, backgroundRefreshing = false, workspaceChecks = {}, connectionError = '', pins, sessionActions, onQuickCreate, onNewSession, creatingId = '' }: {
  workspaces: VibeGhostWorkspace[];
  sessions: VibeGhostSession[];
  loading: boolean;
  backgroundRefreshing?: boolean;
  workspaceChecks?: WorkspaceRefreshSnapshot;
  connectionError?: string;
  pins?: WorkspacePins;
  error: string;
  onSelect: (id: string) => void;
  onOpenWorkspace?: (id: string) => void;
  onConnect: () => void;
  sessionActions?: (session: VibeGhostSession) => ReactNode;
  /** VibeGhost's Quick create and New session… in each row's ⋯ menu. */
  onQuickCreate?: (workspace: VibeGhostWorkspace) => void;
  onNewSession?: (workspace: VibeGhostWorkspace) => void;
  creatingId?: string;
  onRetry: () => Promise<void>;
  onRefresh: (workspace: VibeGhostWorkspace) => Promise<void>;
  onRemove: (workspace: VibeGhostWorkspace) => void;
}) {
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const refreshPending = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  useScrollFade(listRef, "vertical");
  const needle = query.trim().toLowerCase();
  const rows = workspaces.map((workspace) => ({ workspace, sessions: sessions.filter((session) => session.workspaceId === workspace.id) }))
    .filter(({ workspace, sessions }) => !needle || `${workspace.name} ${workspace.defaultWorkingDir || ''} ${workspace.instance?.name || ''} ${sessions.map((session) => `${session.title} ${session.cwd} ${session.gitRepoPath || ""}`).join(" ")}`.toLowerCase().includes(needle));
  const groups = groupRows(rows, pins?.ids || []);
  const sessionCount = rows.reduce((count, row) => count + row.sessions.length, 0);
  const workingCount = rows.reduce((count, row) => count + workspaceSummary(row.workspace, row.sessions).working, 0);

  const refresh = async () => {
    if (refreshPending.current) return;
    refreshPending.current = true;
    setRefreshing(true);
    try { await onRetry(); }
    finally { refreshPending.current = false; setRefreshing(false); }
  };

  return (
    <section aria-label="Workspace overview" className="mx-auto flex min-h-0 w-full min-w-0 max-w-[1040px] flex-1 flex-col px-3 sm:px-4 text-[#f4f7f5]">
      <AppPageHeading className="shrink-0 pb-5 pt-5 sm:pt-7" title="Workspaces" description="Browse connected workspaces and open their sessions."/>
      {/* Landing's search row: the grouped list below replaces the old workspace filter dropdown. */}
      <AppSearchToolbar label="Workspace controls" className="mb-1">
        <ToolbarSearch label="Search workspaces" placeholder="Search workspaces and sessions…" value={query} onChange={setQuery}/>
        <WorkspaceRefreshControl label="Refresh workspaces" error={error} refreshing={refreshing || backgroundRefreshing} onRefresh={() => void refresh()} className={cn("oathkeeper-raised-control", toolbarStyles.action)}/>
        <ToolbarAction label="Add workspace" title="Connect a workspace" onClick={onConnect}><Plus aria-hidden="true"/></ToolbarAction>
      </AppSearchToolbar>

      {pins?.error ? <p role="alert" className={styles.notice}>{pins.error} <button type="button" onClick={pins.retry}>Retry pins</button></p> : null}
      {/* Spacing below the search lives inside the scroller so the shared fade reaches the bar. */}
      <div ref={listRef} className="scroll-fade-y min-h-0 flex-1 overflow-y-auto px-px pb-5 pt-3">
        {loading && !workspaces.length ? <WorkspaceSkeleton/> : rows.length ? <>
          <div className={styles.summary}><span><strong>{rows.length}</strong> {rows.length === 1 ? 'workspace' : 'workspaces'}</span><span>{countLabel(sessionCount, 'session')}{workingCount ? ` · ${workingCount} working` : ''}</span></div>
          <div className={styles.groups}>
            {groups.map(group => <GroupCard key={group.key} group={group}>
              {group.subGroups.map(sub => <div key={sub.key} className="min-w-0">
                {sub.label ? <div className={styles.subGroupHeader}><h3>{sub.label}</h3><span className={styles.groupCount}>{countLabel(sub.rows.length, 'workspace')}</span></div> : null}
                <div className={styles.rowStack}>
                  {sub.rows.map(({ workspace, sessions }) => <WorkspaceRow key={workspace.id} workspace={workspace} sessions={sessions} pins={pins} onConnect={onConnect} sessionActions={sessionActions} onQuickCreate={onQuickCreate ? () => onQuickCreate(workspace) : undefined} onNewSession={onNewSession ? () => onNewSession(workspace) : undefined} creating={creatingId === workspace.id} sessionsLoading={Boolean(workspaceChecks[workspace.id]?.checking || (!workspace.client && !workspaceChecks[workspace.id] && (loading || backgroundRefreshing)))} sessionsError={workspaceChecks[workspace.id]?.error || (!workspace.client ? connectionError : '')} onSelect={onSelect} onOpen={onOpenWorkspace ? () => onOpenWorkspace(workspace.id) : undefined} onRefresh={() => void onRefresh(workspace)} onRemove={() => onRemove(workspace)}/>)}
                </div>
              </div>)}
            </GroupCard>)}
          </div>
        </> : null}
        {!loading && !rows.length ? <RecordsEmptyState surface="plain" graphic={error ? 'unavailable' : 'records'} title={needle ? 'No matching workspaces' : error ? 'Workspaces unavailable' : 'No workspaces connected'} description={error || (needle ? 'Try another search or clear it.' : 'Connect a VibeGhost workspace with an invite to see its sessions here.')} className="min-h-[min(65dvh,560px)]">
          <button type="button" className={cn(promptToolbarControlClass, focusClass, "h-9 px-4 text-[12px]")} onClick={() => {
            if (needle) setQuery("");
            else if (error) void refresh();
            else onConnect();
          }} disabled={refreshing}>{needle ? "Clear search" : error ? "Retry saved workspaces" : "Use workspace invite"}</button>
        </RecordsEmptyState> : null}
        <div data-dock-tail aria-hidden="true"/>
      </div>
    </section>
  );
}

function GroupCard({ group, children }: { group: Group; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const id = useId();
  return <section className={styles.groupCard} aria-label={`${group.label} workspaces`}>
    <header className={styles.groupHeader} onClick={() => setCollapsed(value => !value)}>
      <h2><button type="button" className={styles.groupToggle} aria-expanded={!collapsed} aria-controls={id} title={group.title} onClick={event => { event.stopPropagation(); setCollapsed(value => !value); }}><span>{group.label}</span></button></h2>
      <span className={styles.groupCount}>{countLabel(groupRowCount(group), 'workspace')}</span>
    </header>
    <div id={id} hidden={collapsed} className={styles.subGroups}>{children}</div>
  </section>;
}

function WorkspaceRow({ workspace, sessions, sessionsLoading, sessionsError, onSelect, onRefresh, onRemove, onOpen, onConnect, pins, sessionActions, onQuickCreate, onNewSession, creating = false }: {
  sessionsLoading: boolean; sessionsError: string;
  pins?: WorkspacePins;
  workspace: VibeGhostWorkspace; sessions: VibeGhostSession[]; onSelect: (id: string) => void; onRefresh: () => void; onRemove: () => void; onOpen?: () => void; onConnect: () => void;
  sessionActions?: (session: VibeGhostSession) => ReactNode;
  onQuickCreate?: () => void; onNewSession?: () => void; creating?: boolean;
}) {
  const [open, setOpenState] = useState(() => openWorkspaceRows.has(workspace.id));
  const toggle = () => setOpenState(value => { if (value) openWorkspaceRows.delete(workspace.id); else openWorkspaceRows.add(workspace.id); return !value; });
  const sessionsId = useId();
  const { path } = workspaceSummary(workspace, sessions);
  const groups = directoryGroups(sessions, workspace.defaultWorkingDir);
  const href = vibeGhostHref(workspace.id);
  // The meta line carries loading and failure too, so a closed row still says what it knows.
  const meta = sessionsLoading && !sessions.length
    ? <span role="status" aria-label={`Loading sessions for ${workspace.name}`} className={styles.rowMeta}>{path ? `${shortPath(path)} · ` : ''}Checking sessions…</span>
    : sessionsError && !sessions.length ? <span className={styles.rowMeta} data-tone="error" title={sessionsError}>Sessions unavailable.</span>
    : <span className={styles.rowMeta} title={path || undefined}>{workspaceMeta(workspace, sessions)}</span>;
  return <article className={styles.row} data-workspace-row={workspace.id}>
    {/* Tapping the row shows its sessions; "Open workspace" lives in the menu, as Landing's "Open property". */}
    <header className={styles.rowHeader} onClick={toggle}>
      <button type="button" className={styles.rowLink} aria-expanded={open} aria-controls={sessionsId} aria-label={`${workspace.name}, ${countLabel(sessions.length, 'session')}`} onClick={event => { event.stopPropagation(); toggle(); }}>
        <WorkspaceAvatar workspace={workspace}/>
        <span className={styles.rowTitle}><span className={styles.rowName}>{workspace.name}</span>{meta}</span>
      </button>
      <span className={styles.rowActions} onClick={event => event.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" className={styles.iconButton} aria-label={`Actions for ${workspace.name}`} title={`Actions for ${workspace.name}`} aria-busy={creating || undefined}><MoreHorizontal aria-hidden="true"/></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><a href={href} onClick={event => { if (isModifiedClick(event) || !onOpen) return; event.preventDefault(); onOpen(); }}><ArrowUpRightCircle className="size-4"/>Open workspace</a></DropdownMenuItem>
            {onQuickCreate ? <DropdownMenuItem disabled={!workspace.client || creating} onSelect={onQuickCreate}><IconSquarePlusFillDuo18 className="size-4"/>{creating ? 'Creating session…' : 'Quick create'}</DropdownMenuItem> : null}
            {onNewSession ? <DropdownMenuItem disabled={!workspace.client} onSelect={onNewSession}><AddCircle className="size-4"/>New session…</DropdownMenuItem> : null}
            <DropdownMenuSeparator/>
            {pins ? <DropdownMenuItem disabled={pins.disabled(workspace.id)} onSelect={() => pins.toggle(workspace.id)}>{pins.isPinned(workspace.id) ? <PinFilled className="size-4"/> : <Pin className="size-4"/>}{pins.isPinned(workspace.id) ? 'Unpin workspace' : 'Pin workspace'}</DropdownMenuItem> : null}
            {path ? <DropdownMenuItem onSelect={() => void navigator.clipboard?.writeText(path)}><Copy className="size-4"/>Copy path</DropdownMenuItem> : null}
            <DropdownMenuItem onSelect={onRefresh}><RefreshCw className="size-4"/>Refresh workspace</DropdownMenuItem>
            <DropdownMenuItem onSelect={onConnect}><Plus className="size-4"/>Add workspace…</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onRemove}><Unplug className="size-4"/>Disconnect workspace</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </header>
    <div id={sessionsId} hidden={!open} className={styles.sessions}>
      {open ? <>{groups.map(group => <div key={group.path} className="contents">
        <div className={styles.sessionsLabel}><span className="min-w-0 truncate" title={group.path}>{group.path ? shortPath(group.path) : 'Working directory not recorded'}</span><span className="shrink-0">{countLabel(group.sessions.length, 'session')}</span></div>
        <SessionCardList sessions={group.sessions} hrefFor={vibeGhostSessionHref} onSelect={onSelect} sessionActions={sessionActions}/>
      </div>)}
      {!sessions.length ? sessionsLoading ? <p className={styles.sessionsNote}>Checking sessions…</p>
        : sessionsError ? <div className={styles.sessionsNote}><p>Sessions unavailable.</p><button type="button" onClick={onRefresh}>Retry</button></div>
        : <div className={styles.sessionsNote}><p>No sessions in this workspace.</p>{onQuickCreate && workspace.client ? <button type="button" disabled={creating} onClick={onQuickCreate}>{creating ? 'Creating…' : 'Quick create'}</button> : null}</div> : null}</> : null}
    </div>
  </article>;
}

function WorkspaceSkeleton() {
  return <div role="status" aria-label="Loading workspaces" className={styles.groups}>
    <span className="sr-only">Loading workspaces</span>
    {[5, 3].map((count, card) => <div key={card} aria-hidden="true" className={styles.groupCard}>
      <div className={styles.groupHeader}><span className={cn(styles.skeleton, "h-2.5 w-20")}/><span className={cn(styles.skeleton, "ml-auto h-2 w-16")}/></div>
      <div className={cn(styles.rowStack, "mt-1")}>{Array.from({ length: count }, (_, index) => <div key={index} className={styles.rowHeader}>
        <span className={cn(styles.skeleton, "size-[30px] shrink-0 rounded-[9px]")}/><span className="grid min-w-0 flex-1 gap-1.5"><span className={cn(styles.skeleton, "h-2.5", index % 2 ? "w-1/3" : "w-1/2")}/><span className={cn(styles.skeleton, "h-2", index % 2 ? "w-1/2" : "w-2/3")}/></span>
      </div>)}</div>
    </div>)}
  </div>;
}
