/** Public embedded MCPs. Email remains a private REST-backed prototype. */
export const exposedMcpServers = ["curator", "calendar", "kanban", "social", "gtm", "crm", "vibeghost", "storefronts", "canvas", "reports", "rounds", "board"] as const;
export function isExposedMcpServer(value: string): boolean {
  return (exposedMcpServers as readonly string[]).includes(value);
}

export function isLocalCrmConnection(server: { id: string; url: string }) {
  return ["crm", "demos", "outreach"].includes(server.id)
    && [ `/api/mcp/${server.id}`, `http://127.0.0.1:4022/${server.id}/mcp` ].includes(server.url.trim());
}

/** Collapse saved/stale CRM family selections once; never auto-enable a new capability.
 * Existing CRM selection wins. Legacy Demos/Outreach-only selections become disabled
 * CRM, requiring the owner to enable the expanded connection explicitly.
 * Edited remote/custom connections are preserved, not rewritten to this host.
 */
export function consolidateMcpSelections<T extends { id: string; url: string; enabled?: boolean }>(servers: T[]): T[] {
  const result: T[] = [];
  const crm = servers.find(server => server.id === "crm" && isLocalCrmConnection(server));
  let addedCrm = false;
  for (const server of servers) {
    if (server.id === "email") continue;
    if (isLocalCrmConnection(server)) {
      if (!addedCrm) {
        result.push({ ...(crm ?? server), id: "crm", url: "/api/mcp/crm", enabled: crm?.enabled ?? false });
        addedCrm = true;
      }
    } else result.push(server);
  }
  return result;
}
