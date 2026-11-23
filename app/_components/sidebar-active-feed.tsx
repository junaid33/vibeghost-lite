'use client';

// The Active Feed as a sidebar section, matching VibeGhost's sidebar: the same
// status groups as the Active Feed view (Needs you, Working, Finished, Idle,
// Stopped), each built like a workspace row (mark, name, ··· and chevron) over
// the workspace tree's folder chips.
import { useId, useState, type MouseEvent } from 'react';
import type { VibeGhostSession, VibeGhostWorkspace } from '@/features/oathkeeper/components/vibeghost-view';
import { activeFeedActivityTime, activeFeedGroups, activeFeedState, ActiveStatusMark } from '@/features/oathkeeper/components/vibeghost-active-feed';
import { WorkspaceActionsMenu } from '@/features/oathkeeper/components/workspace-actions-menu';
import type { SessionManagementAction } from '@/features/oathkeeper/components/workspace-session-manager';
import { useSidebarVibeGhostHrefs } from './sidebar-vibeghost-root';
import type { SidebarSessionAction } from './sidebar-session-actions-menu';
import { SidebarSessionPath } from './sidebar-workspace-sessions';
import { SidebarChevron } from './sidebar-icons';
import styles from './oathkeeper-sidebar.module.css';
import treeStyles from './sidebar-workspace-sessions.module.css';
import feedStyles from './sidebar-active-feed.module.css';

const VISIBLE_PER_GROUP = 5;
const CLOSED_BY_DEFAULT = ['idle', 'stopped'];

export function SidebarActiveFeed({ sessions, workspaces, activeSession, current, creatingWorkspaceId, follow, onCreateSession, onSessionAction, onManageSessions }: {
  sessions: VibeGhostSession[];
  workspaces: VibeGhostWorkspace[];
  activeSession?: string;
  /** True on the Active Feed view itself (not one of its sessions). */
  current: boolean;
  creatingWorkspaceId: string;
  follow: (event: MouseEvent<HTMLAnchorElement>, workspace?: string, session?: string, view?: 'active') => void;
  onCreateSession: (workspace: VibeGhostWorkspace, path?: string) => void;
  onSessionAction: (workspace: VibeGhostWorkspace, session: VibeGhostSession, action: SidebarSessionAction) => Promise<void>;
  /** Resume/stop/delete scoped to exactly these sessions. */
  onManageSessions: (action: SessionManagementAction, sessions: VibeGhostSession[], label: string) => void;
}) {
  const id = useId();
  const { href: vibeGhostHref, sessionHref } = useSidebarVibeGhostHrefs();
  const [open, setOpen] = useState(true);
  const [closed, setClosed] = useState<Set<string>>(() => new Set(CLOSED_BY_DEFAULT));
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (set: Set<string>, key: string) => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); return next; };
  const ordered = [...sessions].sort((left, right) => activeFeedActivityTime(right) - activeFeedActivityTime(left));
  const groups = activeFeedGroups.map(group => ({ ...group, sessions: ordered.filter(session => activeFeedState(session) === group.state) })).filter(group => group.sessions.length);
  const live = groups.filter(group => group.state !== 'stopped').reduce((count, group) => count + group.sessions.length, 0);
  return <li className={treeStyles.workspace} data-active-feed-section>
    <div className={treeStyles.sectionHeading}>
      <h3 className={treeStyles.sectionLabel}>
        <a href={vibeGhostHref(undefined, undefined, 'active')} onClick={event => follow(event, undefined, undefined, 'active')} aria-current={current ? 'page' : undefined} className={feedStyles.headingLink} title="Open the Active Feed">
          Active Feed{live ? <span className={feedStyles.headingCount}>{live}</span> : null}
        </a>
      </h3>
      <button type="button" className={styles.branchToggle} aria-label={`${open ? 'Collapse' : 'Expand'} Active Feed`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}><SidebarChevron expanded={open} className={styles.chevron}/></button>
    </div>
    <ul id={id} hidden={!open} aria-label="Active sessions by status" className={treeStyles.sectionItems}>
      {groups.length ? groups.map(group => {
        const groupOpen = !closed.has(group.state);
        const showAll = expanded.has(group.state);
        const visible = showAll ? group.sessions : group.sessions.slice(0, VISIBLE_PER_GROUP);
        // Same folder chips as the workspace tree: one per working directory.
        const folders = new Map<string, VibeGhostSession[]>();
        for (const session of visible) {
          const key = `${session.workspaceId || 'local'}\u0000${session.gitRepoPath || session.cwd || ''}`;
          folders.set(key, [...(folders.get(key) || []), session]);
        }
        return <li key={group.state} className={treeStyles.workspace}>
          <div className={styles.branchRow}>
            <a href={vibeGhostHref(undefined, undefined, 'active')} title={group.subtitle} onClick={event => follow(event, undefined, undefined, 'active')} className={styles.childRow} style={{ paddingRight: 72 }}>
              <span className={feedStyles.groupMark} data-active-status={group.state}><ActiveStatusMark state={group.state}/></span>
              <span className="min-w-0 flex-1 truncate">{group.title}<span className={feedStyles.groupCount}>{group.sessions.length}</span></span>
            </a>
            <WorkspaceActionsMenu label={`${group.title} sessions`} className={treeStyles.pin} onManage={action => onManageSessions(action, group.sessions, `${group.title} sessions`)}/>
            <button type="button" aria-label={`${groupOpen ? 'Collapse' : 'Expand'} ${group.title} sessions`} aria-expanded={groupOpen} onClick={() => setClosed(current => toggle(current, group.state))} className={styles.branchToggle}><SidebarChevron className={styles.chevron} expanded={groupOpen}/></button>
          </div>
          <div hidden={!groupOpen} className={treeStyles.paths}>
            {[...folders].map(([key, items]) => {
              const workspace = workspaces.find(item => item.id === items[0].workspaceId);
              return <SidebarSessionPath key={key} path={items[0].gitRepoPath || items[0].cwd || ''} workspaceId={items[0].workspaceId || ''} sessions={items} activeSession={activeSession}
                hrefFor={session => sessionHref(session, 'active')}
                follow={(event, workspaceId, session) => follow(event, workspaceId, session, 'active')}
                onCreateSession={workspace ? path => onCreateSession(workspace, path) : undefined} creating={creatingWorkspaceId === workspace?.id}
                onSessionAction={(session, action) => workspace ? onSessionAction(workspace, session, action) : Promise.reject(new Error('Workspace connection unavailable.'))}/>;
            })}
            {group.sessions.length > VISIBLE_PER_GROUP ? <button type="button" className={feedStyles.more} onClick={() => setExpanded(current => toggle(current, group.state))}>
              {showAll ? 'Show fewer' : `Show ${group.sessions.length - VISIBLE_PER_GROUP} more`}
            </button> : null}
          </div>
        </li>;
      }) : <li><p className={feedStyles.empty}>No sessions yet.</p></li>}
    </ul>
  </li>;
}
