import type { VibeGhostSession, VibeGhostWorkspace } from "../components/vibeghost-view";
import { isPendingAgentAction, resumeSharedAgent } from "./shared-agent-actions";
import { actionSessionId } from "./shared-session-options";
import type { RemoteSession } from "./shared-workspace-model";

export type SessionAction = "resume" | "fork" | "stop" | "delete";
/** `openSessionId`: the terminal a resume or fork started. `pending`: it started but its identity isn't verified yet. */
export type SessionActionResult = { openSessionId?: string; pending?: boolean };

/** One session action against the workspace's live state; every session menu (sidebar, Workspaces, workspace page,
 *  Active feed) runs through here. Deleting a running session stops it first and waits for it to exit. */
export async function performSessionAction(workspace: Pick<VibeGhostWorkspace, "client" | "remoteId"> | undefined, session: VibeGhostSession, action: SessionAction): Promise<SessionActionResult> {
  const client = workspace?.client;
  if (!session.remoteSessionId || !client) throw new Error("Workspace connection unavailable.");
  const current = async () => (await client.json<RemoteSession[]>("GET", "/api/sessions")).find(item => item.id === session.remoteSessionId);
  const fresh = await current();
  if (!fresh) throw new Error("Session no longer exists in this workspace.");
  if (action === "resume" || action === "fork") {
    const result = await resumeSharedAgent(client, fresh, workspace.remoteId, session, action);
    const id = actionSessionId(result);
    return { openSessionId: id || undefined, pending: !id && isPendingAgentAction(result) };
  }
  const remove = async (path: string) => {
    const response = await client.request("DELETE", path);
    if (response.status >= 400) throw new Error(`Session action rejected (${response.status}).`);
  };
  const path = `/api/sessions/${encodeURIComponent(fresh.id)}`;
  if (action === "stop") {
    if (fresh.status !== "running") throw new Error("Session status changed. Refresh and retry.");
    await remove(path);
    return {};
  }
  if (fresh.status === "running") {
    await remove(path);
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 250));
      const latest = await current();
      if (!latest) return {};
      if (latest.status === "exited") break;
      if (attempt === 19) throw new Error("The session was stopped but hasn't exited yet. Try deleting it again.");
    }
  }
  await remove(`${path}/cleanup`);
  return {};
}
