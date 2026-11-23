// The VibeGhost mini app's Timeline: the Pi, Claude and Codex sessions in the Workspaces it is
// connected to, as lanes of work. Pure: the Timeline hook feeds it the session lists those
// Workspaces' connections return. Session titles and transcript text are untrusted; everything
// leaving here is bounded, control-stripped and credential-redacted plain text.
import { sessionIntegration } from "./session-integrations.ts";
import { vibeGhostHref } from "./vibeghost-routes.ts";

export type AgentPhase = "working" | "waiting" | "blocked" | "idle" | "exited";
/** Timeline order: the four running phases; exited sessions are not lanes. */
export const AGENT_PHASES: readonly AgentPhase[] = ["working", "waiting", "blocked", "idle", "exited"];
export type AgentProvider = "pi" | "claude" | "codex";

export type TimelineAgent = {
  /** Native VibeGhost session id. */
  id: string;
  title: string;
  /** The mini app's id for the session's Workspace. */
  workspaceId: string;
  workspace: string;
  provider: AgentProvider;
  providerName: string;
  phase: AgentPhase;
  /** The program reported `error`; shown as blocked. */
  failed: boolean;
  startedAt: string | null;
  /** When the current phase began, as reported. */
  phaseAt: string | null;
  lastActivityAt: string | null;
  /** Latest activity line, where VibeGhost's semantic inspection has one. */
  activity: string | null;
  /** The tool running now, else the latest one used. */
  tool: string | null;
  /** The session in the mini app, opened from the Timeline. */
  href: string;
  /** Recent work, newest last: the current phase and the ones the Timeline saw end. */
  segments: AgentSegment[];
};

/** A stretch of work on the timeline. `end` is null while it is still going. */
export type AgentSegment = { kind: "working" | "blocked" | "failed"; start: string; end: string | null; title: string | null };

export const TIMELINE_PAGE_SIZE = 20;

/** Strip terminal escapes and control characters, redact credential-shaped text, bound the length. */
export function safeText(value: unknown, max = 240): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "")
    .replace(/\bBearer\s+[^\s"'<>]+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk|rk|pk|ghp|gho|github_pat|xoxb|xoxp|glpat)[-_][A-Za-z0-9_-]{16,}/g, "[redacted]")
    .replace(/\b(access_token|refresh_token|api[_-]?key|authorization|password|secret|token)\b["']?\s*[:=]\s*["']?[^\s,"'<>]+/gi, "$1=[redacted]")
    .trim()
    .slice(0, max);
}

const isoDate = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const latest = (...values: (string | null | undefined)[]) => values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;

/** VibeGhost's session record, as a Workspace's /api/sessions returns it. Only the fields the Timeline reads. */
export type HostSession = {
  id?: unknown; name?: unknown; title?: unknown; workspaceId?: unknown; source?: unknown; status?: unknown;
  agentStatus?: unknown; agentPhase?: unknown; agentStatusUpdatedAt?: unknown; agentPhaseUpdatedAt?: unknown;
  startedAt?: unknown; lastModified?: unknown; tags?: unknown; command?: unknown; agentIdentity?: unknown;
};

/** Same precedence as the Active Feed: either signal saying working wins, then blocked, waiting, idle. */
export function agentPhase(session: Pick<HostSession, "status" | "agentStatus" | "agentPhase">): AgentPhase {
  if (session.status === "exited") return "exited";
  if (session.agentStatus === "working" || session.agentPhase === "working") return "working";
  if (session.agentPhase === "blocked" || session.agentPhase === "error") return "blocked";
  if (session.agentPhase === "waiting") return "waiting";
  return "idle";
}

/** A local Pi, Claude or Codex session becomes a Timeline agent; plain shells, remote and ambiguous sessions do not. */
export function toTimelineAgent(raw: HostSession, workspace: { id: string; name: string }): TimelineAgent | null {
  if (!raw || typeof raw.id !== "string" || !raw.id || (raw.source !== undefined && raw.source !== "local")) return null;
  const integration = sessionIntegration({
    id: raw.id, name: typeof raw.name === "string" ? raw.name : "",
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === "string") : [],
    command: Array.isArray(raw.command) ? raw.command.filter((part): part is string => typeof part === "string") : [],
    agentIdentity: raw.agentIdentity as never,
  });
  const provider = integration.provider;
  if (!provider || integration.issue) return null;
  const id = safeText(raw.id, 160);
  const phaseAt = isoDate(raw.agentPhaseUpdatedAt) ?? isoDate(raw.agentStatusUpdatedAt);
  return {
    id,
    title: safeText(raw.name ?? raw.title, 200) || "Untitled session",
    workspaceId: workspace.id,
    workspace: safeText(workspace.name, 120) || "Workspace",
    provider: provider.id as AgentProvider,
    providerName: provider.displayName,
    phase: agentPhase(raw),
    failed: raw.agentPhase === "error",
    startedAt: isoDate(raw.startedAt),
    phaseAt,
    lastActivityAt: latest(isoDate(raw.lastModified), phaseAt),
    activity: null,
    tool: null,
    href: vibeGhostHref(workspace.id, id, "timeline"),
    segments: [],
  };
}

