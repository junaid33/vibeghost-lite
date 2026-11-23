export type WorkspaceInstance = { id: string; name: string; platform: string };

export type RemoteWorkspaceResponse = {
  workspaces?: RemoteWorkspaceMetadata[];
  instance?: unknown;
};

export function readWorkspaceInstance(value: unknown): WorkspaceInstance | undefined {
  if (!value || typeof value !== "object") return;
  const { id, name, platform } = value as Record<string, unknown>;
  if (typeof id !== "string" || !id.trim() || id.length > 128
    || typeof name !== "string" || !name.trim() || name.length > 100
    || typeof platform !== "string" || !platform.trim() || platform.length > 32
    || [...`${id}${name}${platform}`].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return;
  return { id: id.trim(), name: name.trim(), platform: platform.trim() };
}

export function instancePlatformLabel(platform: string) {
  return ({ darwin: "macOS", linux: "Linux", win32: "Windows", freebsd: "FreeBSD", openbsd: "OpenBSD" } as Record<string, string>)[platform] || "Other OS";
}

export type RemoteWorkspaceMetadata = {
  id: string;
  name: string;
  description?: string;
  defaultWorkingDir?: string;
  color?: string;
  iconShape?: string;
  avatarMode?: string;
  sessionCount?: number;
  runningCount?: number;
  exitedCount?: number;
};

export type SessionRecency = {
  startedAt?: string;
  lastModified?: string;
  activityTimeSource?: 'pi' | 'codex' | 'claude' | 'terminal';
};

export type RemoteSession = SessionRecency & import('./session-integrations/agent-identity').AgentIdentityCarrier & {
  command?: string[];
  codexRegistrationAvailable?: boolean;
  agentChatAvailable?: boolean;
  agentActionsAvailable?: boolean;
  agentObservationAvailable?: boolean;
  terminalFollowUpAvailable?: boolean;
  nativeQueueGrant?: import("./session-integrations/agent-provider").NativeQueueGrant;
  id: string;
  workspaceId?: string;
  name?: string;
  title?: string;
  workingDir?: string;
  status?: string;
  tags?: string[];
  piSessionId?: string;
  piSessionPath?: string;
  agentStatus?: string;
  agentPhase?: string;
  gitRepoPath?: string | null;
  gitBranch?: string | null;
  gitModifiedCount?: number;
  gitAddedCount?: number;
  gitDeletedCount?: number;
  gitStagedCount?: number;
  gitUntrackedCount?: number;
};

export type ImportedSessionRecord = SessionRecency & import('./session-integrations/agent-identity').AgentIdentityCarrier & {
  command?: string[];
  codexRegistrationAvailable?: boolean;
  agentChatAvailable?: boolean;
  agentActionsAvailable?: boolean;
  agentObservationAvailable?: boolean;
  terminalFollowUpAvailable?: boolean;
  nativeQueueGrant?: import("./session-integrations/agent-provider").NativeQueueGrant;
  id: string;
  title: string;
  cwd: string;
  state: "Running" | "Idle";
  remoteSessionId: string;
  workspaceId: string;
  agentStatus?: string;
  agentPhase?: string;
  tags?: string[];
  piSessionId?: string;
  piSessionPath?: string;
  gitRepoPath?: string | null;
  gitBranch?: string | null;
  gitModifiedCount?: number;
  gitAddedCount?: number;
  gitDeletedCount?: number;
  gitStagedCount?: number;
  gitUntrackedCount?: number;
};

export type SharedBrowseFile = {
  name: string;
  path: string;
  type: "directory" | "file";
};

export type SharedGitFile = {
  path: string;
  status: "modified" | "added" | "deleted" | "untracked" | "renamed" | string;
};

export type SharedGitStatus = {
  isGitRepo?: boolean;
  repoPath?: string;
  currentBranch?: string;
  hasChanges?: boolean;
  changedFiles?: SharedGitFile[];
  stagedFiles?: SharedGitFile[];
  allChangedFiles?: SharedGitFile[];
  stagedCount?: number;
  modifiedCount?: number;
  addedCount?: number;
  deletedCount?: number;
  untrackedCount?: number;
  aheadCount?: number;
  behindCount?: number;
  hasUpstream?: boolean;
  remoteUrl?: string;
};

export function getWorkspaceCapabilityId(ticket: string) {
  try {
    const padded = ticket.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(ticket.length / 4) * 4, "=");
    const data = JSON.parse(atob(padded)) as { endpointId?: unknown; workspaceId?: unknown };
    if (typeof data.endpointId === "string" && data.endpointId && typeof data.workspaceId === "string" && data.workspaceId) {
      return `${data.endpointId}:${data.workspaceId}`;
    }
  } catch {}
  throw new Error("The workspace invite is missing its Iroh endpoint identity");
}

