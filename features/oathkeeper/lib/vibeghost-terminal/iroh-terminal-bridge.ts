import type { SharedWorkspaceClient } from "@/features/oathkeeper/lib/shared-workspace-client"

const clients = new Map<string, SharedWorkspaceClient>()
let activeClient: SharedWorkspaceClient | null = null

export function registerIrohTerminalClient(
  sessionId: string,
  client: SharedWorkspaceClient
) {
  clients.set(sessionId, client)
  return () => {
    if (clients.get(sessionId) === client) clients.delete(sessionId)
  }
}

export function registerActiveIrohClient(client: SharedWorkspaceClient) {
  activeClient = client
  return () => {
    if (activeClient === client) activeClient = null
  }
}

export function getActiveIrohClient() {
  if (!activeClient) throw new Error("No active Iroh workspace connection")
  return activeClient
}

export function getIrohTerminalClient(sessionId: string) {
  const client = clients.get(sessionId)
  if (!client) throw new Error(`No Iroh transport for session ${sessionId}`)
  return client
}

export function sessionIdFromApiPath(path: string) {
  const match = path.match(/^\/api\/sessions\/([^/]+)\//)
  if (!match) throw new Error(`Unsupported terminal API path: ${path}`)
  return decodeURIComponent(match[1])
}
