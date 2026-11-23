"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { workspaceQueries, type WorkspaceDirectory } from "../lib/workspace-directory-cache";
import type { SharedWorkspaceClient } from "../lib/shared-workspace-client";
import { DirectWorkspaceClient, asWorkspaceClient } from "../lib/direct-workspace-client";
import { getWorkspaceCapabilityId, mapImportedSessions, readWorkspaceInstance, type RemoteSession, type RemoteWorkspaceResponse } from "../lib/shared-workspace-model";
import { WorkspaceRefreshStatus } from "../lib/workspace-refresh-status";
import { VibeGhostDirectoryContext, useVibeGhostDirectory } from "./use-vibeghost-directory";
import { VIBEGHOST_V2_ROOT } from "../lib/vibeghost-routes";
import { useWorkspacePins } from './use-workspace-pins';
import type { VibeGhostSession, VibeGhostWorkspace } from "../components/vibeghost-view";

const empty: WorkspaceDirectory = { workspaces: [], sessions: [] };
type Scope = { disposed: boolean; controller: AbortController; pendingClients: Set<SharedWorkspaceClient>; connections: Map<string, { promise: Promise<void>; signal: AbortSignal }> };
const newScope = (): Scope => ({ disposed: false, controller: new AbortController(), pendingClients: new Set(), connections: new Map() });

/** The directory VibeGhost v2 shows: every workspace and session of the VibeGhost this Oathkeeper
 *  reaches directly. Same shape as the iroh directory, so the same UI renders it. Nothing is saved:
 *  there are no invites, and the list is read from VibeGhost each time. */
