"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Folder,
  RefreshCw,
  Settings,
  XOutline } from "@/components/icons/duo";
import { Spinner } from "@/components/ui/spinner";
import { HalftoneDots } from "@/components/ui/halftone-dots";
import { Book2, Compass, Box2 } from "@/components/icons/duo";
import { InspectorSection } from "./inspector-section";
import { SharedGitHistory } from "./shared-git-history";
import { type CodeViewItem, parseDiffFromFile } from "@pierre/diffs";
import { CodeView } from "@pierre/diffs/react";
import { cn } from "@/lib/utils";
import styles from "./shared-workspace-inspector.module.css";
import { useAiConfig } from "../hooks/use-ai-config";
import { SimpleSettingsPopover } from "./dual-sidebar/simple-settings-popover";
import { aiRequestFields } from "@/features/oathkeeper/lib/ai-request";
import type { SharedWorkspaceClient } from "@/features/oathkeeper/lib/shared-workspace-client";
import {
  normalizeSharedBrowseFiles,
  sharedGitChangeCount,
  type SharedBrowseFile,
  type SharedGitFile,
  type SharedGitStatus,
} from "@/features/oathkeeper/lib/shared-workspace-model";

type InspectableSession = {
  id: string;
  remoteSessionId?: string;
  cwd: string;
  gitRepoPath?: string | null;
  gitBranch?: string | null;
  gitModifiedCount?: number;
  gitAddedCount?: number;
  gitDeletedCount?: number;
  gitStagedCount?: number;
  gitUntrackedCount?: number;
};

type LoadState = "idle" | "loading" | "ready" | "error";
type FilePreview = { path: string; name: string; kind: "file" | "diff"; content?: string; originalContent?: string; modifiedContent?: string; error?: string };

