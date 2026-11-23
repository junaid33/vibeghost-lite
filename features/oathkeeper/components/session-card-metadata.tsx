'use client';

import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import type { VibeGhostSession } from './vibeghost-view';
import { SessionAgentMarks } from './session-title';
import titleStyles from './session-title.module.css';
import { formatSessionRelativeTime } from '../lib/session-relative-time';

// One clock shared by visible card consumers, not one timer per session.
let now = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
function tick() {
  if (document.visibilityState === 'hidden') return;
  now = Date.now();
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    now = Date.now();
    timer = setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { clearInterval(timer); document.removeEventListener('visibilitychange', tick); }
  };
}
const snapshot = () => now;
const serverSnapshot = () => 0;
/** The shared 30s clock, for other session meta lines. 0 until mounted. */
export const useSessionClock = () => useSyncExternalStore(subscribe, snapshot, serverSnapshot);

export { formatSessionRelativeTime } from '../lib/session-relative-time';

const AGENT_MARK_TAGS = new Set(['pi', 'claude', 'codex']);

export function SessionCardMetadata({ session, separated = false }: { session: VibeGhostSession; separated?: boolean }) {
  const now = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  // Agent tags are shown as a logo beside the time, so only other tags appear as text.
  const tags = [...new Set((session.tags || []).filter(tag => typeof tag === 'string').map(tag => tag.trim().toLowerCase()).filter(tag => tag && !AGENT_MARK_TAGS.has(tag)))];
  const timestamp = session.lastModified || session.startedAt;
  const relative = formatSessionRelativeTime(timestamp, now);
  const source = session.activityTimeSource || 'terminal';
  const title = source === 'pi' ? 'Last Pi conversation message' : source === 'codex' ? 'Last Codex conversation activity' : 'Last terminal activity';
  const colors: Record<string, string> = { dev: 'text-blue-300', droid: 'text-purple-300' };
  const agent = (session.tags || []).some(tag => typeof tag === 'string' && AGENT_MARK_TAGS.has(tag.trim().toLowerCase()));
  if (!tags.length && !relative && !agent && session.status !== 'exited') return null;
  const visibleTags = separated ? tags : tags.slice(0, 2);
  return <span data-session-card-metadata className="mt-1 flex min-w-0 flex-wrap items-center gap-y-1 text-[12px] leading-4">
    {session.status === 'exited' ? <span className="sr-only">Exited session. </span> : null}
    {visibleTags.map((tag, index) => <span key={tag} className="contents">{index ? <span aria-hidden="true" className="px-1 text-[#65756b]">/</span> : null}<span data-session-tag={tag} title={tag} className={cn('max-w-24 truncate uppercase tracking-wide font-[family-name:var(--font-geist-mono)]', colors[tag] || 'text-[#aab4ae]')}>{tag}</span></span>)}
    {!separated && tags.length > 2 ? <span title={tags.slice(2).join(', ')} className="pl-1 text-[#9aa79f]">+{tags.length - 2}</span> : null}
    {tags.length > 0 && (relative || agent) ? <span aria-hidden="true" className="px-1.5 text-[#65756b]">·</span> : null}
    {agent ? <span className={titleStyles.meta}><SessionAgentMarks tags={session.tags}/></span> : null}
    {relative ? <time dateTime={timestamp} data-activity-time-source={source} title={`${title} · ${timestamp}`} className="tabular-nums text-[#9aa79f]">{relative}</time> : null}
  </span>;
}
