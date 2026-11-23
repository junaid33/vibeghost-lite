"use client";
import { useEffect, useId, useRef, useState } from 'react';
import { Settings2, TerminalSquare } from '@/components/icons/duo';
import { KitDialog, KitField, KitFooter, KitSection, kitInputClass, kitCancelClass, kitPrimaryClass } from './dialog-kit';
import type { VibeGhostSession, VibeGhostWorkspace } from './vibeghost-view';
import type { RemoteSession } from '../lib/shared-workspace-model';
import { createdSessionId, sharedMutation } from '../lib/shared-session-options';

export type SharedEditorMode = 'session' | 'workspace' | 'create';
/** `session` is required to edit one; a new session (mode 'create') starts in `workingDir`, else the workspace's default directory. */
export function SharedSessionEditor({ mode, session, workspace, workingDir, onClose, onSaved }: { mode: SharedEditorMode; session?: VibeGhostSession; workspace: VibeGhostWorkspace; workingDir?: string; onClose: () => void; onSaved: (id?: string) => Promise<void> }) {
  const [name, setName] = useState(mode === 'create' ? '' : mode === 'workspace' ? workspace.name : session?.title || '');
  const [cwd, setCwd] = useState(mode === 'session' ? session?.cwd || '' : mode === 'create' && workingDir ? workingDir : workspace.defaultWorkingDir || '~');
  const [tags, setTags] = useState(mode === 'create' ? 'new' : (session?.tags || []).join(', '));
  const [command, setCommand] = useState('');
  const [description, setDescription] = useState(workspace.description || '');
  const [color, setColor] = useState(workspace.color || '');
  const [shape, setShape] = useState(workspace.iconShape || 'circle');
  const [avatar, setAvatar] = useState(workspace.avatarMode || 'gradient');
  const [loading, setLoading] = useState(mode !== 'create');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const client = workspace.client;
  useEffect(() => {
    if (mode === 'create' || !client) return;
    const abort = new AbortController();
    void (async () => {
      try {
        if (mode === 'workspace') {
          const data = await client.json<{workspaces: VibeGhostWorkspace[]}>('GET', '/api/workspaces', undefined, abort.signal);
          if (!client.supportsWorkspaceEditing) throw new Error('Update and restart VibeGhost, then refresh this workspace to enable editing.');
          const fresh = data.workspaces.find(item => item.id === workspace.remoteId);
          if (!fresh) throw new Error('Workspace metadata unavailable.');
          if (!abort.signal.aborted) { setName(fresh.name); setCwd(fresh.defaultWorkingDir || ''); setDescription(fresh.description || ''); setColor(fresh.color || ''); setShape(fresh.iconShape || 'circle'); setAvatar(fresh.avatarMode || 'gradient'); }
        } else {
          if (!session?.remoteSessionId) throw new Error('Session unavailable. Refresh before editing.');
          const fresh = await client.json<RemoteSession>('GET', `/api/sessions/${encodeURIComponent(session.remoteSessionId)}`, undefined, abort.signal);
          if ((fresh.workspaceId || 'default') !== workspace.remoteId) throw new Error('Session moved to another workspace. Refresh before editing.');
          if (!abort.signal.aborted) { setName(fresh.name || session.title); setCwd(fresh.workingDir || session.cwd); setTags((fresh.tags || []).join(', ')); }
        }
        if (!abort.signal.aborted) setLoading(false);
      } catch (reason) { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load settings.'); }
    })();
    return () => abort.abort();
  }, [client, mode, session?.remoteSessionId, session?.title, session?.cwd, workspace.remoteId]);
  const save = async () => {
    if (!client || pending.current || loading) return;
    pending.current = true; setBusy(true); setError('');
    try {
      let id: string | undefined;
      if (mode === 'workspace') {
        if (!client.supportsWorkspaceEditing) throw new Error('Workspace editing is not supported by this VibeGhost server.');
        await sharedMutation(client, 'PATCH', `/api/workspaces/${encodeURIComponent(workspace.remoteId)}`, { name: name.trim(), description, color, iconShape: shape, avatarMode: avatar, defaultWorkingDir: cwd });
      } else {
        const fields = { name: name.trim() || command || 'Terminal', workingDir: cwd, workspaceId: workspace.remoteId, tags: tags.split(',').map(tag => tag.trim()).filter(Boolean) };
        if (mode === 'create') id = createdSessionId(await sharedMutation(client, 'POST', '/api/sessions', { ...fields, command: command ? [command] : [], spawn_terminal: false }));
        else await sharedMutation(client, 'PATCH', `/api/sessions/${encodeURIComponent(session!.remoteSessionId!)}`, fields);
      }
      await onSaved(id); onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const formId = `session-editor-${useId().replace(/:/g, '')}`;
  const field = (key: string) => `${formId}-${key}`;
  return <KitDialog open onOpenChange={open => { if (!open && !pending.current) onClose(); }} busy={busy} icon={mode === 'workspace' ? <Settings2/> : <TerminalSquare/>}
    title={mode === 'workspace' ? 'Workspace settings' : mode === 'create' ? 'New session' : 'Edit session'}
    description={mode === 'workspace' ? 'Edits the connected VibeGhost workspace, not just its local display name.' : `Workspace: ${workspace.name}. Shared connections cannot move sessions to other workspaces.`}
    formId={formId} onSubmit={() => void save()}
    footer={<KitFooter error={error || undefined} notice={loading && !error ? 'Loading settings…' : undefined}>
      <button type="button" className={kitCancelClass} disabled={busy} onClick={onClose}>Cancel</button>
      <button type="submit" form={formId} className={kitPrimaryClass} disabled={busy || loading}>{busy ? 'Saving…' : mode === 'create' ? 'Create session' : 'Save'}</button>
    </KitFooter>}>
    <fieldset disabled={busy || loading} className="m-0 grid min-w-0 gap-4 border-0 p-0">
      <KitSection>
        <KitField label="Name" htmlFor={field('name')}><input id={field('name')} className={kitInputClass} required={mode !== 'create'} value={name} onChange={event => setName(event.target.value)}/></KitField>
        <KitField label={mode === 'workspace' ? 'Default directory' : 'Session directory'} htmlFor={field('cwd')}><input id={field('cwd')} className={kitInputClass} required value={cwd} onChange={event => setCwd(event.target.value)}/></KitField>
        {mode === 'workspace' ? <KitField label="Description" htmlFor={field('description')}><textarea id={field('description')} className={kitInputClass} value={description} onChange={event => setDescription(event.target.value)}/></KitField> : null}
      </KitSection>
      {mode === 'workspace' ? <KitSection caption="Icon">
        <KitField label="Color" htmlFor={field('color')}><input id={field('color')} className={kitInputClass} placeholder="#6366f1" pattern="#[0-9a-fA-F]{6}" value={color} onChange={event => setColor(event.target.value)}/></KitField>
        <KitField label="Icon shape" htmlFor={field('shape')}><select id={field('shape')} className={kitInputClass} value={shape} onChange={event => setShape(event.target.value)}>{['circle','squircle','square','triangle','diamond','hexagon','octagon','shield','star'].map(value => <option key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}</select></KitField>
        <KitField label="Icon style" htmlFor={field('avatar')}><select id={field('avatar')} className={kitInputClass} value={avatar} onChange={event => setAvatar(event.target.value)}><option value="gradient">Gradient</option><option value="dither">Dither</option></select></KitField>
      </KitSection> : <KitSection caption="Session">
        {mode === 'create' ? <KitField label="Start command" htmlFor={field('command')}><select id={field('command')} className={kitInputClass} value={command} onChange={event => { const value = event.target.value; setCommand(value); setTags(['pi','codex','claude'].includes(value) ? value : 'new'); }}><option value="">Host default shell</option>{['zsh','bash','pi','codex','claude'].map(value => <option key={value} value={value}>{value}</option>)}</select></KitField> : null}
        <KitField label="Tags (comma separated)" htmlFor={field('tags')}><input id={field('tags')} className={kitInputClass} value={tags} onChange={event => setTags(event.target.value)}/></KitField>
      </KitSection>}
    </fieldset>
  </KitDialog>;
}
