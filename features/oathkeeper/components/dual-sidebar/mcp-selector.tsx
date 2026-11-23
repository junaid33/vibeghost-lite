"use client";
import * as Glyph from "@/components/icons/duo";
import { IconBookmarksFillDuo18 } from "@/components/icons/duo";


/* Hallmark · component: MCP manager dialog · genre: modern-minimal · theme: existing lab
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass
 */

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Columns3,
  ContactRound,
  Ghost,
  MessagesSquare,
  Network,
  Settings2,
  Plus,
  type LucideIcon,
} from "@/components/icons/duo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { type McpServerConfig, useMcpConfig } from "../../hooks/use-mcp-config";
import { plural } from "@/lib/plural";
import { McpServersPanel, type McpPanelRow, type McpPanelStatus } from "./mcp-servers-panel";
import {
  PromptPopoverHeader,
  labDialogPrimaryButtonClass,
  promptPopoverContentClass,
  promptPopoverFieldClass,
  promptToolbarControlClass,
} from "./prompt-control-popover";

type ConnectionState = {
  state: "idle" | "testing" | "connected" | "error" | "auth";
  toolCount?: number;
  tools?: string[];
  message?: string;
  authenticationConfigured?: boolean;
  oauthStartUrl?: string;
  authMode?: "oauth" | "key" | "none";
  supportedAuthModes?: Array<"oauth" | "key" | "none">;
};

const SERVER_ICONS: Record<string, LucideIcon> = {
  curator: props => <IconBookmarksFillDuo18 className={props.className} aria-hidden="true"/>,
  vibeghost: Ghost,
  calendar: CalendarDays,
  kanban: Columns3,
  social: MessagesSquare,
  crm: ContactRound,
};

function Chevron({ open = false }: { open?: boolean }) {
  return <Glyph.ChevronDown width="11" height="11" className="transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }} aria-hidden="true" />;
}

