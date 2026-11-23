"use client";
import { useCallback, useRef, useState } from 'react';
import type { VibeGhostWorkspace } from '../components/vibeghost-view';
import { createdSessionId, sharedMutation } from '../lib/shared-session-options';
import { navigateVibeGhost } from '../lib/vibeghost-navigation';
import { useVibeGhostDirectory } from './use-vibeghost-directory';

/** VibeGhost's Quick create: a session in the host's default shell, named "New session" and tagged "new", in the
 *  given folder or the workspace's default directory. Resolves to the new remote session id. */
export async function quickCreateVibeGhostSession(workspace: VibeGhostWorkspace, workingDir?: string) {
  if (!workspace.client) throw new Error(`Could not create a session in ${workspace.name}: workspace connection unavailable.`);
  return createdSessionId(await sharedMutation(workspace.client, 'POST', '/api/sessions', {
    name: 'New session', command: [], tags: ['new'], workingDir: workingDir || workspace.defaultWorkingDir || '~', workspaceId: workspace.remoteId,
  }));
}

/** Quick create with one request per workspace at a time, the session list refreshed, then the new session opened. */
export function useVibeGhostQuickCreate() {
  const { refreshWorkspaceSessions, loadSavedWorkspaces } = useVibeGhostDirectory();
  const pending = useRef(new Set<string>());
  const [creatingId, setCreatingId] = useState('');
  const [error, setError] = useState('');
  const quickCreate = useCallback(async (workspace: VibeGhostWorkspace | undefined, workingDir?: string, open: (workspaceId: string, sessionId: string) => void = navigateVibeGhost) => {
    if (!workspace) { setError('Choose a workspace first.'); return; }
    if (pending.current.has(workspace.id)) return;
    pending.current.add(workspace.id);
    setCreatingId(workspace.id);
    setError('');
    try {
      const id = await quickCreateVibeGhostSession(workspace, workingDir);
      try { await refreshWorkspaceSessions(workspace); } catch { await loadSavedWorkspaces(); }
      open(workspace.id, id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Session creation failed.');
    } finally {
      pending.current.delete(workspace.id);
      setCreatingId(current => current === workspace.id ? '' : current);
    }
  }, [refreshWorkspaceSessions, loadSavedWorkspaces]);
  const clearError = useCallback(() => setError(''), []);
  return { quickCreate, creatingId, error, clearError };
}