/** The local ID of a session in a connected workspace. */
export const sharedSessionId = (workspaceId: string, remoteSessionId: string) => `iroh-${workspaceId}-${remoteSessionId}`;

export function mapImportedSessions(
  workspaceId: string,
  workspaceName: string,
  remoteSessions: RemoteSession[]
): ImportedSessionRecord[] {
  return remoteSessions.map((remote) => ({
    id: sharedSessionId(workspaceId, remote.id),
    title: remote.name || remote.title || `Shared session ${remote.id.slice(0, 6)}`,
    cwd: remote.workingDir || workspaceName || "Iroh encrypted peer session",
    state: remote.status === "exited" ? "Idle" : "Running",
    remoteSessionId: remote.id,
    workspaceId,
    agentStatus: remote.agentStatus,
    agentPhase: remote.agentPhase,
    tags: remote.tags,
    startedAt: remote.startedAt,
    lastModified: remote.lastModified,
    activityTimeSource: remote.activityTimeSource,
    command: remote.command,
    agentIdentity: remote.agentIdentity,
    codexRegistrationAvailable: remote.codexRegistrationAvailable,
    agentChatAvailable: remote.agentChatAvailable === true,
    // Left undefined for gateways that predate the split so chat availability still applies.
    agentActionsAvailable: typeof remote.agentActionsAvailable === 'boolean' ? remote.agentActionsAvailable : undefined,
    agentObservationAvailable: typeof remote.agentObservationAvailable === 'boolean' ? remote.agentObservationAvailable : undefined,
    terminalFollowUpAvailable: remote.terminalFollowUpAvailable === true,
    nativeQueueGrant: remote.nativeQueueGrant,
    piSessionId: remote.piSessionId,
    piSessionPath: remote.piSessionPath,
    gitRepoPath: remote.gitRepoPath,
    gitBranch: remote.gitBranch,
    gitModifiedCount: remote.gitModifiedCount,
    gitAddedCount: remote.gitAddedCount,
    gitDeletedCount: remote.gitDeletedCount,
    gitStagedCount: remote.gitStagedCount,
    gitUntrackedCount: remote.gitUntrackedCount,
  }));
}

export function preferredImportedSessionId(sessions: ImportedSessionRecord[]) {
  return sessions.find((session) => session.state === "Running")?.id || sessions[0]?.id || "";
}

export function resolveSharedBrowsePath(basePath: string, filePath: string) {
  if (filePath.startsWith("/")) return filePath;
  const parts = `${basePath}/${filePath}`.split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") resolved.pop();
    else resolved.push(part);
  }
  return `/${resolved.join("/")}`;
}

export function normalizeSharedBrowseFiles(files: SharedBrowseFile[] | undefined, basePath: string) {
  return (files || [])
    .filter((file) => isSafeImmediateChildName(file.name))
    .map((file) => ({
      ...file,
      path: resolveSharedBrowsePath(basePath, file.name),
    }));
}

function isSafeImmediateChildName(name: unknown): name is string {
  return typeof name === "string" && Boolean(name) && name !== "." && name !== ".." && !name.includes("/") && !name.includes("\\") && !name.includes("\0");
}

export function sharedGitChangeCount(status: SharedGitStatus | null | undefined) {
  if (status?.allChangedFiles) return status.allChangedFiles.length;
  return (status?.modifiedCount || 0) + (status?.addedCount || 0) + (status?.deletedCount || 0);
}