function useDirectDirectory() {
  const pins = useWorkspacePins();
  // Read VibeGhost when a v2 page is open; elsewhere only when the v2 sidebar branch asks for it.
  const pathname = usePathname() || "";
  const onV2 = true;
  const [client] = useState(() => new DirectWorkspaceClient());
  const shared = useMemo(() => asWorkspaceClient(client), [client]);
  const [directory, setDirectory] = useState<WorkspaceDirectory>(empty);
  const directoryRef = useRef(directory);
  const updateDirectory = useCallback((update: (current: WorkspaceDirectory) => WorkspaceDirectory) => {
    const next = update(directoryRef.current);
    if (next === directoryRef.current) return;
    directoryRef.current = next;
    setDirectory(next);
  }, []);
  const [refreshStatus] = useState(() => new WorkspaceRefreshStatus());
  const workspaceChecks = useSyncExternalStore(refreshStatus.subscribe, refreshStatus.getSnapshot, refreshStatus.getServerSnapshot);
  const clientsRef = useRef(new Map<string, SharedWorkspaceClient>());
  const clientTicketsRef = useRef(new Map<string, string>());
  const connectionScopeRef = useRef<Scope>(newScope());
  const [loadingWorkspaces, setLoading] = useState(onV2);
  const [directoryReady, setReady] = useState(false);
  const [savedWorkspaceError, setError] = useState("");
  const loadedAt = useRef(0);
  const inFlight = useRef<{ scope: Scope; promise: Promise<void> } | null>(null);
  const turn = useRef(0);

  useEffect(() => {
    const scope = newScope();
    connectionScopeRef.current = scope;
    return () => {
      scope.disposed = true; scope.controller.abort();
      for (const item of clientsRef.current.values()) item.close();
      clientsRef.current.clear();
      workspaceQueries.clear();
    };
  }, []);

  const load = useCallback(async (callerSignal?: AbortSignal) => {
    const scope = connectionScopeRef.current;
    const signal = callerSignal ? AbortSignal.any([scope.controller.signal, callerSignal]) : scope.controller.signal;
    const mine = ++turn.current;
    // The same workspaces v1 lists, in its order and under its ids, so the sidebar, pins, links
    // and tabs are v1's. Only the list of saved workspaces is read from Oathkeeper; each one is
    // then read from VibeGhost directly by its workspace id.
    const [response, remoteSessions] = await Promise.all([
      shared.json<RemoteWorkspaceResponse>("GET", "/api/workspaces", undefined, signal),
      shared.json<RemoteSession[]>("GET", "/api/sessions", undefined, signal),
    ]);
    signal.throwIfAborted();
    if (!Array.isArray(remoteSessions) || !remoteSessions.every(item => item && typeof item.id === "string")) throw new Error("VibeGhost sent an invalid session list");
    if (!Array.isArray(response.workspaces)) throw new Error("VibeGhost sent an invalid workspace list");
    if (mine < turn.current) return;
    const instance = readWorkspaceInstance(response.instance);
    const remote = new Map(response.workspaces.map(item => [item.id, item]));
    const saved = response.workspaces.map(item => ({ id: item.id, remoteId: item.id, name: item.name }));
    const workspaces: VibeGhostWorkspace[] = saved.flatMap(({ id, remoteId, name }) => {
      const item = remote.get(remoteId);
      // One client per workspace, scoped like v1's share: per-workspace reads see only that workspace.
      const known = clientsRef.current.get(id);
      const client = known && known.workspaceId === remoteId ? known : asWorkspaceClient(new DirectWorkspaceClient(remoteId, item?.name || name));
      // A saved workspace VibeGhost no longer has is still listed, as v1 lists one it cannot reach.
      return [{
        id, storageId: id, remoteId, name: item?.name || name || "Shared workspace", instance,
        description: item?.description, color: item?.color, iconShape: item?.iconShape, avatarMode: item?.avatarMode,
        defaultWorkingDir: item?.defaultWorkingDir, shared: true, client,
      }];
    });
    const byRemote = new Map(workspaces.map(item => [item.remoteId, item]));
    const clients = new Map(workspaces.map(item => [item.id, item.client!]));
    const byWorkspace = new Map<string, RemoteSession[]>();
    for (const session of remoteSessions) {
      const workspace = byRemote.get(session.workspaceId || "default");
      if (!workspace) continue;
      byWorkspace.set(workspace.id, [...(byWorkspace.get(workspace.id) ?? []), session]);
    }
    const names = new Map(workspaces.map(item => [item.id, item.name]));
    const sessions: VibeGhostSession[] = [...byWorkspace].flatMap(([id, list]) => mapImportedSessions(id, names.get(id) || id, list).map(remote => ({
      ...remote, status: list.find(item => item.id === remote.remoteSessionId)?.status || "Unknown", shared: true as const, client: clients.get(id) ?? shared,
    })));
    clientsRef.current = clients;
    loadedAt.current = Date.now();
    updateDirectory(() => ({ workspaces, sessions }));
  }, [shared, updateDirectory]);

  const loadSavedWorkspaces = useCallback(async () => {
    const scope = connectionScopeRef.current;
    // A load started by an earlier mount is aborted with that mount; never wait on it.
    if (inFlight.current && inFlight.current.scope === scope) return inFlight.current.promise;
    setLoading(true);
    const promise = load().then(() => { if (!scope.disposed) setError(""); }, error => {
      if (scope.disposed) return;
      setError(`Could not reach VibeGhost. ${error instanceof Error ? error.message : ""}`.trim());
    }).finally(() => {
      if (inFlight.current?.promise === promise) inFlight.current = null;
      if (!scope.disposed) { setLoading(false); setReady(true); }
    });
    inFlight.current = { scope, promise };
    return promise;
  }, [load]);

  const ensureDirectoryFresh = useCallback(async () => {
    if (inFlight.current?.scope === connectionScopeRef.current || Date.now() - loadedAt.current < 5_000) return;
    await loadSavedWorkspaces();
  }, [loadSavedWorkspaces]);

  useEffect(() => {
    if (onV2) void ensureDirectoryFresh();
  }, [onV2, ensureDirectoryFresh]);
  useEffect(() => {
    const resume = () => { if (document.visibilityState !== "hidden" && loadedAt.current) void ensureDirectoryFresh(); };
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { window.removeEventListener("focus", resume); window.removeEventListener("online", resume); document.removeEventListener("visibilitychange", resume); };
  }, [ensureDirectoryFresh, loadSavedWorkspaces]);

  const checkWorkspace = useCallback(async (id: string, operation: () => Promise<void>, signal: AbortSignal) => {
    const token = refreshStatus.begin(id);
    try { await operation(); refreshStatus.finish(id, token, signal.aborted ? undefined : ""); }
    catch (error) { refreshStatus.finish(id, token, signal.aborted ? undefined : "Could not refresh this workspace from VibeGhost. Retry to check again."); throw error; }
  }, [refreshStatus]);

  const refreshWorkspaceSessions = useCallback(async (_workspace: VibeGhostWorkspace, callerSignal?: AbortSignal) => { await load(callerSignal); }, [load]);
  const connectInvite = useCallback(async () => { throw new Error("VibeGhost v2 reads every workspace straight from VibeGhost. There is no invite to add."); }, []) as (value: string, persist?: boolean, savedStorageId?: string, callerSignal?: AbortSignal) => Promise<void>;

  const initialLoading = loadingWorkspaces && !directory.workspaces.length;
  return { pins, directory, updateDirectory, clientsRef, clientTicketsRef, connectionScopeRef,
    workspaceChecks, connectInvite, checkWorkspace, refreshWorkspaceSessions,
    loadingWorkspaces, initialLoading, directoryReady, savedWorkspaceError, directoryError: savedWorkspaceError, loadSavedWorkspaces, ensureDirectoryFresh };
}

const V2Owner = createContext<ReturnType<typeof useDirectDirectory> | null>(null);
/** The one v2 directory owner, app-wide (next to v1's), so the v2 sidebar branch and the v2 pages
 *  share it and a route change does not reload it. It reads nothing until a v2 page or branch asks. */
export function VibeGhostV2DirectoryOwner({ children }: { children: ReactNode }) {
  const owner = useDirectDirectory();
  return <V2Owner.Provider value={owner}>{children}</V2Owner.Provider>;
}
/** Everything under it sees VibeGhost through the direct transport instead of iroh. */
export function VibeGhostV2DirectoryProvider({ children }: { children: ReactNode }) {
  const owner = useContext(V2Owner);
  if (!owner) throw new Error("VibeGhostV2DirectoryOwner is required");
  return <VibeGhostDirectoryContext.Provider value={owner}>{children}</VibeGhostDirectoryContext.Provider>;
}