export function SharedWorkspaceInspector({
  session,
  client,
  open,
  onOpenChange,
}: {
  session: InspectableSession;
  client: SharedWorkspaceClient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<"changes" | "files" | "history">("changes");
  const [gitStatus, setGitStatus] = useState<SharedGitStatus | null>(null);
  const [gitState, setGitState] = useState<LoadState>("idle");
  const [gitError, setGitError] = useState("");
  const [files, setFiles] = useState<SharedBrowseFile[]>([]);
  const [fileState, setFileState] = useState<LoadState>("idle");
  const [fileError, setFileError] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [directoryChildren, setDirectoryChildren] = useState<Record<string, SharedBrowseFile[]>>({});
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(() => new Set());
  const [directoryErrors, setDirectoryErrors] = useState<Record<string, string>>({});
  const [refreshEpoch, setRefreshEpoch] = useState(0);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [previewState, setPreviewState] = useState<LoadState>("idle");
  const [activePath, setActivePath] = useState("");

  const loadGitStatus = useCallback(async (initial = false) => {
    if (initial) setGitState("loading");
    setGitError("");
    try {
      const next = await client.json<SharedGitStatus>(
        "GET",
        `/api/git/status?path=${encodeURIComponent(session.cwd)}`
      );
      setGitStatus(next);
      setGitState("ready");
    } catch (error) {
      setGitError(error instanceof Error ? error.message : "Could not load source-control status");
      setGitState("error");
    }
  }, [client, session.cwd]);

  const loadRootFiles = useCallback(async () => {
    setFileState("loading");
    setFileError("");
    try {
      const response = await client.json<{ files?: SharedBrowseFile[] }>(
        "GET",
        `/api/fs/browse?path=${encodeURIComponent(session.cwd)}`
      );
      setFiles(normalizeSharedBrowseFiles(response.files, session.cwd));
      setExpandedPaths(new Set());
      setDirectoryChildren({});
      setDirectoryErrors({});
      setFileState("ready");
    } catch (error) {
      setFiles([]);
      setFileError(error instanceof Error ? error.message : "Could not browse this workspace");
      setFileState("error");
    }
  }, [client, session.cwd]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setGitStatus(null);
    setGitState("loading");
    setGitError("");
    const load = async () => {
      try {
        const next = await client.json<SharedGitStatus>(
          "GET",
          `/api/git/status?path=${encodeURIComponent(session.cwd)}`
        );
        if (!cancelled) {
          setGitStatus(next);
          setGitState("ready");
          setGitError("");
        }
      } catch (error) {
        if (!cancelled) {
          setGitState("error");
          setGitError(error instanceof Error ? error.message : "Could not load source-control status");
        }
      }
    };
    void load();
    // Fetch when opened, switched, or explicitly refreshed—not on a timer.
    return () => { cancelled = true; };
  }, [client, open, refreshEpoch, session.cwd]);

  useEffect(() => {
    if (!open) return;
    void loadRootFiles();
  }, [loadRootFiles, open, refreshEpoch]);

  const toggleDirectory = useCallback(async (file: SharedBrowseFile) => {
    if (file.type !== "directory") return;
    if (expandedPaths.has(file.path) && !directoryErrors[file.path]) {
      setExpandedPaths((current) => {
        const next = new Set(current);
        next.delete(file.path);
        return next;
      });
      return;
    }

    setExpandedPaths((current) => new Set(current).add(file.path));
    if (directoryChildren[file.path]) return;
    setLoadingPaths((current) => new Set(current).add(file.path));
    setDirectoryErrors((current) => {
      const next = { ...current };
      delete next[file.path];
      return next;
    });
    try {
      const response = await client.json<{ files?: SharedBrowseFile[] }>(
        "GET",
        `/api/fs/browse?path=${encodeURIComponent(file.path)}`
      );
      setDirectoryChildren((current) => ({
        ...current,
        [file.path]: normalizeSharedBrowseFiles(response.files, file.path),
      }));
    } catch (error) {
      setDirectoryErrors((current) => ({
        ...current,
        [file.path]: error instanceof Error ? error.message : "Could not open this folder",
      }));
    } finally {
      setLoadingPaths((current) => {
        const next = new Set(current);
        next.delete(file.path);
        return next;
      });
    }
  }, [client, directoryChildren, directoryErrors, expandedPaths]);

  const openFile = useCallback(async (path: string, kind: "file" | "diff") => {
    const name = path.split("/").filter(Boolean).at(-1) || path;
    setPreview({ path, name, kind });
    setActivePath(path);
    setPreviewState("loading");
    try {
      if (kind === "diff") {
        const response = await client.json<{ originalContent?: string; modifiedContent?: string }>("GET", `/api/fs/diff-content?path=${encodeURIComponent(path)}`);
        setPreview({ path, name, kind, originalContent: response.originalContent || "", modifiedContent: response.modifiedContent || "" });
      } else {
        const response = await client.json<{ content?: string }>("GET", `/api/fs/content?path=${encodeURIComponent(path)}`);
        setPreview({ path, name, kind, content: response.content || "" });
      }
      setPreviewState("ready");
    } catch (error) {
      setPreview({ path, name, kind, error: error instanceof Error ? error.message : "Could not open this file" });
      setPreviewState("error");
    }
  }, [client]);

  const fallbackChangeCount =
    (session.gitModifiedCount || 0) +
    (session.gitAddedCount || 0) +
    (session.gitDeletedCount || 0) +
    (session.gitUntrackedCount || 0);
  const changeCount = gitStatus ? sharedGitChangeCount(gitStatus) : fallbackChangeCount;

  return (
    <Tabs value={tab} onValueChange={(value) => { if (value === 'changes' || value === 'files' || value === 'history') setTab(value); }} asChild>
    <aside aria-label="Shared workspace inspector" className={cn(styles.inspector, !open && styles.hidden)}>
      <header data-inspector-toolbar className={styles.toolbar}>
        {preview ? <>
          <button type="button" onClick={() => setPreview(null)} aria-label="Back to workspace files" className={styles.iconButton}><ArrowLeft className="size-4"/></button>
          <span className={styles.previewTitle} title={preview.path}>{preview.name}</span>
          <span className={styles.muted}>Read only</span>
        </> : <>
          <TabsList aria-label="Workspace inspector views" className={styles.tabs}>
            <TabsTrigger value="changes" className={styles.tab}><FileText className="size-3.5" aria-hidden="true"/>Changes <CountLabel>{changeCount}</CountLabel></TabsTrigger>
            <TabsTrigger value="files" className={styles.tab}><Folder className="size-3.5" aria-hidden="true"/>Files</TabsTrigger>
            <TabsTrigger value="history" className={styles.tab}><Book2 className="size-3.5" aria-hidden="true"/>History</TabsTrigger>
          </TabsList>
          <button type="button" onClick={() => setRefreshEpoch((current) => current + 1)} aria-label="Refresh workspace inspector" title="Refresh workspace inspector" className={cn(styles.iconButton, styles.refresh)}>{gitState === "loading" ? <Spinner className="size-3.5"/> : <RefreshCw className="size-3.5"/>}</button>
        </>}
        <button type="button" onClick={() => onOpenChange(false)} aria-label="Close workspace inspector" title="Close workspace inspector" className={styles.iconButton}><XOutline className="size-4"/></button>
      </header>
      <div className={styles.body}>
        {preview ? <PierreFilePreview preview={preview} state={previewState} onRetry={() => void openFile(preview.path, preview.kind)}/> : <>
          <TabsContent value="changes" className={styles.tabPanel}><SourceControlPanel client={client} session={session} status={gitStatus} state={gitState} error={gitError} changeCount={changeCount} onOpenFile={(path) => void openFile(path, "diff")} onRetry={() => void loadGitStatus(true)}/></TabsContent>
          <TabsContent value="history" className={styles.tabPanel}><SharedGitHistory client={client} cwd={session.cwd} remoteUrl={gitStatus?.remoteUrl} refreshEpoch={refreshEpoch}/></TabsContent>
          <TabsContent value="files" className={styles.tabPanel}><FileTreePanel files={files} state={fileState} error={fileError} expandedPaths={expandedPaths} directoryChildren={directoryChildren} loadingPaths={loadingPaths} directoryErrors={directoryErrors} activePath={activePath} onToggleDirectory={(file) => void toggleDirectory(file)} onOpenFile={(path) => void openFile(path, "file")} onRetry={() => void loadRootFiles()}/></TabsContent>
        </>}
      </div>
    </aside>
    </Tabs>
  );
}

