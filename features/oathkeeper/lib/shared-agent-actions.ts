import { sessionIntegration, type IntegrationSession } from './session-integrations.ts';
import type { RemoteSession } from './shared-workspace-model.ts';
import type { SharedWorkspaceClient } from './shared-workspace-client.ts';

export function isPendingAgentAction(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && 'status' in value && value.status === 'pending');
}

export function canResumeSharedSession(session: IntegrationSession, client?: Pick<SharedWorkspaceClient, 'supportsAgentSessions'>) {
  const integration = sessionIntegration(session);
  return integration.canResume && (integration.provider?.id === 'pi' || client?.supportsAgentSessions === true);
}

export function canForkSharedSession(session: IntegrationSession, client?: Pick<SharedWorkspaceClient, 'supportsAgentSessions'>) {
  const integration = sessionIntegration(session);
  return integration.canFork && (integration.provider?.id === 'pi' || client?.supportsAgentSessions === true);
}

/** Call only with freshly fetched metadata, never a browser-cache identity. */
export async function resumeSharedAgent(client: SharedWorkspaceClient, fresh: RemoteSession, workspaceId: string, fallback: { title: string; cwd: string }, action: 'resume' | 'fork' = 'resume') {
  const integration = sessionIntegration(fresh);
  if (!(action === 'resume' ? integration.canResume : integration.canFork)) throw new Error('No verified agent identity eligible for this action is available.');
  // Native Codex/Claude conversations are revived or forked by the gateway; only Pi relaunches a command.
  if (integration.provider?.id === 'codex' || integration.provider?.id === 'claude') {
    if (!client.supportsAgentSessions) throw new Error(`Update the VibeGhost shared gateway to resume or fork ${integration.provider.id === 'codex' ? 'Codex' : 'Claude'} sessions.`);
    return client.json('POST', `/api/sessions/${encodeURIComponent(fresh.id)}/actions/${action === 'resume' ? 'revive' : 'fork'}`, { idempotencyKey: crypto.randomUUID() });
  }
  const identity = integration.identity!;
  return client.json('POST', '/api/sessions', {
    name: `${fresh.name || fallback.title}${action === 'fork' ? ' (fork)' : ''}`, command: ['pi', action === 'fork' ? '--fork' : '--session', fresh.piSessionId || fresh.piSessionPath || identity.locator?.path || identity.conversation.id],
    tags: fresh.tags?.length ? fresh.tags : ['pi'], workingDir: fresh.workingDir || fallback.cwd,
    workspaceId, duplicateOfSessionId: fresh.id,
  });
}
