"use client";

import { useId, useState, type ReactNode } from 'react';
import { ChevronRight, FolderTree, Plus, Trash2 } from '@/components/icons/duo';
import { cn } from '@/lib/utils';
import type { VibeGhostSession } from './vibeghost-view';
import { SessionCardMetadata } from './session-card-metadata';
import { SessionStatusDot } from './session-status-dot';
import styles from './session-path-menu.module.css';
import { isModifiedClick } from '@/lib/modified-click';

const SESSION_PREVIEW_LIMIT = 5;
const activityTime = (session: VibeGhostSession) => { const value = Date.parse(session.lastModified || session.startedAt || ''); return Number.isFinite(value) ? value : 0; };

export function SessionPathMenu({ sessions, activeId, defaultPath = '', onSelect, hrefFor, onRemove, sessionActions, onCreateInPath, creating = false, variant = 'menu', titleMode = 'session', showGroupControls = true, defaultOpen = true, expansionState }: {
  sessions: VibeGhostSession[];
  activeId: string;
  defaultPath?: string;
  onSelect: (id: string) => void;
  /** With a path per session, rows are links: plain clicks select, Cmd/middle clicks open a new tab. */
  hrefFor?: (session: VibeGhostSession) => string;
  onRemove?: (session: VibeGhostSession) => void;
  /** A row menu (stop, delete, resume…) shown beside each session. */
  sessionActions?: (session: VibeGhostSession) => ReactNode;
  /** Page cards: VibeGhost's + in each folder's header, quick-creating a session in that folder. */
  onCreateInPath?: (path: string) => void;
  creating?: boolean;
  variant?: 'menu' | 'workspace' | 'page';
  titleMode?: 'path' | 'session';
  showGroupControls?: boolean;
  defaultOpen?: boolean;
  expansionState?: Map<string, boolean>;
}) {
  const groups = new Map<string, { path: string; sessions: VibeGhostSession[] }>();
  for (const session of sessions) {
    const path = session.gitRepoPath || session.cwd || defaultPath;
    const key = path;
    const group = groups.get(key) || { path, sessions: [] };
    group.sessions.push(session);
    groups.set(key, group);
  }
  return <div className={cn(variant === 'page' ? 'space-y-6' : variant === 'workspace' ? styles.workspaceList : 'space-y-2', variant === 'menu' ? 'p-2' : 'p-0')} data-session-path-menu>{[...groups].map(([key, { path, sessions: items }]) => <SessionPathGroup key={key} path={path} sessions={items} activeId={activeId} onSelect={onSelect} hrefFor={hrefFor} onRemove={onRemove} sessionActions={sessionActions} onCreateInPath={onCreateInPath} creating={creating} variant={variant} titleMode={titleMode} showGroupControls={showGroupControls} defaultOpen={defaultOpen} expansionState={expansionState}/>)}</div>;
}

