"use client";
import Link from "next/link";
import { ArrowUpRight, X } from "@/components/icons/duo";
import { AgentChat } from "./home-console";
import { VibeGhostSessionView } from "./vibeghost-view";
import { sharedSessionId } from "../lib/shared-workspace-model";
import type { WorkspaceViewChromeProps } from "./workspace-view-shell";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import header from "@/components/ui/inset-header.module.css";
import { HOME_AGENTS, homeAgentHref, type HomeAgent } from "../lib/home-agents";
import styles from "./mini-chat.module.css";

/* The dock's mini chat (home-chat-dialog.tsx): an agent's chat (home-console.tsx AgentChat, the
   same conversation, session bar, input and toolbar as its page) made small for a window over any
   page. Its header, the Calendar month header's recessed bar (inset-header.module.css), opens the full chat or closes the window.
   Under it, one recessed well (.well) holds the whole chat, loading and loaded alike, so the box never
   jumps. Its CSS sets the session bar, the input and the toolbar inside the well, without their cards,
   at a smaller size. */
export function MiniChat({ agent, onAgentChange, onClose, chrome }: {
  agent: HomeAgent; onAgentChange: (agent: HomeAgent) => void; onClose: () => void; chrome: WorkspaceViewChromeProps;
}) {
  const current = HOME_AGENTS.find(item => item.id === agent) ?? HOME_AGENTS[0];
  return <div className={styles.mini} data-chat-compact="">
    <TooltipProvider delayDuration={400}><header className={header.bar}>
      <span className={header.title}>{current.label}</span>
      <Tooltip><TooltipTrigger asChild><Link href={homeAgentHref(agent)} className={`${header.button} ${header.icon}`} aria-label="Open full chat"><ArrowUpRight aria-hidden="true"/></Link></TooltipTrigger><TooltipContent side="bottom" className="text-[12px]">Open full chat</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><button type="button" className={`${header.button} ${header.icon}`} aria-label="Close" onClick={onClose}><X aria-hidden="true"/></button></TooltipTrigger><TooltipContent side="bottom" className="text-[12px]">Close</TooltipContent></Tooltip>
    </header></TooltipProvider>
    <div className={`${styles.body} ${styles.well}`} data-mini-well=""><AgentChat agent={agent} chrome={chrome} onChoose={onAgentChange}/></div>
  </div>;
}

/** One VibeGhost session in the mini chat's small layout (its session bar, conversation or terminal,
 *  input and toolbar, without their cards), for a panel other than the dock's window: the Kanban
 *  card sidebar. Choosing another session in its session bar calls `onSelect` with that session.
 *  A host that picks the session and the view itself passes `view` and `sessionBar={false}`. */
export function MiniSession({ sessionId, chrome, onSelect, view = "chat", sessionBar = true }: { sessionId: string; chrome: WorkspaceViewChromeProps; onSelect: (id: string) => void; view?: "chat" | "terminal"; sessionBar?: boolean }) {
  return <div className={styles.mini} data-chat-compact="">
    <div className={styles.body}><VibeGhostSessionView {...chrome} defaultView={view} sessionBar={sessionBar} pane={{
      id: sessionId, visible: true, onSelect, onClose: () => undefined,
      onNavigate: (workspace, remoteSession) => { if (remoteSession) onSelect(workspace ? sharedSessionId(workspace, remoteSession) : remoteSession); },
    }}/></div>
  </div>;
}
