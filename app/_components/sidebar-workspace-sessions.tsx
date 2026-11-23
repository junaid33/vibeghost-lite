'use client';

import { SessionTitle } from '@/features/oathkeeper/components/session-title';
import { SessionStatusDot } from '@/features/oathkeeper/components/session-status-dot';

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { WorkspaceActionsMenu } from '@/features/oathkeeper/components/workspace-actions-menu';
import type { SessionManagementAction } from '@/features/oathkeeper/components/workspace-session-manager';
import { SidebarSessionActionsMenu, type SidebarSessionAction } from './sidebar-session-actions-menu';
import type { WorkspacePins } from '@/features/oathkeeper/hooks/use-workspace-pins';
import { SidebarChevron } from './sidebar-icons';
import { Folder, Plus } from '@/components/icons/duo';
import { vibeGhostSessionTarget } from '@/features/oathkeeper/lib/vibeghost-routes';
import { useSidebarVibeGhostHrefs } from './sidebar-vibeghost-root';
import type { VibeGhostSession } from '@/features/oathkeeper/components/vibeghost-view';
import styles from './oathkeeper-sidebar.module.css';
import treeStyles from './sidebar-workspace-sessions.module.css';

type Workspace = { id: string; name: string; defaultWorkingDir?: string };
export function SidebarWorkspaceSessions({ workspace, machine, sessions, activeSession, currentWorkspace, avatar, follow, loading = false, error = '', onRetry, onExpand, pins, pinGroupStart = false, sectionLabel, onCreateSession, onNewSession, creating = false, onSessionAction, onManage, onManageSection }: {
  workspace: Workspace;
  machine?: string;
  sessions: VibeGhostSession[];
  activeSession?: string;
  currentWorkspace: boolean;
  avatar: ReactNode;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onExpand?: () => void;
  pins?: WorkspacePins;
  pinGroupStart?: boolean;
  sectionLabel?: string;
  /** Quick create, in a folder or (without one) the workspace's default directory. */
  onCreateSession: (path?: string) => void;
  onNewSession?: () => void;
  creating?: boolean;
  onSessionAction: (session: VibeGhostSession, action: SidebarSessionAction) => Promise<void>;
  onManage: (action: SessionManagementAction) => void;
  onManageSection: (action: SessionManagementAction) => void;
  follow: (event: MouseEvent<HTMLAnchorElement>, workspace?: string, session?: string) => void;
}) {
  const { href: vibeGhostHref } = useSidebarVibeGhostHrefs();
  const [open, setOpen] = useState(currentWorkspace);
  useEffect(() => { if (currentWorkspace) setOpen(true); }, [currentWorkspace]);
  const groups = new Map<string, VibeGhostSession[]>();
  for (const session of sessions) {
    const path = session.gitRepoPath || session.cwd || workspace.defaultWorkingDir || '';
    const items = groups.get(path) || [];
    items.push(session); groups.set(path, items);
  }
  return <li className={treeStyles.workspace} data-pin-divider={pinGroupStart || undefined}>
    {sectionLabel ? <div className={treeStyles.sectionHeading}><h3 className={treeStyles.sectionLabel}>{sectionLabel}</h3><WorkspaceActionsMenu label={sectionLabel} className={treeStyles.sectionMenu} onManage={onManageSection}/></div> : null}
    <div className={styles.branchRow}>
      <a href={vibeGhostHref(workspace.id)} title={machine ? `${workspace.name} · ${machine}` : workspace.name} onClick={event => follow(event, workspace.id)} aria-current={currentWorkspace && !activeSession ? 'page' : undefined} className={styles.childRow} style={pins ? { paddingRight: 72 } : undefined}>{avatar}<span className="truncate">{workspace.name}</span></a>
      {pins ? <WorkspaceActionsMenu label={workspace.name} className={treeStyles.pin} pinned={pins.isPinned(workspace.id)} pinDisabled={pins.disabled(workspace.id)} onTogglePin={() => pins.toggle(workspace.id)} onCreate={() => onCreateSession()} onNewSession={onNewSession} createDisabled={creating} onManage={onManage}/> : null}
      <button type="button" aria-label={`${open ? 'Collapse' : 'Expand'} ${workspace.name} sessions`} aria-expanded={open} onClick={() => { if (!open) onExpand?.(); setOpen(value => !value); }} className={styles.branchToggle}><SidebarChevron className={styles.chevron} expanded={open}/></button>
    </div>
    <div hidden={!open} className={treeStyles.paths}>
      {groups.size ? [...groups].map(([path, items]) => <SidebarSessionPath key={path} path={path} workspaceId={workspace.id} sessions={items} activeSession={activeSession} follow={follow} onCreateSession={onCreateSession} creating={creating} onSessionAction={onSessionAction}/>) : loading ? <div role="status" aria-label={`Loading ${workspace.name} sessions`} className={treeStyles.skeletons}><span className="sr-only">Loading sessions</span>{[0,1,2].map(i => <span key={i} aria-hidden="true" className={treeStyles.skeleton}/>)}</div> : error ? <div className={treeStyles.load}>Sessions unavailable. <button type="button" onClick={onRetry}>Retry</button></div> : null}
    </div>
  </li>;
}

