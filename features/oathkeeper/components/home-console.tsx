"use client";
import { useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown } from "@/components/icons/duo";
import { CustomAppIcon } from "@/components/CustomAppIcon";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ImageGeneration } from "@/components/beui/image-generation";
import { LoadingState } from "@/components/beautiful-ui/loading-state";
import { WorkspaceViewShell, type WorkspaceViewChromeProps } from "./workspace-view-shell";
import { ChatContainerContent, ChatContainerRoot, ChatContainerScrollAnchor } from "./dual-sidebar/chat-container";
import { ScrollButton } from "./dual-sidebar/scroll-button";
import { promptToolbarControlClass } from "./dual-sidebar/prompt-control-popover";
import { AIMessage } from "./ai-message";
import { ComposerLeading, HomeComposer } from "./home-composer";
import { HomeChatContext, type HomeChat } from "./home-chat-context";
import { HomeBrief } from "./home-brief";
import { SessionLoadingSkeleton, VibeGhostSessionView } from "./vibeghost-view";
import { useVibeGhostDirectory } from "../hooks/use-vibeghost-directory";
import { HOME_AGENTS as AGENTS, homeAgentFromPath, homeAgentHref, homeSessionPending, pickHomeSession, readHomeSession, writeHomeSession, type HomeAgent as Agent } from "../lib/home-agents";
import { vibeGhostWorkspacesHref } from "../lib/vibeghost-navigation";
import { sharedSessionId } from "../lib/shared-workspace-model";
import composerStyles from "./home-composer.module.css";
import styles from "./home-console.module.css";

/* Home is the brief ("/", home-brief.tsx); each agent's chat is its own page, /agents/<agent>,
   laid out like the VibeGhost session page in chat view: the conversation in the session card,
   and the input below with its toolbar row. The agent dot leads that toolbar: Oathkeeper shows
   its model pickers there, VibeGhost its prompts and keys (and the session switcher bar above
   the input, with the chat/terminal toggle). Each agent keeps its own draft. */

// Dot is listed last in the menu but can't be chosen yet.
const DOT = { label: "Dot", color: "#10a37f" };

/** The agent picker, first in the input's toolbar row: the available agents as an avatar stack. The
 *  chosen one wears its chat-bubble circle in colour, in front; the others are grey. */
export function AgentMenu({ agent, onChoose }: { agent: Agent; onChoose: (agent: Agent) => void }) {
  const [open, setOpen] = useState(false);
  const current = AGENTS.find(item => item.id === agent) ?? AGENTS[0];
  return <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
    <DropdownMenuTrigger asChild><button type="button" className={`${promptToolbarControlClass} ${styles.agentTrigger}`} aria-label={`Talk to ${current.label}. Change agent`} title={current.label}>
      {/* Fixed order; the chosen circle is in front and the rest step back the farther they are from it. */}
      <span className={styles.stack} aria-hidden="true">{AGENTS.map((item, index) => {
        const depth = { zIndex: AGENTS.length - Math.abs(index - AGENTS.indexOf(current)) };
        return item.id === current.id
          ? <span key={item.id} className={styles.stackActive} style={depth}><CustomAppIcon color={item.color} centered/></span>
          : <span key={item.id} className={styles.stackDot} style={depth}/>;
      })}</span>
      <ChevronDown className={styles.chevron} data-open={open || undefined} aria-hidden="true"/>
    </button></DropdownMenuTrigger>
    <DropdownMenuContent align="start" side="top" sideOffset={8} className={styles.agentMenu}>
      <DropdownMenuRadioGroup value={agent} onValueChange={value => { const next = AGENTS.find(item => item.id === value); if (next) onChoose(next.id); }}>
        {AGENTS.map(item => <DropdownMenuRadioItem key={item.id} value={item.id} className={styles.agentItem}>
          <CustomAppIcon color={item.color} centered/><span className={styles.agentName}>{item.label}</span><Check className={styles.agentCheck} aria-hidden="true"/>
        </DropdownMenuRadioItem>)}
        <DropdownMenuRadioItem value="dot" disabled className={styles.agentItem}>
          <CustomAppIcon color={DOT.color} centered/><span className={styles.agentName}>{DOT.label}</span><span className={styles.agentSoon}>Coming soon</span>
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}

/** Home's route: the brief at "/", an agent's chat at /agents/<agent>. */
export function HomeView(chrome: WorkspaceViewChromeProps) {
  const agent = homeAgentFromPath(usePathname());
  return agent ? <HomeConsole agent={agent} {...chrome}/> : <HomeBrief {...chrome}/>;
}

function HomeConsole({ agent, ...chrome }: WorkspaceViewChromeProps & { agent: Agent }) {
  const router = useRouter();
  const current = AGENTS.find(item => item.id === agent) ?? AGENTS[0];
  return <WorkspaceViewShell title={current.label} breadcrumbs={[{ label: current.label }]} wide scrollable={false} compactInset {...chrome}>
    <AgentChat agent={agent} chrome={chrome} onChoose={next => router.replace(homeAgentHref(next))}/>
  </WorkspaceViewShell>;
}

