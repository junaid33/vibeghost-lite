'use client';

import { Spinner } from "@/components/ui/spinner";
import { ChevronLeft, Copy, MoreHorizontal, Pin, PinFilled, Plus, RefreshCw } from '@/components/icons/duo';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { instancePlatformLabel } from '../lib/shared-workspace-model';
import { navigateVibeGhost, vibeGhostHref, vibeGhostSessionHref, vibeGhostWorkspacesHref } from '../lib/vibeghost-navigation';
import { isModifiedClick } from '@/lib/modified-click';
import { RecordsEmptyState } from './records-empty-state';
import type { WorkspacePins } from '../hooks/use-workspace-pins';
import type { ReactNode } from 'react';
import type { VibeGhostSession, VibeGhostWorkspace } from './vibeghost-view';
import { countLabel, directoryGroups, landingCardStyles as styles, SessionCardList, shortDate, shortPath, workspaceSummary, WorkspaceAvatar } from './vibeghost-landing-cards';

/** One workspace, laid out as Landing's property page: a back link to the grouped list
 *  (which replaces the old switcher dropdown), a hero band with stats, then one titled
 *  card per directory holding its sessions. */
export function VibeGhostWorkspacePage({ workspace, sessions, missingSession, loading, error, onSelect, onRetry, onConnect, pins, sessionActions, onQuickCreate, creating = false }: {
  workspace?: VibeGhostWorkspace;
  pins?: WorkspacePins;
  /** Kept for callers; switching now happens from the grouped Workspaces list. */
  workspaces?: VibeGhostWorkspace[];
  sessions: VibeGhostSession[];
  missingSession: boolean;
  loading: boolean;
  error: string;
  onSelect: (id: string) => void;
  onRetry: () => void;
  onConnect: () => void;
  sessionActions?: (session: VibeGhostSession) => ReactNode;
  /** Quick create in a folder (a + on each folder card). */
  onQuickCreate?: (path: string) => void;
  creating?: boolean;
}) {
  const button = "oathkeeper-raised-control px-3 py-2 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bb8ff]";
  if (!workspace || missingSession) return <RecordsEmptyState surface="plain" graphic={loading ? 'loading' : 'unavailable'} title={loading ? 'Opening workspace…' : missingSession && workspace ? 'Session unavailable' : 'Workspace unavailable'} description={loading ? 'Reconnecting your saved workspace invite.' : error || (missingSession && workspace ? 'This session may have ended or been removed. Retry, or choose another session in this workspace.' : 'This workspace is not available from your saved connections. Retry or connect a workspace invite.')}>
    {!loading ? <div className="flex flex-wrap gap-2"><button className={button} onClick={onRetry}>Retry connection</button>{workspace ? <a href={vibeGhostHref(workspace.id)} className={button} onClick={event => { if (isModifiedClick(event)) return; event.preventDefault(); navigateVibeGhost(workspace.id); }}>Open workspace</a> : <button className={button} onClick={onConnect}>Connect workspace invite</button>}</div> : null}
  </RecordsEmptyState>;
  const { working, updated, path, directories } = workspaceSummary(workspace, sessions);
  const groups = directoryGroups(sessions, workspace.defaultWorkingDir);
  const pinned = pins?.isPinned(workspace.id) ?? false;
  const stats = [
    { label: 'Sessions', value: String(sessions.length) },
    { label: 'Working', value: String(working), tone: working ? styles.statWorking : '' },
    { label: 'Directories', value: String(directories) },
    { label: 'Updated', value: updated ? shortDate(updated) : '—' },
  ];
  return <section aria-label={`${workspace.name} workspace`} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain text-[#f4f7f5]">
    <div className="mx-auto w-full max-w-[1040px] px-3 pb-5 pt-5 sm:px-4 sm:py-7">
      <a href={vibeGhostWorkspacesHref()} className={styles.backButton} onClick={event => { if (isModifiedClick(event)) return; event.preventDefault(); navigateVibeGhost(undefined, undefined, 'workspaces'); }}><ChevronLeft aria-hidden="true"/>All workspaces</a>
      <section className={styles.hero} aria-labelledby="vibeghost-workspace-title">
        <div className={styles.heroBand}>
          <WorkspaceAvatar workspace={workspace} size="hero"/>
          <div className={styles.heroTitle}>
            <span className={styles.heroEyebrow}>{workspace.instance ? `${workspace.instance.name} · ${instancePlatformLabel(workspace.instance.platform)}` : 'Shared workspace'}</span>
            <h1 id="vibeghost-workspace-title">{workspace.name}</h1>
            <p title={path || undefined}>{path ? shortPath(path) : 'Shared terminal sessions'}</p>
          </div>
          <div className={styles.heroActions}>
            {pins ? <button type="button" className={styles.iconButton} aria-label={`${pinned ? 'Unpin' : 'Pin'} ${workspace.name} workspace`} title={pinned ? 'Unpin workspace' : 'Pin workspace'} aria-pressed={pinned} disabled={pins.disabled(workspace.id)} onClick={() => pins.toggle(workspace.id)}>{pinned ? <PinFilled aria-hidden="true"/> : <Pin aria-hidden="true"/>}</button> : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><button type="button" className={styles.iconButton} aria-label={`Actions for ${workspace.name}`} title={`Actions for ${workspace.name}`}><MoreHorizontal aria-hidden="true"/></button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onQuickCreate ? <DropdownMenuItem disabled={creating} onSelect={() => onQuickCreate(path)}><Plus className="size-4"/>{creating ? 'Creating session…' : 'Quick create'}</DropdownMenuItem> : null}
                {path ? <DropdownMenuItem onSelect={() => void navigator.clipboard?.writeText(path)}><Copy className="size-4"/>Copy path</DropdownMenuItem> : null}
                <DropdownMenuItem disabled={loading} onSelect={onRetry}>{loading ? <Spinner className="size-4"/> : <RefreshCw className="size-4"/>}{loading ? 'Refreshing…' : error ? 'Retry refresh' : 'Refresh workspace'}</DropdownMenuItem>
                <DropdownMenuSeparator/>
                <DropdownMenuItem onSelect={onConnect}><Plus className="size-4"/>Add workspace…</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className={styles.heroStats}>{stats.map(stat => <div key={stat.label} className={styles.stat}><span>{stat.label}</span><strong className={stat.tone}>{stat.value}</strong></div>)}</div>
        {!workspace.client ? <p role="status" className={styles.heroFootnote}>Showing saved session details. A fresh connection is required before terminal input is enabled.</p> : null}
      </section>
      {pins?.error ? <p role="alert" className={styles.notice}>{pins.error} <button type="button" onClick={pins.retry}>Retry pins</button></p> : null}
      {error ? <p role="alert" className={styles.notice}>{error}</p> : null}
      {groups.map(group => <section key={group.path} className={styles.detailCard} aria-label={group.path || 'Working directory not recorded'} data-session-path-group>
        <header className={styles.detailCardBand}>
          <h2>{group.path.replace(/\/+$/, '').split('/').filter(Boolean).at(-1) || 'Working directory'}</h2>
          <span className={styles.detailPath} title={group.path}>{group.path ? shortPath(group.path) : ''}</span>
          <span className={styles.groupCount}>{countLabel(group.sessions.length, 'session')}</span>
          {onQuickCreate ? <button type="button" disabled={creating} aria-label={`Quick create session in ${shortPath(group.path)}`} title="Quick create a session in this folder" onClick={() => onQuickCreate(group.path)} className={styles.iconButton}><Plus aria-hidden="true"/></button> : null}
        </header>
        <div className={styles.detailList}><SessionCardList sessions={group.sessions} hrefFor={vibeGhostSessionHref} onSelect={onSelect} sessionActions={sessionActions}/></div>
      </section>)}
      {!sessions.length ? loading ? <div role="status" aria-label="Loading sessions" className={styles.detailCard}><span className="sr-only">Loading sessions</span><div aria-hidden="true" className={styles.detailCardBand}><span className={`${styles.skeleton} h-2.5 w-24`}/></div><div aria-hidden="true" className={styles.detailList}>{[0, 1, 2].map(i => <div key={i} className={`${styles.session} h-[50px]`}/>)}</div></div>
        : error ? <RecordsEmptyState surface="plain" graphic="unavailable" title="Sessions unavailable" description="Retry the connection to load this workspace’s sessions."><button className={button} onClick={onRetry}>Retry connection</button></RecordsEmptyState> : null : null}
      <div data-dock-tail aria-hidden="true"/>
    </div>
  </section>;
}
