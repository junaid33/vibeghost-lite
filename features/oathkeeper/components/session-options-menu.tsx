"use client";
import { useEffect, useRef, useState } from 'react';
import { AppDots, Copy, UploadCircle, AddCircle, Folder, IconSquarePlusFillDuo18, Pencil, StopCircle, Trash2 } from '@/components/icons/duo';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import type { VibeGhostSession, VibeGhostWorkspace } from './vibeghost-view';
import { useVibeGhostDirectory } from '../hooks/use-vibeghost-directory';
import { navigateVibeGhost, vibeGhostHref } from '../lib/vibeghost-navigation';
import { cloneSharedSession, sharedCloneOption, sharedMutation } from '../lib/shared-session-options';
import type { RemoteSession } from '../lib/shared-workspace-model';
import { SharedSessionEditor, type SharedEditorMode } from './shared-session-editor';
import { quickCreateVibeGhostSession } from '../hooks/use-vibeghost-quick-create';
import styles from './session-options-menu.module.css';
import { isModifiedClick } from '@/lib/modified-click';

/** Native VibeGhost SessionOptionsMenu layout, adapted to workspace-scoped Iroh transport. */
export function SessionOptionsMenu({ session, workspace, onShare }: { session: VibeGhostSession; workspace?: VibeGhostWorkspace; onShare: (workspaceId?: string) => void }) {
  const { ensureDirectoryFresh, refreshWorkspaceSessions } = useVibeGhostDirectory();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<SharedEditorMode | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const client = workspace?.client;
  const connected = Boolean(client && session.remoteSessionId);
  const clone = sharedCloneOption(session, client);
  const sync = async (id?: string) => {
    if (workspace) {
      try { await refreshWorkspaceSessions(workspace); }
      catch { if (mounted.current) setError('Change saved, but the session list could not refresh. Use Refresh before repeating the action.'); }
      if (id && mounted.current) navigateVibeGhost(workspace.id, id);
    }
  };
  const act = async (operation: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await operation(); if (mounted.current) setOpen(false); }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Operation failed.'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const edit = (mode: SharedEditorMode) => { setOpen(false); setEditor(mode); };
  return <>
    <DropdownMenu modal={false} open={open} onOpenChange={value => { if (!pending.current) setOpen(value); if (value) void ensureDirectoryFresh(); }}>
      <DropdownMenuTrigger asChild><button type="button" aria-label="Session and workspace options" title="Session and workspace options" className="oathkeeper-raised-control flex size-9 shrink-0 items-center justify-center text-[#949a96]"><AppDots className="size-3.5"/></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} collisionPadding={8} aria-label="Session and workspace options" className="w-[260px] max-w-[calc(100vw-16px)] overflow-y-auto">
        <DropdownMenuLabel><span className="block min-w-0 py-1"><span className="block min-w-0"><span className="block text-[10px] font-normal text-[#919793]">Session</span><span className="block truncate text-[12px] font-medium text-[#f4f7f5]" title={session.title}>{session.title}</span></span></span><span className={styles.pathBadge} title={session.cwd}>{session.cwd}</span></DropdownMenuLabel>
        <DropdownMenuItem disabled={busy || !connected} onSelect={() => edit('session')}><Pencil className="size-4"/>Edit session…</DropdownMenuItem>
        <DropdownMenuItem disabled={busy} onSelect={() => onShare()}><UploadCircle className="size-4"/>Share session…</DropdownMenuItem>
        <DropdownMenuItem disabled={busy || !connected || !!clone.reason} title={clone.reason} onSelect={event => { event.preventDefault(); void act(async () => { if (!client || !workspace || !session.remoteSessionId) return; const id = await cloneSharedSession(client, session.remoteSessionId, workspace.remoteId, session); await sync(id); }); }}><Copy className="size-4"/>{clone.label}</DropdownMenuItem>
        {clone.reason ? <p className="px-2 py-1 text-xs whitespace-normal text-[#919793]">{clone.reason}</p> : null}
        <DropdownMenuItem disabled={busy || !connected} className="text-[#efa09a]!" onSelect={event => {
          event.preventDefault();
          void act(async () => {
            if (!client || !session.remoteSessionId || !workspace) return;
            const path = `/api/sessions/${encodeURIComponent(session.remoteSessionId)}`;
            const fresh = await client.json<RemoteSession>('GET', path);
            if ((fresh.workspaceId || 'default') !== workspace.remoteId) throw new Error('Session moved to another workspace. Refresh before continuing.');
            const exited = fresh.status === 'exited';
            if (!confirm(exited ? 'Delete this exited session? Its recording and metadata will be removed. This cannot be undone.' : `Stop ${fresh.name || session.title}? Its running process will be terminated.`)) return;
            await sharedMutation(client, 'DELETE', `${path}${exited ? '/cleanup' : ''}`);
            await sync();
            if (exited && mounted.current) navigateVibeGhost(workspace.id);
          });
        }}>{session.status === 'exited' ? <Trash2 className="size-4"/> : <StopCircle className="size-4"/>}{session.status === 'exited' ? 'Delete session…' : 'Stop session…'}</DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/[0.08]"/>
        <DropdownMenuLabel><span className="block min-w-0 py-1"><span className="block min-w-0"><span className="block text-[10px] font-normal text-[#919793]">Workspace</span><span className="block truncate text-[12px] font-medium text-[#f4f7f5]" title={workspace?.name}>{workspace?.name || 'Local sessions'}</span></span></span>{workspace?.defaultWorkingDir ? <span className={styles.pathBadge} title={workspace.defaultWorkingDir}>{workspace.defaultWorkingDir}</span> : null}</DropdownMenuLabel>
        <DropdownMenuItem disabled={busy || !connected} onSelect={() => edit('workspace')}><Pencil className="size-4"/>Edit workspace…</DropdownMenuItem>
        <DropdownMenuItem disabled={busy || !workspace} onSelect={() => onShare(workspace?.id)}><UploadCircle className="size-4"/>Share workspace…</DropdownMenuItem>
        <DropdownMenuItem disabled={busy || !workspace} asChild><a href={vibeGhostHref(workspace?.id)} onClick={event => { if (isModifiedClick(event)) return; event.preventDefault(); if (workspace && !busy) navigateVibeGhost(workspace.id); }}><Folder className="size-4"/>Open workspace</a></DropdownMenuItem>
        {/* As in VibeGhost: both start in this session's folder. */}
        <DropdownMenuItem disabled={busy || !client || !workspace} onSelect={event => { event.preventDefault(); void act(async () => { if (!workspace) return; const id = await quickCreateVibeGhostSession(workspace, session.cwd); await sync(id); }); }}><IconSquarePlusFillDuo18 className="size-4"/>Quick create</DropdownMenuItem>
        <DropdownMenuItem disabled={busy || !client || !workspace} onSelect={() => edit('create')}><AddCircle className="size-4"/>New session…</DropdownMenuItem>
        {!connected ? <p className="px-2 py-1 text-xs text-[#919793]">Connect this workspace to manage its sessions.</p> : null}
        {busy ? <p role="status" className="px-2 py-1 text-xs text-[#919793]">Applying change…</p> : null}
        {error ? <p role="alert" className="max-w-full px-2 py-1 text-xs whitespace-normal text-[#efa09a]">{error}</p> : null}
      </DropdownMenuContent>
    </DropdownMenu>
    {editor && workspace ? <SharedSessionEditor mode={editor} session={session} workspace={workspace} workingDir={editor === 'create' ? session.cwd : undefined} onClose={() => setEditor(null)} onSaved={sync}/> : null}
  </>;
}
