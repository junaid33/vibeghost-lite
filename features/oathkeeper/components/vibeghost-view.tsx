"use client";
import * as Glyph from "@/components/icons/duo";
import { flushSync } from "react-dom";


import { useCallback, useEffect, useLayoutEffect, useId, useRef, useState, useSyncExternalStore, type ComponentProps, type ChangeEvent, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { Check, Clipboard, Copy, Eraser, Keyboard, MessageSquareText, Mic, MoreHorizontal, Folder, Paperclip, Plus, QrCode, RefreshCw, ScanLine, Settings, ShieldCheck, TerminalSquare, Trash2 } from "@/components/icons/duo";
import composerStyles from "./home-composer.module.css";
import endedStyles from "./session-ended-status.module.css";
import threadStyles from "./chat-thread.module.css";
import { Spinner } from "@/components/ui/spinner";
import { OathkeeperOrb } from "@/components/OathkeeperOrb";
import { SessionPickerMenu } from './session-picker-menu';
import { sessionPickerWorkspaces, workspaceMachineLabel } from './session-picker-workspaces';
import { SessionOptionsMenu } from './session-options-menu';
import { SharedSessionEditor } from './shared-session-editor';
import { useVibeGhostQuickCreate } from '../hooks/use-vibeghost-quick-create';
import { SessionMemoryMenu, type PiMemoryCommand } from './session-memory-menu';
import { SessionTitle } from './session-title';
import { SessionStatusDot } from './session-status-dot';
import { ShareCodeTabs } from "./share-code-tabs";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmbeddedGhosttyTerminal, type EmbeddedGhosttyTerminalHandle } from "@/features/oathkeeper/components/embedded-ghostty-terminal";
import { MobileTerminalInput, type MobileTerminalInputHandle } from "@/features/oathkeeper/components/mobile-terminal-input";
import { VibeGhostChatView, type VibeGhostChatViewHandle } from "@/features/oathkeeper/components/vibeghost-chat-view";
import { WorkspaceSessionManager, type SessionManagementAction } from './workspace-session-manager';
import { useVibeGhostDirectory } from '../hooks/use-vibeghost-directory';
import { directoryRefreshKey, workspaceQueries } from '../lib/workspace-directory-cache';
import { navigateVibeGhost, useVibeGhostLocation, vibeGhostAppName, vibeGhostHref, vibeGhostSessionHref, vibeGhostSessionTarget, workspaceNavigationEvent } from '../lib/vibeghost-navigation';
import { isModifiedClick } from '@/lib/modified-click';
import { VibeGhostWorkspacePage } from './vibeghost-workspace-page';
import { VibeGhostLanding } from './vibeghost-landing';
import { VibeGhostTabs, type SessionPaneTarget } from './vibeghost-tabs';
import { VibeGhostActiveFeed } from './vibeghost-active-feed';
import { VibeGhostTimeline } from './vibeghost-timeline';
import { VibeGhostWorkspaceOverview } from "@/features/oathkeeper/components/vibeghost-workspace-overview";
import { SharedWorkspaceInspector } from "@/features/oathkeeper/components/shared-workspace-inspector";
import { VibeGhostWorkspaceGradient } from "@/components/VibeGhostWorkspaceGradient";
import { BrowserDictationButton, type BrowserDictationHandle } from "./browser-dictation-button";
import { ComposerAttachment, ComposerAttachmentStack } from './composer-attachment';

import { useHorizontalScrollFade } from "../hooks/use-horizontal-scroll-fade";
import { TerminalSendButton } from "./terminal-send-button";
import { TerminalComposerInput, type TerminalComposerInputHandle } from "./terminal-composer-input";
import { readTerminalDraft, writeTerminalDraft, subscribeTerminalDraft, emptyTerminalDraft, readTerminalSubmission, emptyTerminalSubmission, beginTerminalSubmission, finishTerminalSubmission, failTerminalSubmission, dismissTerminalSubmission } from "../lib/terminal-composer-draft";
import { encodeAgentComposerInput } from '../lib/agent-composer-input';
import { sessionIntegration, importedNativeQueueAvailable, type NativeQueueObservation, type SessionView } from '../lib/session-integrations';
import { canResumeSharedSession, isPendingAgentAction, resumeSharedAgent } from '../lib/shared-agent-actions';
import { actionSessionId, createdSessionId, sharedMutation } from '../lib/shared-session-options';
import { SessionViewToggle } from './session-view-toggle';
import { HerdrControlsMenu } from './herdr-controls-menu';
import { ProgramPromptsMenu } from './program-prompts-menu';
import { CLAUDE_PROMPT_CONTROLS, CODEX_PROMPT_CONTROLS, PI_PROMPT_CONTROLS, TMUX_CONTROLS } from '../lib/session-integrations/program-controls';
import type { AgentProviderId } from '../lib/session-integrations/agent-identity';
import { AgentConversation } from './agent-conversation';
import { KITTY_ALT_ENTER_SEQUENCE } from "../lib/vibeghost-terminal/terminal-key-sequences";
import { MAX_WORKSPACE_UPLOAD_BYTES, uploadWorkspaceFile } from "@/features/oathkeeper/lib/workspace-file-upload";
import { SharedWorkspaceClient } from "@/features/oathkeeper/lib/shared-workspace-client";
import { type WorkspaceInstance, type RemoteSession } from "@/features/oathkeeper/lib/shared-workspace-model";
import { WorkspaceViewShell, type WorkspaceViewChromeProps } from "@/features/oathkeeper/components/workspace-view-shell";
import { promptComposerSendButtonClass, promptToolbarControlClass } from "@/features/oathkeeper/components/dual-sidebar/prompt-control-popover";
import { dialogKitStyles } from './dialog-kit';

