'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import styles from './oathkeeper-sidebar.module.css';
import { SidebarGlyph, SidebarChevron } from './sidebar-icons';
import { Columns3, Sparkles, Workspaces } from '@/components/icons/duo';
import { ActiveWorkspaceAvatar } from './active-workspace-avatar';
import { SidebarWorkspaceSection } from './sidebar-workspace-section';
import { SidebarWorkspaceSessions } from './sidebar-workspace-sessions';
import { SidebarActiveFeed } from './sidebar-active-feed';
import type { SidebarSessionAction } from './sidebar-session-actions-menu';
import { WorkspaceMark } from '@/features/oathkeeper/components/vibeghost-workspace-icon';
import type { VibeGhostSession, VibeGhostWorkspace } from '@/features/oathkeeper/components/vibeghost-view';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { SharedSessionManagement, type SessionManagementScope } from '@/features/oathkeeper/components/shared-session-management';
import { performSessionAction } from '@/features/oathkeeper/lib/session-actions';
import { groupWorkspacesByComputer, partitionWorkspacesByPin } from '@/features/oathkeeper/lib/workspace-pins';
import { workspaceMachineLabel } from '@/features/oathkeeper/components/session-picker-workspaces';
import { useVibeGhostDirectory } from '@/features/oathkeeper/hooks/use-vibeghost-directory';
import { useVibeGhostQuickCreate } from '@/features/oathkeeper/hooks/use-vibeghost-quick-create';
import { SharedSessionEditor } from '@/features/oathkeeper/components/shared-session-editor';
import { navigateVibeGhost, useVibeGhostLocation, type VibeGhostSection } from '@/features/oathkeeper/lib/vibeghost-navigation';
import { VibeGhostV2DirectoryProvider } from '@/features/oathkeeper/hooks/use-vibeghost-v2-directory';
import { SidebarVibeGhostRootContext, useSidebarVibeGhostHrefs, type SidebarVibeGhostRoot } from './sidebar-vibeghost-root';
import { isModifiedClick } from '@/lib/modified-click';

