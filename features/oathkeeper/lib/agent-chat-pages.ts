import type { AgentChatMessage, AgentChatResponse } from "./session-integrations/agent-chat"

/** Chronological bounded history; current-page updates win duplicate IDs. */
export function mergeAgentChatPages(latest: AgentChatResponse | undefined, older: readonly AgentChatResponse[]): AgentChatMessage[] {
  const messages = new Map<string, AgentChatMessage>()
  for (const page of [...older].reverse().concat(latest ? [latest] : [])) {
    for (const message of page.messages) messages.set(message.id, message)
  }
  return [...messages.values()]
}
