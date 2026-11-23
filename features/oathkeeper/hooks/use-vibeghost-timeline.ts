"use client";

import { useCallback, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useVibeGhostDirectory } from "./use-vibeghost-directory";
import { workspaceQueries } from "../lib/workspace-directory-cache";
import { activitySummary, compareAgents, observeSegments, SEGMENT_WINDOW_MS, TIMELINE_PAGE_SIZE, toTimelineAgent, type AgentSegment, type HostSession, type SemanticPage, type TimelineAgent } from "../lib/vibeghost-timeline";
import type { VibeGhostWorkspace } from "../components/vibeghost-view";

// The Timeline reads through the same Workspace connections as the mini app's sidebar and Active
// Feed (the app-wide directory), so it needs nothing they don't have. One query is its source of
// truth: each read lists every connected Workspace's sessions and inspects only the lanes in view.
// It rereads every 8 seconds while the page is visible, on focus, and as more lanes come into view.
const REFRESH_MS = 8_000;
const INSPECT_CONCURRENCY = 4;

// Kept between reads, in memory and bounded: the stretches of work seen so far, the latest
// activity lines, and each Workspace's last good list, so one missed read doesn't drop its lanes.
type Summary = ReturnType<typeof activitySummary>;
const history = new Map<string, { segments: AgentSegment[]; seenAt: number }>();
const lines = new Map<string, { marker: string; summary: Summary }>();
const lastLists = new Map<string, TimelineAgent[]>();
const marker = (agent: TimelineAgent) => `${agent.phase}|${agent.phaseAt}|${agent.lastActivityAt}`;

function remember(id: string, entry: { marker: string; summary: Summary }) {
  lines.delete(id);
  lines.set(id, entry);
  if (lines.size > 500) lines.delete(lines.keys().next().value!);
}

async function readLines(agents: TimelineAgent[], workspaces: VibeGhostWorkspace[], signal: AbortSignal) {
  const stale = agents.filter(agent => lines.get(agent.id)?.marker !== marker(agent));
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(INSPECT_CONCURRENCY, stale.length) }, async () => {
    while (next < stale.length && !signal.aborted) {
      const agent = stale[next++];
      const client = workspaces.find(workspace => workspace.id === agent.workspaceId)?.client;
      if (!client) continue;
      try {
        const page = await client.json<SemanticPage>("GET", `/api/sessions/${encodeURIComponent(agent.id)}/inspect?mode=semantic&limit=2&maxChars=1000`, undefined, signal);
        remember(agent.id, { marker: marker(agent), summary: activitySummary(page) });
      } catch {
        // No semantic activity for this session now: keep any earlier line, and don't ask again until it changes.
        if (!signal.aborted) remember(agent.id, { marker: marker(agent), summary: lines.get(agent.id)?.summary ?? { activity: null, tool: null, latestActivityAt: null } });
      }
    }
  }));
}

function withLine(agent: TimelineAgent): TimelineAgent {
  const summary = lines.get(agent.id)?.summary;
  const segments = history.get(agent.id)?.segments ?? agent.segments;
  // The open stretch is titled with the latest line; once it ends it keeps the last one it had.
  const open = segments.at(-1);
  if (summary && open && open.end === null) open.title = summary.activity ?? summary.tool ?? open.title;
  if (!summary) return { ...agent, segments: segments.map(segment => ({ ...segment })) };
  const lastActivityAt = [agent.lastActivityAt, summary.latestActivityAt].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  return { ...agent, activity: summary.activity, tool: summary.tool, lastActivityAt, segments: segments.map(segment => ({ ...segment })) };
}

async function readTimeline(workspaces: VibeGhostWorkspace[], inView: number, signal: AbortSignal) {
  const readings = await Promise.allSettled(workspaces.map(async workspace => {
    const rows = await workspace.client!.json<HostSession[]>("GET", "/api/sessions", undefined, signal);
    if (!Array.isArray(rows)) throw new Error("Invalid session list");
    return rows.map(row => toTimelineAgent(row, workspace)).filter((agent): agent is TimelineAgent => agent !== null && agent.phase !== "exited");
  }));
  signal.throwIfAborted();
  if (readings.every(reading => reading.status === "rejected")) throw new Error("VibeGhost workspaces could not be read.");
  readings.forEach((reading, index) => { if (reading.status === "fulfilled") lastLists.set(workspaces[index].id, reading.value); });
  const checkedAt = new Date().toISOString();
  const now = Date.parse(checkedAt);
  const agents = workspaces.flatMap(workspace => lastLists.get(workspace.id) ?? []).map(agent => {
    const segments = observeSegments(history.get(agent.id)?.segments ?? [], agent, checkedAt);
    history.set(agent.id, { segments, seenAt: now });
    return { ...agent, segments };
  }).sort(compareAgents);
  for (const [id, entry] of history) if (now - entry.seenAt > SEGMENT_WINDOW_MS) history.delete(id);
  await readLines(agents.slice(0, inView), workspaces, signal);
  return { agents: agents.map(withLine), checkedAt };
}

export function useVibeGhostTimeline() {
  const { directory, initialLoading, loadingWorkspaces, directoryError } = useVibeGhostDirectory();
  const connected = useMemo(() => directory.workspaces.filter(workspace => workspace.client), [directory.workspaces]);
  const connectedKey = connected.map(workspace => workspace.id).sort().join("\n");
  const [inView, setInView] = useState(TIMELINE_PAGE_SIZE);
  const query = useQuery({
    queryKey: ["vibeghost", "timeline", connectedKey, inView],
    queryFn: ({ signal }) => readTimeline(connected, inView, signal),
    enabled: connected.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 4_000,
    retry: false,
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  }, workspaceQueries);
  const all = query.data?.agents;
  const hasMore = Boolean(all && all.length > inView);

  /** Attach to the end of the lanes: reaching it brings the next lanes into view. */
  const loadMoreRef = useCallback((node: Element | null) => {
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setInView(count => count + TIMELINE_PAGE_SIZE);
    }, { rootMargin: "480px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore]);

  const agents = useMemo(() => all?.slice(0, inView) ?? [], [all, inView]);
  const waitingForDirectory = initialLoading || (loadingWorkspaces && !connected.length);
  return {
    agents,
    loading: !all && (waitingForDirectory || (connected.length > 0 && !query.isError)),
    error: !all ? (query.error instanceof Error ? query.error.message : !connected.length && !waitingForDirectory ? directoryError || "No connected workspaces" : "") : "",
    hasMore,
    loadMoreRef,
  };
}