export type VibeGhostSession = import('../lib/session-integrations/agent-identity').AgentIdentityCarrier & {
  command?: string[];
  codexRegistrationAvailable?: boolean;
  agentChatAvailable?: boolean;
  agentActionsAvailable?: boolean;
  agentObservationAvailable?: boolean;
  terminalFollowUpAvailable?: boolean;
  nativeQueueGrant?: import("../lib/session-integrations/agent-provider").NativeQueueGrant;
  startedAt?: string;
  lastModified?: string;
  activityTimeSource?: 'pi' | 'codex' | 'claude' | 'terminal';
  status?: string;
  agentStatus?: string;
  agentPhase?: string;
  id: string;
  title: string;
  cwd: string;
  state: "Running" | "Idle";
  shared?: boolean;
  client?: SharedWorkspaceClient;
  remoteSessionId?: string;
  workspaceId?: string;
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

export type VibeGhostWorkspace = {
  id: string;
  storageId: string;
  remoteId: string;
  name: string;
  instance?: WorkspaceInstance;
  description?: string;
  color?: string;
  iconShape?: string;
  avatarMode?: string;
  defaultWorkingDir?: string;
  shared: true;
  client?: SharedWorkspaceClient;
};

type SharedSessionPayload = {
  version: 1;
  kind: "vibeghost-session";
  sessionId: string;
  title: string;
  cwd?: string;
};


import { WorkspaceRefreshControl } from './workspace-refresh-control';
import { useWorkspaceConnectRequests } from '../lib/workspace-connect-request';
import { performSessionAction, type SessionAction } from '../lib/session-actions';
import { SidebarSessionActionsMenu } from '@/app/_components/sidebar-session-actions-menu';
import { composerFieldClass, composerMicClass } from './composer-controls';
import { rememberPiSentText } from '../lib/pi-sent-texts';

const controlClass = "oathkeeper-raised-control flex h-9 shrink-0 items-center";

function SessionToolbar({ sessions, workspaces, activeId, onSelect, onAdd, onQuickCreate, onNewSession, onShare, onRefresh, refreshError, refreshing, onRemoveWorkspace, onRemoveLocalSession, viewMode, onViewModeChange, secondaryView, providerName, inspectorAvailable, inspectorOpen, onInspectorToggle, onMemoryCommand, memoryPending, memoryDisabled }: {
  sessions: VibeGhostSession[];
  workspaces: VibeGhostWorkspace[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  /** VibeGhost's per-workspace Quick create and New session… in the switcher. */
  onQuickCreate: (workspace: VibeGhostWorkspace) => void;
  onNewSession: (workspace: VibeGhostWorkspace) => void;
  onShare: (workspaceId?: string) => void;
  onRefresh: () => void;
  refreshError: string;
  refreshing: boolean;
  onRemoveWorkspace: (workspace: VibeGhostWorkspace) => void;
  onRemoveLocalSession: (session: VibeGhostSession) => void;
  viewMode: SessionView;
  onViewModeChange: (mode: SessionView) => void;
  secondaryView?: 'chat';
  providerName?: string;
  inspectorAvailable: boolean;
  inspectorOpen: boolean;
  onInspectorToggle: () => void;
  onMemoryCommand: (command: PiMemoryCommand) => void;
  memoryPending: boolean;
  memoryDisabled: boolean;
}) {
  const { pins, ensureDirectoryFresh } = useVibeGhostDirectory();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<string | null>(null);
  const activeIndex = Math.max(0, sessions.findIndex((session) => session.id === activeId));
  const session = sessions[activeIndex];
  const activeWorkspace = workspaces.find((workspace) => workspace.id === session.workspaceId);
  const localSessions = sessions.filter((item) => !item.workspaceId);

  const pickerWorkspaces = sessionPickerWorkspaces({
    sessions, workspaces, isPinned: pins.isPinned,
    workspaceActions: workspace => [
      {label:`${editingWorkspace === workspace.id ? 'Finish editing' : 'Edit'} ${workspace.name}`,displayLabel:editingWorkspace === workspace.id ? 'Finish editing' : 'Edit workspace',icon:<Glyph.Brush2/>,run:()=>setEditingWorkspace(value => value === workspace.id ? null : workspace.id),keepOpen:true},
      {label:`Quick create in ${workspace.name}`,displayLabel:'Quick create',icon:<Glyph.IconSquarePlusFillDuo18/>,disabled:!workspace.client,run:()=>{setMenuOpen(false); onQuickCreate(workspace)}},
      {label:`New session in ${workspace.name}`,displayLabel:'New session…',icon:<Plus/>,disabled:!workspace.client,run:()=>{setMenuOpen(false); onNewSession(workspace)}},
      {label:`Share ${workspace.name} workspace`,displayLabel:'Share workspace',icon:<Glyph.UploadCircle/>,run:()=>{setMenuOpen(false); onShare(workspace.id)}},
      {label:`${pins.isPinned(workspace.id) ? 'Unpin' : 'Pin'} ${workspace.name}`,displayLabel:pins.isPinned(workspace.id) ? 'Unpin workspace' : 'Pin workspace',icon:pins.isPinned(workspace.id) ? <Glyph.PinFilled/> : <Glyph.Pin/>,disabled:pins.disabled(workspace.id),run:()=>pins.toggle(workspace.id),keepOpen:true},
      ...(editingWorkspace === workspace.id ? [{label:`Remove ${workspace.name} connection`,displayLabel:'Remove connection',icon:<Glyph.CloseCircle/>,run:()=>{setMenuOpen(false); onRemoveWorkspace(workspace)}}] : []),
    ],
    localSessionActions: item => [{label:`Remove ${item.title}`,icon:<Trash2/>,run:()=>onRemoveLocalSession(item)}],
  });

  return (
    <DropdownMenu modal={false} open={menuOpen} onOpenChange={(open) => { setMenuOpen(open); if (open) void ensureDirectoryFresh(); else setEditingWorkspace(null); }}>
    <div data-session-toolbar className={cn(composerStyles.sessionToolbar, "relative z-40 font-sans text-[12px] font-medium")}>
      <div className="flex min-w-0 items-center gap-[3px]">
        <DropdownMenuTrigger asChild><button type="button" aria-label="Switch workspace or session" className={cn(controlClass, "min-w-0 flex-1 gap-2 px-2.5 text-left")}>
          <span className="flex shrink-0 items-center justify-center pr-1"><SessionStatusDot session={session} selected/></span>
          <span className="min-w-0 flex-1 leading-none"><span className="flex min-w-0 items-center gap-1 truncate text-[12px] uppercase tracking-[.08em] text-[#777e79]"><span className="shrink-0">{activeWorkspace?.name || "Local sessions"}</span>{session.shared && activeWorkspace ? <><span aria-hidden="true" className="text-[#515753]">·</span><span className="truncate">{workspaceMachineLabel(activeWorkspace)}</span></> : null}</span><span className="mt-1 block truncate text-[12px] text-[#f4f7f5]"><SessionTitle title={session.title} tags={session.tags} placement="trigger"/></span></span>
          <span className="h-5 w-px bg-gradient-to-b from-transparent to-[#f4f7f5]/10"/>
          <Glyph.ChevronDown className={cn("size-2.5 shrink-0 text-[#919793] transition-transform", menuOpen && "rotate-180")} aria-hidden="true" />
        </button></DropdownMenuTrigger>
        <SessionOptionsMenu key={session.id} session={session} workspace={activeWorkspace} onShare={onShare}/>
        <SessionMemoryMenu key={`memory-${session.id}`} session={session} onCommand={onMemoryCommand} pending={memoryPending} disabled={memoryDisabled || !session.client || !session.remoteSessionId}/>
        <WorkspaceRefreshControl label={session.status === 'exited' ? 'Reload session recording' : 'Refresh session'} error={refreshError} refreshing={refreshing} onRefresh={onRefresh} className={cn(controlClass, "size-9 justify-center text-[#949a96]")}/>
        <SessionViewToggle secondaryView={secondaryView} view={viewMode} providerName={providerName} onChange={onViewModeChange} className={cn(controlClass, "size-9 justify-center text-[#949a96]")}/>
        {inspectorAvailable ? <button type="button" aria-label={inspectorOpen ? "Close workspace inspector" : "Open workspace inspector"} title={inspectorOpen ? "Close workspace inspector" : "Open workspace inspector"} aria-pressed={inspectorOpen} onClick={onInspectorToggle} className={cn(controlClass, "size-9 justify-center", inspectorOpen ? "oathkeeper-control-selected text-[#b7bcb9]" : "text-[#949a96]")}><Folder aria-hidden="true" className="size-3.5"/></button> : null}
      </div>

      <SessionPickerMenu headerAction={{label:'Connect shared workspace',icon:<Plus/>,run:()=>{setMenuOpen(false); onAdd()}}} workspaces={pickerWorkspaces} activeId={activeId} onSelect={id => { onSelect(id); setMenuOpen(false); }} notice={pins.error ? <p role="alert" className="px-3 py-2 text-xs text-[#e89a94]">{pins.error} <button type="button" onClick={pins.retry}>Retry pins</button></p> : undefined}/>
    </div>
    </DropdownMenu>
  );
}

function TerminalControlToolbar({ onSendInput, onFocusInput, onPaste, onSettings, onAttach, attaching = false, onPiKey, onFollowUp, followUpDisabled = false, disabled = false, pi = false, agent, program }: {
  onSendInput: (text: string) => void;
  onFocusInput: () => void;
  onPaste: () => void;
  onSettings: () => void;
  onAttach?: () => void;
  attaching?: boolean;
  onPiKey?: (text: string) => void;
  onFollowUp?: () => void;
  followUpDisabled?: boolean;
  disabled?: boolean;
  pi?: boolean;
  agent?: AgentProviderId;
  program?: 'herdr' | 'tmux';
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useHorizontalScrollFade(scrollRef);
  const toolbarControlClass = "oathkeeper-raised-control flex h-8 shrink-0 items-center text-[#b7bcb9]";
  const keyClass = cn(toolbarControlClass, "justify-center gap-1.5 px-2.5 font-mono text-[12px] font-medium uppercase tracking-[0.1em]");

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const redirectWheel = (event: WheelEvent) => {
      if (scroller.scrollWidth <= scroller.clientWidth) return;
      event.preventDefault();
      event.stopPropagation();
      scroller.scrollLeft += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    };
    scroller.addEventListener("wheel", redirectWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", redirectWheel);
  }, []);

  return <div ref={scrollRef} data-terminal-control-toolbar inert={disabled} aria-label="Terminal controls" aria-disabled={disabled || undefined} className={cn("scroll-fade-x relative z-20 flex h-8 min-w-0 touch-pan-x gap-[3px] overflow-x-auto overflow-y-hidden overscroll-x-contain overscroll-y-none font-mono text-[12px] font-medium text-[#b7bcb9] [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden [&_button]:text-[#b7bcb9] [&_button_svg]:text-current", disabled && "pointer-events-none opacity-45")}>
    <button type="button" onClick={onSettings} aria-label="Terminal toolbar settings" className={cn(toolbarControlClass, "size-8 justify-center")}><Settings className="size-4"/></button>
    <button type="button" onClick={onAttach} disabled={disabled || attaching} aria-label="Attach file" title="Upload a file to this session (up to 10 MB)" className={cn(toolbarControlClass, 'size-8 justify-center disabled:opacity-40')}><Paperclip className="size-4"/></button>
    {program === 'herdr' ? <HerdrControlsMenu disabled={disabled} onSendInput={onSendInput}/> :
      program === 'tmux' ? <ProgramPromptsMenu label="tmux controls" description="Default Ctrl+B bindings. Only for explicitly tmux-tagged sessions; custom keymaps may differ." controls={TMUX_CONTROLS} disabled={disabled} onSendInput={onSendInput}/> :
      pi ? <ProgramPromptsMenu label="Pi prompts" description="Pi’s default editor bindings. Queue the composer draft or control the terminal editor; custom keymaps may differ." controls={PI_PROMPT_CONTROLS} disabled={disabled} onSendInput={onPiKey ?? onSendInput} onFollowUp={onFollowUp} followUpDisabled={followUpDisabled}/> :
      agent === 'claude' ? <ProgramPromptsMenu label="Claude prompts" description="Claude Code’s native editor bindings. Enter while busy may join ongoing work; after-work follow-up is unavailable. Ctrl+X Ctrl+S sends immediately, not as follow-up. Long-press and Alt+Enter follow-up are disabled. Custom keymaps may differ." controls={CLAUDE_PROMPT_CONTROLS} disabled={disabled} onSendInput={onPiKey ?? onSendInput}/> :
      agent === 'codex' ? <ProgramPromptsMenu label="Codex prompts" description="Codex’s native editor bindings. Enter while busy steers; Tab queues the draft. This is not Pi extension or scheduler follow-up delivery." controls={CODEX_PROMPT_CONTROLS} disabled={disabled} onSendInput={onPiKey ?? onSendInput} onFollowUp={onFollowUp} followUpDisabled={followUpDisabled} followUpShortcut="Tab"/> : null}
    <button type="button" onClick={onFocusInput} aria-label="Focus terminal input" className={cn(keyClass, "w-[72px] px-0 text-[#949a96]")}><TerminalSquare className="size-3.5"/><span className="h-3.5 w-px bg-current/25"/><Keyboard className="size-3.5"/></button>
    <span role="group" aria-label="Terminal navigation keys" className="oathkeeper-raised-control inline-flex shrink-0 overflow-hidden rounded-[8px]">
      {([["↑", "\u001b[A", "Up"], ["↓", "\u001b[B", "Down"], ["←", "\u001b[D", "Left"], ["→", "\u001b[C", "Right"], ["ESC", "\u001b", "Escape"]] as const).map(([label, key, name], index) => <button key={name} type="button" onClick={() => onSendInput(key)} aria-label={`Send ${name} key`} className={cn("flex h-8 items-center justify-center border-0 bg-transparent px-2 font-mono text-[13px] text-[#d7dbd8] transition-colors hover:bg-white/[.05] focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-[#8bb8ff]", index < 4 && "w-8 px-0", index > 0 && "border-l border-white/[.08]", index === 0 && "rounded-l-[8px]", index === 4 && "rounded-r-[8px] text-[12px] font-medium uppercase tracking-[.1em]")}>{label}</button>)}
    </span>
    <span role="group" aria-label="Enter controls" className="oathkeeper-raised-control inline-flex shrink-0 overflow-hidden rounded-[8px]">
      <button type="button" onClick={() => onSendInput("\r")} className="flex h-8 min-w-[72px] items-center justify-center border-0 bg-transparent px-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[#d7dbd8] transition-colors hover:bg-white/[.05]">Enter</button>
      <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label="More Enter actions" className="flex size-8 items-center justify-center border-l border-white/[.08] bg-transparent text-[#d7dbd8] transition-colors hover:bg-white/[.05]"><MoreHorizontal className="size-4"/></button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-52 rounded-xl bg-[var(--oathkeeper-panel)] p-1 font-mono text-[#f4f7f5] ring-1 ring-white/10"><DropdownMenuItem disabled={!pi} onSelect={() => onSendInput(KITTY_ALT_ENTER_SEQUENCE)} className="min-h-9 rounded-lg px-2 text-[12px] focus:bg-white/10 focus:text-white">Alt+Enter · Follow-up</DropdownMenuItem><DropdownMenuItem disabled={!pi} onSelect={() => onSendInput(`continue${KITTY_ALT_ENTER_SEQUENCE}`)} className="min-h-9 rounded-lg px-2 text-[12px] focus:bg-white/10 focus:text-white">Continue + Alt+Enter</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </span>
    <span role="group" aria-label="Control keys" className="oathkeeper-raised-control inline-flex shrink-0 overflow-hidden rounded-[8px]">
      <button type="button" onClick={() => onSendInput("\u0003")} className="flex h-8 min-w-[70px] items-center justify-center gap-1.5 border-0 bg-transparent px-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[#d7dbd8] transition-colors hover:bg-white/[.05]">Ctrl<span className="text-[#686e6a]">+</span>C</button>
      <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label="More control keys" className="flex size-8 items-center justify-center border-l border-white/[.08] bg-transparent text-[#d7dbd8] transition-colors hover:bg-white/[.05]"><MoreHorizontal className="size-4"/></button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-44 rounded-xl bg-[var(--oathkeeper-panel)] p-1 font-mono text-[#f4f7f5] ring-1 ring-white/10">{[["Ctrl+D · EOF", "\u0004"], ["Ctrl+Z · Suspend", "\u001a"], ["Ctrl+L · Clear screen", "\u000c"], ["Ctrl+R · Reverse search", "\u0012"], ["Ctrl+W · Delete word", "\u0017"], ["Ctrl+U · Delete line", "\u0015"], ["Ctrl+A · Start of line", "\u0001"], ["Ctrl+E · End of line", "\u0005"], ["Ctrl+K · Kill to end", "\u000b"]].map(([label, key]) => <DropdownMenuItem key={label} onSelect={() => onSendInput(key)} className="min-h-9 rounded-lg px-2 text-[12px] focus:bg-white/10 focus:text-white">{label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
    </span>
    <button type="button" onClick={onPaste} className={cn(keyClass, "min-w-[72px]")}><Clipboard className="size-3.5 text-[#949a96]"/>Paste</button>
    <button type="button" onClick={() => onSendInput(agent || pi ? "\x15" : "clear\r")} title={agent || pi ? "Delete to the start of agent input" : "Clear terminal screen"} className={cn(keyClass, "min-w-[68px]")}><Eraser className="size-3.5 text-[#949a96]"/>Clear</button>
    <span role="group" aria-label="Tab and terminal keys" className="oathkeeper-raised-control inline-flex shrink-0 overflow-hidden rounded-[8px]">
      <button type="button" onClick={() => onSendInput("\t")} className="flex h-8 min-w-[58px] items-center justify-center gap-1.5 border-0 bg-transparent px-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[#d7dbd8] transition-colors hover:bg-white/[.05]"><Keyboard className="size-3.5"/>Tab</button>
      <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label="More terminal keys" className="flex size-8 items-center justify-center border-l border-white/[.08] bg-transparent text-[#d7dbd8] transition-colors hover:bg-white/[.05]"><MoreHorizontal className="size-4"/></button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-48 rounded-xl bg-[var(--oathkeeper-panel)] p-1 font-mono text-[#f4f7f5] ring-1 ring-white/10">{[["Enter", "\r"], ["Shift+Tab", "\u001b[Z"], ["Delete", "\u001b[3~"], ["Page up", "\u001b[5~"], ["Page down", "\u001b[6~"], ["Home", "\u001b[H"], ["End", "\u001b[F"], ["`", "`"], ["~", "~"], ["|", "|"], ["/", "/"], ["\\", "\\"], ["-", "-"], ["_", "_"], ["'", "'"], ['"', '"'], ["(", "("], [")", ")"], ["{", "{"], ["}", "}"], ["[", "["], ["]", "]"], ["<", "<"], [">", ">"]].map(([label, key]) => <DropdownMenuItem key={`${label}-${key}`} onSelect={() => onSendInput(key)} className="min-h-9 rounded-lg px-2 text-[12px] focus:bg-white/10 focus:text-white">{label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
    </span>
  </div>;
}

export function VibeGhostView(chrome: WorkspaceViewChromeProps) {
  const location = useVibeGhostLocation();
  if (location.view === 'timeline' && !location.workspace && !location.session) return <WorkspaceViewShell {...chrome} title="Timeline" breadcrumbs={[
    { label: vibeGhostAppName(), href: vibeGhostHref(), onClick: event => { if (isModifiedClick(event)) return; event.preventDefault(); navigateVibeGhost(); } },
    { label: 'Timeline' },
  ]}><VibeGhostTimeline chrome={chrome}/></WorkspaceViewShell>;
  if (location.view === 'tabs') return <WorkspaceViewShell {...chrome} title="Tabs" wide scrollable={false} breadcrumbs={[
    { label: vibeGhostAppName(), href: vibeGhostHref(), onClick: event => { if (isModifiedClick(event)) return; event.preventDefault(); navigateVibeGhost(); } },
    { label: 'Tabs' },
  ]}><VibeGhostTabs renderSession={pane => <VibeGhostSessionView {...chrome} pane={pane}/>}/></WorkspaceViewShell>;
  return <VibeGhostSessionView {...chrome}/>;
}

function VibeGhostFrame({ embedded, ...props }: ComponentProps<typeof WorkspaceViewShell> & { embedded: boolean }) {
  return embedded ? <>{props.children}</> : <WorkspaceViewShell {...props}/>;
}

/** Single controlled session surface, shared by the regular page, tab panes and Home. Home
 *  opens it on the chat view and puts its agent picker first in the composer's toolbar. */
export function VibeGhostSessionView({ pane, defaultView = "terminal", toolbarLeading, sessionBar = true, ...chrome }: WorkspaceViewChromeProps & { pane?: SessionPaneTarget; defaultView?: SessionView; toolbarLeading?: ReactNode;
  /** false drops the session bar (switcher, options, view toggle) when the host picks the session and the view itself: the Kanban card. */
  sessionBar?: boolean }) {
  const { pins, directory, updateDirectory, clientsRef, clientTicketsRef, connectionScopeRef,
    workspaceChecks, connectInvite, checkWorkspace, refreshWorkspaceSessions,
    loadingWorkspaces, initialLoading, savedWorkspaceError, directoryError, loadSavedWorkspaces, ensureDirectoryFresh } = useVibeGhostDirectory();
  const { workspaces, sessions } = directory;
  const route = useVibeGhostLocation();
  const embedded = Boolean(pane);
  const paneVisible = pane?.visible ?? true;
  const instanceId = useId();
  const directInputId = embedded ? `vibeghost-direct-terminal-${instanceId}` : 'vibeghost-direct-terminal-input';
  const selectedSession = pane ? sessions.find(item => item.id === pane.id) : sessions.find((item) => route.session && (route.workspace
    ? item.workspaceId === route.workspace && item.remoteSessionId === route.session
    : !item.workspaceId && item.id === route.session));
  const location = pane ? { workspace: selectedSession?.workspaceId || '', session: selectedSession?.remoteSessionId || pane.id, view: '' } : route;
  useEffect(() => { if (!embedded) void ensureDirectoryFresh(); }, [embedded, ensureDirectoryFresh, location.workspace, location.session, location.view]);
  const activeWorkspaceCheck = location.workspace ? workspaceChecks[location.workspace] : undefined;
  const selectedWorkspace = workspaces.find((item) => item.id === location.workspace);
  const activeId = selectedSession?.id || '';
  // A session opened right after it was made (resumed, forked, quick-created) can be newer than the
  // list on hand: look it up once in its workspace before calling it unavailable.
  const missingIn = selectedSession ? undefined : pane
    ? workspaces.filter(item => pane.id.startsWith(`iroh-${item.id}-`)).sort((a, b) => b.id.length - a.id.length)[0]
    : route.session ? selectedWorkspace : undefined;
  const missingKey = missingIn?.client ? `${missingIn.id}\n${pane?.id ?? route.session}` : '';
  const lookedUpRef = useRef('');
  const [lookedUp, setLookedUp] = useState('');
  useEffect(() => {
    if (!missingKey || !missingIn || lookedUpRef.current === missingKey) return;
    lookedUpRef.current = missingKey;
    void refreshWorkspaceSessions(missingIn).catch(() => undefined).finally(() => setLookedUp(missingKey));
  }, [missingKey, missingIn, refreshWorkspaceSessions]);
  const findingSession = Boolean(missingKey) && lookedUp !== missingKey;
  // Sessions opened from the Active Feed or the Timeline stay under its path, so the way back leads there.
  const returnView = location.view === 'active' || location.view === 'timeline' ? location.view : undefined;
  const navigateSession = (workspace?: string, remoteSession?: string) => {
    if (pane) pane.onNavigate(workspace, remoteSession);
    else navigateVibeGhost(workspace, remoteSession, returnView);
  };
  const actOnSession = async (target: VibeGhostSession, action: SessionAction) => {
    const workspace = workspaces.find(item => item.id === target.workspaceId);
    const result = await performSessionAction(workspace, target, action);
    // Refresh the session's own workspace so a resumed or forked session is listed before it opens.
    if (workspace) await refreshWorkspaceSessions(workspace).catch(() => loadSavedWorkspaces());
    else await loadSavedWorkspaces();
    if (!result.openSessionId || !target.workspaceId) return;
    // A resumed session takes over from the one it came from, so a tab (or Home) showing it follows.
    if (pane && action === 'resume' && target.id === activeId) pane.onNavigate(target.workspaceId, result.openSessionId);
    else navigateVibeGhost(target.workspaceId, result.openSessionId, pane ? undefined : returnView);
  };
  // Quick create (VibeGhost's): a session in a folder (a session's own, or the workspace's default) that opens at once;
  // New session… opens the dialog. Offered wherever VibeGhost offers them: breadcrumb bar, ⋯ menus, the switcher, row menus.
  const quick = useVibeGhostQuickCreate();
  const [newSession, setNewSession] = useState<{ workspace: VibeGhostWorkspace; workingDir?: string } | null>(null);
  const createIn = (workspace: VibeGhostWorkspace, workingDir?: string) => void quick.quickCreate(workspace, workingDir, (workspaceId, sessionId) => navigateSession(workspaceId, sessionId));
  const sessionActions = (target: VibeGhostSession) => {
    const workspace = workspaces.find(item => item.id === target.workspaceId);
    return <SidebarSessionActionsMenu session={target} onCreate={workspace?.client ? () => createIn(workspace, target.cwd) : undefined} createDisabled={quick.creatingId === workspace?.id} onAction={action => actOnSession(target, action)}/>;
  };
  const selectSession = (id: string) => {
    if (pane) { pane.onSelect(id); return; }
    const target = sessions.find((item) => item.id === id);
    if (target) { const route = vibeGhostSessionTarget(target); navigateVibeGhost(route.workspace, route.session, returnView); }
  };
  const selectActiveSession = (target: VibeGhostSession) => {
    const route = vibeGhostSessionTarget(target);
    navigateVibeGhost(route.workspace, route.session, 'active');
  };
  const draft = useSyncExternalStore(subscribeTerminalDraft, () => readTerminalDraft(activeId), emptyTerminalDraft);
  const submission = useSyncExternalStore(subscribeTerminalDraft, () => readTerminalSubmission(activeId), emptyTerminalSubmission);
  const input = draft.text;
  const setInput = (value: string | ((text: string) => string)) => writeTerminalDraft(activeId, value);
  const submitPending = useRef(new Set<string>());
  const dictationSubmitPending = useRef(new Set<string>());
  const [joinOpen, setJoinOpen] = useState(false);
  useWorkspaceConnectRequests(() => setJoinOpen(true), paneVisible);
  const [invitePrefill, setInvitePrefill] = useState('');
  useEffect(()=>{
    if (embedded) return;
    const readInvite=()=>{if(!window.location.hash || window.location.hash.startsWith('#/'))return;setInvitePrefill(window.location.hash.slice(1));setJoinOpen(true);window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);};
    readInvite();window.addEventListener('hashchange',readInvite);return()=>window.removeEventListener('hashchange',readInvite);
  },[embedded]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCode, setShareCode] = useState("");
  const [shareTarget, setShareTarget] = useState<Pick<VibeGhostSession, 'title' | 'shared'> | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionManagement, setSessionManagement] = useState<SessionManagementAction | null>(null);
  const [sessionToRemove, setSessionToRemove] = useState<VibeGhostSession | null>(null);
  const [workspaceToRemove, setWorkspaceToRemove] = useState<VibeGhostWorkspace | null>(null);
  const [removingSession, setRemovingSession] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const manualRefreshPending = useRef(new Set<string>());
  const [manualRefreshingKeys, setManualRefreshingKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [actionError, setActionError] = useState<{ scope: string; message: string } | null>(null);
  const actionScope = activeId || location.workspace || 'directory';
  // Explicit action failures belong to the initiating view, never a polling run.
  const reportActionError = (message: string) => setActionError(message ? { scope: actionScope, message } : null);
  const visibleActionError = actionError?.scope === actionScope ? actionError.message : '';
  const [terminalEpoch, setTerminalEpoch] = useState(0);
  const [chatEpoch, setChatEpoch] = useState(0);
  const [viewMode, setViewMode] = useState<SessionView>(defaultView);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const memoryCommandPending = useRef(false);
  const [memoryCommandSession, setMemoryCommandSession] = useState<string | null>(null);
  const exitedActionPending = useRef(false);
  const [exitedAction, setExitedAction] = useState<'resume' | 'clean' | null>(null);
  const [resumeVerificationPending, setResumeVerificationPending] = useState(false);

  const [uploadingFile, setUploadingFile] = useState("");
  const [draggingFiles, setDraggingFiles] = useState(false);
  const fileDragDepth = useRef(0);
  const uploadPending = useRef(false);
  const uploadController = useRef<AbortController | null>(null);
  const sessionController = useRef<AbortController | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | undefined>(undefined);
  const terminalRef = useRef<EmbeddedGhosttyTerminalHandle>(null);
  const chatRef = useRef<VibeGhostChatViewHandle>(null);
  const mobileInputRef = useRef<MobileTerminalInputHandle>(null);
  const commandInputRef = useRef<TerminalComposerInputHandle>(null);
  const dictationRef = useRef<BrowserDictationHandle>(null);
  useEffect(() => {
    if (!paneVisible) {
      // Dictation keeps writing to this session's draft; the shell shows it while away.
      setInspectorOpen(false);
      setSettingsOpen(false);
      setShareOpen(false);
      setJoinOpen(false);
    }
  }, [paneVisible]);
  // A cached row is navigable display data, never authority to mount/send to a terminal.
  const session = selectedSession && (!selectedSession.shared || selectedSession.client) ? selectedSession : null;
  // The breadcrumb bar's Quick create: in the open session's folder, or on a workspace page its default directory.
  const createTarget = session ? workspaces.find(item => item.id === session.workspaceId) : selectedWorkspace;
  const latestSession = useRef(session);
  useLayoutEffect(() => { latestSession.current = session; }, [session]);
  useEffect(() => {
    uploadTargetRef.current = session?.id;
    const controller = new AbortController();
    sessionController.current = controller;
    return () => {
      controller.abort();
      uploadTargetRef.current = undefined;
      uploadController.current?.abort();
      uploadController.current = null;
      uploadPending.current = false;
    };
  }, [session?.id, session?.client]);
  useEffect(() => {
    setUploadingFile("");
    fileDragDepth.current = 0;
    setDraggingFiles(false);
  }, [session?.id, session?.client]);
  const [queueObservation, setQueueObservation] = useState<NativeQueueObservation>();
  const queueObservationRef = useRef<NativeQueueObservation | undefined>(undefined);
  useEffect(() => {
    const client = session?.client, remoteId = session?.remoteSessionId;
    queueObservationRef.current = undefined;
    setQueueObservation(undefined);
    if (!session || !client || !remoteId || !paneVisible || sessionIntegration(session).provider?.id !== 'codex') return;
    const owner = session, controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined, pending = false;
    let seenGeneration = client.transportGeneration, retryAfter = 0;
    const clearLease = () => { queueObservationRef.current = undefined; setQueueObservation(undefined); };
    const fetchLease = async () => {
      if (pending || controller.signal.aborted || document.visibilityState === 'hidden' || Date.now() < retryAfter) return;
      pending = true; clearLease();
      const generation = client.transportGeneration;
      seenGeneration = generation;
      try {
        const response = await client.json<RemoteSession>('GET', `/api/sessions/${encodeURIComponent(remoteId)}`, undefined, controller.signal);
        const current = latestSession.current;
        if (controller.signal.aborted || client.transportGeneration !== generation || current?.client !== client ||
          current.id !== owner.id || current.workspaceId !== owner.workspaceId || response.id !== remoteId) return;
        const observation: NativeQueueObservation = { ownerId: owner.id, peerId: owner.workspaceId!, remoteId, client, generation, response };
        if (importedNativeQueueAvailable(current, observation)) {
          queueObservationRef.current = observation; setQueueObservation(observation);
        }
      } catch { if (!controller.signal.aborted) { clearLease(); retryAfter = Date.now() + 6000; } }
      finally { pending = false; }
    };
    // UI-only audit; metadata reads occur once per lease or known reconnect,
    // not per tick. All timers/listeners/reads are scoped to this visible owner.
    const audit = () => {
      if (controller.signal.aborted) return;
      const observation = queueObservationRef.current;
      if (client.transportGeneration !== seenGeneration ||
        (observation && !importedNativeQueueAvailable(latestSession.current, observation))) {
        clearLease(); void fetchLease();
      }
      const expiry = queueObservationRef.current?.response.nativeQueueGrant?.expiresAt;
      const delay = typeof expiry === 'number' && Number.isFinite(expiry) && expiry > Date.now() ? Math.min(1000, expiry - Date.now()) : 1000;
      timer = setTimeout(audit, Math.max(1, delay));
    };
    const visibility = () => { if (document.visibilityState === 'hidden') clearLease(); else void fetchLease(); };
    document.addEventListener('visibilitychange', visibility);
    void fetchLease(); audit();
    return () => { controller.abort(); if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [session, session?.id, session?.client, session?.workspaceId, session?.remoteSessionId, session?.agentIdentity?.conversation.id,
    session?.agentIdentity?.binding.epoch, session?.nativeQueueGrant?.expiresAt, session?.terminalFollowUpAvailable, session?.status, session?.agentPhase, paneVisible]);
  const integration = sessionIntegration(session, queueObservation);
  const composerAgent = integration.composerAgent;
  const chatAvailable = Boolean(session?.shared && session.client && session.remoteSessionId && integration.secondaryView === 'chat');
  const secondaryView = chatAvailable ? 'chat' : undefined;
  const effectiveView: SessionView = viewMode === secondaryView ? viewMode : 'terminal';
  const inspectorAvailable = Boolean(session?.shared && session.client && session.cwd);
  const canResumeExited = Boolean(
    session?.status === 'exited' && session.client && session.remoteSessionId &&
    selectedWorkspace?.client === session.client &&
    canResumeSharedSession(session, session.client) && !resumeVerificationPending
  );
  const canCleanExited = Boolean(
    session?.status === 'exited' && session.client && session.remoteSessionId &&
    selectedWorkspace?.client === session.client && !resumeVerificationPending
  );

  useEffect(() => {
    // Each session opens on the page's default view (Home asks for chat); without chat it falls back to the terminal.
    setViewMode(defaultView);
    setResumeVerificationPending(false);
    setExitedAction(null);
  }, [defaultView, secondaryView, session?.id]);

  useEffect(() => {
    if (!inspectorAvailable) setInspectorOpen(false);
  }, [inspectorAvailable]);


  const sendTerminalInput = useCallback((text: string) => {
    if (!paneVisible || !session || session.status === 'exited') return;
    setViewMode('terminal');
    terminalRef.current?.sendInput(text);
  }, [session, paneVisible]);
  const uploadFiles = async (files: File[]) => {
    const target = session;
    if (!files.length) return;
    if (!target?.client || !target.remoteSessionId || target.status === "exited") {
      reportActionError("Connect to a running workspace session before uploading a file.");
      return;
    }
    if (uploadPending.current) { reportActionError("Please wait for the current upload to finish."); return; }
    const invalid = files.find((file) => !file.size || file.size > MAX_WORKSPACE_UPLOAD_BYTES);
    if (invalid) { reportActionError(`${invalid.name || "File"}: choose a nonempty file up to 10 MB.`); return; }
    const controller = new AbortController();
    uploadController.current = controller;
    uploadPending.current = true;
    reportActionError("");
    try {
      for (const file of files) {
        if (controller.signal.aborted || uploadTargetRef.current !== target.id) break;
        setUploadingFile(file.name || "image");
        const quotedPath = await uploadWorkspaceFile(target.client, target.remoteSessionId, file, controller.signal);
        // A session switch or disconnect must never insert a path into a different terminal.
        if (controller.signal.aborted || uploadTargetRef.current !== target.id || clientsRef.current.get(target.workspaceId!) !== target.client) break;
        await target.client.json("POST", `/api/sessions/${encodeURIComponent(target.remoteSessionId)}/input`, { text: `${quotedPath} ` }, controller.signal);
      }
    } catch (error) {
      if (!controller.signal.aborted && uploadTargetRef.current === target.id) reportActionError(error instanceof Error ? error.message : "File upload failed.");
    } finally {
      if (uploadController.current === controller) {
        uploadController.current = null;
        uploadPending.current = false;
        setUploadingFile("");
      }
    }
  };

  const pasteTerminalInput = async () => {
    const targetId = session?.id;
    const signal = sessionController.current?.signal;
    try {
      if (navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        const files: File[] = [];
        let text = "";
        for (const item of items) {
          const type = item.types.find((type) => type.startsWith("image/"));
          if (type) files.push(new File([await item.getType(type)], `pasted-image.${type.split("/")[1].replace("jpeg", "jpg")}`, { type }));
          else if (item.types.includes("text/plain")) text += await (await item.getType("text/plain")).text();
        }
        if (signal?.aborted || uploadTargetRef.current !== targetId) return;
        if (files.length) { await uploadFiles(files); return; }
        if (text) { sendTerminalInput(text.replace(/\r\n/g, "\n")); return; }
      } else {
        const text = await navigator.clipboard.readText();
        if (!signal?.aborted && uploadTargetRef.current === targetId && text) { sendTerminalInput(text.replace(/\r\n/g, "\n")); return; }
      }
      if (!signal?.aborted) reportActionError("Clipboard is empty. Paste directly into the input or use Attach file.");
    } catch {
      if (!signal?.aborted) reportActionError("Clipboard access was denied. Paste directly into the input or use Attach file.");
    }
  };

  const submit = async (followUp = false) => {
    const target = session;
    if (!target || commandInputRef.current?.isComposing() || uploadPending.current || submitPending.current.has(target.id) || dictationSubmitPending.current.has(target.id)) return;
    if (integration.issue) { reportActionError('Agent identity or tags conflict. Resolve the session binding before sending; your draft was kept.'); return; }
    if (followUp && (!sessionIntegration(latestSession.current, queueObservationRef.current).canFollowUp ||
      latestSession.current?.id !== target.id || latestSession.current?.workspaceId !== target.workspaceId ||
      latestSession.current?.client !== target.client || latestSession.current?.remoteSessionId !== target.remoteSessionId)) { reportActionError('Native follow-up lease is unavailable or expired. Your draft was kept.'); return; }
    const signal = sessionController.current?.signal;
    if (signal?.aborted || target.status === 'exited') return;
    if (!target.client && !terminalRef.current) return;
    dictationSubmitPending.current.add(target.id);
    try {
      if (dictationRef.current && !await dictationRef.current.finish()) return;
    } finally { dictationSubmitPending.current.delete(target.id); }
    // Navigation/edit cancellation must never send a delayed draft elsewhere.
    if (signal?.aborted || signal !== sessionController.current?.signal || uploadPending.current || commandInputRef.current?.isComposing()) return;
    if (followUp && (!sessionIntegration(latestSession.current, queueObservationRef.current).canFollowUp ||
      latestSession.current?.id !== target.id || latestSession.current?.workspaceId !== target.workspaceId ||
      latestSession.current?.client !== target.client || latestSession.current?.remoteSessionId !== target.remoteSessionId || (composerAgent === 'codex' && (latestSession.current?.agentIdentity?.conversation.id !== target.agentIdentity?.conversation.id || latestSession.current?.agentIdentity?.binding.epoch !== target.agentIdentity?.binding.epoch)))) { reportActionError('Native follow-up lease changed or expired. Your draft was kept.'); return; }
    const command = readTerminalDraft(target.id).text.trim();
    if (!command) return;
    let payload: string;
    try {
      // Validate before moving the draft. Framing and submit must stay in one RPC,
      // never the terminal's paced raw-input path or a separately retried Enter.
      payload = composerAgent
        ? encodeAgentComposerInput(command, followUp ? 'alt-enter' : 'enter', composerAgent)
        : `${command}\r`;
      if (composerAgent && (!target.client || !target.remoteSessionId)) {
        reportActionError('Agent submission requires a connected shared session. Your draft was kept.');
        return;
      }
    } catch (error) {
      reportActionError(error instanceof Error ? error.message : 'Could not prepare this message. Your draft was kept.');
      return;
    }
    const submitted = beginTerminalSubmission(target.id);
    if (!submitted) return;
    // Recognition has drained before the snapshot. Retire defensively before
    // dispatch so no speech callback can populate the next draft.
    dictationRef.current?.cancel();
    commandInputRef.current?.retire();
    reportActionError('');
    submitPending.current.add(target.id);
    try {
      if (effectiveView === "chat" && integration.chatProvider === 'pi' && chatRef.current) await chatRef.current.sendMessage(command, followUp, signal);
      else if (target.client && target.remoteSessionId) {
        if (composerAgent === 'pi') rememberPiSentText(target.remoteSessionId, command);
        await target.client.json("POST", `/api/sessions/${encodeURIComponent(target.remoteSessionId)}/input`, { text: payload }, signal);
      } else terminalRef.current?.writeCommand(command);
      finishTerminalSubmission(target.id, submitted);
    } catch {
      // A failed response is not proof that input was rejected. Never put
      // possibly-sent text back in the editor; retain the recovery receipt.
      failTerminalSubmission(target.id, submitted, false);
    } finally { submitPending.current.delete(target.id); }
  };

  const runMemoryCommand = async (command: PiMemoryCommand) => {
    const target = session;
    const signal = sessionController.current?.signal;
    if (!target?.client || !target.remoteSessionId || target.status !== 'running' ||
      integration.provider?.id !== 'pi' || !signal || signal.aborted ||
      memoryCommandPending.current || uploadPending.current || submitPending.current.has(target.id)) return;
    memoryCommandPending.current = true;
    setMemoryCommandSession(target.id);
    reportActionError('');
    // Extension commands report in the TUI, not the semantic transcript. Keep
    // the composer draft untouched and send paste + Enter in one scoped RPC.
    setViewMode('terminal');
    try {
      await target.client.json('POST', `/api/sessions/${encodeURIComponent(target.remoteSessionId)}/input`, {
        text: encodeAgentComposerInput(command, 'enter', 'pi'),
      }, signal);
    } catch (error) {
      if (!signal.aborted) reportActionError(`${error instanceof Error ? error.message : 'Memory command failed.'} Delivery could not be confirmed. Check the terminal before retrying.`);
    } finally {
      memoryCommandPending.current = false;
      setMemoryCommandSession(null);
    }
  };

  const refreshActiveSession = async () => {
    // Explicit refresh may reload a recording; background metadata polling
    // never invokes this action or drives its spinner.
    const key = session?.workspaceId || session?.id;
    if (!key || manualRefreshPending.current.has(key)) return;
    manualRefreshPending.current.add(key);
    setManualRefreshingKeys(new Set(manualRefreshPending.current));
    try {
      if (effectiveView === 'chat') setChatEpoch(current => current + 1);
      else if (effectiveView === 'terminal') setTerminalEpoch(current => current + 1);
      const workspace = workspaces.find(item => item.id === session?.workspaceId);
      if (!workspace?.client) return;
      uploadController.current?.abort();
      // The invite-scoped owner replaces the connection for existing consumers.
      await workspaceQueries.cancelQueries({ queryKey: directoryRefreshKey });
      const signal = connectionScopeRef.current.controller.signal;
      await checkWorkspace(workspace.id, async () => {
        // A recording reload does not need to reconnect the shared live transport.
        if (effectiveView === 'terminal' && session?.status !== 'exited') await workspace.client!.reconnect();
        await refreshWorkspaceSessions(workspace, signal);
      }, signal);
    } catch { /* The scoped refresh control owns the failure; no global alert. */ }
    finally {
      manualRefreshPending.current.delete(key);
      setManualRefreshingKeys(new Set(manualRefreshPending.current));
    }
  };

  const runExitedAction = async (action: 'resume' | 'clean', run: () => Promise<void>) => {
    if (exitedActionPending.current) return;
    exitedActionPending.current = true;
    setExitedAction(action);
    reportActionError('');
    try { await run(); }
    catch (error) { reportActionError(error instanceof Error ? error.message : 'Session action failed.'); }
    finally { exitedActionPending.current = false; setExitedAction(null); }
  };

  const resumeExitedSession = async () => {
    const target = session;
    const workspace = selectedWorkspace;
    const client = target?.client;
    if (!target || target.status !== 'exited' || !workspace || !client || !target.remoteSessionId)
      throw new Error('Connect to this workspace before resuming the session.');
    if (!canResumeSharedSession(target, client))
      throw new Error('This session cannot be resumed.');
    const path = `/api/sessions/${encodeURIComponent(target.remoteSessionId)}`;
    const fresh = await client.json<RemoteSession>('GET', path);
    if ((fresh.workspaceId || 'default') !== workspace.remoteId)
      throw new Error('Session moved to another workspace. Refresh before continuing.');
    if (fresh.status !== 'exited' || !canResumeSharedSession(fresh, client))
      throw new Error('This session is no longer eligible to resume. Refresh before trying again.');
    const result = await resumeSharedAgent(client, fresh, workspace.remoteId, target);
    // Pending with a session ID only awaits identity verification: open the new terminal.
    if (isPendingAgentAction(result) && !actionSessionId(result)) {
      setResumeVerificationPending(true);
      reportActionError('Resume started, but agent identity verification is pending. Check the new terminal before retrying.');
      await refreshWorkspaceSessions(workspace);
      return;
    }
    const resumedId = createdSessionId(result);
    try { await refreshWorkspaceSessions(workspace); }
    catch { reportActionError('The session resumed, but the workspace could not refresh. Refresh before retrying.'); }
    navigateSession(workspace.id, resumedId);
  };

  const cleanExitedSession = async () => {
    const target = session;
    const workspace = selectedWorkspace;
    const client = target?.client;
    if (!target || target.status !== 'exited' || !workspace || !client || !target.remoteSessionId)
      throw new Error('Connect to this workspace before cleaning up the session.');
    const path = `/api/sessions/${encodeURIComponent(target.remoteSessionId)}`;
    const fresh = await client.json<RemoteSession>('GET', path);
    if ((fresh.workspaceId || 'default') !== workspace.remoteId)
      throw new Error('Session moved to another workspace. Refresh before continuing.');
    if (fresh.status !== 'exited')
      throw new Error('Only exited sessions can be cleaned up. Refresh before trying again.');
    if (!window.confirm('Delete this exited session? Its recording and metadata will be removed. This cannot be undone.')) return;
    await sharedMutation(client, 'DELETE', `${path}/cleanup`);
    try { await refreshWorkspaceSessions(workspace); }
    catch { reportActionError('The session was cleaned up, but the workspace could not refresh.'); }
    navigateSession(workspace.id);
  };

  const openShare = (workspaceId?: string) => {
    const workspace = workspaces.find(item => item.id === (workspaceId || session?.workspaceId));
    if (workspace) {
      setShareTarget({title:workspace.name,shared:true});
      setShareCode(clientTicketsRef.current.get(workspace.id) || '');
    } else if (session) {
      setShareTarget(session);
      setShareCode(session.shared ? '' : encodeSharedSessionInvite(session));
    } else return;
    setShareOpen(true);
  };

  const removeSelection = async () => {
    if (!workspaceToRemove && !sessionToRemove) return;
    const scope = connectionScopeRef.current;
    setRemovingSession(true);
    setRemoveError('');
    try {
      if (workspaceToRemove) {
        await workspaceQueries.cancelQueries({ queryKey: directoryRefreshKey });
        const response = await fetch("/api/vibeghost/workspaces", {
          method: "DELETE",
          signal: AbortSignal.any([scope.controller.signal, AbortSignal.timeout(10_000)]),
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: workspaceToRemove.storageId }),
        });
        if (!response.ok) throw new Error("Could not remove this saved VibeGhost workspace");
        if (scope.disposed) return;
        clientsRef.current.get(workspaceToRemove.id)?.close();
        clientsRef.current.delete(workspaceToRemove.id);
        clientTicketsRef.current.delete(workspaceToRemove.id);
        updateDirectory(current => ({
          workspaces: current.workspaces.filter(item => item.id !== workspaceToRemove.id),
          sessions: current.sessions.filter(item => item.workspaceId !== workspaceToRemove.id),
        }));
      } else if (sessionToRemove) {
        updateDirectory(current => ({ ...current, sessions: current.sessions.filter(item => item.id !== sessionToRemove.id) }));
      }
      if ((workspaceToRemove && location.workspace === workspaceToRemove.id) || (sessionToRemove && activeId === sessionToRemove.id)) navigateSession();
      window.dispatchEvent(new Event(workspaceNavigationEvent));
      setWorkspaceToRemove(null);
      setSessionToRemove(null);
    } catch (error) {
      if (!scope.disposed) setRemoveError(error instanceof Error ? error.message : "Could not remove this saved VibeGhost connection");
    } finally {
      if (!scope.disposed) setRemovingSession(false);
    }
  };

  return (
    <VibeGhostFrame embedded={embedded} title={vibeGhostAppName()} breadcrumbs={[
      { label: vibeGhostAppName(), href: vibeGhostHref(), onClick: (event: MouseEvent<HTMLAnchorElement>) => { if (isModifiedClick(event)) return; event.preventDefault(); navigateVibeGhost(); } },
      ...(session ? [
        returnView
          ? { label: returnView === 'timeline' ? 'Timeline' : 'Active Feed', href: vibeGhostHref(undefined, undefined, returnView), onClick: (event: MouseEvent<HTMLAnchorElement>) => { if (isModifiedClick(event)) return; event.preventDefault(); navigateVibeGhost(undefined, undefined, returnView); } }
          : { label: selectedWorkspace?.name || "Local sessions", href: vibeGhostHref(selectedWorkspace?.id), onClick: (event: MouseEvent<HTMLAnchorElement>) => { if (isModifiedClick(event)) return; event.preventDefault(); navigateVibeGhost(selectedWorkspace?.id); } },
        { label: session.title },
      ] : selectedWorkspace ? [{ label: selectedWorkspace.name }] : location.view === 'workspaces' ? [{ label: 'Workspaces' }] : location.view === 'active' ? [{ label: 'Active Feed' }] : []),
    ]} toolbar={createTarget || (selectedWorkspace && !session) ? <>{createTarget ? <button type="button" disabled={!createTarget.client || quick.creatingId === createTarget.id} onClick={() => createIn(createTarget, session?.cwd)} aria-label={`Quick create session in ${createTarget.name}`} title={session ? 'Quick create a session in this folder' : `Quick create a session in ${createTarget.name}`} className="oathkeeper-raised-control inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 disabled:opacity-50">{quick.creatingId === createTarget.id ? <Spinner className="size-3.5"/> : <Plus className="size-3.5"/>}<span className="max-sm:sr-only">Quick create</span></button> : null}{selectedWorkspace && !session ? <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label="Workspace actions" className="oathkeeper-raised-control flex size-9 items-center justify-center"><MoreHorizontal className="size-4 rotate-90"/></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={!selectedWorkspace.client || quick.creatingId === selectedWorkspace.id} onSelect={() => createIn(selectedWorkspace)}><Glyph.IconSquarePlusFillDuo18 className="size-4"/>Quick create</DropdownMenuItem><DropdownMenuItem disabled={!selectedWorkspace.client} onSelect={() => setNewSession({ workspace: selectedWorkspace })}><Glyph.AddCircle className="size-4"/>New session…</DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem disabled={!selectedWorkspace.client} onSelect={() => setSessionManagement('resume')}><RefreshCw className="size-4"/>Resume sessions…</DropdownMenuItem><DropdownMenuItem disabled={!selectedWorkspace.client} onSelect={() => setSessionManagement('stop')}><TerminalSquare className="size-4"/>Stop sessions…</DropdownMenuItem><DropdownMenuItem disabled={!selectedWorkspace.client} onSelect={() => setSessionManagement('delete')}><Trash2 className="size-4"/>Delete exited sessions…</DropdownMenuItem><DropdownMenuItem onSelect={() => setJoinOpen(true)}><Plus className="size-4"/>Add workspace…</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : null}</> : undefined} wide scrollable={false} compactInset {...chrome}>
      <main onDragEnterCapture={(event) => {
        if (!session || !event.dataTransfer.types.includes('Files')) return;
        event.preventDefault(); event.stopPropagation();
        fileDragDepth.current += 1;
        setDraggingFiles(true);
      }} onDragOverCapture={(event) => {
        if (!session || !event.dataTransfer.types.includes('Files')) return;
        event.preventDefault(); event.stopPropagation();
        event.dataTransfer.dropEffect = uploadPending.current ? 'none' : 'copy';
      }} onDragLeaveCapture={(event) => {
        if (!fileDragDepth.current) return;
        event.stopPropagation();
        fileDragDepth.current = Math.max(0, fileDragDepth.current - 1);
        if (!fileDragDepth.current) setDraggingFiles(false);
      }} onDropCapture={(event) => {
        if (!session || !event.dataTransfer.types.includes('Files')) return;
        event.preventDefault(); event.stopPropagation();
        fileDragDepth.current = 0;
        setDraggingFiles(false);
        void uploadFiles(Array.from(event.dataTransfer.files));
      }} onPasteCapture={(event) => {
        const files = event.clipboardData.files.length ? Array.from(event.clipboardData.files) : Array.from(event.clipboardData.items).filter(item => item.kind === "file").map(item => item.getAsFile()).filter((file): file is File => file !== null);
        if (!files.length || !session) return;
        event.preventDefault();
        event.stopPropagation();
        void uploadFiles(files);
      }} className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden">
        {draggingFiles ? <div role="status" className="pointer-events-none absolute inset-1 z-50 flex items-center justify-center rounded-xl border border-dashed border-[#8bb8ff]/60 bg-[#08090a]/85 font-mono text-sm text-[#d7e6ff]"><span>{uploadingFile ? 'Upload in progress…' : 'Drop images or files to upload to this session'}</span></div> : null}
        {quick.error ? <div role="alert" className="relative z-10 flex shrink-0 items-center gap-2 rounded-[9px] bg-[#e67b73]/[.08] pl-3 pr-1 py-1 font-mono text-[12px] leading-4 text-[#e89a94] ring-1 ring-inset ring-[#e67b73]/15"><span className="min-w-0 flex-1 py-1">{quick.error}</span><button type="button" onClick={quick.clearError} className="relative flex size-9 shrink-0 items-center justify-center rounded-lg text-[#e89a94] hover:bg-white/[.06] hover:text-[#f4f7f5] focus-visible:outline-2 focus-visible:outline-[#8bb8ff]" aria-label="Dismiss message"><Glyph.X className="size-4" aria-hidden="true"/></button></div> : null}
        {session ? <>
          {visibleActionError ? <div role="alert" className="relative z-10 flex shrink-0 items-center gap-2 rounded-[9px] bg-[#e67b73]/[.08] pl-3 pr-1 py-1 font-mono text-[12px] leading-4 text-[#e89a94] ring-1 ring-inset ring-[#e67b73]/15"><span className="min-w-0 flex-1 py-1">{visibleActionError}</span><button type="button" onClick={() => setActionError(null)} className="relative flex size-9 shrink-0 items-center justify-center rounded-lg text-[#e89a94] hover:bg-white/[.06] hover:text-[#f4f7f5] focus-visible:outline-2 focus-visible:outline-[#8bb8ff]" aria-label="Dismiss message"><Glyph.X className="size-4" aria-hidden="true"/></button></div> : null}

          <div className="relative z-0 flex min-h-0 min-w-0 flex-1 gap-1 overflow-hidden">
            <section data-tabs-terminal-card={pane ? "" : undefined} data-session-card="" className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl bg-[#08090a] p-[3px] shadow-[inset_0_1px_0_rgb(244_247_245/.06),0_1px_1px_rgb(0_0_0/.25),0_4px_8px_rgb(0_0_0/.25)] ring-1 ring-white/[.08]">
              <div aria-hidden={effectiveView !== 'terminal'} inert={effectiveView !== 'terminal'} className="flex min-h-0 min-w-0 flex-1"><EmbeddedGhosttyTerminal key={`${session.id}-${terminalEpoch}`} ref={terminalRef} active={paneVisible} mobileInputId={directInputId} sessionId={session.id} title={session.title} cwd={session.cwd} shared={session.shared} client={session.client} remoteSessionId={session.remoteSessionId} className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-[9px] bg-[#08090a]"/></div>
              {chatAvailable && session.client && session.remoteSessionId ? <div data-session-chat="" aria-hidden={effectiveView !== 'chat'} className={cn("absolute inset-[3px] z-20 min-h-0 min-w-0 overflow-hidden rounded-[9px] bg-[#08090a] transition-opacity duration-150", effectiveView === "chat" ? "visible opacity-100" : "pointer-events-none invisible opacity-0")}>{integration.chatProvider === 'pi' ? <VibeGhostChatView key={session.id} ref={chatRef} client={session.client} sessionId={session.remoteSessionId} title={session.title} active={paneVisible && effectiveView === "chat"} refreshEpoch={chatEpoch} live={session.status !== 'exited'}/> : <AgentConversation key={session.id} client={session.client} sessionId={session.remoteSessionId} providerHint={integration.chatProvider === 'claude' ? 'claude' : 'codex'} conversationId={session.agentIdentity?.conversation.id} bindingEpoch={session.agentIdentity?.binding.epoch} agentPhase={session.agentPhase} transcriptPath={session.agentIdentity?.locator?.kind === 'claude-jsonl' ? session.agentIdentity.locator.path : undefined} live={session.status !== 'exited'} active={paneVisible && effectiveView === 'chat'} refreshEpoch={chatEpoch} onLinked={() => { void ensureDirectoryFresh(); }} onOpenTerminal={() => { flushSync(() => setViewMode('terminal')); terminalRef.current?.focus(); }}/>}</div> : null}
            </section>
            {session.shared && session.client ? <SharedWorkspaceInspector key={`${session.workspaceId || "shared"}:${session.remoteSessionId || session.id}`} session={session} client={session.client} open={inspectorOpen} onOpenChange={setInspectorOpen}/> : null}
          </div>

          {submission?.state === 'sending' ? <span role="status" className="sr-only">Sending message…</span> : null}
          {submission && submission.state !== 'sending' ? <div role="alert" className="absolute inset-x-3 bottom-24 z-30 rounded-[9px] bg-[var(--oathkeeper-panel)] px-3 py-2 text-[12px] text-[#919793] shadow-lg">
            <><div className="flex items-start gap-2"><span className="min-w-0 flex-1">Could not confirm delivery. Check the terminal before retrying; your submitted message is saved.</span><button type="button" aria-label="Dismiss send warning" onClick={() => dismissTerminalSubmission(activeId)} className="shrink-0 px-1 text-[#f4f7f5]">×</button></div><details className="mt-1"><summary className="cursor-pointer">Show submitted message</summary><pre className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap break-words font-sans">{submission.text}</pre></details></>
          </div> : null}
          <MobileTerminalInput key={session.id} ref={mobileInputRef} id={directInputId} onSendInput={sendTerminalInput}/>
          <div data-terminal-controls className={composerStyles.terminalControls}>
            {session.status === 'exited' ? <section aria-labelledby={`exited-session-title-${session.id}`} data-exited-session-status data-composer-status="exited" className={cn(composerStyles.uploadStatus, endedStyles.status, "font-sans")}>
              <div className={endedStyles.row}>
                <div role="status" className={endedStyles.copy}>
                  <h2 id={`exited-session-title-${session.id}`} className={endedStyles.label}>Session ended</h2>
                </div>
                <div className={endedStyles.actions}>
                  {canResumeExited ? <button type="button" disabled={exitedAction !== null} onClick={() => void runExitedAction('resume', resumeExitedSession)} className={endedStyles.action} aria-label="Resume session">{exitedAction === 'resume' ? <Spinner size="sm" className="size-3"/> : <RefreshCw className="size-3" aria-hidden="true"/>}{exitedAction === 'resume' ? 'Resuming…' : 'Resume'}</button> : null}
                  <button type="button" disabled={!canCleanExited || exitedAction !== null} onClick={() => void runExitedAction('clean', cleanExitedSession)} className={endedStyles.action} aria-label="Clean up session">{exitedAction === 'clean' ? <Spinner size="sm" className="size-3"/> : <Glyph.CloseCircle className="size-3" aria-hidden="true"/>}{exitedAction === 'clean' ? 'Cleaning up…' : 'Clean up'}</button>
                </div>
              </div>
            </section> : null}
            {sessionBar ? <SessionToolbar sessions={sessions} workspaces={workspaces} activeId={session.id} onSelect={selectSession} onAdd={() => setJoinOpen(true)} onQuickCreate={workspace => createIn(workspace)} onNewSession={workspace => setNewSession({ workspace })} onShare={openShare} onRefresh={() => void refreshActiveSession()} refreshError={activeWorkspaceCheck?.error || ''} refreshing={manualRefreshingKeys.has(session.workspaceId || session.id)} onRemoveWorkspace={setWorkspaceToRemove} onRemoveLocalSession={setSessionToRemove} viewMode={effectiveView} onViewModeChange={setViewMode} secondaryView={secondaryView} providerName={integration.provider?.displayName || 'Codex'} inspectorAvailable={inspectorAvailable} inspectorOpen={inspectorOpen} onInspectorToggle={() => setInspectorOpen((current) => !current)} onMemoryCommand={(command) => { void runMemoryCommand(command); }} memoryPending={memoryCommandSession === session.id} memoryDisabled={Boolean(uploadingFile) || submission?.state === 'sending'}/> : null}
          <ComposerAttachmentStack data-terminal-composer-stack className={composerStyles.terminalStack}>
            {uploadingFile ? <ComposerAttachment><div role="status" data-terminal-upload-status className={composerStyles.uploadStatus}><Spinner size="sm" className="size-3.5"/><span className="min-w-0 truncate">Uploading {uploadingFile}…</span></div></ComposerAttachment> : null}
          <form onSubmit={(event) => { event.preventDefault(); void submit(); }} data-composer-surface data-terminal-composer className={cn(composerStyles.panel, composerStyles.terminal)}>
            <div className={composerStyles.terminalRow}>
            <div data-terminal-composer-field className="relative min-w-0 flex-1">
            <TerminalComposerInput key={session.id} ref={commandInputRef} value={input} pi={integration.canFollowUp} onSend={(followUp) => { void submit(followUp); }} onChange={(value) => { dictationRef.current?.cancel(); setInput(value); }} className={composerFieldClass}/>
            <div className="pointer-events-none absolute inset-0 z-20 [--dictation-action-inset:2.25rem]"><BrowserDictationButton inline className={composerMicClass} ref={dictationRef} key={session.id} persistent={{ key: `vibeghost:${session.id}`, label: session.title, href: vibeGhostSessionHref(session), write: (text) => writeTerminalDraft(session.id, (current) => `${current}${current && !/\s$/.test(current) ? " " : ""}${text}`) }} onTranscript={(text) => setInput((current) => `${current}${current && !/\s$/.test(current) ? " " : ""}${text}`)} onError={reportActionError}/></div>
            <div className="absolute right-[5px] top-[5px] z-20"><TerminalSendButton followUpLabel={integration.provider?.id === 'codex' ? 'Codex follow-up (Tab)' : undefined} className="!size-8 [&>svg]:!size-3.5" key={session.id} disabled={Boolean(uploadingFile) || submission?.state === 'sending' || session.status === 'exited'} pi={integration.canFollowUp} onSend={(followUp) => { void submit(followUp); }}/></div>
            </div>
            <input ref={uploadInputRef} type="file" multiple className="sr-only" tabIndex={-1} aria-label="Choose files to upload" onChange={(event) => { const files = Array.from(event.currentTarget.files || []); event.currentTarget.value = ""; void uploadFiles(files); }}/>
            </div>
            <div className={composerStyles.terminalToolbar}>
              <div className="flex min-w-0 items-center gap-[3px]">{toolbarLeading}<div className="min-w-0 flex-1">
              <TerminalControlToolbar disabled={session.status === 'exited'} pi={integration.provider?.id === 'pi'} agent={integration.provider?.id} program={integration.program?.controls} onSendInput={sendTerminalInput} onFocusInput={() => { flushSync(() => setViewMode('terminal')); terminalRef.current?.focus(); }} onPaste={() => void pasteTerminalInput()} onSettings={() => setSettingsOpen(true)} onAttach={() => uploadInputRef.current?.click()} attaching={Boolean(uploadingFile)} onFollowUp={integration.canFollowUp ? () => { void submit(true); } : undefined} followUpDisabled={Boolean(uploadingFile) || submission?.state === 'sending'} onPiKey={(text) => { flushSync(() => setViewMode('terminal')); sendTerminalInput(text); terminalRef.current?.focus(); }}/>
              </div></div>
            </div>
          </form>
          </ComposerAttachmentStack>
          </div>
        </> : pane && (loadingWorkspaces || findingSession) ? <SessionLoadingSkeleton label="Connecting session…" sessionBar={sessionBar} toolbarLeading={toolbarLeading}/>
        : pane ? <section role="status" data-tabs-placeholder="" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-xl bg-[#161719] p-6 text-center text-[13px] text-[#b7bcb9]"><h2 className="text-[#f4f7f5]">Session unavailable</h2><p className="max-w-sm">{activeWorkspaceCheck?.error || savedWorkspaceError || 'Its workspace may be disconnected, or the session may have been removed. Your tab and draft are kept.'}</p><div className="flex gap-3"><button type="button" className="oathkeeper-raised-control px-3 py-2" onClick={() => void loadSavedWorkspaces()} disabled={loadingWorkspaces}>Retry connection</button><button type="button" className="px-3 py-2" onClick={pane.onClose}>Close tab</button></div></section> : location.workspace || location.session ? <VibeGhostWorkspacePage workspace={selectedWorkspace} workspaces={workspaces} pins={pins} sessions={sessions.filter((item) => item.workspaceId === location.workspace)} missingSession={Boolean(location.session)} loading={(activeWorkspaceCheck?.checking ?? loadingWorkspaces) || findingSession} error={activeWorkspaceCheck?.error || (!selectedWorkspace?.client ? savedWorkspaceError : '')} onSelect={selectSession} onRetry={() => { void loadSavedWorkspaces(); }} onConnect={() => setJoinOpen(true)} sessionActions={sessionActions} onQuickCreate={selectedWorkspace?.client ? path => createIn(selectedWorkspace, path) : undefined} creating={quick.creatingId === selectedWorkspace?.id}/> : location.view === 'active' ? <VibeGhostActiveFeed workspaces={workspaces} sessions={sessions} loading={initialLoading || loadingWorkspaces || Object.values(workspaceChecks).some(item => item.checking)} refreshing={loadingWorkspaces} error={directoryError || savedWorkspaceError} onRefresh={loadSavedWorkspaces} onSelect={selectActiveSession} sessionActions={sessionActions}/> : location.view === 'workspaces' ? <VibeGhostWorkspaceOverview workspaces={workspaces} sessions={sessions} pins={pins} loading={initialLoading} backgroundRefreshing={loadingWorkspaces} workspaceChecks={workspaceChecks} connectionError={savedWorkspaceError} error={directoryError} onRetry={loadSavedWorkspaces} onSelect={selectSession} onOpenWorkspace={(id) => navigateVibeGhost(id)} onConnect={() => setJoinOpen(true)} onRefresh={() => loadSavedWorkspaces()} onRemove={setWorkspaceToRemove} sessionActions={sessionActions} onQuickCreate={workspace => createIn(workspace)} onNewSession={workspace => setNewSession({ workspace })} creatingId={quick.creatingId}/> : <VibeGhostLanding onOpenWorkspaces={() => navigateVibeGhost(undefined, undefined, 'workspaces')} onOpenActive={() => navigateVibeGhost(undefined, undefined, 'active')} onOpenTabs={() => navigateVibeGhost(undefined, undefined, 'tabs')} onOpenTimeline={() => navigateVibeGhost(undefined, undefined, 'timeline')}/>}
      </main>

      <JoinSessionDialog initialValue={invitePrefill} open={joinOpen} onOpenChange={setJoinOpen} onConnect={connectInvite}/>
      {shareTarget ? <ShareSessionDialog open={shareOpen} onOpenChange={setShareOpen} session={shareTarget} code={shareCode}/> : null}
      <RemoveConnectionDialog workspace={workspaceToRemove} session={sessionToRemove} removing={removingSession} error={removeError} onOpenChange={(open) => { if (!open && !removingSession) { setWorkspaceToRemove(null); setSessionToRemove(null); setRemoveError(''); } }} onRemove={() => void removeSelection()}/>
      {sessionManagement && selectedWorkspace ? <WorkspaceSessionManager key={`${selectedWorkspace.id}:${sessionManagement}`} action={sessionManagement} workspaceName={selectedWorkspace.name}
        sessions={sessions.filter(s => s.workspaceId === selectedWorkspace.id).map(s => ({id:s.id,name:s.title,status:s.status,canResume:canResumeSharedSession(s, selectedWorkspace.client),tags:s.tags,lastActive:s.lastModified || s.startedAt}))}
        onClose={() => setSessionManagement(null)} onRefresh={loadSavedWorkspaces}
        onAction={async (action,id) => {
          const target = sessions.find(s => s.id === id && s.workspaceId === selectedWorkspace.id);
          const client = selectedWorkspace.client;
          if (!target?.remoteSessionId || !client) throw new Error('Workspace connection unavailable.');
          const fresh = (await client.json<RemoteSession[]>('GET','/api/sessions')).find(s => s.id === target.remoteSessionId);
          if (!fresh) throw new Error('Session no longer exists.');
          if (action === 'resume') {
            return resumeSharedAgent(client, fresh, selectedWorkspace.remoteId, target);
          }
          if (action === 'stop' ? fresh.status !== 'running' : fresh.status !== 'exited') throw new Error('Session status changed. Refresh the list before retrying.');
          const response = await client.request('DELETE',`/api/sessions/${encodeURIComponent(fresh.id)}${action === 'delete' ? '/cleanup' : ''}`);
          if (response.status >= 400) throw new Error(`Session action rejected (${response.status}). Check workspace permissions.`);
        }}/>:null}
      <ToolbarSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} pi={integration.provider?.id === 'pi'}/>
      {newSession ? <SharedSessionEditor mode="create" workspace={newSession.workspace} workingDir={newSession.workingDir} onClose={() => setNewSession(null)} onSaved={async id => { const target = newSession.workspace; try { await refreshWorkspaceSessions(target); } catch { await loadSavedWorkspaces(); } if (id) navigateSession(target.id, id); }}/> : null}
    </VibeGhostFrame>
  );
}

function ToolbarSettingsDialog({ open, onOpenChange, pi = false }: { open: boolean; onOpenChange: (open: boolean) => void; pi?: boolean }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><LabDialogContent>
    <DialogHeading title="Terminal controls" description="The toolbar mirrors VibeGhost’s mobile terminal controls using Oathkeeper’s raised surfaces."/>
    <div className="space-y-3 p-6">
      {[ ["Input", "Focus the one-line terminal input"], ["Navigation", "Arrow keys, Escape, Enter, and Tab"], ["Control", "Interrupt, paste, clear, and tmux shortcuts"] ].map(([title, detail]) => <div key={title} className="rounded-[10px] bg-[var(--oathkeeper-panel)] p-3 shadow-[inset_0_1px_0_rgb(244_247_245/.08),0_4px_8px_rgb(0_0_0/.2)] ring-1 ring-black/20"><p className="text-white/80">{title}</p><p className="mt-1 text-[12px] text-white/35">{detail}</p></div>)}
    </div>
    {pi ? <p className="px-6 pb-4 text-[12px] leading-5 text-white/50">Pi defaults: Edit queued (Alt+↑) restores queued messages into Pi’s terminal editor. Recall prompt (↑) browses history from the empty editor or its top. Neither changes already-sent history. Use the terminal keyboard to edit recalled text; your Oathkeeper draft stays separate. Follow-up sends the Oathkeeper draft with Alt+Enter. Custom Pi keybindings may differ.</p> : null}
    <DialogFooter single><button type="button" onClick={() => onOpenChange(false)} className="lab-primary">Done</button></DialogFooter>
  </LabDialogContent></Dialog>;
}

/** A session's loading skeleton, laid out as the loaded session: the conversation card with the
 *  loader, then the controls block with the session bar (when the host shows one), the input and
 *  its toolbar. It wears the loaded parts' own classes and data attributes, so a small host (the
 *  dock's mini chat, mini-chat.module.css) sizes it exactly as it sizes the loaded session, and
 *  the full page keeps its full size: nothing moves when the session arrives. `toolbarLeading`
 *  (the agent picker) stays usable; everything else is a disabled placeholder. */
export function SessionLoadingSkeleton({ label, sessionBar = true, toolbarLeading }: { label: string; sessionBar?: boolean; toolbarLeading?: ReactNode }) {
  const pulse = "block rounded-full bg-white/[.07] motion-safe:animate-pulse";
  const noop = () => {};
  return <>
    <section role="status" data-tabs-placeholder="" data-session-skeleton="" className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-[#08090a] p-[3px] shadow-[inset_0_1px_0_rgb(244_247_245/.06),0_1px_1px_rgb(0_0_0/.25),0_4px_8px_rgb(0_0_0/.25)] ring-1 ring-white/[.08]"><span aria-hidden="true" className={threadStyles.loaderPad}><OathkeeperOrb size={40}/></span><span className="sr-only">{label}</span></section>
    <div data-terminal-controls data-session-skeleton="" className={composerStyles.terminalControls}>
      {sessionBar ? <div data-session-toolbar aria-hidden="true" className={cn(composerStyles.sessionToolbar, "relative z-40 font-sans text-[12px] font-medium")}>
        <div className="flex min-w-0 items-center gap-[3px]">
          <span className={cn(controlClass, "min-w-0 flex-1 gap-2 px-2.5")}>
            <span className="flex shrink-0 items-center justify-center pr-1"><span className={cn(pulse, "size-1.5")}/></span>
            <span data-skeleton-lines className="flex min-w-0 flex-1 flex-col gap-1.5"><span className={cn(pulse, "h-1.5 w-24 max-w-[70%]")}/><span className={cn(pulse, "h-2 w-36 max-w-full")}/></span>
          </span>
          {[0, 1, 2, 3, 4].map(index => <span key={index} className={cn(controlClass, "size-9")}/>)}
        </div>
      </div> : null}
      <ComposerAttachmentStack data-terminal-composer-stack className={composerStyles.terminalStack}>
        <form onSubmit={event => event.preventDefault()} data-composer-surface data-terminal-composer className={cn(composerStyles.panel, composerStyles.terminal)}>
          <div className={composerStyles.terminalRow}>
            <div data-terminal-composer-field className="relative min-w-0 flex-1">
              <textarea disabled rows={1} tabIndex={-1} placeholder="Send a message…" aria-label="Terminal command" className={composerFieldClass}/>
              <div className="pointer-events-none absolute inset-0 z-20 [--dictation-action-inset:2.25rem]"><BrowserDictationButton inline disabled className={composerMicClass} onTranscript={noop} onError={noop}/></div>
              <div className="absolute right-[5px] top-[5px] z-20"><TerminalSendButton disabled pi={false} onSend={noop} className="!size-8 [&>svg]:!size-3.5"/></div>
            </div>
          </div>
          <div className={composerStyles.terminalToolbar}>
            <div className="flex min-w-0 items-center gap-[3px]">{toolbarLeading}<div className="min-w-0 flex-1"><TerminalControlToolbar disabled onSendInput={noop} onFocusInput={noop} onPaste={noop} onSettings={noop}/></div></div>
          </div>
        </form>
      </ComposerAttachmentStack>
    </div>
  </>;
}

function VibeGhostLoadingState() {
  const skeleton = "rounded bg-white/[.07] motion-safe:animate-pulse";
  return <>
    <div aria-label="Loading saved sessions" className="h-[42px] w-full rounded-xl bg-[#08090a] p-[3px]">
      <div className="flex items-center gap-[3px]"><span className="flex size-9 items-center justify-center rounded-[9px] bg-[var(--oathkeeper-panel)] text-[#686e6a]"><RefreshCw className="size-4" strokeWidth={1.6}/></span><div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[9px] bg-[var(--oathkeeper-panel)] px-2.5"><span className={cn(skeleton, "size-[18px] rounded-full")}/><span className={cn(skeleton, "h-2.5 w-28 max-w-[42%]")}/><span className={cn(skeleton, "ml-auto h-2.5 w-2.5")}/></div></div>
    </div>
    <section aria-label="Loading terminal" className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl bg-[#08090a] p-[3px] shadow-[inset_0_1px_0_rgb(244_247_245/.06),0_1px_1px_rgb(0_0_0/.25),0_4px_8px_rgb(0_0_0/.25)] ring-1 ring-white/[.08]">
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-[9px] bg-[#08090a] px-4 py-5 font-mono"><div className={cn(skeleton, "h-2 w-32")}/><div className={cn(skeleton, "mt-3 h-2 w-52 max-w-[65%]")}/><div className={cn(skeleton, "mt-3 h-2 w-40 max-w-[50%]")}/></div>
    </section>
    <form aria-label="Terminal command loading" className="flex shrink-0 flex-col gap-[3px] rounded-t-[14px] rounded-b-[11px] bg-[#08090a] p-[3px] ring-1 ring-black/30">
      <textarea rows={1} disabled placeholder="Loading session…" aria-label="Terminal command" className="h-[42px] min-h-[42px] max-h-[42px] min-w-0 w-full resize-none overflow-x-hidden overflow-y-auto rounded-[10px] bg-[#141617] px-3 py-2 font-mono text-[16px] leading-6 text-[#f4f7f5] outline-none ring-1 ring-inset ring-black/30 placeholder:text-[#686e6a]"/>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_32px_32px] items-center gap-[3px] pt-[3px]"><TerminalControlToolbar disabled onSendInput={() => {}} onFocusInput={() => {}} onPaste={() => {}} onSettings={() => {}}/><button type="button" disabled aria-label="Voice input" className={`${promptToolbarControlClass} size-8 justify-center`}><Mic className="size-4"/></button><button type="button" disabled aria-label="Send terminal command" className={promptComposerSendButtonClass}><Glyph.ArrowUp className="size-4" aria-hidden="true" /></button></div>
    </form>
  </>;
}

function VibeGhostNoSessionsState({ workspaces, error, onAdd, onRefresh, onRemove }: { workspaces: VibeGhostWorkspace[]; error: string; onAdd: () => void; onRefresh: (workspace: VibeGhostWorkspace) => void; onRemove: (workspace: VibeGhostWorkspace) => void }) {
  return <section className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto rounded-xl bg-[#08090a] p-3 sm:p-6">
    <div className="w-full max-w-[520px] overflow-hidden rounded-[9px] bg-[#181a1c] font-mono text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/.08),0_18px_50px_rgb(0_0_0/.4)] ring-1 ring-white/[.08]">
      <header className="px-6 pt-6"><h2 className="font-sans text-[20px] font-normal tracking-[-.025em] text-white/85">Shared workspaces</h2><p className="mt-1.5 text-[12px] leading-5 text-white/35">These Iroh workspaces are connected, but they currently have no terminal sessions.</p></header>
      <div className="space-y-2 p-6">{workspaces.map((workspace) => <div key={workspace.id} className="overflow-hidden rounded-[15px] bg-[#101213] p-[3px] shadow-[0_1px_0_rgb(255_255_255/.07),0_0_0_1px_rgb(255_255_255/.07),0_3px_7px_rgb(0_0_0/.3),inset_0_1px_0_rgb(255_255_255/.055)]"><div className="flex items-center gap-3 rounded-[12px] bg-[#141617] p-3 shadow-[inset_0_1px_0_rgb(244_247_245/.07),0_2px_5px_rgb(0_0_0/.16)]"><VibeGhostWorkspaceGradient seed={workspace.id} accentColor={workspace.color} shape={workspace.iconShape === "circle" ? "circle" : "squircle"} className="size-8"/><span className="min-w-0 flex-1"><span className="block truncate text-[12px] text-[#f4f7f5]">{workspace.name}</span><span className="mt-1 block truncate text-[12px] text-[#89958e]">No sessions · Iroh connected</span></span><button type="button" onClick={() => onRefresh(workspace)} aria-label={`Refresh ${workspace.name}`} className="flex size-8 items-center justify-center rounded-[8px] text-[#919793] hover:bg-white/[.05] hover:text-white focus-visible:outline-2 focus-visible:outline-[#8bb8ff]"><RefreshCw className="size-3.5"/></button><button type="button" onClick={() => onRemove(workspace)} aria-label={`Remove ${workspace.name}`} className="flex size-8 items-center justify-center rounded-[8px] text-[#9b7772] hover:bg-[#e67b73]/10 hover:text-[#e67b73] focus-visible:outline-2 focus-visible:outline-[#e67b73]"><Trash2 className="size-3.5"/></button></div></div>)}</div>
      {error ? <p role="alert" className="px-6 pb-3 text-[12px] leading-4 text-[#e89a94]">{error}</p> : null}
      <DialogFooter single><button type="button" onClick={onAdd} className="lab-primary"><Plus className="size-4"/>Connect another workspace</button></DialogFooter>
    </div>
  </section>;
}

function VibeGhostEmptyState({ error, onConnect }: { error: string; onConnect: (value: string) => Promise<void> }) {
  return <section className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto rounded-xl bg-[#08090a] p-3 sm:p-6">
    <div className="w-full max-w-[444px] overflow-hidden rounded-[9px] bg-[#181a1c] font-mono text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/.08),0_18px_50px_rgb(0_0_0/.4)] ring-1 ring-white/[.08]">
      <header className="px-6 pt-6"><h2 className="font-sans text-[20px] font-normal tracking-[-.025em] text-white/85">Connect</h2><p className="mt-1.5 text-[12px] leading-5 text-white/35">Add a VibeGhost workspace with its Iroh ID or QR code. Added workspaces reconnect automatically.</p></header>
      <WorkspaceConnectForm onConnect={onConnect} initialError={error}/>
    </div>
  </section>;
}

function JoinSessionDialog({ open, onOpenChange, onConnect, initialValue = '' }: { initialValue?: string; open: boolean; onOpenChange: (open: boolean) => void; onConnect: (value: string) => Promise<void> }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><LabDialogContent>
    <DialogHeading title="Connect" description="Paste a workspace invite or scan its QR code to connect."/>
    <WorkspaceConnectForm initialValue={initialValue} onConnect={onConnect} onConnected={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} autoFocus/>
  </LabDialogContent></Dialog>;
}

function RemoveConnectionDialog({ workspace, session, removing, error, onOpenChange, onRemove }: { workspace: VibeGhostWorkspace | null; session: VibeGhostSession | null; removing: boolean; error: string; onOpenChange: (open: boolean) => void; onRemove: () => void }) {
  const name = workspace?.name || session?.title || "this connection";
  return <Dialog open={Boolean(workspace || session)} onOpenChange={onOpenChange}><LabDialogContent>
    <DialogHeading title={workspace ? "Remove workspace?" : "Remove session?"} description={workspace ? `Remove ${name} and all of its imported sessions from Oathkeeper. This does not stop or delete anything in VibeGhost.` : `Remove ${name} from Oathkeeper. This does not stop or delete the terminal.`}/>
    {error ? <p role="alert" className="px-6 pb-3 text-xs text-[#e89a94]">{error}</p> : null}
    <DialogFooter><button type="button" disabled={removing} onClick={() => onOpenChange(false)} className="lab-secondary disabled:opacity-45">Cancel</button><button type="button" disabled={removing} onClick={onRemove} className="inline-flex h-[38px] items-center justify-center gap-2 rounded-[12px] bg-[#b44f49] px-4 text-white shadow-[inset_0_1px_0_rgb(255_255_255/.1),0_4px_8px_rgb(0_0_0/.25)] transition-[background,transform] hover:bg-[#c65b54] active:scale-[.97] disabled:opacity-45">{removing ? <Spinner className="size-4"/> : <Trash2 className="size-4"/>}{removing ? "Removing…" : "Remove"}</button></DialogFooter>
  </LabDialogContent></Dialog>;
}

function WorkspaceConnectForm({ onConnect, onConnected, onCancel, autoFocus = false, initialError = "", initialValue = '' }: { initialValue?: string; onConnect: (value: string) => Promise<void>; onConnected?: () => void; onCancel?: () => void; autoFocus?: boolean; initialError?: string }) {
  const [value, setValue] = useState(initialValue);
  useEffect(()=>{setValue(initialValue);},[initialValue]);
  const [mode, setMode] = useState<"manual" | "qr">("manual");
  const [error, setError] = useState(initialError);
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);

  const connect = async (ticket = value) => {
    if (connecting || !ticket.trim()) return;
    setConnecting(true);
    setError("");
    try {
      await onConnect(ticket);
      setValue("");
      onConnected?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not connect to this workspace");
    } finally {
      setConnecting(false);
    }
  };

  const scanImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setError("");
    try {
      const result = await detectQrCode(file);
      setValue(result);
      await connect(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read this QR code");
    } finally {
      setScanning(false);
      event.target.value = "";
    }
  };

  return <form onSubmit={(event: FormEvent) => { event.preventDefault(); if (mode === "manual") void connect(); }}>
    <div className="space-y-4 p-6">
      <div className="grid grid-cols-2 gap-[3px] rounded-[12px] bg-[#08090a] p-[3px]">
        <button type="button" onClick={() => { setMode("manual"); setError(""); }} className={cn("h-9 rounded-[9px] font-mono text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors", mode === "manual" ? "bg-[var(--oathkeeper-panel)] text-[#f4f7f5] shadow-[inset_0_1px_0_rgb(255_255_255/.08),0_4px_8px_rgb(0_0_0/.2)]" : "text-white/35 hover:text-white/60")}>Manual ID</button>
        <button type="button" onClick={() => { setMode("qr"); setError(""); }} className={cn("h-9 rounded-[9px] font-mono text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors", mode === "qr" ? "bg-[var(--oathkeeper-panel)] text-[#f4f7f5] shadow-[inset_0_1px_0_rgb(255_255_255/.08),0_4px_8px_rgb(0_0_0/.2)]" : "text-white/35 hover:text-white/60")}>QR Code</button>
      </div>
      {mode === "manual" ? <label className="block"><span className="text-white/80">Invite or connection ID</span><span className="mt-0.5 block text-[12px] text-white/35">The invite grants encrypted workspace access through Iroh</span><textarea autoFocus={autoFocus} rows={3} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Paste workspace invite or connection ID" autoCapitalize="none" autoComplete="off" spellCheck={false} className="mt-3 w-full resize-none rounded-[12px] border border-black bg-black/55 px-3 py-2.5 text-[13px] leading-5 text-white/85 shadow-[inset_0_1px_3px_rgb(0_0_0/.5)] outline-none placeholder:text-white/25 focus:border-white/20"/></label> : <div className="space-y-3"><p className="text-[12px] leading-5 text-white/35">Choose or capture an image containing the workspace QR code.</p><label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-[var(--oathkeeper-panel)] text-white/65 shadow-[inset_0_1px_0_rgb(255_255_255/.08),0_4px_8px_rgb(0_0_0/.2)] ring-1 ring-black/45 transition-colors hover:text-white"><input type="file" accept="image/*" capture="environment" onChange={(event) => void scanImage(event)} className="sr-only"/><ScanLine className="size-4"/>{scanning || connecting ? "Reading QR…" : "Choose QR code"}</label></div>}
      {connecting ? <p role="status" className="text-[12px] leading-5 text-white/60">Connecting securely, then loading workspace sessions… This will time out if the gateway cannot be reached.</p> : null}
      {error ? <p role="alert" className="text-[12px] leading-5 text-[#f87171]">{error}</p> : null}
    </div>
    {mode === "manual" ? <DialogFooter single={!onCancel}>{onCancel ? <button type="button" onClick={onCancel} className="lab-secondary">Cancel</button> : null}<button type="submit" disabled={connecting || !value.trim()} className="lab-primary disabled:opacity-45">{connecting ? <Spinner className="size-4"/> : <ShieldCheck className="size-4"/>}{connecting ? "Connecting…" : "Connect"}</button></DialogFooter> : onCancel ? <DialogFooter single><button type="button" onClick={onCancel} className="lab-secondary">Cancel</button></DialogFooter> : null}
  </form>;
}

function ShareSessionDialog({ open, onOpenChange, session, code }: { open: boolean; onOpenChange: (open: boolean) => void; session: Pick<VibeGhostSession, 'title' | 'shared'>; code: string }) {
  const destination = typeof window === "undefined" ? "" : `${window.location.origin}/vibeghost`;
  return <Dialog open={open} onOpenChange={onOpenChange}><LabDialogContent>
    <DialogHeading title={`Share ${session.title}`} description={session.shared ? "This reuses the workspace invite and grants access to the whole workspace, not just this session. Keep it private." : "Share this session reference. It does not grant new workspace access."}/>
    <div className="p-6">{!code ? <p role="alert" className="mb-3 text-xs text-[#efa09a]">Reconnect this workspace to recover its existing invite.</p> : null}<ShareCodeTabs key={code} code={code} defaultUrl={destination} label={session.shared ? "Workspace connection ID" : "Session reference"}/></div>
    <DialogFooter single><button type="button" onClick={() => onOpenChange(false)} className="lab-primary">Done</button></DialogFooter>
  </LabDialogContent></Dialog>;
}

function LabDialogContent({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <DialogContent hideClose className={cn("lab-dialog-surface block max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-[24px] bg-[#111]/85 p-0 font-mono text-[13px] font-medium text-white shadow-[0_24px_70px_rgb(0_0_0/.55)] backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", wide ? "max-w-[560px]" : "max-w-[444px]")}><DialogCloseButton/>{children}</DialogContent>;
}

function DialogHeading({ title, description }: { title: string; description: string }) {
  // The shared dialog kit's header type, so VibeGhost dialogs match every other dialog.
  return <header className="relative px-6 pb-0 pt-6 pr-16"><DialogTitle className={dialogKitStyles.title}>{title}</DialogTitle><DialogDescription className={dialogKitStyles.subtitle}>{description}</DialogDescription></header>;
}

function DialogCloseButton() {
  return <DialogClose className="oathkeeper-raised-control !absolute right-6 top-5 z-10 flex size-[34px] items-center justify-center" aria-label="Close"><Glyph.X className="size-[18px]" aria-hidden="true" /></DialogClose>;
}

function DialogFooter({ children, single = false }: { children: React.ReactNode; single?: boolean }) {
  return <footer className={cn("lab-dialog-footer relative grid gap-3 p-6", single ? "grid-cols-1 justify-items-end" : "grid-cols-2")}>{children}</footer>;
}

function encodeSharedSessionInvite(session: VibeGhostSession) {
  const payload: SharedSessionPayload = { version: 1, kind: "vibeghost-session", sessionId: session.id, title: session.title, cwd: session.cwd };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function tryDecodeSharedSessionInvite(invite: string) {
  try { return decodeSharedSessionInvite(invite); } catch { return null; }
}

function decodeSharedSessionInvite(invite: string): SharedSessionPayload {
  const ticket = invite.trim().replace(/^.*#/, "");
  if (!ticket) throw new Error("Paste a session invite or connection ID");
  try {
    const padded = ticket.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(ticket.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SharedSessionPayload>;
    if (payload.version !== 1 || payload.kind !== "vibeghost-session" || !payload.sessionId || !payload.title) throw new Error("Incomplete session invite");
    return payload as SharedSessionPayload;
  } catch (error) {
    throw new Error(`Invalid session invite${error instanceof Error ? `: ${error.message}` : ""}`);
  }
}

type BarcodeDetectorLike = { detect: (source: ImageBitmap) => Promise<Array<{ rawValue?: string }>> };
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike;

async function detectQrCode(file: File) {
  const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  if (!Detector) throw new Error("QR scanning is not supported in this browser. Paste the invite instead.");
  const bitmap = await createImageBitmap(file);
  try {
    const codes = await new Detector({ formats: ["qr_code"] }).detect(bitmap);
    const value = codes[0]?.rawValue;
    if (!value) throw new Error("No QR code was found in that image");
    return value;
  } finally {
    bitmap.close();
  }
}
