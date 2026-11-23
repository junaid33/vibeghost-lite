"use client";

import { useCallback, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Check, CloseCircle, RefreshCw, StopCircle } from '@/components/icons/duo';
import { HalftoneDots } from '@/components/ui/halftone-dots';
import { cn } from '@/lib/utils';
import { useScrollFade } from '../hooks/use-horizontal-scroll-fade';
import { isPendingAgentAction } from '../lib/shared-agent-actions';
import { KitDialog, KitFooter, dialogKitStyles as kit, kitCancelClass, kitDangerClass, kitPrimaryClass } from './dialog-kit';
import { formatSessionRelativeTime } from './session-card-metadata';
import { SessionAgentMarks } from './session-title';
import styles from './workspace-session-manager.module.css';

export type SessionManagementAction = 'resume' | 'stop' | 'delete';
export type ManagedSession = { id: string; name: string; status?: string; canResume: boolean; tags?: string[]; lastActive?: string };

const COPY = {
  resume: { title: 'Resume sessions', verb: 'Resume', running: 'Resuming', done: 'Resumed', Icon: RefreshCw, empty: 'Nothing to resume', emptyDetail: 'No exited agent session here can be resumed.' },
  stop: { title: 'Stop sessions', verb: 'Stop', running: 'Stopping', done: 'Stopped', Icon: StopCircle, empty: 'Nothing running', emptyDetail: 'No session here is running.' },
  delete: { title: 'Delete exited sessions', verb: 'Delete', running: 'Deleting', done: 'Deleted', Icon: CloseCircle, empty: 'Nothing to delete', emptyDetail: 'No session here has exited.' },
} as const;
const AGENT_TAGS = new Set(['pi', 'claude', 'codex']);

type Step = 'queued' | 'working' | 'done' | 'pending' | 'failed' | 'skipped';
type RunItem = ManagedSession & { step: Step; error?: string };
const plural = (count: number) => `${count} ${count === 1 ? 'session' : 'sessions'}`;
const isEligible = (action: SessionManagementAction, session: ManagedSession) =>
  action === 'resume' ? session.status === 'exited' && session.canResume : action === 'delete' ? session.status === 'exited' : session.status === 'running';

function stepTag(action: SessionManagementAction, step: Step): { label: string; tone?: string } | null {
  if (step === 'working') return { label: COPY[action].running, tone: 'working' };
  if (step === 'done') return { label: COPY[action].done, tone: 'done' };
  if (step === 'pending') return { label: 'Verifying', tone: 'pending' };
  if (step === 'failed') return { label: 'Failed', tone: 'failed' };
  if (step === 'skipped') return { label: 'Not run' };
  return null;
}

/** Blue while the session is running, gray once it has exited, red when the action failed. */
function dotTone(action: SessionManagementAction, session: ManagedSession, step?: Step) {
  if (step === 'failed') return 'failed';
  const running = step === 'done' || step === 'pending' ? action === 'resume' : session.status === 'running';
  return running ? 'live' : undefined;
}

/** The band's scroll area; the card being worked on keeps itself in view unless you've just scrolled. */
function SessionBand({ label, container, touchedAt, children }: { label: string; container: RefObject<HTMLDivElement | null>; touchedAt: RefObject<number>; children: ReactNode }) {
  useScrollFade(container, 'vertical');
  const touched = () => { touchedAt.current = Date.now(); };
  return <div ref={container} className={cn(styles.scroll, 'scroll-fade-y')} role="region" aria-label={label} tabIndex={0} onWheel={touched} onTouchMove={touched} onKeyDown={touched}>{children}</div>;
}

