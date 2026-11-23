'use client';

import { useRef, useState } from 'react';
import { canForkSharedSession, canResumeSharedSession } from '@/features/oathkeeper/lib/shared-agent-actions';
import { MoreHorizontal, IconSquarePlusFillDuo18, Copy, RefreshCw, StopCircle, CloseCircle } from '@/components/icons/duo';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { VibeGhostSession } from '@/features/oathkeeper/components/vibeghost-view';

export type { SessionAction as SidebarSessionAction } from '@/features/oathkeeper/lib/session-actions';
import type { SessionAction as SidebarSessionAction } from '@/features/oathkeeper/lib/session-actions';

export function SidebarSessionActionsMenu({ session, onCreate, createDisabled = false, onAction }: {
  session: VibeGhostSession;
  onCreate?: () => void;
  createDisabled?: boolean;
  onAction: (action: SidebarSessionAction) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const resumable = canResumeSharedSession(session, session.client);
  const run = async (action: SidebarSessionAction) => {
    if (pending.current) return;
    const warning = action === 'delete'
      ? session.status === 'running' ? `Stop and delete ${session.title}? Its recording and metadata will be removed. This cannot be undone.` : `Delete ${session.title}? Its recording and metadata will be removed. This cannot be undone.`
      : action === 'stop'
        ? `Stop ${session.title}? Its recording and metadata will be kept.`
        : '';
    if (warning && !window.confirm(warning)) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await onAction(action);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Session action failed.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return <DropdownMenu open={open} onOpenChange={setOpen}>
    <DropdownMenuTrigger asChild>
      <button type="button" aria-label={`Actions for ${session.title}`} title={`Actions for ${session.title}`} className="grid size-7 place-items-center rounded-md text-[var(--oathkeeper-muted)] hover:bg-white/[.06] hover:text-[var(--oathkeeper-ink)] focus-visible:outline-2 focus-visible:outline-[var(--oathkeeper-nav-accent)]">
        <MoreHorizontal className="size-3.5"/>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={4} className="w-52">
      {onCreate ? <DropdownMenuItem disabled={busy || createDisabled} onSelect={onCreate}><IconSquarePlusFillDuo18 className="size-4"/>{createDisabled ? "Creating session…" : "Quick create"}</DropdownMenuItem> : null}
      {resumable ? <DropdownMenuItem disabled={busy} onSelect={event => { event.preventDefault(); void run('resume'); }}><RefreshCw className="size-4"/>Resume session</DropdownMenuItem> : null}
      {canForkSharedSession(session, session.client) ? <DropdownMenuItem disabled={busy} onSelect={event => { event.preventDefault(); void run('fork'); }}><Copy className="size-4"/>Fork session</DropdownMenuItem> : null}
      {session.status === 'running' ? <DropdownMenuItem disabled={busy} className="text-[#efa09a]" onSelect={event => { event.preventDefault(); void run('stop'); }}><StopCircle className="size-4"/>Stop session…</DropdownMenuItem> : null}
      {session.status === 'exited' || session.status === 'running' ? <DropdownMenuItem disabled={busy} className="text-[#efa09a]" onSelect={event => { event.preventDefault(); void run('delete'); }}><CloseCircle className="size-4"/>{session.status === 'running' ? 'Stop and delete…' : 'Delete session…'}</DropdownMenuItem> : null}
      {busy ? <p role="status" className="px-2 py-1 text-xs text-white/45">Applying change…</p> : null}
      {error ? <p role="alert" className="px-2 py-1 text-xs whitespace-normal text-[#efa09a]">{error}</p> : null}
    </DropdownMenuContent>
  </DropdownMenu>;
}
