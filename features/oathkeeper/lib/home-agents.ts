import type { VibeGhostSession } from "../components/vibeghost-view";
import { sharedSessionId } from "./shared-workspace-model";
import type { WorkspaceDirectory } from "./workspace-directory-cache";

/* Home's agents. "/" is the brief; each agent's chat is its own page, /agents/<agent>. */
export type HomeAgent = "oathkeeper" | "vibeghost";
/* `orb` holds the Arcturus orb (agent-orb.tsx) on the agent's colour: the orange and the blue of
   the Oathkeeper orb's own drift (orb-logo-catalog.ts), tuned for its exposure. */
export const HOME_AGENTS: { id: HomeAgent; label: string; color: string; orb: { light: string; shadow: string } }[] = [
  { id: "oathkeeper", label: "Oathkeeper", color: "#d97757", orb: { light: "#b85a00", shadow: "#4a1400" } },
  // The blue of Landing's unit dot and a running session's dot.
  { id: "vibeghost", label: "VibeGhost", color: "#2684fc", orb: { light: "#2a68c8", shadow: "#081a50" } },
];
export const isHomeAgent = (value: unknown): value is HomeAgent => HOME_AGENTS.some(agent => agent.id === value);
export const homeAgentHref = (agent: HomeAgent) => `/agents/${agent}`;
export const homeAgentFromPath = (pathname: string | null): HomeAgent | null => {
  const value = pathname?.match(/^\/agents\/([^/]+)\/?$/)?.[1];
  return isHomeAgent(value) ? value : null;
};

/** The agent the dock's chat opens (and its orb's colour): the one chosen there last, else Oathkeeper. */
const CHAT_AGENT_KEY = "oathkeeper.home.chat-agent.v1";
export const readChatAgent = (): HomeAgent => { try { const value = localStorage.getItem(CHAT_AGENT_KEY); return isHomeAgent(value) ? value : "oathkeeper"; } catch { return "oathkeeper"; } };
export const writeChatAgent = (agent: HomeAgent) => { try { localStorage.setItem(CHAT_AGENT_KEY, agent); } catch { /* A view choice only. */ } };

/** The VibeGhost session Home's VibeGhost chat opens: the one chosen last, else the most recent open one, else the most recent. */
const SESSION_KEY = "oathkeeper.home.session.v1";
export const readHomeSession = () => { try { return localStorage.getItem(SESSION_KEY); } catch { return null; } };
export const writeHomeSession = (id: string) => { try { localStorage.setItem(SESSION_KEY, id); } catch { /* A view choice only. */ } };
const recency = (session: VibeGhostSession) => { const time = Date.parse(session.lastModified || session.startedAt || ""); return Number.isFinite(time) ? time : 0; };
export function pickHomeSession(sessions: VibeGhostSession[], saved: string | null) {
  const byRecency = [...sessions].sort((a, b) => recency(b) - recency(a));
  return sessions.find(item => item.id === saved) ?? byRecency.find(item => item.status?.toLowerCase() !== "exited") ?? byRecency[0];
}
/** Workspaces connect one by one: while the chosen session's workspace is still connecting, wait for it rather than open another session first. */
export function homeSessionPending(directory: WorkspaceDirectory, saved: string | null, loading: boolean) {
  if (!saved || !loading || directory.sessions.some(item => item.id === saved)) return false;
  const owner = directory.workspaces.find(workspace => saved.startsWith(sharedSessionId(workspace.id, "")));
  return !owner?.client;
}
