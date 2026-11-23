"use client";

import { useCallback, useEffect, useState } from "react";
import { consolidateMcpSelections } from "@/lib/mcp-catalog";

const STORAGE_KEY = "oathkeeper-mcp-config";
const UPDATED_EVENT = "oathkeeperMcpConfigUpdated";

export type BuiltInMcpServerId = "curator" | "vibeghost" | "calendar" | "kanban" | "social" | "crm" | "canvas" | "reports";
export type McpServerKind = "vibeghost" | "embedded" | "custom";
export type McpServerConfig = {
  id: string;
  kind: McpServerKind;
  name: string;
  description: string;
  url: string;
  enabled: boolean;
  authMode?: "oauth" | "key" | "none";
  builtIn: boolean;
};

export type OathkeeperMcpConfig = {
  version: 5;
  servers: McpServerConfig[];
};

export const BUILT_IN_MCP_SERVERS: Record<BuiltInMcpServerId, McpServerConfig> = {
  curator: { id: "curator", kind: "embedded", name: "Curator", description: "Link and picture collections on your local/Tailscale host", url: "/api/mcp/curator", enabled: false, builtIn: true },
  vibeghost: { id: "vibeghost", kind: "vibeghost", name: "VibeGhost", description: "Sessions, workspaces, memory, and automation", url: "", enabled: false, authMode: "oauth", builtIn: false },
  calendar: { id: "calendar", kind: "embedded", name: "Calendar", description: "Events, schedules, and reminders", url: "/api/mcp/calendar", enabled: false, builtIn: true },
  kanban: { id: "kanban", kind: "embedded", name: "Kanban", description: "Boards, columns, cards, and status", url: "/api/mcp/kanban", enabled: false, builtIn: true },
  social: { id: "social", kind: "embedded", name: "Social Media", description: "Sources, response drafts, and publishing", url: "/api/mcp/social", enabled: false, builtIn: true },
  canvas: { id: "canvas", kind: "embedded", name: "Canvas", description: "Charts, tables and mock-ups the agent shows in chat — previews and a library", url: "/api/mcp/canvas", enabled: false, builtIn: true },
  reports: { id: "reports", kind: "embedded", name: "Reports", description: "The mailbox where worker sessions post reports for review", url: "/api/mcp/reports", enabled: false, builtIn: true },
  crm: { id: "crm", kind: "embedded", name: "CRM", description: "Companies, people, demos, and copy-only outreach — no deployment or sending", url: "/api/mcp/crm", enabled: false, builtIn: true },
};

const builtInOrder: BuiltInMcpServerId[] = ["calendar", "kanban", "social", "curator", "canvas", "reports", "crm"];
const fallback = (): OathkeeperMcpConfig => ({ version: 5, servers: builtInOrder.map((id) => ({ ...BUILT_IN_MCP_SERVERS[id] })) });

function cleanServer(value: unknown): McpServerConfig | null {
  if (!value || typeof value !== "object") return null;
  const server = value as Partial<McpServerConfig>;
  if (typeof server.id !== "string" || !server.id.trim() || typeof server.name !== "string" || !server.name.trim() || typeof server.url !== "string" || !server.url.trim()) return null;
  const knownDefault = server.id in BUILT_IN_MCP_SERVERS ? BUILT_IN_MCP_SERVERS[server.id as BuiltInMcpServerId] : null;
  // Retired embedded integrations must not reappear as custom connections.
  if (!knownDefault && server.kind === "embedded" && server.builtIn) return null;
  const builtIn = Boolean(knownDefault && knownDefault.kind === "embedded");
  const defaults = knownDefault;
  const kind: McpServerKind = defaults?.kind || (server.kind === "vibeghost" || server.kind === "embedded" || server.kind === "custom" ? server.kind : "custom");
  const legacyLocalUrl = builtIn && kind === "embedded" && server.url.trim() === `http://127.0.0.1:4022/${server.id}/mcp`;
  return {
    id: server.id.trim().slice(0, 80),
    kind,
    name: server.name.trim().slice(0, 80),
    description: typeof server.description === "string" ? server.description.trim().slice(0, 180) : defaults?.description || (kind === "vibeghost" ? "Sessions, workspaces, memory, and automation" : "Custom Streamable HTTP server"),
    url: legacyLocalUrl ? defaults!.url : server.url.trim().slice(0, 2048),
    enabled: server.enabled === true,
    authMode: kind === "vibeghost" && (server.authMode === "key" || server.authMode === "none") ? server.authMode : kind === "vibeghost" ? "oauth" : undefined,
    builtIn,
  };
}

