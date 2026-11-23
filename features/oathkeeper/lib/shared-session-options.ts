import { sessionIntegration, type IntegrationSession } from './session-integrations.ts';
import { canForkSharedSession, canResumeSharedSession, isPendingAgentAction, resumeSharedAgent } from './shared-agent-actions.ts';
import type { SharedWorkspaceClient } from './shared-workspace-client.ts';
import type { RemoteSession } from './shared-workspace-model.ts';

export function sharedCloneOption(session: IntegrationSession, client?: Pick<SharedWorkspaceClient, 'supportsAgentSessions'>) {
  const integration = sessionIntegration(session);
  const action = integration.canResume ? 'resume' : integration.canFork ? 'fork' : 'duplicate';
  let reason: string | undefined;
  if (integration.provider && integration.provider.id !== 'pi' && action === 'duplicate') reason = `Link a verified ${integration.provider.displayName} conversation in Chat before resuming or forking. This provider may not support session actions.`;
  if ((action === 'resume' && !canResumeSharedSession(session, client)) || (action === 'fork' && !canForkSharedSession(session, client))) reason = 'Update VibeGhost to enable this agent action over shared connections.';
  return { action, reason, label: reason ? 'Session action unavailable' : action === 'resume' ? 'Resume session' : action === 'fork' ? 'Fork session' : 'Duplicate session' } as const;
}

/** Supports successful empty (204) responses without inventing a JSON body. */
export async function sharedMutation(client: Pick<SharedWorkspaceClient, 'request'>, method: string, path: string, body?: Record<string, unknown>) {
  const response = await client.request(method, path, body);
  const text = new TextDecoder().decode(response.body);
  let data: any = {};
  try { if (text) data = JSON.parse(text); } catch { if (response.status < 400) throw new Error('The server returned an invalid response. Refresh before trying again.'); }
  if (response.status < 200 || response.status >= 300) throw new Error(data?.error || `Operation failed (${response.status}).`);
  return data;
}
export function actionSessionId(result: unknown): string | undefined {
  const id = result && typeof result === 'object' && 'sessionId' in result ? result.sessionId : null;
  return typeof id === 'string' && id ? id : undefined;
}
/** A pending agent action has already started its terminal; only identity
 * verification remains, so its session is returned for navigation. */
export function createdSessionId(result: unknown): string {
  const id = actionSessionId(result);
  if (id) return id;
  if (isPendingAgentAction(result)) throw new Error('The agent action is still pending. Refresh the session list before trying again; do not duplicate this request.');
  throw new Error('The server did not return a session identity. Refresh before trying again.');
}
export async function cloneSharedSession(client: SharedWorkspaceClient, sessionId: string, workspaceId: string, fallback: { title: string; cwd: string }) {
  const fresh = await client.json<RemoteSession>('GET', `/api/sessions/${encodeURIComponent(sessionId)}`);
  if ((fresh.workspaceId || 'default') !== workspaceId) throw new Error('Session is no longer in this workspace. Refresh before trying again.');
  const option = sharedCloneOption(fresh, client);
  if (option.reason) throw new Error(option.reason);
  const result = option.action === 'duplicate'
    ? await sharedMutation(client, 'POST', '/api/sessions', { name: fresh.name || fallback.title, command: fresh.command || [], workingDir: fresh.workingDir || fallback.cwd, tags: fresh.tags || [], workspaceId, duplicateOfSessionId: fresh.id })
    : await resumeSharedAgent(client, fresh, workspaceId, fallback, option.action);
  // Keep the original recording: cloning is not consent to delete it.
  return createdSessionId(result);
}