function CountLabel({ children }: { children: React.ReactNode }) {
  return <span data-inspector-count className={styles.count}>{children}</span>;
}

function SourceControlPanel({
  client,
  session,
  status,
  state,
  error,
  changeCount,
  onRetry,
  onOpenFile,
}: {
  client: SharedWorkspaceClient;
  session: InspectableSession;
  status: SharedGitStatus | null;
  state: LoadState;
  error: string;
  changeCount: number;
  onRetry: () => void;
  onOpenFile: (path: string) => void;
}) {
  const repoPath = status?.repoPath || session.gitRepoPath || session.cwd;
  const repoName = repoPath.split("/").filter(Boolean).at(-1) || "Workspace";
  const branch = status?.currentBranch || session.gitBranch || "No branch";
  const staged = status?.stagedFiles || [];
  const changed = status?.changedFiles || status?.allChangedFiles || [];
  const isGitRepo = status?.isGitRepo ?? Boolean(session.gitRepoPath || session.gitBranch);
  const { config } = useAiConfig();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pending = useRef(false);
  const [actionError, setActionError] = useState("");
  const writable = client.supportsGitWrites && Boolean(session.remoteSessionId);
  const mutate = async (action: "stage" | "unstage" | "revert" | "commit" | "pull" | "push", files?: string[]) => {
    if (!writable || pending.current) return;
    pending.current = true; setBusy(true); setPendingAction(action); setActionError("");
    try {
      await client.json("POST", `/api/sessions/${encodeURIComponent(session.remoteSessionId!)}/git/${action}`, { path: session.cwd, expectedRepoPath: repoPath, sessionId: session.remoteSessionId, mode: "active-session", ...(files ? { files } : action === "commit" ? { message } : {}) });
      if (action === "commit") setMessage("");
      onRetry();
    } catch (error) { setActionError(error instanceof Error ? error.message : "Git action failed."); }
    finally { pending.current = false; setBusy(false); setPendingAction(null); }
  };
  const revert = (files: SharedGitFile[]) => {
    const untracked = files.filter((file) => file.status === "untracked").length;
    const subject = files.length === 1 ? files[0].path : `${files.length} files`;
    if (confirm(`Discard all changes in ${subject}?${untracked ? ` ${untracked} untracked ${untracked === 1 ? "file" : "files"} will be deleted.` : ""} Staged changes are kept. This cannot be undone.`)) void mutate("revert", files.map((file) => file.path));
  };
  const generate = async () => {
    if (!writable || pending.current) return;
    const ai = aiRequestFields(config);
    if (!ai) { setActionError(""); setSettingsOpen(true); return; }
    pending.current = true; setBusy(true); setPendingAction("draft"); setActionError("");
    const snapshot = message;
    try {
      const context = await client.json<{ diff: string; truncated: boolean }>("GET", `/api/sessions/${encodeURIComponent(session.remoteSessionId!)}/git/commit-context`);
      if (!context.diff?.trim()) throw new Error("Stage changes before drafting a commit message.");
      const response = await fetch("/api/vibeghost/commit-message", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...context, ...ai }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not draft a commit message.");
      setMessage((current) => current === snapshot ? data.message : current);
    } catch (error) { setActionError(error instanceof Error ? error.message : "Could not draft a commit message."); }
    finally { pending.current = false; setBusy(false); setPendingAction(null); }
  };

  if (state === "loading" && !status) return <InspectorLoading label="Reading source control"/>;
  if (state === "error" && !status && !session.gitRepoPath && !session.gitBranch) {
    return <InspectorError message={error || "Source-control status is unavailable"} onRetry={onRetry}/>;
  }
  if (!isGitRepo) return <InspectorEmpty title="Not a Git repository" detail="This session directory has no source-control status."/>;

  return <div className={styles.source}>
    {error ? <p role="status" className={styles.warning}>Showing the last available status. {error}</p> : null}
    <InspectorSection title="Repository" icon={<Compass className="size-3.5" aria-hidden="true"/>}>
    <section data-inspector-summary className={styles.summary}>
      <div className={styles.repoHeading}><h2 title={repoName}>{repoName}</h2><span title={`Branch: ${branch}`} className={styles.branch}>{branch}</span></div>
      <p title={repoPath} className={styles.repoPath}>{repoPath}</p>
      <div className={styles.metrics}>
        <SourceMetric label="Changes" value={changeCount}/>
        <SourceMetric label="Staged" value={status?.stagedCount ?? session.gitStagedCount ?? staged.length}/>
        <SourceMetric label="Added" value={status?.addedCount ?? session.gitAddedCount ?? 0}/>
        <SourceMetric label="Deleted" value={status?.deletedCount ?? session.gitDeletedCount ?? 0}/>
      </div>
      {(status?.aheadCount || status?.behindCount) ? <p className={styles.muted}>{status.aheadCount ? `${status.aheadCount} ahead` : ""}{status.aheadCount && status.behindCount ? " · " : ""}{status.behindCount ? `${status.behindCount} behind` : ""}</p> : null}
    </section>
    </InspectorSection>
    {writable ? <InspectorSection title="Commit message" icon={<FileText className="size-3.5"/>}>
      <div className={styles.commitContent}>
        <div className={styles.messageField} data-drafting={pendingAction === "draft" || undefined}>
          <textarea aria-label="Commit message" aria-busy={pendingAction === "draft"} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={pendingAction === "draft" ? "" : "Describe the staged changes…"} rows={3} maxLength={4000} className={styles.message}/>
          {pendingAction === "draft" ? <HalftoneDots className={styles.messageDots}/> : null}
        </div>
      <div className={styles.commitActions}>
        <button type="button" aria-label="Draft commit message with AI" title="Send staged diff to your selected AI model for a draft. Does not commit." disabled={busy || !staged.length} onClick={() => void generate()} className={cn(styles.action, styles.aiAction)}>{pendingAction === "draft" ? <Spinner aria-hidden="true" className="size-3.5"/> : <Box2 className="size-3.5" aria-hidden="true"/>}</button>
        <SimpleSettingsPopover open={settingsOpen} onOpenChange={setSettingsOpen} trigger={<button type="button" aria-label="AI settings" disabled={busy} className={cn(styles.action, styles.aiAction)}><Settings className="size-3.5" aria-hidden="true"/></button>}/>
        <button type="button" disabled={busy || !status?.hasUpstream} title={status?.hasUpstream ? `${status.behindCount || 0} incoming commits` : 'No upstream configured'} onClick={() => void mutate("pull")} className={cn(styles.action, styles.syncAction)}>{pendingAction === "pull" ? <Spinner aria-hidden="true" className="size-3"/> : null}Pull {(status?.behindCount || 0) > 0 ? <span className={styles.syncCount} aria-label={`${status?.behindCount} incoming commits`}>{status?.behindCount}</span> : null}</button>
        <button type="button" disabled={busy} title={status?.hasUpstream ? `${status.aheadCount || 0} outgoing commits` : 'Publish this branch'} onClick={() => void mutate("push")} className={cn(styles.action, styles.syncAction)}>{pendingAction === "push" ? <Spinner aria-hidden="true" className="size-3"/> : null}Push {(status?.aheadCount || 0) > 0 ? <span className={styles.syncCount} aria-label={`${status?.aheadCount} outgoing commits`}>{status?.aheadCount}</span> : null}</button>
        <button type="button" disabled={busy || !message.trim() || !staged.length} onClick={() => void mutate("commit")} className={styles.commitButton}>{pendingAction === "commit" ? <Spinner aria-hidden="true" className="size-3 "/> : null}COMMIT {staged.length} STAGED {staged.length === 1 ? "FILE" : "FILES"}</button>
      </div>
      {actionError ? <p role="alert" className={styles.warning}>{actionError}</p> : null}
      </div>
    </InspectorSection> : null}
    <ChangeSection title="Staged changes" icon={<ClipboardList className="size-3.5"/>} files={staged} repoPath={repoPath} onOpenFile={onOpenFile} busy={busy} actionLabel="Unstage" onAction={writable ? (files) => void mutate("unstage", files) : undefined}/>
    <ChangeSection title="Changes" icon={<FileText className="size-3.5"/>} files={changed} repoPath={repoPath} onOpenFile={onOpenFile} busy={busy} actionLabel="Stage" onAction={writable ? (files) => void mutate("stage", files) : undefined} onRevert={writable ? revert : undefined}/>
  </div>;
}

