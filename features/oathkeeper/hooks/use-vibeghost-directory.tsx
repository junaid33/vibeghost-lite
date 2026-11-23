"use client";

import { createContext, useContext, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cacheWorkspaceDirectory, directoryRefreshKey, readWorkspaceDirectory, workspaceQueries, type WorkspaceDirectory } from '../lib/workspace-directory-cache';
import { SharedWorkspaceClient } from '../lib/shared-workspace-client';
import { getWorkspaceCapabilityId, mapImportedSessions, readWorkspaceInstance, type RemoteSession, type RemoteWorkspaceResponse } from '../lib/shared-workspace-model';
import { workspaceDeadline, workspaceDiagnostic } from '../lib/workspace-connection-lifecycle';
import { WorkspaceRefreshStatus, workspaceRefreshSummary } from '../lib/workspace-refresh-status';
import { usePathname } from 'next/navigation';
import { workspaceNavigationEvent } from '../lib/vibeghost-navigation';
import { VIBEGHOST_V2_ROOT } from '../lib/vibeghost-routes';
import { useWorkspacePins } from './use-workspace-pins';
import type { VibeGhostSession, VibeGhostWorkspace } from '../components/vibeghost-view';

type SavedVibeGhostWorkspace = { id: string; name: string; ticket: string; addedAt: string };

// One app-scoped owner for authenticated workspace connections. The sidebar,
// overview and terminal consume it; route changes never tear it down. Only
// whitelisted display metadata is copied to the separate query cache.
const isV2Path = (path: string | null) => Boolean(path) && (path === VIBEGHOST_V2_ROOT || path!.startsWith(`${VIBEGHOST_V2_ROOT}/`));