type Entry = VibeGhostWorkspace;
type NavProps = { active: boolean; collapsed: boolean; onClose?: () => void };
/** VibeGhost v2's branch: the same tree as VibeGhost's, read from the v2 directory, linking into /vibeghost-v2. */
export function VibeGhostV2SidebarNav(props: NavProps) {
  return <SidebarVibeGhostRootContext.Provider value="/vibeghost-v2"><VibeGhostV2DirectoryProvider><VibeGhostSidebarNav {...props}/></VibeGhostV2DirectoryProvider></SidebarVibeGhostRootContext.Provider>;
}
const underRoot = (pathname: string, root: SidebarVibeGhostRoot) => pathname === root || pathname.startsWith(`${root}/`);
export function VibeGhostSidebarNav({ active, collapsed, onClose }: NavProps) {
  const router = useRouter();
  const { root, href: vibeGhostHref } = useSidebarVibeGhostHrefs();
  const appName = 'VibeGhost';
  const location = useVibeGhostLocation();
  const { pins, directory, workspaceChecks, loadingWorkspaces, savedWorkspaceError, loadSavedWorkspaces, ensureDirectoryFresh, refreshWorkspaceSessions } = useVibeGhostDirectory();
  const [open, setOpen] = useState(active);
  const [menuOpen, setMenuOpen] = useState(false);
  const [management, setManagement] = useState<SessionManagementScope | null>(null);
  const [sessionNotice, setSessionNotice] = useState('');
  // Quick create (a folder, else the workspace's default directory) and New session… (the dialog), as in VibeGhost.
  const quick = useVibeGhostQuickCreate();
  const [newSessionFor, setNewSessionFor] = useState<Entry | null>(null);
  const creatingWorkspaceId = quick.creatingId, createError = quick.error;
  const manage = (action: SessionManagementScope['action'], targets: Entry[], label: string) => { void ensureDirectoryFresh(); setManagement({ action, ids: targets.map(w => w.id), label }); };
  // Bulk actions on an explicit set of sessions (a sidebar Active Feed group).
  const manageSessions = (action: SessionManagementScope['action'], targets: VibeGhostSession[], label: string) => { void ensureDirectoryFresh(); setManagement({ action, ids: [...new Set(targets.flatMap(session => session.workspaceId ? [session.workspaceId] : []))], label, sessionIds: targets.map(session => session.id) }); };
  const quickCreate = (workspace: Entry, path?: string) => quick.quickCreate(workspace, path, (workspaceId, sessionId) => go(workspaceId, sessionId));
  const actOnSession = async (workspace: Entry, session: VibeGhostSession, action: SidebarSessionAction) => {
    setSessionNotice('');
    const result = await performSessionAction(workspace, session, action);
    if (result.pending) setSessionNotice('New terminal started; identity verification is pending. Check the new terminal before repeating this action.');
    // Refresh the session's own workspace so a resumed or forked session is listed before it opens.
    await refreshWorkspaceSessions(workspace).catch(() => loadSavedWorkspaces());
    if (result.openSessionId) go(workspace.id, result.openSessionId, location.view === 'active' ? 'active' : undefined);
  };
  useEffect(() => { if (active) setOpen(true); }, [active]);
  // v1's owner loads its list on every page; v2's owner waits to be asked, so its branch asks once here.
  useEffect(() => { if (root !== '/vibeghost') void ensureDirectoryFresh(); }, [root, ensureDirectoryFresh]);
  const error = Boolean(savedWorkspaceError);
  const go = (workspace?: string, session?: string, view?: VibeGhostSection) => {
    setMenuOpen(false);
    navigateVibeGhost(workspace, session, view);
    onClose?.();
  };
  const follow = (event: MouseEvent<HTMLAnchorElement>, workspace?: string, session?: string, view?: VibeGhostSection) => {
    if (isModifiedClick(event)) return;
    event.preventDefault(); go(workspace, session, view);
  };
  const icon = <SidebarGlyph name="vibeghost"/>;
  const groups = partitionWorkspacesByPin(directory.workspaces, pins.ids);
  const rows: Entry[] = [...groups.pinned, ...groups.unpinned];
  const sections = [
    ...(groups.pinned.length ? [{ key: 'pinned', label: 'Pinned', items: groups.pinned }] : []),
    ...groupWorkspacesByComputer(groups.unpinned, workspaceMachineLabel).map(group => ({ key: `computer:${group.id}`, label: group.label, items: group.items })),
  ];
  const avatar = (item: Entry) => <WorkspaceMark workspace={item} className="size-4"/>;
  const current = (id: string) => active && location.workspace === id;
  const landingCurrent = active && !location.view && !location.workspace && !location.session;
  const activeFeedCurrent = active && location.view === 'active' && !location.session;
  const tabsCurrent = active && location.view === 'tabs';
  const timelineCurrent = active && location.view === 'timeline' && !location.session;
  const workspacesCurrent = active && location.view === 'workspaces' && !location.session;
  const workspacesIcon = <Workspaces className="size-4" aria-hidden="true"/>;
  const tabsIcon = <Columns3 className="size-4" aria-hidden="true"/>;
  const timelineIcon = <Sparkles className="size-4" aria-hidden="true"/>;
  const activeFeedIcon = <ActiveWorkspaceAvatar/>;
  const linkClass = cn(styles.row, 'flex min-h-8 w-full min-w-0 items-center rounded-control px-2 text-left text-[13px] transition-colors hover:bg-hover-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal');
  if (collapsed) return <div className="grid justify-items-center gap-1"><DropdownMenu open={menuOpen} onOpenChange={value => { setMenuOpen(value); if (value) void ensureDirectoryFresh(); }}><DropdownMenuTrigger asChild><button type="button" aria-label={appName} title={appName} data-sidebar-active={active} className={cn(linkClass, 'justify-center px-0', active && 'bg-hover-2')}>{icon}</button></DropdownMenuTrigger><DropdownMenuContent side="right" align="start" aria-label={`${appName} workspaces`} className="max-h-[70dvh] overflow-y-auto"><DropdownMenuItem asChild><a href={vibeGhostHref()} onClick={event => follow(event)} aria-current={landingCurrent ? 'page' : undefined}>{icon}<span className="min-w-0 flex-1 truncate">{appName}</span></a></DropdownMenuItem><DropdownMenuItem asChild><a href={vibeGhostHref(undefined, undefined, 'workspaces')} onClick={event => follow(event, undefined, undefined, 'workspaces')} aria-current={workspacesCurrent ? 'page' : undefined}>{workspacesIcon}<span className="min-w-0 flex-1 truncate">Workspaces</span></a></DropdownMenuItem><DropdownMenuItem asChild><a href={vibeGhostHref(undefined, undefined, 'active')} onClick={event => follow(event, undefined, undefined, 'active')} aria-current={activeFeedCurrent ? 'page' : undefined}>{activeFeedIcon}<span className="min-w-0 flex-1 truncate">Active Feed</span></a></DropdownMenuItem><DropdownMenuItem asChild><a href={vibeGhostHref(undefined, undefined, 'tabs')} onClick={event => follow(event, undefined, undefined, 'tabs')} aria-current={tabsCurrent ? 'page' : undefined}>{tabsIcon}<span className="min-w-0 flex-1 truncate">Tabs</span></a></DropdownMenuItem><DropdownMenuItem asChild><a href={vibeGhostHref(undefined, undefined, 'timeline')} onClick={event => follow(event, undefined, undefined, 'timeline')} aria-current={timelineCurrent ? 'page' : undefined}>{timelineIcon}<span className="min-w-0 flex-1 truncate">Timeline</span></a></DropdownMenuItem>{rows.map(item => <DropdownMenuItem key={item.id} asChild><a href={vibeGhostHref(item.id)} onClick={event => follow(event, item.id)} aria-current={current(item.id) ? 'page' : undefined}>{avatar(item)}<span className="min-w-0 flex-1 truncate">{item.name}</span></a></DropdownMenuItem>)}{error ? <DropdownMenuItem onSelect={() => void loadSavedWorkspaces()}>Retry workspace list</DropdownMenuItem> : null}</DropdownMenuContent></DropdownMenu>{sections.map(section => <div key={section.key} className="grid justify-items-center gap-1"><hr className="my-2 w-6 border-white/10"/>{section.items.map(item => <a key={item.id} href={vibeGhostHref(item.id)} title={`${item.name} · ${workspaceMachineLabel(item)}`} aria-label={item.name} aria-current={current(item.id) ? 'page' : undefined} onClick={event => follow(event, item.id)} className={cn('grid size-9 place-items-center rounded-lg hover:bg-white/5', current(item.id) && 'bg-blue-500/15')}>{avatar(item)}</a>)}</div>)}</div>;
  return <Collapsible open={open} onOpenChange={setOpen} className="shrink-0">
    <div data-sidebar-branch className={styles.branchRow}><a href={vibeGhostHref()} title={appName} onClick={event => follow(event)} data-sidebar-group={root === '/vibeghost' ? 'vibeghost' : 'vibeghost-v2'} className={linkClass}>{icon}<span className="ml-2 truncate font-medium">{appName}</span></a><button type="button" aria-label={`${open ? 'Collapse' : 'Expand'} ${appName} workspaces`} aria-expanded={open} onClick={() => { if (!open) void ensureDirectoryFresh(); setOpen(value => !value); }} className={styles.branchToggle}><SidebarChevron expanded={open} className={styles.chevron}/></button></div>
    <CollapsibleContent className={styles.subnav}><ul aria-label={`${appName} workspaces`} className={styles.tree}><li><a href={vibeGhostHref(undefined, undefined, 'workspaces')} onClick={event => follow(event, undefined, undefined, 'workspaces')} aria-current={workspacesCurrent ? 'page' : undefined} className={styles.childRow}>{workspacesIcon}<span className="truncate">Workspaces</span></a></li><li><a href={vibeGhostHref(undefined, undefined, 'tabs')} onClick={event => follow(event, undefined, undefined, 'tabs')} aria-current={tabsCurrent ? 'page' : undefined} className={styles.childRow}>{tabsIcon}<span className="truncate">Tabs</span></a></li><li><a href={vibeGhostHref(undefined, undefined, 'timeline')} onClick={event => follow(event, undefined, undefined, 'timeline')} aria-current={timelineCurrent ? 'page' : undefined} className={styles.childRow}>{timelineIcon}<span className="truncate">Timeline</span></a></li><SidebarActiveFeed sessions={directory.sessions} workspaces={directory.workspaces} current={activeFeedCurrent} activeSession={active && location.view === 'active' ? directory.sessions.find(session => (session.remoteSessionId || session.id) === location.session)?.id : undefined} creatingWorkspaceId={creatingWorkspaceId} follow={follow} onCreateSession={(workspace, path) => void quickCreate(workspace, path)} onSessionAction={actOnSession} onManageSessions={manageSessions}/>{loadingWorkspaces && !rows.length ? <li role="status" aria-label="Loading workspaces" className="space-y-2 p-2"><span className="sr-only">Loading workspaces</span>{[0,1,2].map(i => <div key={i} aria-hidden="true" className="h-8 rounded bg-white/[.06] motion-safe:animate-pulse"/>)}</li> : null}{sections.map((group, index) => <SidebarWorkspaceSection key={group.key} label={group.label} divider={index > 0} onManage={action => manage(action, group.items, group.label === 'Pinned' ? 'Pinned workspaces' : group.label)}>{group.items.map(item => <SidebarWorkspaceSessions key={item.id} workspace={item} machine={workspaceMachineLabel(item)} sessions={directory.sessions.filter(session => session.workspaceId === item.id)} currentWorkspace={current(item.id)} activeSession={active ? directory.sessions.find(session => session.workspaceId === item.id && (session.remoteSessionId || session.id) === location.session)?.id : undefined} avatar={avatar(item)} follow={follow} onCreateSession={path => void quickCreate(item, path)} onNewSession={() => setNewSessionFor(item)} creating={creatingWorkspaceId === item.id} onSessionAction={(session, action) => actOnSession(item, session, action)} onManage={action => manage(action, [item], item.name)} onManageSection={action => manage(action, group.items, group.label === 'Pinned' ? 'Pinned workspaces' : group.label)} onExpand={() => void ensureDirectoryFresh()} pins={pins} loading={Boolean(workspaceChecks[item.id]?.checking || (!workspaceChecks[item.id] && loadingWorkspaces))} error={workspaceChecks[item.id]?.error || savedWorkspaceError} onRetry={() => void loadSavedWorkspaces()}/>)}</SidebarWorkspaceSection>)}{sessionNotice ? <li role="status" className="px-3 py-2 text-[11px] text-ink-3">{sessionNotice}</li> : null}{createError ? <li role="alert" className="px-3 py-2 text-[11px] text-[#e89a94]">{createError} <button type="button" onClick={quick.clearError} className="underline">Dismiss</button></li> : null}{pins.error ? <li role="alert" className="px-3 py-2 text-[11px] text-[#e89a94]">{pins.error} <button type="button" onClick={pins.retry} className="underline">Retry pins</button></li> : null}{error ? <li><button type="button" onClick={() => void loadSavedWorkspaces()} className={cn(linkClass, 'text-ink-3')}>Retry workspace list</button></li> : null}</ul></CollapsibleContent>
    {newSessionFor ? <SharedSessionEditor mode="create" workspace={newSessionFor} onClose={() => setNewSessionFor(null)} onSaved={async id => { const workspace = newSessionFor; try { await refreshWorkspaceSessions(workspace); } catch { await loadSavedWorkspaces(); } if (id) go(workspace.id, id); }}/> : null}
    {management ? <SharedSessionManagement key={`${management.ids.join(',')}:${management.sessionIds?.join(',') ?? '*'}:${management.action}`} scope={management} onClose={() => setManagement(null)}/> : null}
  </Collapsible>;
}