function PierreFilePreview({ preview, state, onRetry }: { preview: FilePreview; state: LoadState; onRetry: () => void }) {
  const items = useMemo<CodeViewItem[]>(() => {
    if (state !== "ready") return [];
    if (preview.kind === "diff") {
      const fileDiff = parseDiffFromFile(
        { name: preview.name, contents: preview.originalContent || "" },
        { name: preview.name, contents: preview.modifiedContent || "" }
      );
      return [{ id: preview.path, type: "diff", fileDiff }];
    }
    return [{ id: preview.path, type: "file", file: { name: preview.name, contents: preview.content || "" } }];
  }, [preview, state]);

  if (state === "loading") return <InspectorLoading label={preview.kind === "diff" ? "Rendering diff" : "Opening file"}/>;
  if (state === "error") return <InspectorError message={preview.error || "File preview is unavailable"} onRetry={onRetry}/>;
  return <div className={styles.previewPanel}><CodeView items={items} className="h-full min-h-full w-full overflow-auto" options={{ diffStyle: "unified", diffIndicators: "bars", hunkSeparators: "line-info", lineDiffType: "word-alt", overflow: "scroll", theme: "pierre-dark", themeType: "dark", unsafeCSS: ":host { --diffs-bg: #111111 !important; --diffs-dark-bg: #111111 !important; --diffs-dark: #e4e8e5 !important; background: #111111 !important; color: #e4e8e5 !important; }" }}/></div>;
}

