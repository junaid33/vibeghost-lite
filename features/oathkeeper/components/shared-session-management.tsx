"use client";
import { canResumeSharedSession, resumeSharedAgent } from '../lib/shared-agent-actions';
import { useVibeGhostDirectory } from "../hooks/use-vibeghost-directory";
import type { RemoteSession } from "../lib/shared-workspace-model";
import { WorkspaceSessionManager, type SessionManagementAction } from "./workspace-session-manager";
/** `sessionIds` narrows the workspace scope to exact sessions (a sidebar Active Feed group). */
export type SessionManagementScope = { action: SessionManagementAction; ids: string[]; label: string; sessionIds?: string[] };
export function SharedSessionManagement({ scope, onClose }: { scope: SessionManagementScope; onClose: () => void }) {
  const { directory, loadSavedWorkspaces } = useVibeGhostDirectory();
  const sessions = directory.sessions.filter(s => s.workspaceId && scope.ids.includes(s.workspaceId) && (!scope.sessionIds || scope.sessionIds.includes(s.id)));
  return <WorkspaceSessionManager action={scope.action} workspaceName={scope.label} onClose={onClose} onRefresh={loadSavedWorkspaces}
    sessions={sessions.map(s => ({ id: s.id, name: s.title, status: s.status, canResume: canResumeSharedSession(s, directory.workspaces.find(w => w.id === s.workspaceId)?.client), tags: s.tags, lastActive: s.lastModified || s.startedAt }))}
    onAction={async (action, id) => {
      const target = sessions.find(s => s.id === id);
      const workspace = directory.workspaces.find(w => w.id === target?.workspaceId);
      if (!target?.remoteSessionId || !workspace?.client) throw new Error("Workspace connection unavailable.");
      const client = workspace.client;
      const fresh = (await client.json<RemoteSession[]>("GET", "/api/sessions")).find(s => s.id === target.remoteSessionId);
      if (!fresh) throw new Error("Session no longer exists in this workspace.");
      if (action === "resume") {
        return resumeSharedAgent(client, fresh, workspace.remoteId, target);
      } else {
        if (action === "stop" ? fresh.status !== "running" : fresh.status !== "exited") throw new Error("Session status changed. Refresh and retry.");
        const response = await client.request("DELETE", `/api/sessions/${encodeURIComponent(fresh.id)}${action === "delete" ? "/cleanup" : ""}`);
        if (response.status >= 400) throw new Error(`Session action rejected (${response.status}).`);
      }
    }}/>
}
