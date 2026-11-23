export type AgentProviderId = "pi" | "codex" | "claude"

export type AgentIdentityBindingState = "expected" | "verified" | "legacy"

export type AgentIdentityV1 = {
  version: 1
  provider: AgentProviderId
  conversation: {
    kind: "session" | "thread"
    id: string
  }
  binding: {
    state: AgentIdentityBindingState
    source:
      | "pi-extension"
      | "pi-legacy-migration"
      | "codex-app-server"
      | "codex-hook"
      | "codex-notify"
      | "claude-cli"
      | "claude-hook"
      | "claude-native-registry"
    boundAt: string
    verifiedAt?: string
    epoch?: string
  }
  observed?: {
    cliVersion?: string
    cwd?: string
    threadTreeId?: string
    forkedFromId?: string
    parentThreadId?: string
    processPid?: number
    processStart?: string
  }
  locator?: {
    kind: "pi-jsonl" | "claude-jsonl"
    path: string
  }
}

export type AgentIdentityCarrier = {
  agentIdentity?: AgentIdentityV1
  piSessionId?: string
  piSessionPath?: string
}

const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
const PI_SESSION_FILE_PATTERN = /(?:^|\/)([0-9a-fA-F-]{16,})\.jsonl$/

export function canonicalizeAgentUuid(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.trim().toLowerCase()
  return CANONICAL_UUID_PATTERN.test(normalized) ? normalized : undefined
}

function nonEmptyString(value: unknown, maxLength = 4096): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) return undefined
  return value
}

function optionalString(value: unknown, maxLength = 4096): string | undefined | null {
  if (value === undefined) return undefined
  return nonEmptyString(value, maxLength) ?? null
}

export function normalizeAgentIdentity(value: unknown): AgentIdentityV1 | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const identity = value as Partial<AgentIdentityV1>
  if (
    identity.version !== 1 ||
    (identity.provider !== "pi" && identity.provider !== "codex" && identity.provider !== "claude")
  ) {
    return undefined
  }

  const conversation = identity.conversation
  const binding = identity.binding
  if (!conversation || !binding || typeof conversation !== "object" || typeof binding !== "object") {
    return undefined
  }

  const expectedKind = identity.provider === "codex" ? "thread" : "session"
  if (conversation.kind !== expectedKind) return undefined

  const conversationId = nonEmptyString(conversation.id, 512)
  if (!conversationId) return undefined
  const normalizedConversationId =
    identity.provider === "pi" ? conversationId : canonicalizeAgentUuid(conversationId)
  if (!normalizedConversationId) return undefined

  if (
    binding.state !== "expected" &&
    binding.state !== "verified" &&
    binding.state !== "legacy"
  ) {
    return undefined
  }

  const allowedSources =
    identity.provider === "pi"
      ? new Set(["pi-extension", "pi-legacy-migration"])
      : identity.provider === "codex"
        ? new Set(["codex-app-server", "codex-hook", "codex-notify"])
        : new Set(["claude-cli", "claude-hook", "claude-native-registry"])
  if (!allowedSources.has(binding.source)) return undefined
  if (typeof binding.boundAt !== "string" || !ISO_TIMESTAMP_PATTERN.test(binding.boundAt)) {
    return undefined
  }
  if (
    binding.verifiedAt !== undefined &&
    (typeof binding.verifiedAt !== "string" || !ISO_TIMESTAMP_PATTERN.test(binding.verifiedAt))
  ) {
    return undefined
  }
  if (binding.epoch !== undefined && !nonEmptyString(binding.epoch, 256)) return undefined

  let observed: AgentIdentityV1["observed"]
  if (identity.observed !== undefined) {
    if (!identity.observed || typeof identity.observed !== "object") return undefined
    const cliVersion = optionalString(identity.observed.cliVersion, 128)
    const cwd = optionalString(identity.observed.cwd, 16 * 1024)
    const threadTreeId = optionalString(identity.observed.threadTreeId, 512)
    const forkedFromId = optionalString(identity.observed.forkedFromId, 512)
    const parentThreadId = optionalString(identity.observed.parentThreadId, 512)
    if ([cliVersion, cwd, threadTreeId, forkedFromId, parentThreadId].includes(null)) {
      return undefined
    }
    const processStart = optionalString(identity.observed.processStart, 128)
    const processPid = identity.observed.processPid
    if (processStart === null || (processPid !== undefined && (!Number.isSafeInteger(processPid) || processPid <= 1))) return undefined
    observed = {
      ...(processStart ? { processStart } : {}),
      ...(processPid ? { processPid } : {}),
      ...(cliVersion ? { cliVersion } : {}),
      ...(cwd ? { cwd } : {}),
      ...(threadTreeId ? { threadTreeId } : {}),
      ...(forkedFromId ? { forkedFromId } : {}),
      ...(parentThreadId ? { parentThreadId } : {}),
    }
  }

  let locator: AgentIdentityV1["locator"]
  if (identity.locator !== undefined) {
    if (
      !((identity.provider === "pi" && identity.locator.kind === "pi-jsonl") ||
        (identity.provider === "claude" && identity.locator.kind === "claude-jsonl")) ||
      !nonEmptyString(identity.locator.path, 16 * 1024)
    ) {
      return undefined
    }
    locator = { kind: identity.locator.kind, path: identity.locator.path }
  }

  return {
    version: 1,
    provider: identity.provider,
    conversation: { kind: expectedKind, id: normalizedConversationId },
    binding: {
      state: binding.state,
      source: binding.source,
      boundAt: binding.boundAt,
      ...(binding.verifiedAt ? { verifiedAt: binding.verifiedAt } : {}),
      ...(binding.epoch ? { epoch: binding.epoch } : {}),
    },
    ...(observed ? { observed } : {}),
    ...(locator ? { locator } : {}),
  }
}