function joinWorkspacePath(root: string, relative: string) {
  if (relative.startsWith("/")) return relative;
  return `${root.replace(/\/$/, "")}/${relative.replace(/^\.\//, "")}`;
}

function SourceMetric({ label, value }: { label: string; value: number }) {
  return <span className={styles.metric}><strong>{value}</strong><span>{label}</span></span>;
}

function ChangeSection({ title, icon, files, repoPath, onOpenFile, onAction, onRevert, actionLabel, busy }: { title: string; icon: React.ReactNode; files: SharedGitFile[]; repoPath: string; onOpenFile: (path: string) => void; onAction?: (paths: string[]) => void; onRevert?: (files: SharedGitFile[]) => void; actionLabel: string; busy: boolean }) {
  const [open, setOpen] = useState(true);
  return <section data-inspector-change-group data-expanded={open} className={styles.changeGroup}>
    <div className={styles.groupHeader}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={styles.disclosure}>{icon}<span>{title}</span><CountLabel>{files.length}</CountLabel></button>
      {files.length && (onAction || onRevert) ? <div className={styles.bulkActions}>
        {onRevert ? <button type="button" disabled={busy} onClick={() => onRevert(files)} className={styles.bulkAction} data-bulk-action="revert">Revert all</button> : null}
        {onAction ? <button type="button" disabled={busy} onClick={() => onAction(files.map((file) => file.path))} className={styles.bulkAction} data-bulk-action={actionLabel.toLowerCase()}>{actionLabel} all</button> : null}
      </div> : null}
    </div>
    {open ? files.length ? <div className={cn(styles.groupBody, styles.groupRows)}>{files.map((file) => <div key={`${title}-${file.path}`} data-inspector-change-row className={styles.changeRow}>
      <ChangeRow file={file} onOpen={() => onOpenFile(joinWorkspacePath(repoPath, file.path))}/>
      {onAction ? <button type="button" disabled={busy} aria-label={`${actionLabel} ${file.path}`} onClick={() => onAction([file.path])} className={styles.rowAction}>{actionLabel}</button> : null}
      {onRevert ? <button type="button" disabled={busy} aria-label={`Revert ${file.path}`} onClick={() => onRevert([file])} className={styles.rowAction}>Revert</button> : null}
    </div>)}</div> : <p className={cn(styles.groupBody, styles.emptyGroup)}>No files in this group.</p> : null}
  </section>;
}

