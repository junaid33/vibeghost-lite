import { isVerifiedAgentIdentity, type AgentIdentityCarrier } from "./session-integrations/agent-identity.ts";
import { canShowAgentChat, getAgentChatProviderId, hasAgentCapability, resolveAgentProvider } from "./session-integrations/agent-provider.ts";
import { getSessionTags } from "./session-integrations/session-tags.ts";

export type IntegrationSession = AgentIdentityCarrier & { name?: string; title?: string; command?: string[]; tags?: string[]; status?: string; agentPhase?: string; codexRegistrationAvailable?: boolean; agentChatAvailable?: boolean; agentActionsAvailable?: boolean; agentObservationAvailable?: boolean; terminalFollowUpAvailable?: boolean; nativeQueueGrant?: import("./session-integrations/agent-provider.ts").NativeQueueGrant; id?: string; workspaceId?: string; remoteSessionId?: string; client?: { readonly transportGeneration: number; readonly supportsAgentSessions: boolean } };
export type SessionView = "terminal" | "chat";
export const PROGRAM_INTEGRATIONS = [
  { id: "herdr", exactTag: "herdr", displayName: "Herdr", view: undefined, controls: "herdr" as const },
  { id: "tmux", exactTag: "tmux", displayName: "tmux", view: undefined, controls: "tmux" as const },
] as const;

/** Native provider semantics, adapted to imported mini-app session records. Tags
 * route presentation, never establish a verified conversation or live TUI data. */
/** Ephemeral fresh-read observation, never persisted in DTO/cache. Peer and
 * client generation bind the lease; raw dispatch still has a documented TOCTOU. */
export type NativeQueueObservation = {
  ownerId: string; peerId: string; remoteId: string;
  client: NonNullable<IntegrationSession["client"]>; generation: number;
  response: IntegrationSession;
};
export function importedNativeQueueAvailable(session: IntegrationSession | null | undefined, observation?: NativeQueueObservation): boolean {
  if (!session?.client || !observation || session.terminalFollowUpAvailable !== true || session.client.supportsAgentSessions !== true ||
    !Number.isInteger(observation.generation) || observation.generation < 0 ||
    observation.client !== session.client || observation.generation !== session.client.transportGeneration ||
    observation.ownerId !== session.id || observation.peerId !== session.workspaceId || observation.remoteId !== session.remoteSessionId ||
    session.status !== "running" || session.agentPhase === "blocked") return false;
  const base = resolveAgentProvider({ ...session, name: session.name || session.title || "", command: session.command || [] });
  const fresh = resolveAgentProvider({ ...observation.response, name: observation.response.name || "", command: observation.response.command || [] });
  return !base.issue && !fresh.issue && base.identity?.provider === "codex" && base.identity.binding.state === "verified" && fresh.identity?.provider === "codex" &&
    base.identity.conversation.id === fresh.identity.conversation.id && base.identity.binding.epoch === fresh.identity.binding.epoch &&
    hasAgentCapability({ ...observation.response, name: observation.response.name || "", command: observation.response.command || [] }, "terminal.followUp");
}
export function sessionIntegration(session: IntegrationSession | null | undefined, observation?: NativeQueueObservation) {
  const carrier = { ...session, name: session?.name || session?.title || "", command: session?.command || [] };
  const agent = resolveAgentProvider(carrier);
  const tags = getSessionTags(carrier);
  const matches = PROGRAM_INTEGRATIONS.filter(program => tags.includes(program.exactTag));
  const program = matches.length === 1 ? matches[0] : undefined;
  const provider = !matches.length && !agent.issue ? agent.provider : undefined;
  const chatProvider = !matches.length && canShowAgentChat(carrier) ? getAgentChatProviderId(carrier) : undefined;
  const secondaryView = chatProvider ? "chat" as const : undefined;
  return {
    provider, identity: agent.identity, issue: matches.length > 1 ? "ambiguous" as const : agent.issue,
    program, secondaryView, chatProvider,
    composerAgent: provider?.id,
    canFollowUp: Boolean(provider && (provider.id === "codex" && session?.remoteSessionId
      ? importedNativeQueueAvailable(session, observation) : hasAgentCapability(carrier, "terminal.followUp"))),
    canFork: Boolean(session?.status === 'running' && hasAgentCapability(carrier, 'session.fork') && isVerifiedAgentIdentity(agent.identity) && agent.identity?.provider === provider?.id),
    canResume: Boolean(session?.status === "exited" && hasAgentCapability(carrier, "session.resume") && isVerifiedAgentIdentity(agent.identity) && agent.identity?.provider === provider?.id),
  };
}
