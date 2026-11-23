import {
  normalizeAgentIdentity,
  resolvePersistedAgentIdentity,
  type AgentIdentityCarrier,
  type AgentIdentityV1,
  type AgentProviderId,
} from "./agent-identity.ts"
import { getSessionTags } from "./session-tags.ts"

export type AgentCapability =
  | "chat.read"
  | "inspection.semantic"
  | "identity.persist"
  | "lifecycle.semantic"
  | "session.resume"
  | "session.fork"
  | "input.steer"
  | "input.followUp"
  | "terminal.steer"
  | "terminal.followUp"

export type AgentProviderDefinition = {
  id: AgentProviderId
  exactTag: AgentProviderId
  displayName: string
  conversationLabel: string
  capabilities: ReadonlySet<AgentCapability>
}

const COMMON_SESSION_CAPABILITIES: AgentCapability[] = [
  "chat.read",
  "inspection.semantic",
  "identity.persist",
  "lifecycle.semantic",
  "session.resume",
  "session.fork",
]

export const AGENT_PROVIDERS: Readonly<Record<AgentProviderId, AgentProviderDefinition>> = {
  pi: {
    id: "pi",
    exactTag: "pi",
    displayName: "Pi",
    conversationLabel: "Pi Session ID",
    capabilities: new Set<AgentCapability>([
      ...COMMON_SESSION_CAPABILITIES,
      "input.steer",
      "input.followUp",
      "terminal.steer",
      "terminal.followUp",
    ]),
  },
  codex: {
    id: "codex",
    exactTag: "codex",
    displayName: "Codex",
    conversationLabel: "Codex Thread ID",
    capabilities: new Set<AgentCapability>([
      ...COMMON_SESSION_CAPABILITIES,
      // TUI Enter/Tab are not Pi extension/MCP/scheduler delivery.
      "terminal.steer",
      "terminal.followUp",
    ]),
  },
  claude: {
    id: "claude",
    exactTag: "claude",
    displayName: "Claude",
    conversationLabel: "Claude Session ID",
    // Response-negotiated exact-ID backend capability; tags alone never enable it.
    // Enter during tool work is not after-turn follow-up.
    capabilities: new Set<AgentCapability>(COMMON_SESSION_CAPABILITIES),
  },
}

export type AgentProviderResolution = {
  provider?: AgentProviderDefinition
  identity?: AgentIdentityV1
  issue?: "ambiguous" | "identity-conflict"
}

/** Short-lived capability lease, not cryptographic proof or an atomic identity reservation. */
export type NativeQueueGrant = { version: "0.155.1"; conversationId: string; epoch: string; expiresAt: number }

type AgentProviderSession = AgentIdentityCarrier & {
  name: string
  command: string[]
  tags?: string[]
  codexRegistrationAvailable?: boolean
  /** Response-only capability negotiation from the serving backend. */
  agentChatAvailable?: boolean
  /** Native launch and live observation are distinct from persisted chat reads. */
  agentActionsAvailable?: boolean
  agentObservationAvailable?: boolean
  terminalFollowUpAvailable?: boolean
  nativeQueueGrant?: NativeQueueGrant
  status?: string
  agentPhase?: string
}

export function resolveAgentProvider(session: AgentProviderSession): AgentProviderResolution {
  const tags = getSessionTags(session)
  const providerTags = tags.filter(
    (tag): tag is AgentProviderId => tag === "pi" || tag === "codex" || tag === "claude",
  )
  const uniqueProviderTags = Array.from(new Set(providerTags))
  const explicitIdentity = normalizeAgentIdentity(session.agentIdentity)
  const identity = explicitIdentity ?? resolvePersistedAgentIdentity(session)

  if (explicitIdentity) {
    if (!uniqueProviderTags.includes(explicitIdentity.provider)) {
      return { identity: explicitIdentity, issue: "identity-conflict" }
    }
    const conflictingTags = uniqueProviderTags.filter((tag) => tag !== explicitIdentity.provider)
    if (conflictingTags.length > 0) {
      return { identity: explicitIdentity, issue: "identity-conflict" }
    }
    return { provider: AGENT_PROVIDERS[explicitIdentity.provider], identity: explicitIdentity }
  }

  // Preserve legacy Pi sessions created before explicit tags were persisted.
  if (identity?.provider === "pi" && uniqueProviderTags.length === 0) {
    return { provider: AGENT_PROVIDERS.pi, identity }
  }

  if (uniqueProviderTags.length > 1) return { identity, issue: "ambiguous" }
  if (uniqueProviderTags.length === 1) {
    return { provider: AGENT_PROVIDERS[uniqueProviderTags[0]], identity }
  }
  return { identity }
}

/** Shell preparation never overrides an explicit provider, identity or conflict. */
export function getAgentChatProviderId(session: AgentProviderSession): AgentProviderId | undefined {
  const resolution = resolveAgentProvider(session)
  if (resolution.issue) return undefined
  if (resolution.provider) return resolution.provider.id
  return !resolution.identity && session.codexRegistrationAvailable === true ? "codex" : undefined
}

export function canShowAgentChat(session: AgentProviderSession): boolean {
  const resolution = resolveAgentProvider(session)
  if (resolution.issue) return false
  if (resolution.provider?.id === "claude" && session.agentChatAvailable !== true) return false
  return resolution.provider?.capabilities.has("chat.read") ?? (getAgentChatProviderId(session) === "codex")
}

export function hasAgentCapability(
  session: AgentProviderSession,
  capability: AgentCapability,
): boolean {
  const resolved = resolveAgentProvider(session)
  if (resolved.provider?.id === "claude") {
    // Chat reads, native launch and live observation are negotiated separately.
    // Gateways that predate the split only send agentChatAvailable.
    const actions = session.agentActionsAvailable ?? session.agentChatAvailable
    const observation = session.agentObservationAvailable ?? session.agentChatAvailable
    if ((capability === "chat.read" || capability === "inspection.semantic") && session.agentChatAvailable !== true) return false
    if ((capability === "session.resume" || capability === "session.fork") && actions !== true) return false
    if (capability === "lifecycle.semantic" && observation !== true) return false
  }
  if (resolved.provider?.id === "codex" && capability === "terminal.followUp") {
    const grant = session.nativeQueueGrant
    const now = Date.now()
    return session.terminalFollowUpAvailable === true && session.status === "running" && session.agentPhase !== "blocked" &&
      resolved.identity?.provider === "codex" && resolved.identity.binding.state === "verified" && grant?.version === "0.155.1" &&
      grant.conversationId === resolved.identity.conversation.id && typeof grant.epoch === "string" && grant.epoch.length > 0 && grant.epoch === resolved.identity.binding.epoch &&
      Number.isFinite(grant.expiresAt) && grant.expiresAt > now && grant.expiresAt <= now + 6_000
  }
  return resolved.provider?.capabilities.has(capability) ?? false
}

export function getAgentProviderId(session: AgentProviderSession): AgentProviderId | undefined {
  return resolveAgentProvider(session).provider?.id
}