export function readMcpConfig(): OathkeeperMcpConfig {
  if (typeof window === "undefined") return fallback();
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if ((value?.version === 2 || value?.version === 3 || value?.version === 4 || value?.version === 5) && Array.isArray(value.servers)) {
      const seen = new Set<string>();
      const servers: McpServerConfig[] = [];
      for (const raw of value.servers as unknown[]) {
        const server = cleanServer(raw);
        if (server && server.id !== "openfronts" && !seen.has(server.id)) {
          seen.add(server.id);
          if (server.builtIn && server.url !== BUILT_IN_MCP_SERVERS[server.id as BuiltInMcpServerId].url) {
            // Preserve previously customized endpoints as external connections,
            // without silently granting the local integration their selection.
            servers.push({ ...server, id: `custom-legacy-${server.id}`, kind: "custom", builtIn: false });
          } else servers.push(server);
        }
      }
      const migrated = consolidateMcpSelections(servers).map(server => server.id === "crm" && server.url === "/api/mcp/crm" ? { ...BUILT_IN_MCP_SERVERS.crm, enabled: server.enabled } : server);
      const byId = new Map(migrated.map((server) => [server.id, server]));
      const builtIns = builtInOrder.map((id) => byId.get(id) || { ...BUILT_IN_MCP_SERVERS[id] });
      const additional = migrated.filter((server) => !builtInOrder.includes(server.id as BuiltInMcpServerId));
      // A new disabled built-in must not silently evict an existing connection at the cap.
      return { version: 5, servers: [...builtIns, ...additional] };
    }
    if (value?.server === "vibeghost" && typeof value.url === "string" && value.url.trim()) {
      const migrated = fallback();
      migrated.servers.unshift({ ...BUILT_IN_MCP_SERVERS.vibeghost, url: value.url.trim(), enabled: value.enabled !== false, builtIn: false });
      return migrated;
    }
  } catch {
    // Fall through to fresh built-ins.
  }
  return fallback();
}

export function saveMcpConfig(config: OathkeeperMcpConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT, { detail: config }));
}

// One bootstrap per page, not competing bootstraps per composer/control.
let fleetSync: Promise<void> | undefined;
const fleetWrites = new Map<string, Promise<void>>();
function persistFleetServer(id: string) {
  const next = (fleetWrites.get(id) ?? Promise.resolve()).then(async () => {
    const server = readMcpConfig().servers.find((item) => item.id === id);
    if (server?.kind !== "vibeghost" || !server.url) return;
    await fetch("/api/vibeghost/connections", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(server) });
  }).catch(() => {});
  fleetWrites.set(id, next);
  void next.finally(() => { if (fleetWrites.get(id) === next) fleetWrites.delete(id); });
}
// The server's VibeGhost connections are the source of truth; the browser keeps a copy. A page load only reads: it
// adopts the server's name, URL, auth mode and enabled flag, and adds hosts it didn't know. It never writes the copy
// back, because a tab or device with an old copy would switch hosts off for every client (2026-11-09: both hosts were
// disabled at 17:31:53Z and again at 17:39:45Z by page loads). Writes happen only on an explicit change
// (updateServer, the settings form, adding a host). A host that only this browser has is uploaded once, never overwritten.
async function synchronizeFleet() {
  const response = await fetch("/api/vibeghost/connections", { cache: "no-store" });
  if (!response.ok) return;
  const payload = await response.json();
  if (!Array.isArray(payload.connections)) return;
  const fromServer = new Map<string, McpServerConfig>();
  for (const connection of payload.connections as unknown[]) {
    const server = cleanServer({ ...(connection as object), kind: "vibeghost", builtIn: false });
    if (server) fromServer.set(server.id, server);
  }
  const current = readMcpConfig();
  const known = new Set(current.servers.map((server) => server.id));
  let changed = false;
  const servers = current.servers.map((server) => {
    const saved = server.kind === "vibeghost" ? fromServer.get(server.id) : undefined;
    if (!saved) return server;
    const merged = { ...server, name: saved.name, url: saved.url, enabled: saved.enabled, authMode: saved.authMode };
    if (merged.name !== server.name || merged.url !== server.url || merged.enabled !== server.enabled || merged.authMode !== server.authMode) changed = true;
    return merged;
  });
  for (const [id, server] of fromServer) if (!known.has(id)) { servers.push(server); changed = true; }
  if (changed) saveMcpConfig({ version: 5, servers });
  for (const server of servers) if (server.kind === "vibeghost" && server.url && !fromServer.has(server.id)) persistFleetServer(server.id);
}

