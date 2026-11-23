"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "@/components/icons/duo";
import type { SharedWorkspaceClient } from "../lib/shared-workspace-client";
import styles from "./shared-workspace-inspector.module.css";
type Commit = { hash: string; shortHash?: string; subject?: string; message?: string; author: string; relativeDate?: string; refs?: string; body?: string };

export function SharedGitHistory({ client, cwd, remoteUrl, refreshEpoch }: { client: SharedWorkspaceClient; cwd: string; remoteUrl?: string; refreshEpoch: number }) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(""); setCommits([]);
    void client.json<{ commits: Commit[] }>("GET", `/api/git/history?path=${encodeURIComponent(cwd)}`).then(data => {
      if (!cancelled) setCommits(data.commits);
    }).catch(error => { if (!cancelled) setError(error instanceof Error ? error.message : "Could not load history"); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [client, cwd, refreshEpoch, retry]);
  if (loading) return <p role="status" className={styles.empty}>Loading history…</p>;
  if (error) return <div className={styles.empty}><p role="alert">{error}</p><button className={styles.action} onClick={() => setRetry(n => n + 1)}>Retry</button></div>;
  if (!commits.length) return <p className={styles.empty}>No commits yet.</p>;
  return <div className={styles.historyList}>{commits.map(commit => <HistoryEntry key={commit.hash} commit={commit} remoteUrl={remoteUrl}/>)}</div>;
}

function HistoryEntry({ commit, remoteUrl }: { commit: Commit; remoteUrl?: string }) {
  const [open, setOpen] = useState(false);
  const subject = commit.subject || commit.message || "No commit message";
  const githubUrl = githubCommitUrl(remoteUrl, commit.hash);
  return <article className={styles.historyEntry}>
    <div className={styles.historyHeader}>
      <button type="button" aria-expanded={open} className={styles.historyToggle} onClick={() => setOpen(value => !value)}>
        <strong>{subject}</strong>
        <small>{commit.shortHash || commit.hash.slice(0, 8)} · {commit.author}{commit.relativeDate ? ` · ${commit.relativeDate}` : ""}</small>
      </button>
      {githubUrl ? <a href={githubUrl} target="_blank" rel="noreferrer" className={styles.externalCommit} aria-label={`Open ${commit.shortHash || commit.hash.slice(0, 8)} on GitHub`} title="Open on GitHub"><ArrowUpRight className="size-3.5"/></a> : null}
    </div>
    {open && commit.body && commit.body !== subject ? <p className={styles.commitBody}>{commit.body}</p> : null}
  </article>;
}

function githubCommitUrl(remoteUrl: string | undefined, hash: string) {
  if (!remoteUrl || !/github\.com[:/]/i.test(remoteUrl)) return undefined;
  const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/i);
  return match ? `https://github.com/${match[1]}/commit/${hash}` : undefined;
}