function MiniLabSwitch({ id, checked, onChange, label, disabled = false }: { id: string; checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return <label className={cn("lab-switch-control shrink-0 max-sm:before:absolute max-sm:before:-inset-x-1 max-sm:before:-inset-y-[7px] max-sm:before:content-['']", disabled && "pointer-events-none opacity-45")} htmlFor={id}>
    <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="sr-only" aria-label={label} disabled={disabled}/>
    <span className="lab-switch-thumb" aria-hidden="true"/>
  </label>;
}

function normalizedMcpUrl(value: string, serverId?: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Server URL is required.");
  if (trimmed.length > 2048) throw new Error("Server URL is too long.");
  if (["curator", "calendar", "kanban", "social", "crm"].includes(serverId || "") && trimmed === `/api/mcp/${serverId}`) return trimmed;
  const url = new URL(trimmed);
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1";
  if (url.username || url.password) throw new Error("Server URLs cannot contain credentials.");
  if (url.protocol === "http:" && loopback) return url.toString();
  if (url.protocol !== "https:") throw new Error("Remote MCP servers must use HTTPS.");
  return url.toString();
}

function AuthenticationChoices({ value, onChange, supported, enabledMode }: { value: "oauth" | "key" | "none"; onChange: (value: "oauth" | "key" | "none") => void; supported?: Array<"oauth" | "key" | "none">; enabledMode?: "oauth" | "key" | "none" }) {
  return <div className="grid grid-cols-3 gap-2">
    {([['oauth', 'OAuth'], ['key', 'App key'], ['none', 'No auth']] as const).map(([mode, label]) => {
      const unavailable = Boolean(supported && !supported.includes(mode));
      const active = value === mode;
      const enabled = enabledMode === mode && !unavailable;
      return <button key={mode} type="button" disabled={unavailable} onClick={() => onChange(mode)} aria-pressed={active} className={cn("flex h-12 flex-col items-center justify-center gap-1 rounded-[10px] border border-black bg-[#202326] text-white/45 shadow-[inset_0_1px_0_rgb(255_255_255/.05),0_3px_8px_rgb(0_0_0/.2)] transition-[background,color,transform] hover:text-white/75 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-30", active && "bg-[#2d3439] text-white ring-1 ring-[#6fa8ff]/35")}><span className="text-[12px]">{label}</span><span className={cn("text-[12px] font-semibold uppercase tracking-[.14em] text-white/25", enabled && "text-[#71d8ab]")}>{enabled ? "Enabled" : "Disabled"}</span></button>;
    })}
  </div>;
}

function statusCopy(server: McpServerConfig, connection?: ConnectionState) {
  if (!server.enabled) return "Off";
  if (connection?.state === "testing") return "Checking…";
  if (connection?.state === "connected") return plural(connection.toolCount ?? 0, "tool");
  if (connection?.state === "auth") return "Sign in required";
  if (connection?.state === "error") return "Unavailable";
  return server.enabled ? "Enabled" : "Off";
}

function panelStatus(server: McpServerConfig, connection?: ConnectionState): McpPanelStatus {
  if (!server.enabled) return "off";
  if (connection?.state === "connected") return "connected";
  if (connection?.state === "auth") return "needs-auth";
  if (connection?.state === "error") return "error";
  return "connecting";
}

export function McpSelector({ disabled = false }: { disabled?: boolean }) {
  const { config, updateServer, removeServer, addVibeGhost, addCustomServer } = useMcpConfig();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vibeGhostFleetOpen, setVibeGhostFleetOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [draftAuthMode, setDraftAuthMode] = useState<"oauth" | "key" | "none">("oauth");
  const [draftApiKey, setDraftApiKey] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<McpServerConfig | null>(null);
  const [addingVibeGhost, setAddingVibeGhost] = useState(false);
  const [addingExternal, setAddingExternal] = useState(false);
  const [externalName, setExternalName] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [newVibeGhostName, setNewVibeGhostName] = useState("");
  const [newVibeGhostUrl, setNewVibeGhostUrl] = useState("");
  const [newVibeGhostAuthMode, setNewVibeGhostAuthMode] = useState<"oauth" | "key" | "none">("oauth");
  const [newVibeGhostApiKey, setNewVibeGhostApiKey] = useState("");
  const [connections, setConnections] = useState<Record<string, ConnectionState>>({});

  const selected = selectedId ? config.servers.find((server) => server.id === selectedId) || null : null;
  const vibeGhostServers = config.servers.filter((server) => server.kind === "vibeghost");
  const regularServers = config.servers.filter((server) => server.kind !== "vibeghost");
  const enabledVibeGhostCount = vibeGhostServers.filter((server) => server.enabled).length;
  const enabledCount = regularServers.filter((server) => server.enabled).length + (enabledVibeGhostCount > 0 ? 1 : 0);
  const connection = selected ? connections[selected.id] : undefined;
  const SelectedIcon = selected ? (selected.kind === "vibeghost" ? Ghost : SERVER_ICONS[selected.id] || Network) : Network;
  const isTesting = connection?.state === "testing";
  const edited = Boolean(selected && (draftName !== selected.name || draftUrl !== selected.url || (selected.kind === "vibeghost" && (draftAuthMode !== (selected.authMode || "oauth") || Boolean(draftApiKey)))));

  const closeSettings = () => {
    setSelectedId(null);
    setVibeGhostFleetOpen(false);
    setAddingVibeGhost(false);
    setAddingExternal(false);
    setFormError(null);
  };

  const backFromConnection = () => {
    const returnToFleet = selected?.kind === "vibeghost";
    setSelectedId(null);
    setFormError(null);
    if (!returnToFleet) setVibeGhostFleetOpen(false);
  };

  const testConnection = async (server: Pick<McpServerConfig, "id" | "kind" | "url">) => {
    setConnections((current) => ({ ...current, [server.id]: { state: "testing" } }));
    try {
      const response = await fetch("/api/mcp/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(server) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        const authRequired = payload.authenticationRequired === true;
        setConnections((current) => ({ ...current, [server.id]: { state: authRequired ? "auth" : "error", message: payload.error || "Connection failed", authenticationConfigured: payload.authenticationConfigured === true, oauthStartUrl: typeof payload.oauthStartUrl === "string" ? payload.oauthStartUrl : undefined, supportedAuthModes: Array.isArray(payload.supportedAuthModes) ? payload.supportedAuthModes : undefined } }));
        // Availability/authentication is not the owner's saved selection.
        return false;
      }
      setConnections((current) => ({ ...current, [server.id]: { state: "connected", toolCount: payload.toolCount, tools: Array.isArray(payload.tools) ? payload.tools.filter((t: unknown): t is string => typeof t === "string") : undefined, authenticationConfigured: payload.authenticationConfigured === true, authMode: payload.authMode, supportedAuthModes: Array.isArray(payload.supportedAuthModes) ? payload.supportedAuthModes : undefined } }));
      return true;
    } catch (error) {
      setConnections((current) => ({ ...current, [server.id]: { state: "error", message: error instanceof Error ? error.message : "Connection failed" } }));
      return false;
    }
  };

  const openSettings = (server: McpServerConfig) => {
    setVibeGhostFleetOpen(server.kind === "vibeghost");
    setSelectedId(server.id);
    setDraftName(server.name);
    setDraftUrl(server.url);
    setDraftAuthMode(server.authMode || "oauth");
    setDraftApiKey("");
    setFormError(null);
    if (server.url.trim()) void testConnection({ id: server.id, kind: server.kind, url: server.url });
  };

  const createExternalConnection = () => {
    try {
      if (!externalName.trim()) throw new Error("Name is required.");
      const server = addCustomServer(externalName, normalizedMcpUrl(externalUrl));
      setAddingExternal(false);
      openSettings(server);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not add this server.");
    }
  };

  const setServerEnabled = (server: McpServerConfig, enabled: boolean) => {
    if (!enabled) {
      updateServer(server.id, { enabled: false });
      setConnections((current) => ({ ...current, [server.id]: { state: "idle" } }));
      return;
    }
    try {
      const url = normalizedMcpUrl(server.url, server.id);
      updateServer(server.id, { enabled: true, url });
      void testConnection({ id: server.id, kind: server.kind, url });
    } catch (error) {
      setConnections((current) => ({ ...current, [server.id]: { state: "error", message: error instanceof Error ? error.message : "Could not enable this server" } }));
    }
  };

  const saveSettings = async () => {
    if (!selected) return false;
    const name = draftName.trim();
    if (!name) { setFormError("Name is required."); return false; }
    let url: string;
    try { url = normalizedMcpUrl(draftUrl, selected.id); } catch (error) { setFormError(error instanceof Error ? error.message : "Enter a valid Streamable HTTP URL."); return false; }
    if (selected.kind === "vibeghost") {
      const response = await fetch("/api/vibeghost/connections", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...selected, name, url, authMode: draftAuthMode, apiKey: draftApiKey }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setFormError(payload.error || "Could not save authentication settings."); return false; }
    }
    updateServer(selected.id, { name, url, authMode: selected.kind === "vibeghost" ? draftAuthMode : undefined });
    setDraftName(name);
    setDraftUrl(url);
    setDraftApiKey("");
    setFormError(null);
    if (selected.enabled) await testConnection({ id: selected.id, kind: selected.kind, url });
    return true;
  };

  const openVibeGhostFleet = () => {
    setVibeGhostFleetOpen(true);
    setSelectedId(null);
    setFormError(null);
    for (const server of vibeGhostServers) if (server.url.trim()) void testConnection({ id: server.id, kind: server.kind, url: server.url });
  };

  const setVibeGhostFleetEnabled = (enabled: boolean) => {
    for (const server of vibeGhostServers) setServerEnabled(server, enabled);
  };

  const beginAddVibeGhost = () => {
    setNewVibeGhostName(`VibeGhost ${config.servers.filter((server) => server.kind === "vibeghost").length + 1}`);
    setNewVibeGhostUrl("");
    setNewVibeGhostAuthMode("oauth");
    setNewVibeGhostApiKey("");
    setFormError(null);
    setAddingVibeGhost(true);
  };

  const createVibeGhostConnection = async () => {
    const name = newVibeGhostName.trim();
    if (!name) { setFormError("Name is required."); return; }
    let url: string;
    try { url = normalizedMcpUrl(newVibeGhostUrl, "vibeghost"); } catch (error) { setFormError(error instanceof Error ? error.message : "Enter a valid VibeGhost MCP URL."); return; }
    const server = addVibeGhost(name, url);
    const response = await fetch("/api/vibeghost/connections", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...server, authMode: newVibeGhostAuthMode, apiKey: newVibeGhostApiKey }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { removeServer(server.id); setFormError(payload.error || "Could not add VibeGhost."); return; }
    updateServer(server.id, { authMode: newVibeGhostAuthMode });
    setAddingVibeGhost(false);
    setSelectedId(server.id);
    setDraftName(server.name);
    setDraftUrl(server.url);
    setDraftAuthMode(newVibeGhostAuthMode);
    setDraftApiKey("");
    setFormError(null);
    void testConnection({ id: server.id, kind: server.kind, url: server.url });
  };

  const saveAndConnect = async () => {
    if (!selected || !(await saveSettings())) return;
    if (selected.kind !== "vibeghost") return;
    if (draftAuthMode === "oauth" && !(connection?.state === "connected" && connection.authMode === "oauth")) {
      window.location.href = connection?.oauthStartUrl || `/api/mcp/oauth/start?${new URLSearchParams({ connectionId: selected.id })}`;
      return;
    }
    updateServer(selected.id, { enabled: true, authMode: draftAuthMode });
    await testConnection({ id: selected.id, kind: selected.kind, url: draftUrl });
  };

  const confirmRemove = () => {
    if (!removeTarget) return;
    if (removeTarget.kind === "vibeghost") void fetch("/api/mcp/oauth/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: removeTarget.id }) });
    removeServer(removeTarget.id);
    setConnections((current) => { const next = { ...current }; delete next[removeTarget.id]; return next; });
    const returnToFleet = removeTarget.kind === "vibeghost";
    setRemoveTarget(null);
    setSelectedId(null);
    setAddingVibeGhost(false);
    setFormError(null);
    setVibeGhostFleetOpen(returnToFleet);
  };

  useEffect(() => {
    if (!open) return;
    for (const server of config.servers) {
      if (server.enabled && server.url.trim() && !connections[server.id]) void testConnection({ id: server.id, kind: server.kind, url: server.url });
    }
    // Check enabled servers once per open; later checks are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, config.servers]);

  const panelRows: McpPanelRow[] = [
    (() => {
      const hosts = vibeGhostServers;
      const states = hosts.filter((server) => server.enabled).map((server) => connections[server.id]);
      const status: McpPanelStatus = enabledVibeGhostCount === 0 ? "off" : states.some((c) => c?.state === "connected") ? "connected" : states.some((c) => c?.state === "auth") ? "needs-auth" : states.some((c) => c?.state === "error") ? "error" : "connecting";
      const tools = hosts.flatMap((server) => (server.enabled ? connections[server.id]?.tools ?? [] : []));
      return {
        id: "vibeghost",
        name: "VibeGhost",
        transport: hosts.length === 1 ? "http" : plural(hosts.length, "host"),
        status,
        enabled: enabledVibeGhostCount > 0,
        error: states.find((c) => c?.state === "error")?.message,
        tools,
        toolsKnown: states.some((c) => c?.state === "connected"),
        switchLabel: `${enabledVibeGhostCount > 0 ? "Disable" : "Enable"} VibeGhost fleet`,
        switchDisabled: hosts.length === 0,
        onToggle: setVibeGhostFleetEnabled,
        onSettings: openVibeGhostFleet,
        settingsLabel: "VibeGhost fleet settings",
        onAuthorize: openVibeGhostFleet,
        onReconnect: () => { for (const server of hosts) if (server.enabled) void testConnection({ id: server.id, kind: server.kind, url: server.url }); },
      };
    })(),
    ...regularServers.map((server): McpPanelRow => {
      const state = connections[server.id];
      return {
        id: server.id,
        name: server.name,
        transport: server.builtIn ? "embedded" : "http",
        status: panelStatus(server, state),
        enabled: server.enabled,
        error: state?.state === "error" ? state.message : undefined,
        tools: state?.tools ?? [],
        toolsKnown: state?.state === "connected",
        switchLabel: `${server.enabled ? "Disable" : "Enable"} ${server.name}`,
        switchDisabled: state?.state === "testing",
        onToggle: (checked) => setServerEnabled(server, checked),
        onSettings: () => openSettings(server),
        settingsLabel: `Settings for ${server.name}`,
        onAuthorize: () => openSettings(server),
        onReconnect: () => void testConnection({ id: server.id, kind: server.kind, url: server.url }),
      };
    }),
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mcpAuth") !== "connected") return;
    const connectionId = params.get("mcpConnection");
    const server = config.servers.find((candidate) => candidate.id === connectionId && candidate.kind === "vibeghost");
    if (!server) return;
    params.delete("mcpAuth");
    params.delete("mcpConnection");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    setOpen(true);
    setVibeGhostFleetOpen(true);
    setSelectedId(server.id);
    setDraftName(server.name);
    setDraftUrl(server.url);
    setDraftAuthMode(server.authMode || "oauth");
    setDraftApiKey("");
    updateServer(server.id, { enabled: true });
    void testConnection({ id: server.id, kind: server.kind, url: server.url });
  }, [config.servers, updateServer]);

  return <>
    <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) closeSettings(); }}>
      <DialogTrigger asChild>
        <button type="button" disabled={disabled} aria-label={`MCP servers: ${enabledCount} enabled`} title="MCP servers" className={`${promptToolbarControlClass} w-8 justify-center text-[12px] font-medium sm:w-auto sm:gap-1.5 sm:px-2.5`}>
          <Network className="size-3.5"/><span className="hidden sm:inline">MCP</span>{enabledCount > 0 ? <span className="hidden font-mono text-[12px] text-[#686e6a] sm:inline">{enabledCount}</span> : null}<span className="hidden sm:inline"><Chevron open={open}/></span>
        </button>
      </DialogTrigger>

      <DialogContent hideClose className={`min-h-0 max-h-[min(720px,calc(100dvh-2rem))] !overflow-y-auto overscroll-contain touch-pan-y [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${promptPopoverContentClass}`}>
        {addingExternal ? (
          <div key="add-external">
            <PromptPopoverHeader title="Add external MCP" description="Connect a Streamable HTTP server" onBack={() => { setAddingExternal(false); setFormError(null); }} />
            <div className="space-y-5 px-5 pb-5">
              <div><label htmlFor="external-mcp-name" className="text-[12px] text-white/70">Name</label><input id="external-mcp-name" autoFocus maxLength={80} value={externalName} onChange={event => setExternalName(event.target.value)} placeholder="My tools" className={`mt-2 w-full ${promptPopoverFieldClass}`} /></div>
              <div><label htmlFor="external-mcp-url" className="text-[12px] text-white/70">Server URL</label><input id="external-mcp-url" value={externalUrl} onChange={event => setExternalUrl(event.target.value)} placeholder="https://example.com/mcp" className={`mt-2 w-full font-mono text-[12px] ${promptPopoverFieldClass}`} /></div>
              <p className="text-[12px] leading-4 text-white/40">HTTPS, or HTTP on localhost. No authentication for now; external OAuth and custom headers are not supported. Enable the server after adding it.</p>
              {formError ? <p role="alert" className="text-[12px] text-[#f37996]">{formError}</p> : null}
              <button type="button" onClick={createExternalConnection} className={`w-full text-[12px] ${labDialogPrimaryButtonClass}`}>Add server</button>
            </div>
          </div>
        ) : addingVibeGhost ? (
          <div key="add-vibeghost" className="animate-in fade-in-0 slide-in-from-right-2 duration-200">
            <PromptPopoverHeader title="Add VibeGhost" description="Connect another VibeGhost host" onBack={() => { setAddingVibeGhost(false); setFormError(null); }} />
            <div className="space-y-5 px-5 pb-5">
              <div>
                <label htmlFor="new-vibeghost-name" className="text-[12px] text-white/70">Connection name</label>
                <input id="new-vibeghost-name" value={newVibeGhostName} onChange={(event) => setNewVibeGhostName(event.target.value)} placeholder="Studio VibeGhost" className={`mt-2 w-full ${promptPopoverFieldClass}`} autoFocus />
              </div>
              <div>
                <label htmlFor="new-vibeghost-url" className="text-[12px] text-white/70">MCP server URL</label>
                <input id="new-vibeghost-url" value={newVibeGhostUrl} onChange={(event) => { setNewVibeGhostUrl(event.target.value); setFormError(null); }} placeholder="https://your-vibeghost.example/mcp" className={`mt-2 w-full font-mono text-[12px] ${promptPopoverFieldClass}`} />
                <p className="mt-2 text-[12px] leading-[1.45] text-white/30">Each host is authorized and managed independently.</p>
              </div>
              <div>
                <p className="mb-2 text-[12px] text-white/70">Authentication</p>
                <AuthenticationChoices value={newVibeGhostAuthMode} onChange={(mode) => { setNewVibeGhostAuthMode(mode); setFormError(null); }} />
                {newVibeGhostAuthMode === "key" ? <><input type="password" value={newVibeGhostApiKey} onChange={(event) => setNewVibeGhostApiKey(event.target.value)} placeholder="vgk_…" autoComplete="off" className={`mt-2 w-full font-mono text-[12px] ${promptPopoverFieldClass}`} /><p className="mt-2 text-[12px] leading-[1.45] text-white/30">Create a key in VibeGhost → Settings → Applications.</p></> : null}
              </div>
              {formError ? <div role="alert" className="rounded-[10px] border border-black bg-black/35 px-3 py-2.5"><p className="text-[12px] leading-4 text-[#f37996]">{formError}</p></div> : null}
              <button type="button" onClick={createVibeGhostConnection} className={`w-full text-[12px] ${labDialogPrimaryButtonClass}`}>Add connection</button>
            </div>
          </div>
        ) : selected ? (
          <div key={selected.id} className="animate-in fade-in-0 slide-in-from-right-2 duration-200">
            <PromptPopoverHeader title={selected.name} description="Connection settings" onBack={backFromConnection} actions={
              <button type="button" disabled={isTesting || !draftUrl.trim()} onClick={() => void testConnection({ id: selected.id, kind: selected.kind, url: draftUrl.trim() })} aria-label={`${connection?.state === "connected" ? "Live" : connection?.state === "error" ? "Down" : connection?.state === "auth" ? "Authentication required" : isTesting ? "Checking connection" : "Check connection"}. Press to check again.`} className="group flex h-8 items-center justify-center gap-1.5 rounded-[9px] bg-transparent px-2 text-[12px] text-white/45 transition-[background,color,transform] hover:bg-white/[.04] hover:text-white/75 active:translate-y-px disabled:pointer-events-none disabled:opacity-45">
                <span className={cn("size-2 rounded-full bg-white/25 transition-colors", connection?.state === "connected" && "bg-[#71d8ab] shadow-[0_0_8px_rgb(113_216_171/.35)]", (connection?.state === "error" || connection?.state === "auth") && "bg-[#f37996] shadow-[0_0_8px_rgb(243_121_150/.25)]", isTesting && "animate-pulse bg-[#8bb8ff]")} aria-hidden="true"/>
                <span>{connection?.state === "connected" ? "Live" : connection?.state === "error" ? "Down" : connection?.state === "auth" ? "Sign in" : isTesting ? "Checking…" : "Check"}</span>
              </button>
            } />
            <div className="space-y-5 px-5 pb-5">
              <div>
                <label htmlFor="mcp-server-name" className="text-[12px] text-white/70">Name</label>
                <input id="mcp-server-name" value={draftName} onChange={(event) => setDraftName(event.target.value)} className={`mt-2 w-full ${promptPopoverFieldClass}`} />
              </div>
              {!selected.builtIn ? <div>
                <label htmlFor="mcp-server-url" className="text-[12px] text-white/70">Server URL</label>
                <input id="mcp-server-url" value={draftUrl} placeholder={selected.id === "vibeghost" ? "https://your-vibeghost.example/mcp" : "https://example.local/mcp"} onChange={(event) => { setDraftUrl(event.target.value); setConnections((current) => ({ ...current, [selected.id]: { state: "idle" } })); }} className={`mt-2 w-full font-mono text-[12px] ${promptPopoverFieldClass}`} />
                <p className="mt-2 text-[12px] leading-[1.45] text-white/30">Streamable HTTP endpoint. Remote servers must use HTTPS.</p>
              </div> : <p className="text-[12px] leading-4 text-white/40">Built into Oathkeeper. Its endpoint is managed automatically. To connect another server, use Add external MCP.</p>}

              {selected.kind === "vibeghost" ? <div><p className="mb-2 text-[12px] text-white/70">Authentication</p><AuthenticationChoices value={draftAuthMode} supported={connection?.supportedAuthModes} enabledMode={connection?.state === "connected" ? connection.authMode : undefined} onChange={(mode) => { setDraftAuthMode(mode); setDraftApiKey(""); setFormError(null); }} />{draftAuthMode === "key" ? <><input type="password" value={draftApiKey} onChange={(event) => setDraftApiKey(event.target.value)} placeholder="Enter a new key to replace the saved key" autoComplete="off" className={`mt-2 w-full font-mono text-[12px] ${promptPopoverFieldClass}`} /><p className="mt-2 text-[12px] leading-[1.45] text-white/30">Keys are encrypted server-side and never returned to the browser.</p></> : draftAuthMode === "oauth" ? <p className="mt-2 text-[12px] leading-[1.45] text-white/30">OAuth opens VibeGhost for scoped approval.</p> : <p className="mt-2 text-[12px] leading-[1.45] text-white/30">Use only when this VibeGhost explicitly permits unauthenticated MCP.</p>}</div> : null}

              {(connection?.message || formError) ? <div role="alert" className="rounded-[10px] border border-black bg-black/35 px-3 py-2.5"><p className="text-[12px] leading-4 text-[#f37996]">{formError || connection?.message}</p>{connection?.state === "auth" && selected.kind === "vibeghost" && draftAuthMode === "oauth" ? <><p className="mt-1 text-[12px] leading-4 text-white/30">Use the Save and authorize button below to approve this host through VibeGhost.</p></> : null}</div> : null}

              <div className="flex min-h-[60px] items-center gap-2.5 rounded-[12px] border border-black bg-black/35 px-3 py-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/.035)]">
                <span className="flex size-8 max-sm:size-9 shrink-0 items-center justify-center rounded-[9px] bg-white/[.045] text-white/45"><SelectedIcon className="size-4"/></span>
                <div className="min-w-0 flex-1"><p className="text-[12.5px] text-white/80">Use this server</p><p className="mt-0.5 text-[12px] text-white/30">{statusCopy(selected, connection)}</p></div>
                <MiniLabSwitch id={`mcp-settings-enabled-${selected.id}`} checked={selected.enabled} onChange={(checked) => setServerEnabled(selected, checked)} label={`${selected.enabled ? "Disable" : "Enable"} ${selected.name}`} disabled={isTesting}/>
              </div>

              <button type="button" disabled={selected.kind === "vibeghost" ? (!edited && connection?.state === "connected" && connection.authMode === draftAuthMode) : !edited} onClick={() => void (selected.kind === "vibeghost" ? saveAndConnect() : saveSettings())} className={`w-full text-[12px] ${labDialogPrimaryButtonClass}`}>{selected.kind === "vibeghost" ? (draftAuthMode === "oauth" && !(connection?.state === "connected" && connection.authMode === "oauth") ? "Save and authorize" : "Save and connect") : "Save"}</button>

              {!selected.builtIn ? <button type="button" onClick={() => setRemoveTarget(selected)} className="h-[38px] w-full rounded-[12px] bg-[#4a252d] text-[12px] text-[#ff8ba1] shadow-[inset_0_1px_0_rgb(255_139_161/.22),0_4px_8px_rgb(0_0_0/.3)] ring-1 ring-black/30 transition-[background,transform,color] hover:bg-[radial-gradient(100%_100%_at_top,rgb(255_139_161/.16),transparent),#4a252d] hover:text-[#ffb8c5] active:translate-y-px">Remove server</button> : null}
            </div>
          </div>
        ) : vibeGhostFleetOpen ? (
          <div key="vibeghost-fleet" className="animate-in fade-in-0 slide-in-from-right-2 duration-200">
            <PromptPopoverHeader title="VibeGhost" description={`${enabledVibeGhostCount} of ${plural(vibeGhostServers.length, "host")} connected`} onBack={closeSettings} />
            <div className="space-y-2 px-5 pb-5">
              {vibeGhostServers.length ? vibeGhostServers.map((server) => {
                const serverConnection = connections[server.id];
                return <div key={server.id} className="flex min-h-[60px] items-center gap-2.5 rounded-[12px] border border-black bg-black/35 px-3 py-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/.035)]">
                  <span className="flex size-8 max-sm:size-9 shrink-0 items-center justify-center rounded-[9px] bg-white/[.045] text-white/45"><Ghost className="size-4"/></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-white/80">{server.name}</span>
                    <span className={cn("mt-0.5 block truncate text-[12px] text-white/30", serverConnection?.state === "connected" && "text-[#71d8ab]", (serverConnection?.state === "error" || serverConnection?.state === "auth") && "text-[#f37996]")}>{statusCopy(server, serverConnection)}</span>
                  </span>
                  <button type="button" onClick={() => openSettings(server)} aria-label={`Settings for ${server.name}`} className="flex size-8 max-sm:size-9 shrink-0 items-center justify-center rounded-[9px] text-white/35 transition-[background,color,transform] hover:bg-white/[.055] hover:text-white/75 active:scale-[.95]"><Settings2 className="size-3.5"/></button>
                  <MiniLabSwitch id={`vibeghost-enabled-${server.id}`} checked={server.enabled} onChange={(checked) => setServerEnabled(server, checked)} label={`${server.enabled ? "Disable" : "Enable"} ${server.name}`} disabled={serverConnection?.state === "testing"}/>
                </div>;
              }) : <div className="rounded-[12px] border border-black bg-black/35 px-4 py-5 text-center"><Ghost className="mx-auto size-5 text-white/25"/><p className="mt-2 text-[12px] text-white/55">No VibeGhost hosts yet</p><p className="mt-1 text-[12px] text-white/30">Add a local or hosted VibeGhost connection.</p></div>}
              <button type="button" onClick={beginAddVibeGhost} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-black bg-[#202326] text-[12px] text-white/60 shadow-[inset_0_1px_0_rgb(255_255_255/.06),0_4px_10px_rgb(0_0_0/.24)] transition-[background,color,transform] hover:bg-[#272b2e] hover:text-white/85 active:translate-y-px">
                <Plus className="size-3.5"/>Add VibeGhost
              </button>
            </div>
          </div>
        ) : (
          <div key="servers" className="animate-in fade-in-0 slide-in-from-left-2 duration-200">
            <DialogTitle className="sr-only">MCP servers</DialogTitle>
            <DialogDescription className="sr-only">Choose which connected tools Oathkeeper can use in this conversation.</DialogDescription>
            <div className="p-3">
              <McpServersPanel rows={panelRows} onAddExternal={() => { setExternalName(""); setExternalUrl(""); setFormError(null); setAddingExternal(true); }} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {removeTarget ? <AlertDialog open onOpenChange={(nextOpen) => { if (!nextOpen) setRemoveTarget(null); }}><AlertDialogContent className="max-w-sm z-[calc(var(--z-modal)+1)]"><AlertDialogHeader><AlertDialogTitle>Remove {removeTarget.name}?</AlertDialogTitle><AlertDialogDescription>This removes the MCP connection from Oathkeeper. It does not delete server files or stored data.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmRemove} className="bg-red text-white hover:bg-red/90">Remove</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> : null}
  </>;
}
