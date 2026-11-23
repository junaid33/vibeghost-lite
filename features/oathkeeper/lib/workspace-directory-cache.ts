'use client';

import { QueryClient, useQuery } from '@tanstack/react-query';
import type { VibeGhostSession, VibeGhostWorkspace } from '../components/vibeghost-view';

export type WorkspaceDirectory = { workspaces: VibeGhostWorkspace[]; sessions: VibeGhostSession[] };
export const directoryKey = ['vibeghost', 'directory-metadata'] as const;
export const directoryRefreshKey = ['vibeghost', 'directory-refresh'] as const;
export const workspaceQueries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 30 * 60_000 } } });
const empty: WorkspaceDirectory = { workspaces: [], sessions: [] };

export function readWorkspaceDirectory() {
  return workspaceQueries.getQueryData<WorkspaceDirectory>(directoryKey) || empty;
}

/** Memory-only, explicitly whitelisted display data. Never retain clients, invites,
 * transport handles, terminal output or pending operations in the query cache.
 * Chat readiness and queue capability flags/grants are intentionally omitted: display-cache restore
 * is never proof of a live authorized runtime. Reconnect must fetch them anew. */
export function cacheWorkspaceDirectory(directory: WorkspaceDirectory) {
  const snapshot: WorkspaceDirectory = {
    workspaces: directory.workspaces.map(w => ({
      id: w.id, storageId: w.storageId, remoteId: w.remoteId, name: w.name,
      instance: w.instance ? { ...w.instance } : undefined, description: w.description,
      color: w.color, iconShape: w.iconShape, avatarMode: w.avatarMode,
      defaultWorkingDir: w.defaultWorkingDir, shared: true,
    })),
    sessions: directory.sessions.map(s => ({
      id: s.id, title: s.title, cwd: s.cwd, state: s.state, status: s.status,
      shared: s.shared, remoteSessionId: s.remoteSessionId, workspaceId: s.workspaceId,
      tags: s.tags ? [...s.tags] : undefined, piSessionId: s.piSessionId,
      command: s.command, agentIdentity: s.agentIdentity, codexRegistrationAvailable: s.codexRegistrationAvailable,
      agentStatus: s.agentStatus, agentPhase: s.agentPhase,
      startedAt: s.startedAt, lastModified: s.lastModified, activityTimeSource: s.activityTimeSource,
      gitRepoPath: s.gitRepoPath, gitBranch: s.gitBranch, gitModifiedCount: s.gitModifiedCount,
      gitAddedCount: s.gitAddedCount, gitDeletedCount: s.gitDeletedCount,
      gitStagedCount: s.gitStagedCount, gitUntrackedCount: s.gitUntrackedCount,
    })),
  };
  workspaceQueries.setQueryData(directoryKey, snapshot);
}

export function useCachedWorkspaceDirectory() {
  return useQuery<WorkspaceDirectory>({ queryKey: directoryKey, enabled: false, queryFn: () => empty }, workspaceQueries).data;
}