// VibeGhost reports only the phase an agent is in now and when it began. The Timeline keeps the
// stretches it has seen, so a finished turn stays on the timeline with VibeGhost's own start and
// end times. Nothing is inferred for phases it never saw.
export const SEGMENT_WINDOW_MS = 60 * 60_000;
const MAX_SEGMENTS = 12;

function segmentKind(agent: Pick<TimelineAgent, "phase" | "failed">): AgentSegment["kind"] | null {
  if (agent.phase === "working") return "working";
  if (agent.phase === "blocked") return agent.failed ? "failed" : "blocked";
  return null;
}

/** The segments after seeing `agent` now: an ended phase closes when the new one began. */
export function observeSegments(previous: readonly AgentSegment[], agent: TimelineAgent, nowIso: string): AgentSegment[] {
  const segments = previous.map(segment => ({ ...segment }));
  const open = segments.at(-1)?.end === null ? segments.at(-1) : undefined;
  const kind = segmentKind(agent);
  const began = (agent.phase === "exited" ? agent.lastActivityAt : agent.phaseAt) ?? nowIso;
  if (open && open.kind !== kind) open.end = began > open.start ? began : open.start;
  if (kind && !(open && open.kind === kind)) segments.push({ kind, start: agent.phaseAt ?? agent.startedAt ?? nowIso, end: null, title: null });
  const oldest = Date.parse(nowIso) - SEGMENT_WINDOW_MS;
  return segments.filter(segment => segment.end === null || Date.parse(segment.end) >= oldest).slice(-MAX_SEGMENTS);
}

/** VibeGhost's semantic inspection, reduced to one line: the latest message, else the tool's own description. */
export type SemanticPage = {
  state?: { pendingToolNames?: unknown; latestActivityAt?: unknown };
  events?: { role?: unknown; text?: unknown; tools?: { name?: unknown; toolName?: unknown; arguments?: unknown }[] }[];
};

export function activitySummary(page: SemanticPage) {
  const events = Array.isArray(page?.events) ? page.events : [];
  const event = [...events].reverse().find(item => item?.role === "assistant" && ((typeof item.text === "string" && item.text.trim()) || (Array.isArray(item.tools) && item.tools.length)))
    ?? events.at(-1);
  const tools = Array.isArray(event?.tools) ? event.tools : [];
  const lastTool = tools.at(-1);
  const pending = Array.isArray(page?.state?.pendingToolNames) ? page.state.pendingToolNames.find(name => typeof name === "string") : undefined;
  const text = typeof event?.text === "string" ? event.text.split("\n").map(line => line.trim()).find(Boolean) : undefined;
  return {
    activity: safeText(text, 280) || toolDescription(lastTool?.arguments) || null,
    tool: safeText(pending ?? lastTool?.name ?? lastTool?.toolName, 80) || null,
    latestActivityAt: isoDate(page?.state?.latestActivityAt),
  };
}

/** Only a tool call's own short `description` (as Claude's Bash gives), never its other arguments. */
function toolDescription(argumentsValue: unknown) {
  if (typeof argumentsValue !== "string" || !argumentsValue.includes("\"description\"")) return "";
  try {
    const parsed = JSON.parse(argumentsValue) as { description?: unknown };
    return safeText(parsed?.description, 200);
  } catch { return ""; }
}

/** Timeline order: phase, then the most recent phase change first (stable while an agent stays in its phase), then id. */
export function compareAgents(a: TimelineAgent, b: TimelineAgent) {
  const since = (agent: TimelineAgent) => { const time = Date.parse((agent.phase === "exited" ? agent.lastActivityAt : agent.phaseAt ?? agent.lastActivityAt) ?? agent.startedAt ?? ""); return Number.isFinite(time) ? time : 0; };
  return AGENT_PHASES.indexOf(a.phase) - AGENT_PHASES.indexOf(b.phase) || since(b) - since(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