function ChangeRow({ file, onOpen }: { file: SharedGitFile; onOpen: () => void }) {
  const parts = file.path.split("/");
  const name = parts.pop() || file.path;
  return <button type="button" onClick={onOpen} className={styles.fileChange} title={`Open diff for ${file.path}`}>
    <span className={styles.fileIdentity}><span>{name}</span>{parts.length ? <small>{parts.join("/")}</small> : null}</span>
    <span title={file.status} className={cn(styles.status, statusClass(file.status))}>{statusLabel(file.status)}</span>
  </button>;
}

function FileTreePanel({
  files,
  state,
  error,
  expandedPaths,
  directoryChildren,
  loadingPaths,
  directoryErrors,
  activePath,
  onToggleDirectory,
  onOpenFile,
  onRetry,
}: {
  files: SharedBrowseFile[];
  state: LoadState;
  error: string;
  expandedPaths: Set<string>;
  directoryChildren: Record<string, SharedBrowseFile[]>;
  loadingPaths: Set<string>;
  directoryErrors: Record<string, string>;
  activePath: string;
  onToggleDirectory: (file: SharedBrowseFile) => void;
  onOpenFile: (path: string) => void;
  onRetry: () => void;
}) {
  if (state === "loading" && !files.length) return <InspectorLoading label="Reading files"/>;
  if (state === "error") return <InspectorError message={error || "Files are unavailable"} onRetry={onRetry}/>;
  if (!files.length) return <InspectorEmpty title="No files found" detail="This session directory is empty."/>;
  return <div data-inspector-file-tree className={styles.fileTree}><div className={styles.sectionHeading}><Folder className="size-3.5"/><span>Workspace files</span><CountLabel>{files.length}</CountLabel></div><div className={cn(styles.groupBody, styles.groupRows)}><FileRows files={files} expandedPaths={expandedPaths} directoryChildren={directoryChildren} loadingPaths={loadingPaths} directoryErrors={directoryErrors} activePath={activePath} onToggleDirectory={onToggleDirectory} onOpenFile={onOpenFile}/></div></div>;
}