export function useMcpConfig() {
  const [config, setConfig] = useState<OathkeeperMcpConfig>(fallback);
  useEffect(() => {
    const sync = () => setConfig(readMcpConfig());
    sync();
    // Fleet synchronization is optional. A dropped first-load request must not
    // escape as a global runtime error or replace the saved local configuration.
    fleetSync ??= synchronizeFleet().catch(() => {});
    window.addEventListener("storage", sync);
    window.addEventListener(UPDATED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(UPDATED_EVENT, sync);
    };
  }, []);

  const commit = useCallback((servers: McpServerConfig[]) => saveMcpConfig({ version: 5, servers }), []);
  const updateServer = useCallback((id: string, changes: Partial<Omit<McpServerConfig, "id" | "builtIn" | "kind">>) => {
    const servers = readMcpConfig().servers.map((server) => server.id === id ? { ...server, ...changes, ...(server.builtIn ? { url: BUILT_IN_MCP_SERVERS[server.id as BuiltInMcpServerId].url } : {}) } : server);
    commit(servers);
    if (servers.find((server) => server.id === id)?.kind === "vibeghost") persistFleetServer(id);
  }, [commit]);
  const removeServer = useCallback((id: string) => commit(readMcpConfig().servers.filter((server) => server.id !== id || server.builtIn)), [commit]);
  const restoreBuiltIn = useCallback((id: BuiltInMcpServerId) => {
    const config = readMcpConfig();
    if (config.servers.some((server) => server.id === id)) return;
    const order = new Map(builtInOrder.map((serverId, index) => [serverId, index]));
    commit([...config.servers, { ...BUILT_IN_MCP_SERVERS[id] }].sort((a, b) => (order.get(a.id as BuiltInMcpServerId) ?? 99) - (order.get(b.id as BuiltInMcpServerId) ?? 99)));
  }, [commit]);
  const addVibeGhost = useCallback((name: string, url: string) => {
    const config = readMcpConfig();
    if (config.servers.length >= 20) throw new Error("Oathkeeper supports up to 20 MCP servers.");
    const server: McpServerConfig = { id: `vibeghost-${crypto.randomUUID()}`, kind: "vibeghost", name: name.trim(), description: "Sessions, workspaces, memory, and automation", url: url.trim(), enabled: false, authMode: "oauth", builtIn: false };
    commit([...config.servers, server]);
    return server;
  }, [commit]);
  const addCustomServer = useCallback((name: string, url: string) => {
    const config = readMcpConfig();
    if (config.servers.length >= 20) throw new Error("Oathkeeper supports up to 20 MCP servers.");
    const server: McpServerConfig = { id: `custom-${crypto.randomUUID()}`, kind: "custom", name: name.trim(), description: "Custom Streamable HTTP server", url: url.trim(), enabled: false, builtIn: false };
    commit([...config.servers, server]);
    return server;
  }, [commit]);

  return { config, saveConfig: saveMcpConfig, updateServer, removeServer, restoreBuiltIn, addVibeGhost, addCustomServer };
}