export function getLegacyPiIdentity(
  session: Pick<AgentIdentityCarrier, "piSessionId" | "piSessionPath">,
): AgentIdentityV1 | undefined {
  const path = nonEmptyString(session.piSessionPath, 16 * 1024)
  const id =
    nonEmptyString(session.piSessionId, 512) ??
    (path ? path.match(PI_SESSION_FILE_PATTERN)?.[1] : undefined)
  if (!id) return undefined

  return {
    version: 1,
    provider: "pi",
    conversation: { kind: "session", id },
    binding: {
      state: "legacy",
      source: "pi-legacy-migration",
      boundAt: new Date(0).toISOString(),
    },
    ...(path ? { locator: { kind: "pi-jsonl" as const, path } } : {}),
  }
}

export function resolvePersistedAgentIdentity(
  session: AgentIdentityCarrier,
): AgentIdentityV1 | undefined {
  return normalizeAgentIdentity(session.agentIdentity) ?? getLegacyPiIdentity(session)
}

export function isVerifiedAgentIdentity(
  identity: AgentIdentityV1 | undefined,
): identity is AgentIdentityV1 {
  return identity?.binding.state === "verified" || identity?.binding.state === "legacy"
}

export function createCodexIdentity(input: {
  threadId: string
  state: "expected" | "verified"
  source?: "codex-app-server" | "codex-hook" | "codex-notify"
  epoch?: string
  now?: string
  cliVersion?: string
  cwd?: string
  threadTreeId?: string
  forkedFromId?: string
  parentThreadId?: string
}): AgentIdentityV1 {
  const threadId = canonicalizeAgentUuid(input.threadId)
  if (!threadId) throw new Error("Codex thread ID must be a canonical UUID")
  const now = input.now ?? new Date().toISOString()
  if (!ISO_TIMESTAMP_PATTERN.test(now)) throw new Error("Identity timestamp must be ISO-8601 UTC")

  return {
    version: 1,
    provider: "codex",
    conversation: { kind: "thread", id: threadId },
    binding: {
      state: input.state,
      source: input.source ?? "codex-app-server",
      boundAt: now,
      ...(input.state === "verified" ? { verifiedAt: now } : {}),
      ...(input.epoch ? { epoch: input.epoch } : {}),
    },
    observed: {
      ...(input.cliVersion ? { cliVersion: input.cliVersion } : {}),
      ...(input.cwd ? { cwd: input.cwd } : {}),
      ...(input.threadTreeId ? { threadTreeId: input.threadTreeId } : {}),
      ...(input.forkedFromId ? { forkedFromId: input.forkedFromId } : {}),
      ...(input.parentThreadId ? { parentThreadId: input.parentThreadId } : {}),
    },
  }
}

export function assertCompatibleIdentityBinding(
  currentValue: unknown,
  nextValue: unknown,
): AgentIdentityV1 {
  const next = normalizeAgentIdentity(nextValue)
  if (!next) throw new Error("Invalid agent identity")
  const current = normalizeAgentIdentity(currentValue)
  if (!current) return next

  const sameConversation =
    current.provider === next.provider &&
    current.conversation.kind === next.conversation.kind &&
    current.conversation.id === next.conversation.id
  if (current.binding.state === "verified" && !sameConversation) {
    const error = new Error("A verified agent identity cannot be replaced") as Error & {
      code?: string
    }
    error.code = "AGENT_IDENTITY_CONFLICT"
    throw error
  }
  if (current.binding.epoch && next.binding.epoch && current.binding.epoch !== next.binding.epoch) {
    const error = new Error("Agent identity binding epoch mismatch") as Error & { code?: string }
    error.code = "AGENT_IDENTITY_CONFLICT"
    throw error
  }
  return next
}