function useDirectoryOwner() {
  const pins = useWorkspacePins();
  // VibeGhost v2 talks to VibeGhost directly and must not open iroh: on /vibeghost-v2 this owner
  // dials nothing. Connections already open from another page stay as they are; they idle out.
  const dialing = !isV2Path(usePathname());
  const dialingRef = useRef(dialing);
  useEffect(() => { dialingRef.current = dialing; }, [dialing]);
  const [directory, setDirectory] = useState<WorkspaceDirectory>(readWorkspaceDirectory);
  const directoryRef = useRef(directory);
  const { workspaces, sessions } = directory;
  const updateDirectory = useCallback((update: (current: WorkspaceDirectory) => WorkspaceDirectory) => {
    const next = update(directoryRef.current);
    if (next === directoryRef.current) return;
    directoryRef.current = next;
    setDirectory(next);
    cacheWorkspaceDirectory(next);
  }, []);
  const [refreshStatus] = useState(() => new WorkspaceRefreshStatus());
  const workspaceChecks = useSyncExternalStore(refreshStatus.subscribe, refreshStatus.getSnapshot, refreshStatus.getServerSnapshot);
  const clientsRef = useRef(new Map<string, SharedWorkspaceClient>());
  const clientTicketsRef = useRef(new Map<string, string>());
  const connectionScopeRef = useRef({ disposed: false, controller: new AbortController(), pendingClients: new Set<SharedWorkspaceClient>(), connections: new Map<string, { promise: Promise<void>; signal: AbortSignal }>() });
  // A workspace's session lists can come back out of order: a background refresh that started before
  // a resume can land after the refresh that follows it and drop the new session. Take a turn before
  // asking; a list older than the one already shown is not applied.
  const sessionListTurnsRef = useRef(new Map<string, { asked: number; shown: number }>());
  const takeSessionListTurn = useCallback((workspaceId: string) => {
    const turns = sessionListTurnsRef.current.get(workspaceId) ?? { asked: 0, shown: 0 };
    sessionListTurnsRef.current.set(workspaceId, turns);
    const turn = ++turns.asked;
    return () => { if (turn < turns.shown) return false; turns.shown = turn; return true; };
  }, []);
  useEffect(() => {
    const clients = clientsRef.current;
    const scope = { disposed: false, controller: new AbortController(), pendingClients: new Set<SharedWorkspaceClient>(), connections: new Map<string, { promise: Promise<void>; signal: AbortSignal }>() };
    connectionScopeRef.current = scope;
    return () => {
      scope.disposed = true;
      scope.controller.abort();
      clientTicketsRef.current.clear();
      for (const client of scope.pendingClients) client.close();
      for (const client of clients.values()) client.close();
      clients.clear();
    };
  }, []);

  const connectInviteAttempt = useCallback(async (value: string, persist = true, savedStorageId?: string, callerSignal?: AbortSignal) => {
    const ticket = value.trim().replace(/^.*#/, "");
    if (!ticket) throw new Error("Paste a workspace invite or connection ID");
    const scope = connectionScopeRef.current;
    const signal = callerSignal ? AbortSignal.any([scope.controller.signal, callerSignal]) : scope.controller.signal;
    signal.throwIfAborted();
    const client = await SharedWorkspaceClient.connect(ticket);
    if (scope.disposed || signal.aborted) { client.close(); throw new Error("Workspace connection canceled"); }
    scope.pendingClients.add(client);
    const attempt=crypto.randomUUID().slice(0,8);const started=performance.now();
    workspaceDiagnostic(attempt,'loading workspace','started',0);
    try {
      const capabilityId = getWorkspaceCapabilityId(ticket);
      const showSessions = takeSessionListTurn(capabilityId);
      const [workspaceResponse, remoteSessions] = await workspaceDeadline(Promise.all([
        client.json<RemoteWorkspaceResponse>("GET", "/api/workspaces", undefined, signal),
        client.json<RemoteSession[]>("GET", "/api/sessions", undefined, signal),
      ]),'loading workspace',20_000);
      signal.throwIfAborted();
      if (scope.disposed) throw new Error("Workspace connection canceled");
      workspaceDiagnostic(attempt,'loading workspace','completed',performance.now()-started);
      const metadata = workspaceResponse.workspaces?.find((item) => item.id === client.workspaceId) || workspaceResponse.workspaces?.[0];
      const workspaceName = metadata?.name || client.workspaceName || "Shared workspace";
      const previousInstance = directoryRef.current.workspaces.find(item => item.id === capabilityId)?.instance;
      const workspace: VibeGhostWorkspace = {
        id: capabilityId,
        storageId: persist ? capabilityId : savedStorageId || capabilityId,
        remoteId: client.workspaceId,
        name: workspaceName,
        instance: readWorkspaceInstance(workspaceResponse.instance) ?? previousInstance,
        description: metadata?.description,
        color: metadata?.color,
        iconShape: metadata?.iconShape,
        avatarMode: metadata?.avatarMode,
        defaultWorkingDir: metadata?.defaultWorkingDir,
        shared: true,
        client,
      };
      const importedSessions: VibeGhostSession[] = mapImportedSessions(capabilityId, workspaceName, remoteSessions).map((remote) => ({
        ...remote,
        status: remoteSessions.find((item) => item.id === remote.remoteSessionId)?.status || "Unknown",
        shared: true,
        client,
      }));
      if (persist) {
        workspaceDiagnostic(attempt,'saving invite','started',performance.now()-started);
        const response = await fetch("/api/vibeghost/workspaces", {
          signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: capabilityId, name: workspaceName, ticket }),
        });
        if (!response.ok) throw new Error("Could not save this workspace to ~/.oathkeeper/apps/vibeghost");
        workspaceDiagnostic(attempt,'saving invite','completed',performance.now()-started);
      }

      signal.throwIfAborted();
      if (scope.disposed) throw new Error("Workspace connection canceled");
      const previousClient = clientsRef.current.get(capabilityId);
      clientsRef.current.set(capabilityId, client);
      clientTicketsRef.current.set(capabilityId, ticket);
      updateDirectory(current => ({
        workspaces: current.workspaces.some(item => item.id === capabilityId)
          ? current.workspaces.map(item => item.id === capabilityId ? workspace : item)
          : [...current.workspaces, workspace],
        sessions: showSessions()
          ? [...current.sessions.filter(item => item.workspaceId !== capabilityId), ...importedSessions]
          : current.sessions.map(item => item.workspaceId === capabilityId ? { ...item, client } : item),
      }));
      if (persist) window.dispatchEvent(new Event(workspaceNavigationEvent));
      if (previousClient && previousClient !== client) window.setTimeout(() => previousClient.close(), 0);
    } catch (error) {
      workspaceDiagnostic(attempt,'loading workspace','failed',performance.now()-started);
      client.close();
      throw error;
    } finally { scope.pendingClients.delete(client); }
  }, [takeSessionListTurn, updateDirectory]);

  const checkWorkspace = useCallback(async (id: string, operation: () => Promise<void>, signal: AbortSignal, connecting = false) => {
    const scope = connectionScopeRef.current;
    const token = refreshStatus.begin(id);
    try {
      await operation();
      if (!scope.disposed) refreshStatus.finish(id, token, signal.aborted ? undefined : '');
    } catch (error) {
      if (!scope.disposed) refreshStatus.finish(id, token, signal.aborted ? undefined : connecting
        ? 'Could not connect using this saved workspace invite. Check that sharing is online, then retry.'
        : 'Could not refresh this workspace’s details. Existing sessions may still work. Retry to check again.');
      throw error;
    }
  }, [refreshStatus]);

  const connectInvite = useCallback((value: string, persist = true, savedStorageId?: string, callerSignal?: AbortSignal) => {
    const scope = connectionScopeRef.current;
    const signal = callerSignal || scope.controller.signal;
    const key = getWorkspaceCapabilityId(value.trim().replace(/^.*#/, ""));
    const current = scope.connections.get(key);
    if (current && !current.signal.aborted && !persist) return current.promise;
    const pending = (async () => {
      // Cancel stale reads before a write. The display cache is a separate query,
      // so cancellation cannot roll back a confirmed removal or new invite.
      if (persist) await workspaceQueries.cancelQueries({ queryKey: directoryRefreshKey });
      if (persist) await checkWorkspace(key, () => connectInviteAttempt(value, persist, savedStorageId, signal), signal, true);
      else await connectInviteAttempt(value, persist, savedStorageId, signal);
    })().finally(() => {
      if (scope.connections.get(key)?.promise === pending) scope.connections.delete(key);
    });
    scope.connections.set(key, { promise: pending, signal });
    return pending;
  }, [connectInviteAttempt, checkWorkspace]);

  const refreshWorkspaceSessions = useCallback(async (workspace: VibeGhostWorkspace, callerSignal?: AbortSignal) => {
    const scope = connectionScopeRef.current;
    const client = workspace.client;
    if (!client) return;
    const signal = callerSignal ? AbortSignal.any([scope.controller.signal, callerSignal]) : scope.controller.signal;
    const showSessions = takeSessionListTurn(workspace.id);
    const [remoteSessions, response] = await Promise.all([
      client.json<RemoteSession[]>('GET', '/api/sessions', undefined, signal),
      client.json<RemoteWorkspaceResponse>('GET', '/api/workspaces', undefined, signal),
    ]);
    signal.throwIfAborted();
    if (scope.disposed || clientsRef.current.get(workspace.id) !== client) return;
    if (!Array.isArray(remoteSessions) || !remoteSessions.every(item => item && typeof item.id === 'string')) throw new Error('Invalid session list');
    const metadata = response.workspaces?.find(item => item.id === workspace.remoteId);
    if (!metadata) throw new Error('Workspace metadata unavailable');
    if (!showSessions()) return;
    const refreshed = mapImportedSessions(workspace.id, metadata.name, remoteSessions).map(remote => ({ ...remote, status: remoteSessions.find(item => item.id === remote.remoteSessionId)?.status || 'Unknown', shared: true, client }));
    updateDirectory(current => ({
      workspaces: current.workspaces.map(item => item.id === workspace.id ? {
        ...item, name: metadata.name, description: metadata.description, color: metadata.color,
        iconShape: metadata.iconShape, avatarMode: metadata.avatarMode,
        defaultWorkingDir: metadata.defaultWorkingDir, instance: readWorkspaceInstance(response.instance) ?? item.instance,
      } : item),
      sessions: [...current.sessions.filter(item => item.workspaceId !== workspace.id), ...refreshed],
    }));
  }, [takeSessionListTurn, updateDirectory]);

  // Session activity (working, idle, needs you) is read through existing connections when the
  // page loads and whenever the tab or window regains focus; there is no timer. Never redial
  // or replace session objects unless their status actually changed.
  useEffect(() => {
    const controller = new AbortController();
    const pending = new Set<string>();
    const poll = () => {
      if (document.visibilityState === 'hidden' || controller.signal.aborted || !dialingRef.current) return;
      for (const workspace of directoryRef.current.workspaces) {
        const client = workspace.client;
        if (!client || pending.has(workspace.id)) continue;
        pending.add(workspace.id);
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]);
        void client.json<RemoteSession[]>('GET', '/api/sessions', undefined, signal).then(remote => {
          if (signal.aborted || clientsRef.current.get(workspace.id) !== client) return;
          if (!Array.isArray(remote)) return;
          const byId = new Map(remote.filter(item => item && typeof item.id === 'string').map(item => [item.id, item]));
          updateDirectory(current => {
            let changed = false;
            const sessions = current.sessions.map(session => {
              if (session.workspaceId !== workspace.id) return session;
              const latest = byId.get(session.remoteSessionId || session.id);
              if (!latest) return session;
              if (session.status === latest.status && session.agentStatus === latest.agentStatus && session.agentPhase === latest.agentPhase) return session;
              changed = true;
              return { ...session, status: latest.status, agentStatus: latest.agentStatus, agentPhase: latest.agentPhase };
            });
            return changed ? { ...current, sessions } : current;
          });
        }).catch(() => {
          // Keep the last known activity on transport failure; do not invent idle.
        }).finally(() => pending.delete(workspace.id));
      }
    };
    poll();
    document.addEventListener('visibilitychange', poll);
    window.addEventListener('focus', poll);
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', poll);
      window.removeEventListener('focus', poll);
    };
  }, [updateDirectory]);

  const refreshQuery = useQuery({
    queryKey: directoryRefreshKey,
    enabled: dialing,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    networkMode: 'always',
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // Metadata is fetched on demand, never on a repeating timer.
    refetchInterval: false,
    refetchIntervalInBackground: false,
    queryFn: async ({ signal: querySignal }) => {
      const scope = connectionScopeRef.current;
      const signal = AbortSignal.any([scope.controller.signal, querySignal]);
      let desired: Map<string, SavedVibeGhostWorkspace>;
      try {
        const response = await fetch('/api/vibeghost/workspaces', { cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) });
        if (!response.ok) throw new Error('Saved workspace request failed');
        const payload = await response.json();
        if (!Array.isArray(payload?.workspaces) || !payload.workspaces.every((item: SavedVibeGhostWorkspace) => item && typeof item.id === 'string' && typeof item.ticket === 'string' && typeof item.name === 'string')) throw new Error('Invalid saved workspace response');
        desired = new Map(payload.workspaces.map((item: SavedVibeGhostWorkspace) => [getWorkspaceCapabilityId(item.ticket), item]));
      } catch {
        signal.throwIfAborted();
        throw new Error('Could not load saved VibeGhost workspaces. Showing the last saved list; retry to recover your connections. No new invite is needed.');
      }
      signal.throwIfAborted();
      if (scope.disposed) return null;
      // Only a successful authoritative manifest may prune rows or retire owners.
      // A changed ticket with the same public identity must not reuse old authority.
      for (const [id, client] of clientsRef.current) {
        if (!desired.has(id) || clientTicketsRef.current.get(id) !== desired.get(id)!.ticket) {
          clientsRef.current.delete(id); clientTicketsRef.current.delete(id); client.close();
        }
      }
      updateDirectory(current => {
        const retained = current.workspaces.filter(item => desired.has(item.id)).map(item => ({ ...item, storageId: desired.get(item.id)!.id, client: clientsRef.current.get(item.id) }));
        const known = new Set(retained.map(item => item.id));
        for (const [id, item] of desired) if (!known.has(id)) retained.push({ id, storageId: item.id, remoteId: '', name: item.name, shared: true, client: undefined });
        return { workspaces: retained, sessions: current.sessions.filter(item => !item.workspaceId || desired.has(item.workspaceId)).map(item => ({ ...item, client: item.workspaceId ? clientsRef.current.get(item.workspaceId) : undefined })) };
      });
      refreshStatus.retain(new Set(desired.keys()));
      await Promise.allSettled([...desired].map(([id, item]) => {
        const current = directoryRef.current.workspaces.find(workspace => workspace.id === id);
        return checkWorkspace(id, () => current?.client
          ? refreshWorkspaceSessions(current, signal)
          : connectInvite(item.ticket, false, item.id, signal), signal, !current?.client);
      }));
      signal.throwIfAborted();
      if (scope.disposed) return null;
      return Date.now();
    },
  }, workspaceQueries);
  const { refetch } = refreshQuery;
  const loadingWorkspaces = refreshQuery.isFetching;
  const initialLoading = loadingWorkspaces && !workspaces.length;
  // Every saved workspace has been checked at least once (or the load failed): counts read now won't still be filling in.
  const directoryReady = refreshQuery.isFetched;
  const savedWorkspaceError = refreshQuery.error instanceof Error ? refreshQuery.error.message : '';
  const directoryError = savedWorkspaceError || workspaceRefreshSummary(workspaceChecks, new Map(workspaces.map(item => [item.id, item.name])));
  const loadSavedWorkspaces = useCallback(async () => { if (dialingRef.current) await refetch({ cancelRefetch: false }); }, [refetch]);

  const ensureDirectoryFresh = useCallback(async () => {
    const cached = workspaceQueries.getQueryState(directoryRefreshKey);
    if (cached?.fetchStatus === 'fetching') return;
    if (cached?.status === 'success' && !cached.isInvalidated && Date.now() - cached.dataUpdatedAt < 15_000) return;
    await loadSavedWorkspaces();
  }, [loadSavedWorkspaces]);

  useEffect(() => {
    workspaceQueries.mount();
    const resume = () => { if (document.visibilityState !== 'hidden') void ensureDirectoryFresh(); };
    const changed = () => { void loadSavedWorkspaces(); };
    window.addEventListener('online', resume);
    window.addEventListener('pageshow', resume);
    window.addEventListener('focus', resume);
    window.addEventListener(workspaceNavigationEvent, changed);
    document.addEventListener('visibilitychange', resume);
    return () => {
      workspaceQueries.unmount();
      window.removeEventListener('online', resume);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('focus', resume);
      window.removeEventListener(workspaceNavigationEvent, changed);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [ensureDirectoryFresh, loadSavedWorkspaces]);

  return { pins, directory, updateDirectory, clientsRef, clientTicketsRef, connectionScopeRef,
    workspaceChecks, connectInvite, checkWorkspace, refreshWorkspaceSessions,
    loadingWorkspaces, initialLoading, directoryReady, savedWorkspaceError, directoryError, loadSavedWorkspaces, ensureDirectoryFresh };
}

const DirectoryContext = createContext<ReturnType<typeof useDirectoryOwner> | null>(null);
/** VibeGhost v2 provides its own directory (direct transport) to the same UI through this context. */
export const VibeGhostDirectoryContext = DirectoryContext;
export function VibeGhostDirectoryProvider({ children }: { children: ReactNode }) {
  const owner = useDirectoryOwner();
  return <DirectoryContext.Provider value={owner}>{children}</DirectoryContext.Provider>;
}
export function useVibeGhostDirectory() {
  const owner = useContext(DirectoryContext);
  if (!owner) throw new Error('VibeGhostDirectoryProvider is required');
  return owner;
}