/** An agent's chat: the conversation card, then the input with the agent picker leading its
 *  toolbar. The agent's page shows it, and so does the dock's chat dialog (home-chat-dialog.tsx). */
export function AgentChat({ agent, chrome, onChoose }: { agent: Agent; chrome: WorkspaceViewChromeProps; onChoose: (agent: Agent) => void }) {
  const chat = useContext(HomeChatContext);
  const menu = <AgentMenu agent={agent} onChoose={onChoose}/>;
  if (!chat) throw new Error("AgentChat must be rendered inside OathkeeperApp");
  return <ComposerLeading.Provider value={menu}>
    {agent === "vibeghost" ? <VibeGhostConsole chrome={chrome} chat={chat} menu={menu}/>
      : <div className={styles.console} data-home-console={agent}>
        <OathkeeperConsole chat={chat}/>
      </div>}
  </ComposerLeading.Provider>;
}

/* ---------- Oathkeeper ---------- */
function OathkeeperConsole({ chat }: { chat: HomeChat }) {
  const { messages, status, loading, pendingGeneration } = chat;
  return <>
    <section className={styles.thread} aria-label="Oathkeeper conversation">
      {messages.length ? <ChatContainerRoot contextRef={chat.scrollRef} className="relative h-full min-h-0 w-full">
        <ChatContainerContent className="mx-auto flex w-full max-w-[760px] flex-col px-3 pb-3 pt-4 sm:px-6">
          <div className="w-full space-y-3">
            {messages.map((message, index) => <AIMessage key={message.id || index} message={message} status={status} isLatestMessage={index === messages.length - 1} isLoading={loading} beginFollowingLatest={chat.followLatest} onAttachImage={loading ? undefined : chat.onAttachImage}/>)}
            {pendingGeneration === "image" ? <ImageGeneration/> : pendingGeneration === "chat" && messages.at(-1)?.role === "user" ? <LoadingState label="Inspecting" variant="Drive"/> : null}
          </div>
          <ChatContainerScrollAnchor/>
          <div className="absolute bottom-2 right-2"><ScrollButton/></div>
        </ChatContainerContent>
      </ChatContainerRoot> : <div className={styles.empty}><h1>What should your agents work on?</h1></div>}
    </section>
    <div className={composerStyles.terminalControls}>
      {chat.notice}
      <HomeComposer {...chat.composer} placeholder={messages.length ? "Give Oathkeeper the next instruction…" : "Ask Oathkeeper, or describe a task to hand off…"}/>
    </div>
  </>;
}

/* ---------- VibeGhost: the real session page, opened on chat ---------- */
function VibeGhostConsole({ chrome, chat, menu }: { chrome: WorkspaceViewChromeProps; chat: HomeChat; menu: ReactNode }) {
  const { directory, loadingWorkspaces, ensureDirectoryFresh } = useVibeGhostDirectory();
  useEffect(() => { void ensureDirectoryFresh(); }, [ensureDirectoryFresh]);
  const [saved, setSaved] = useState(readHomeSession);
  const session = homeSessionPending(directory, saved, loadingWorkspaces) ? undefined : pickHomeSession(directory.sessions, saved);
  const choose = (id: string) => { setSaved(id); writeHomeSession(id); };
  // While workspaces load, the session's own skeleton (session bar, input and toolbar at their loaded
  // sizes, in this host's scale), so the session replaces it without moving anything.
  if (!session && loadingWorkspaces) return <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden"><SessionLoadingSkeleton label="Connecting to your workspaces" toolbarLeading={menu}/></div>;
  if (!session) return <div className={styles.console} data-home-console="vibeghost">
    <section className={styles.thread} aria-label="VibeGhost">
      <div className={styles.empty}><p>No VibeGhost sessions</p><Link href={vibeGhostWorkspacesHref()} className={styles.emptyLink}>Workspaces</Link></div>
    </section>
    <div className={composerStyles.terminalControls}>
      <HomeComposer {...chat.composer} persistent={undefined} value="" disabled attachments={false} configuration={null} placeholder="Choose a session…" ariaLabel="Message a VibeGhost session"/>
    </div>
  </div>;
  return <VibeGhostSessionView {...chrome} defaultView="chat" toolbarLeading={menu} pane={{
    id: session.id, visible: true, onSelect: choose, onClose: () => undefined,
    // A freshly resumed session may not be in this render's directory yet; Home shows it once it is.
    onNavigate: (workspace, remoteSession) => { if (remoteSession) choose(workspace ? sharedSessionId(workspace, remoteSession) : remoteSession); },
  }}/>;
}