/** A folder chip and its sessions. Also used by the sidebar Active Feed, which
 *  links into the Active Feed view (`hrefFor`). */
export function SidebarSessionPath({ path, workspaceId, sessions, activeSession, follow, onCreateSession, creating, onSessionAction, hrefFor }: {
  path: string; workspaceId: string; sessions: VibeGhostSession[]; activeSession?: string;
  hrefFor?: (session: VibeGhostSession) => string;
  follow: (event: MouseEvent<HTMLAnchorElement>, workspace?: string, session?: string) => void;
  onCreateSession?: (path?: string) => void;
  creating: boolean;
  onSessionAction: (session: VibeGhostSession, action: SidebarSessionAction) => Promise<void>;
}) {
  const { sessionHref: vibeGhostSessionHref } = useSidebarVibeGhostHrefs();
  const containsActive = sessions.some(session => session.id === activeSession);
  const [open, setOpen] = useState(true);
  useEffect(() => { if (containsActive) setOpen(true); }, [containsActive]);
  const label = path.replace(/\/+$/, '').split('/').filter(Boolean).at(-1) || 'Working directory';
  // VibeGhost's folder row: the chip collapses its sessions; + quick-creates a session in that folder.
  return <div className={treeStyles.path}>
    <div className={treeStyles.pathHead}>
      <button type="button" className={treeStyles.pathToggle} aria-expanded={open} title={path || label} onClick={() => setOpen(value => !value)}>
        <span className={treeStyles.chip}><Folder aria-hidden="true" className={treeStyles.folder}/><span className={treeStyles.pathLabel}>{label}</span><span className={treeStyles.count}>{sessions.length}</span></span>
      </button>
      {onCreateSession ? <button type="button" className={treeStyles.pathCreate} disabled={creating} aria-label={`Quick create session in ${label}`} title="Quick create a session in this folder" onClick={() => onCreateSession(path || undefined)}><Plus/></button> : null}
    </div>
    <ul hidden={!open} aria-label={`${path || label} sessions`} className={treeStyles.sessions}>
      {sessions.map(session => <li key={session.id} className={treeStyles.sessionItem}><a href={hrefFor ? hrefFor(session) : vibeGhostSessionHref({ ...session, workspaceId })} onClick={event => follow(event, workspaceId, vibeGhostSessionTarget(session).session)} aria-label={session.title} title={`${session.title}\n${path}`} aria-current={session.id === activeSession ? 'page' : undefined} data-ended={session.status?.toLowerCase() === 'exited' || undefined} className={treeStyles.session}>
        <span className={treeStyles.spinnerSlot}><SessionStatusDot session={session} selected={session.id === activeSession}/></span><span className={treeStyles.title}><SessionTitle title={session.title} tags={session.tags}/></span>
      </a><span className={treeStyles.sessionAction}><SidebarSessionActionsMenu session={session} onCreate={onCreateSession ? () => onCreateSession(path || undefined) : undefined} createDisabled={creating} onAction={action => onSessionAction(session, action)}/></span></li>)}
    </ul>
  </div>;
}