function SessionCardBody({ action, session, now, step, selectable, selected }: { action: SessionManagementAction; session: RunItem | ManagedSession; now: number; step?: Step; selectable?: boolean; selected?: boolean }) {
  const tag = step ? stepTag(action, step) : null;
  const relative = formatSessionRelativeTime(session.lastActive, now);
  const agent = session.tags?.some(tag => AGENT_TAGS.has(tag.trim().toLowerCase()));
  const error = 'error' in session ? session.error : undefined;
  return <>
    {step === 'working' ? <HalftoneDots className={styles.halftone} color="#b5d0ff" spacing={5}/> : null}
    <span className={styles.dot} data-tone={dotTone(action, session, step)} aria-hidden="true"/>
    <span className={styles.head}>
      <strong>{session.name}</strong>
      {tag ? <span className={styles.tag} data-tone={tag.tone}>{tag.label}</span> : selectable ? <span className={styles.check} aria-hidden="true">{selected ? <Check/> : null}</span> : null}
    </span>
    {agent || relative ? <span className={styles.meta}>{agent ? <SessionAgentMarks tags={session.tags}/> : null}{relative ? <time dateTime={session.lastActive}>{relative}</time> : null}</span> : null}
    {error ? <small className={styles.error}>{error}</small> : null}
  </>;
}