function SessionPathGroup({ path, sessions, activeId, onSelect, hrefFor, onRemove, sessionActions, onCreateInPath, creating, variant, titleMode, showGroupControls, defaultOpen, expansionState }: {
  path: string;
  sessions: VibeGhostSession[];
  activeId: string;
  onSelect: (id: string) => void;
  hrefFor?: (session: VibeGhostSession) => string;
  onRemove?: (session: VibeGhostSession) => void;
  /** A row menu (stop, delete, resume…) shown beside each session. */
  sessionActions?: (session: VibeGhostSession) => ReactNode;
  onCreateInPath?: (path: string) => void;
  creating: boolean;
  variant: 'menu' | 'workspace' | 'page';
  titleMode: 'path' | 'session';
  showGroupControls: boolean;
  defaultOpen: boolean;
  expansionState?: Map<string, boolean>;
}) {
  const expansionKey = JSON.stringify([sessions[0]?.workspaceId || 'local', path]);
  const [open, setOpen] = useState(() => expansionState?.get(expansionKey) ?? defaultOpen);
  const workspace = variant === 'workspace';
  const bodyId = useId();
  const label = path || 'Working directory not recorded';
  // Home-relative for scanning; the full path stays in the title tooltip.
  const shortLabel = label.replace(/^\/(?:Users|home)\/[^/]+(?=\/|$)/, '~');
  const pathTitle = path.replace(/\/+$/, '').split('/').filter(Boolean).at(-1) || 'Working directory';
  const groupTitle = titleMode === 'path' ? pathTitle : sessions.length === 1 ? sessions[0].title : `${sessions.length} sessions`;
  // Long directories show their most recent sessions first, then one row to reveal the rest.
  const [showAll, setShowAll] = useState(false);
  const truncated = variant !== 'menu' && sessions.length > SESSION_PREVIEW_LIMIT + 1;
  const ordered = truncated ? [...sessions].sort((left, right) => activityTime(right) - activityTime(left)) : sessions;
  const shown = truncated && !showAll ? ordered.filter((session, index) => index < SESSION_PREVIEW_LIMIT || session.id === activeId) : ordered;
  const sessionCards = <div className={styles.sessionList}>{shown.map(session => <div key={session.id} data-selected={session.id === activeId} data-exited={session.status === 'exited'} className={styles.session}>
    <div className={styles.sessionInner}>
      {hrefFor ? <a href={hrefFor(session)} data-lab-menu-row data-multiline aria-label={`Session ${session.title}${session.status === 'exited' ? ', exited' : ''}`} aria-current={session.id === activeId ? 'true' : undefined} title={session.title} onClick={event => { if (isModifiedClick(event)) return; event.preventDefault(); onSelect(session.id); }} className={styles.sessionButton}>
        <SessionStatusDot session={session} bright selected={session.id === activeId} className={styles.sessionDot}/>
        <span data-session-copy className={styles.sessionCopy}><span data-session-title className={styles.sessionTitle}>{session.title}</span><SessionCardMetadata session={session}/></span>
      </a> : <button type="button" data-lab-menu-row data-multiline aria-label={`Session ${session.title}${session.status === 'exited' ? ', exited' : ''}`} aria-current={session.id === activeId ? 'true' : undefined} title={session.title} onClick={() => onSelect(session.id)} className={styles.sessionButton}>
        <SessionStatusDot session={session} bright selected={session.id === activeId} className={styles.sessionDot}/>
        <span data-session-copy className={styles.sessionCopy}><span data-session-title className={styles.sessionTitle}>{session.title}</span><SessionCardMetadata session={session}/></span>
      </button>}
      {sessionActions ? <span className={styles.sessionActions}>{sessionActions(session)}</span> : null}
      {onRemove ? <button type="button" aria-label={`Remove ${session.title}`} onClick={() => onRemove(session)} className={styles.removeButton}><Trash2 className="size-3.5"/></button> : null}
    </div>
  </div>)}
    {truncated ? <button type="button" aria-expanded={showAll} onClick={() => setShowAll(value => !value)} className={styles.showAll}>
      <span aria-hidden="true" className={styles.moreDot}/>{showAll ? 'Show fewer' : `Show ${sessions.length - shown.length} more`}
    </button> : null}
  </div>;
  if (variant === 'page') return <section aria-labelledby={bodyId} data-session-path-group className={cn(styles.pathCard, styles.pageCard)}>
    <div className={cn(styles.pagePathHeader, styles.pageBand)}><span className={styles.pathCopy}><h2 id={bodyId}>{pathTitle}</h2><span className={styles.fullPath} title={label}>{shortLabel}</span></span><span className={styles.pathCount}>{sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}</span>{onCreateInPath ? <button type="button" disabled={creating} aria-label={`Quick create session in ${shortLabel}`} title="Quick create a session in this folder" onClick={() => onCreateInPath(path)} className={styles.pathCreate}><Plus aria-hidden="true"/></button> : null}</div>
    <div className={styles.sessionBody}>{sessionCards}</div>
  </section>;
  return <section aria-label={label} data-session-path-group className={cn(styles.pathCard, !workspace && styles.menuPathCard)}>
    <button type="button" aria-label={workspace && titleMode === 'session' ? label : undefined} aria-expanded={open} aria-controls={bodyId} title={label} onClick={() => { expansionState?.set(expansionKey, !open); setOpen(!open); }} className={cn(styles.pathHeader, showGroupControls && styles.pathHeaderWithControls)}>
      {showGroupControls ? <><ChevronRight aria-hidden="true" className={cn(styles.pathChevron, open && styles.pathChevronOpen)}/><FolderTree aria-hidden="true" className={styles.pathIcon}/></> : null}
      {workspace ? <span className={styles.pathCopy}><span className={styles.pathTitle}>{groupTitle}</span><span className={styles.fullPath}>{shortLabel}</span></span> : <span className={styles.menuPathLabel}>{label}</span>}
      <span className={styles.pathCount}>{sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}</span>
      {/* Collapsible rows need a visible affordance even without the group controls. */}
      {workspace && !showGroupControls ? <ChevronRight aria-hidden="true" className={cn(styles.pathChevron, styles.trailingChevron, open && styles.pathChevronOpen)}/> : null}
    </button>
    <div id={bodyId} hidden={!open} className={cn(styles.sessionBody, !workspace && styles.menuSessionBody)}>{sessionCards}</div>
  </section>;
}