function FileRows({
  files,
  expandedPaths,
  directoryChildren,
  loadingPaths,
  directoryErrors,
  activePath,
  onToggleDirectory,
  onOpenFile,
  depth = 0,
}: {
  files: SharedBrowseFile[];
  expandedPaths: Set<string>;
  directoryChildren: Record<string, SharedBrowseFile[]>;
  loadingPaths: Set<string>;
  directoryErrors: Record<string, string>;
  activePath: string;
  onToggleDirectory: (file: SharedBrowseFile) => void;
  onOpenFile: (path: string) => void;
  depth?: number;
}) {
  return files.map((file) => {
    const directory = file.type === "directory";
    const expanded = expandedPaths.has(file.path);
    const loading = loadingPaths.has(file.path);
    const children = directoryChildren[file.path];
    return <div key={file.path}>
      <button type="button" aria-expanded={directory ? expanded : undefined} onClick={() => directory ? onToggleDirectory(file) : onOpenFile(file.path)} data-directory={directory} data-active={!directory && file.path === activePath || undefined} aria-current={!directory && file.path === activePath ? "true" : undefined} className={styles.fileRow} style={{ paddingLeft: `${12 + depth * 16}px` }} title={file.path}>
        {directory ? loading ? <Spinner aria-hidden="true" className={styles.chevron}/> : <ChevronRight aria-hidden="true" className={cn(styles.chevron, expanded && styles.expanded)}/> : <span aria-hidden="true" className={styles.chevron}/>}
        <span className="min-w-0 flex-1 truncate">{file.name}</span>
      </button>
      {directory && expanded ? directoryErrors[file.path] ? <button type="button" onClick={() => onToggleDirectory(file)} className="flex w-full items-center gap-1.5 py-2 pr-3 text-left text-[9px] leading-4 text-[#e67b73]" style={{ paddingLeft: `${24 + depth * 13}px` }}><AlertCircle className="size-3 shrink-0"/><span className="truncate">{directoryErrors[file.path]} · Retry</span></button> : children?.length ? <FileRows files={children} expandedPaths={expandedPaths} directoryChildren={directoryChildren} loadingPaths={loadingPaths} directoryErrors={directoryErrors} activePath={activePath} onToggleDirectory={onToggleDirectory} onOpenFile={onOpenFile} depth={depth + 1}/> : !loading && children ? <p className="py-2 pr-3 text-[9px] text-[#5f6561]" style={{ paddingLeft: `${29 + depth * 13}px` }}>Empty folder</p> : null : null}
    </div>;
  });
}

function InspectorLoading({ label }: { label: string }) {
  return <div role="status" className={styles.empty}><Spinner className="size-4 "/><span className={styles.muted}>{label}</span></div>;
}

function InspectorError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className={styles.empty}><p role="alert" className={styles.warning}>{message}</p><button type="button" onClick={onRetry} className={styles.action}>Retry</button></div>;
}

function InspectorEmpty({ title, detail }: { title: string; detail: string }) {
  return <div className={styles.empty}><p>{title}</p><p className={styles.muted}>{detail}</p></div>;
}

function statusLabel(status: string) {
  if (status === "added") return "A";
  if (status === "deleted") return "D";
  if (status === "untracked") return "U";
  if (status === "renamed") return "R";
  return "M";
}

function statusClass(status: string) {
  if (status === "added" || status === "untracked") return "text-[#49b984]";
  if (status === "deleted") return "text-[#e67b73]";
  if (status === "renamed") return "text-[#73aaf0]";
  return "text-[#d1a85a]";
}