/** Shared presentation; each app supplies its own authenticated transport. */
export function WorkspaceSessionManager({ action, workspaceName, sessions, onAction, onRefresh, onClose }: {
  action: SessionManagementAction; workspaceName: string; sessions: ManagedSession[];
  onAction: (action: SessionManagementAction, id: string) => Promise<unknown>;
  onRefresh: () => Promise<unknown>; onClose: () => void;
}) {
  const copy = COPY[action];
  const [now] = useState(() => Date.now());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [run, setRun] = useState<RunItem[] | null>(null);
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const lock = useRef(false);
  const cancelRequested = useRef(false);
  const container = useRef<HTMLDivElement>(null);
  const touchedAt = useRef(0);

  const eligible = sessions.filter(session => !completed.has(session.id) && isEligible(action, session))
    .sort((a, b) => (Date.parse(b.lastActive ?? '') || 0) - (Date.parse(a.lastActive ?? '') || 0));
  const targets = eligible.filter(session => selected.has(session.id));
  const allSelected = eligible.length > 0 && targets.length === eligible.length;
  const toggle = (id: string, on: boolean) => {
    setConfirming(false);
    setSelected(previous => { const next = new Set(previous); if (on) next.add(id); else next.delete(id); return next; });
  };

  const follow = useCallback((element: HTMLLIElement | null) => {
    const scroller = container.current;
    if (!element || !scroller || Date.now() - touchedAt.current < 4000) return;
    const top = element.offsetTop, bottom = top + element.offsetHeight;
    if (top >= scroller.scrollTop && bottom <= scroller.scrollTop + scroller.clientHeight) return;
    scroller.scrollTo({ top: Math.max(0, top - (scroller.clientHeight - element.offsetHeight) / 2), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, []);

  const start = async () => {
    if (lock.current || !targets.length) return;
    lock.current = true;
    cancelRequested.current = false;
    const batch = targets;
    setConfirming(false); setCancelling(false); setRefreshFailed(false); setRunning(true);
    setRun(batch.map(session => ({ ...session, step: 'queued' })));
    const update = (id: string, patch: Partial<RunItem>) => setRun(items => items?.map(item => item.id === id ? { ...item, ...patch } : item) ?? null);
    const succeeded = new Set<string>();
    try {
      for (const target of batch) {
        if (cancelRequested.current) { update(target.id, { step: 'skipped' }); continue; }
        update(target.id, { step: 'working' });
        try {
          const result = await onAction(action, target.id);
          succeeded.add(target.id);
          update(target.id, { step: isPendingAgentAction(result) ? 'pending' : 'done' });
        } catch (error) {
          update(target.id, { step: 'failed', error: error instanceof Error ? error.message : 'Action failed' });
        }
      }
      setCompleted(previous => new Set([...previous, ...succeeded]));
      setSelected(previous => new Set([...previous].filter(id => !succeeded.has(id))));
      try { await onRefresh(); } catch { setRefreshFailed(true); }
    } finally { lock.current = false; setRunning(false); }
  };

  const total = run?.length ?? 0;
  const finished = run?.filter(item => item.step !== 'queued' && item.step !== 'working').length ?? 0;
  const succeededCount = run?.filter(item => item.step === 'done' || item.step === 'pending').length ?? 0;
  const failedCount = run?.filter(item => item.step === 'failed').length ?? 0;
  const progress = total ? running ? finished / total : 1 : 0;
  const stats = [
    { label: copy.done, value: String(succeededCount), tone: succeededCount ? 'done' : undefined },
    { label: 'Failed', value: String(failedCount), tone: failedCount ? 'failed' : undefined },
    { label: 'Finished', value: `${finished}/${total}`, tone: undefined },
  ];
  const eligibleLabel = action === 'resume' ? 'can be resumed' : action === 'stop' ? 'running' : 'exited';
  const title = !run ? copy.title : running ? `${copy.running} ${plural(total)}` : succeededCount === total ? `${copy.done} ${plural(total)}` : `${copy.done} ${succeededCount} of ${total}`;
  const description = !run ? eligible.length ? `${workspaceName} · ${eligible.length} ${eligibleLabel}` : workspaceName : running ? `${workspaceName} · ${finished} of ${total}` : workspaceName;

  const footer = running ? <KitFooter>
    <button type="button" disabled={cancelling} onClick={() => { cancelRequested.current = true; setCancelling(true); }} className={kitCancelClass}>{cancelling ? 'Cancelling…' : 'Cancel remaining'}</button>
  </KitFooter> : run ? <KitFooter error={refreshFailed ? 'Couldn’t refresh the session list.' : undefined}>
    <button type="button" onClick={() => setRun(null)} className={kitCancelClass}>Back</button>
    <button type="button" onClick={onClose} className={kitPrimaryClass}>Done</button>
  </KitFooter> : <KitFooter notice={confirming && action === 'delete' ? 'Their recordings are removed for good.' : undefined}>
    <button type="button" onClick={confirming ? () => setConfirming(false) : onClose} className={kitCancelClass}>{confirming ? 'Back' : 'Cancel'}</button>
    <button type="button" disabled={!targets.length} onClick={() => { if (action !== 'resume' && !confirming) setConfirming(true); else void start(); }} className={confirming ? kitDangerClass : kitPrimaryClass}>
      {confirming ? `Confirm ${copy.verb.toLowerCase()} (${targets.length})` : targets.length ? `${copy.verb} (${targets.length})` : copy.verb}
    </button>
  </KitFooter>;

  const items = run ?? eligible;
  return <KitDialog open onOpenChange={open => { if (!open) onClose(); }} busy={running} icon={<copy.Icon/>} title={title} description={description} closeLabel={`Close ${copy.title.toLowerCase()}`} footer={footer}>
    {run ? <div className={styles.progress} data-running={running || undefined} role="progressbar" aria-label={`${copy.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><span style={{ transform: `scaleX(${Math.min(1, Math.max(.02, progress))})` }}/></div> : null}
    {run ? <div className={styles.stats}>{stats.map(stat => <div key={stat.label} className={styles.stat}><span>{stat.label}</span><strong data-tone={stat.tone}>{stat.value}</strong></div>)}</div> : null}
    <section className={kit.section}>
      <div className={styles.captionRow}>
        <span className={kit.caption}>Sessions <span className={styles.count}>{run ? `${finished}/${total}` : eligible.length ? `${targets.length}/${eligible.length}` : ''}</span></span>
        {!run && eligible.length ? <button type="button" className={styles.selectAll} onClick={() => { setConfirming(false); setSelected(allSelected ? new Set() : new Set(eligible.map(session => session.id))); }}>{allSelected ? 'Clear' : 'Select all'}</button> : null}
      </div>
      <div className={kit.group}>
        {items.length ? <SessionBand label="Sessions" container={container} touchedAt={touchedAt}><ul className={styles.list}>
          {run ? run.map(item => <li key={item.id} ref={item.step === 'working' ? follow : undefined} className={styles.card} data-step={item.step} data-action={action}>
            <SessionCardBody action={action} session={item} now={now} step={item.step}/>
          </li>) : eligible.map(session => <li key={session.id}>
            <label className={styles.card} data-selected={selected.has(session.id) || undefined}>
              <input type="checkbox" className="sr-only" checked={selected.has(session.id)} onChange={event => toggle(session.id, event.target.checked)}/>
              <SessionCardBody action={action} session={session} now={now} selectable selected={selected.has(session.id)}/>
            </label>
          </li>)}
        </ul></SessionBand> : <div className={styles.empty}><strong>{copy.empty}</strong><small>{copy.emptyDetail}</small></div>}
      </div>
    </section>
  </KitDialog>;
}
