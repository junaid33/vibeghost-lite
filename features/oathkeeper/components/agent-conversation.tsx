"use client"
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react"
import { SharedWorkspaceError, type SharedWorkspaceClient } from "../lib/shared-workspace-client"
import type { AgentChatImage, AgentChatMessage, AgentChatResponse } from "../lib/session-integrations/agent-chat"
import { mergeAgentChatPages } from "../lib/agent-chat-pages"
import { SharedTranscriptImage } from "./shared-transcript-image"
import { ChatImages, ChatThread, ProviderMark, pushChatBlock, type ChatBlock, type ChatTurn } from "./chat-thread"
import { AgentQuestionCard, answersFromResult } from "./agent-question-card"
import { QueueSleeve } from "./queue-sleeve"
import { answerAgentQuestion, useAgentQueue } from "../hooks/use-agent-interactions"
import { ASK_USER_QUESTION_TOOL, parseAgentQuestionSet, type AgentQuestionRequest } from "../lib/agent-questions"
import { CanvasFrame } from "./canvas/canvas-frame"
import { toolCanvases } from "../lib/chat-canvas"
import styles from "./agent-conversation.module.css"

// Claude and Codex transcripts from a shared VibeGhost workspace, rendered
// through the same ChatThread presentation as Pi and the native VibeGhost app.
export function AgentConversation({ client, sessionId, providerHint = 'codex', conversationId, bindingEpoch, agentPhase, transcriptPath, live = true, active = true, refreshEpoch = 0, onLinked, onOpenTerminal }: { client: SharedWorkspaceClient; sessionId: string; providerHint?: 'codex' | 'claude'; conversationId?: string; bindingEpoch?: string; agentPhase?: string; /** The session's transcript on this computer (agentIdentity.locator), for the queue. */ transcriptPath?: string; live?: boolean; active?: boolean; refreshEpoch?: number; onLinked?: () => void; onOpenTerminal?: () => void }) {
  const session = { id: sessionId };
  const owner = `${sessionId}:${conversationId ?? 'pending'}:${bindingEpoch ?? 'legacy'}`;
  const [history, setHistory] = useState<{ owner: string; pages: AgentChatResponse[] }>({ owner, pages: [] });
  const [earlierError, setEarlierError] = useState<unknown>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const historyController = useRef<AbortController | null>(null);
  const [visibleCount, setVisibleCount] = useState(60)
  const [threadId, setThreadId] = useState("")
  const [linkError, setLinkError] = useState<unknown>(null)
  const [linking, setLinking] = useState(false)
  const assistantName = providerHint === 'claude' ? 'Claude' : 'Codex';
  const [data, setData] = useState<AgentChatResponse>();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const bindingController = useRef<AbortController | null>(null);
  const refetch = useCallback(async () => {
    const request = ++generation.current;
    controllerRef.current?.abort();
    const controller = new AbortController(); controllerRef.current = controller;
    try {
      if (!client.supportsAgentSessions) throw new Error('This VibeGhost shared gateway does not support agent conversations yet. Update/reload the native server and reconnect this workspace. The terminal remains available.');
      const result = await client.json<AgentChatResponse>('GET', `/api/sessions/${encodeURIComponent(sessionId)}/agent-chat`, undefined, controller.signal);
      if (request === generation.current && !controller.signal.aborted) { setData(result); setError(null); }
    } catch (caught) { if (request === generation.current && !controller.signal.aborted) setError(caught); }
    finally { if (request === generation.current && !controller.signal.aborted) setLoading(false); }
  }, [client, sessionId, owner]);
  useEffect(() => {
    setData(undefined); setError(null); setLoading(true); setThreadId(''); setLinkError(null); setLinking(false);
    setLoadingEarlier(false); setEarlierError(null); setVisibleCount(60);
    return () => { generation.current++; controllerRef.current?.abort(); bindingController.current?.abort(); historyController.current?.abort(); };
  }, [client, owner]);
  useEffect(() => {
    if (!active) return;
    let disposed = false; let timer: ReturnType<typeof setTimeout>;
    const poll = async () => { if (document.visibilityState !== 'hidden') await refetch(); if (!disposed) timer = setTimeout(poll, 2500); };
    void poll();
    return () => { disposed = true; clearTimeout(timer); generation.current++; controllerRef.current?.abort(); bindingController.current?.abort(); };
  }, [active, refetch, refreshEpoch]);
  const query = { data, error, isPending: loading, refetch };
  const queryError = query.error instanceof SharedWorkspaceError ? query.error : null
  const olderPages = history.owner === owner ? history.pages : [];
  const allMessages = mergeAgentChatPages(query.data, olderPages);
  const messages = query.data?.pagination ? allMessages : allMessages.slice(-visibleCount);
  const lastPage = olderPages.at(-1) ?? query.data;
  const loadEarlier = async () => {
    const cursor = lastPage?.pagination?.nextCursor;
    if (!cursor || loadingEarlier || olderPages.length >= 12) return;
    const controller = new AbortController(); historyController.current = controller;
    setLoadingEarlier(true); setEarlierError(null);
    try {
      const page = await client.json<AgentChatResponse>('GET', `/api/sessions/${encodeURIComponent(sessionId)}/agent-chat?cursor=${encodeURIComponent(cursor)}`, undefined, controller.signal);
      if (!controller.signal.aborted) setHistory(current => ({ owner, pages: [...(current.owner === owner ? current.pages : []), page] }));
    } catch (error) { if (!controller.signal.aborted) setEarlierError(error); }
    finally { if (historyController.current === controller) { historyController.current = null; setLoadingEarlier(false); } }
  };
  // Claude binds itself from its process registry once the first prompt writes a
  // transcript, so a pending Claude identity is a wait, never a manual link form
  // (as in native VibeGhost). Codex still offers the manual thread link.
  const identityPending = queryError?.code === "AGENT_IDENTITY_PENDING"
  const needsCodexLink = identityPending && providerHint !== "claude"
  const awaitingClaude = identityPending && providerHint === "claude"
  const unavailable = providerHint === "codex" && queryError?.code === "CODEX_APP_SERVER_UNAVAILABLE"
  const linkCodex = async (event: FormEvent) => {
    event.preventDefault()
    if (linking) return
    setLinking(true)
    setLinkError(null)
    const controller = new AbortController(); bindingController.current = controller;
    try {
      await client.json('POST', `/api/sessions/${encodeURIComponent(session.id)}/agent-binding`, { threadId: threadId.trim() }, controller.signal);
      if (controller.signal.aborted) return;
      setThreadId(""); onLinked?.();
      await query.refetch()
    } catch (error) {
      if (!controller.signal.aborted) setLinkError(error)
    } finally {
      if (bindingController.current === controller) { bindingController.current = null; setLinking(false); }
    }
  }
  const answer = useCallback(async (request: AgentQuestionRequest, submit: Parameters<typeof answerAgentQuestion>[3]) => {
    await answerAgentQuestion(client, sessionId, request, submit)
    void refetch()
  }, [client, sessionId, refetch])
  const renderQuestion = useCallback((request: AgentQuestionRequest, running: boolean, key: string) => (
    <AgentQuestionCard key={key} request={request} running={running && live} author={assistantName}
      onAnswer={providerHint === 'claude' && live ? submit => answer(request, submit) : undefined}
      unanswerable={providerHint !== 'claude' ? "Answer in the terminal." : undefined}
      onOpenTerminal={onOpenTerminal}/>
  ), [answer, assistantName, live, onOpenTerminal, providerHint])
  const turns = useMemo(
    () => toChatTurns(messages, assistantName, <ProviderMark provider={providerHint}/>, (image, index) => <SharedTranscriptImage key={index} image={image} client={client} sessionId={sessionId}/>, renderQuestion),
    [messages, assistantName, providerHint, client, sessionId, renderQuestion]
  )
  const lastTurn = turns.at(-1)
  const toolRunning = lastTurn?.role === "assistant" && lastTurn.blocks.some(block => block.kind === "tools" && block.tools.some(tool => tool.status === "running"))
  // The phase reported by the agent's hooks/registry is authoritative; an
  // unanswered tool row only stands in when no phase has been reported.
  const working = agentPhase ? agentPhase === "working" : toolRunning
  const queue = useAgentQueue({ client, sessionId, provider: providerHint, transcriptPath, working: live && working, active: active && live })
  const hasEarlier = Boolean((lastPage?.pagination?.hasMore && lastPage.pagination.nextCursor && olderPages.length < 12) || (!query.data?.pagination && allMessages.length > visibleCount))
  // A missing link, or Codex's transcript service down: one card in the thread with labels, the state and errors only.
  const prelude = <>
    {needsCodexLink ? (
      <section className={styles.recovery} aria-labelledby={`link-title-${session.id}`}>
        <header className={styles.recoveryHead}>
          <span className={styles.recoveryMark} aria-hidden="true"><ProviderMark provider={providerHint}/></span>
          <h2 id={`link-title-${session.id}`}>Link {assistantName} conversation</h2>
          <span className={styles.recoveryState} data-tone="pending" role="status">Not linked</span>
        </header>
        <form onSubmit={linkCodex} className={styles.linkForm}>
          <label htmlFor={`codex-thread-${session.id}`} className="sr-only">{assistantName} thread ID</label>
          <input id={`codex-thread-${session.id}`} value={threadId} onChange={(event) => setThreadId(event.target.value)} placeholder="Thread ID" autoComplete="off" spellCheck={false} />
          <span className={styles.pillTrack}><button type="submit" className={styles.pill} disabled={linking || !threadId.trim()}>{linking ? "Linking…" : "Link"}</button></span>
        </form>
        {linkError ? <p role="alert" className={styles.recoveryError}>{linkError instanceof Error ? linkError.message : 'Could not link this conversation.'}</p> : null}
      </section>
    ) : null}
    {unavailable ? (
      <section className={styles.recovery} aria-labelledby={`transcript-title-${session.id}`}>
        <header className={styles.recoveryHead}>
          <span className={styles.recoveryMark} aria-hidden="true"><ProviderMark provider={providerHint}/></span>
          <h2 id={`transcript-title-${session.id}`}>Codex transcript</h2>
          <span className={styles.recoveryState} data-tone="error" role="alert">Unavailable</span>
        </header>
        <div className={styles.recoveryActions}><span className={styles.pillTrack}><button type="button" className={styles.pill} onClick={() => void query.refetch()}>Retry</button></span></div>
      </section>
    ) : null}
  </>
  const shownError = !identityPending && !unavailable && query.error ? query.error : earlierError
  return (
    <>
    {active && live ? <QueueSleeve items={queue.items} busy={queue.busy} error={queue.error} onRemove={queue.remove} onEdit={queue.edit}/> : null}
    <ChatThread
      label="Agent conversation"
      turns={turns}
      prelude={prelude}
      loading={query.isPending}
      loadingLabel="Reading conversation…"
      emptyLabel={needsCodexLink || unavailable ? "" : awaitingClaude ? (live ? "Waiting for the conversation to start." : "No saved conversation for this session.") : "No messages yet."}
      error={shownError ? (shownError instanceof Error ? shownError.message : "Conversation unavailable.") : undefined}
      onRetry={shownError === query.error ? () => void query.refetch() : undefined}
      earlier={hasEarlier ? { loading: loadingEarlier, onLoad: () => query.data?.pagination ? void loadEarlier() : setVisibleCount((count) => count + 60) } : undefined}
      working={working ? `${assistantName} is working` : undefined}
    />
    </>
  )
}

type RenderImage = (image: AgentChatImage, index: number) => ReactNode
type RenderQuestion = (request: AgentQuestionRequest, running: boolean, key: string) => ReactNode

/** A question call's card model: the server's parsed question when it sent
 *  one, else the tool input; answers from the record or the result text. */
export function questionOf(part: { name: string; arguments?: Record<string, unknown>; question?: AgentQuestionRequest; result?: string; toolCallId?: string }): AgentQuestionRequest | undefined {
  if (part.name !== ASK_USER_QUESTION_TOOL) return undefined
  const set = part.question ?? parseAgentQuestionSet(part.arguments)
  if (!set) return undefined
  const answers = part.question?.answers ?? answersFromResult(part.result, set.questions)
  return { ...set, ...(part.toolCallId ? { toolUseId: part.toolCallId } : {}), ...(answers ? { answers } : {}) }
}

/** Folds transcript messages into turns. Consecutive assistant and tool
 * messages share one turn (Claude writes one message per tool call), and their
 * tool calls group into a single list, preserving part order. */
export function toChatTurns(messages: AgentChatMessage[], assistantName: string, icon: ReactNode, renderImage: RenderImage, renderQuestion?: RenderQuestion): ChatTurn[] {
  const turns: ChatTurn[] = []
  const canvasSeen = new Set<string>()
  // A canvas_publish result shows the published page inline under its tool row, as in Oathkeeper's own chat.
  const pushCanvases = (blocks: ChatBlock[], tool: { name?: string; args?: unknown; result?: unknown; isError?: boolean }) => {
    for (const canvas of toolCanvases([tool], canvasSeen)) pushChatBlock(blocks, { kind: "node", key: `canvas:${canvas.id}`, node: <CanvasFrame id={canvas.id} title={canvas.title} height={canvas.height} heights={canvas.heights} inline/> })
  }
  for (const message of messages) {
    const media = message.images?.length ? <ChatImages images={message.images} render={renderImage} /> : null
    if (message.role === "user") {
      const text = message.parts?.length ? message.parts.flatMap(part => part.type === "text" ? [part.text] : []).join("\n\n") : message.text
      turns.push({ id: message.id, role: "user", text, media })
      continue
    }
    if (message.role === "system") {
      if (message.text.trim()) turns.push({ id: message.id, role: "system", text: message.text })
      continue
    }
    let turn = turns.at(-1)
    if (turn?.role !== "assistant") {
      turn = { id: message.id, role: "assistant", author: assistantName, icon, blocks: [] }
      turns.push(turn)
    }
    const blocks: ChatBlock[] = turn.blocks
    if (message.role === "tool") {
      pushChatBlock(blocks, { kind: "tools", tools: [{ id: message.id, name: message.toolName || "tool", result: message.text, isError: message.isError, truncated: message.truncated, media }] })
      pushCanvases(blocks, { name: message.toolName, result: message.text, isError: message.isError })
      continue
    }
    if (message.parts?.length) {
      for (const [index, part] of message.parts.entries()) {
        if (part.type === "text") { if (part.text.trim()) pushChatBlock(blocks, { kind: "text", text: part.text }) }
        else if (part.type === "thinking") { if (part.text.trim()) pushChatBlock(blocks, { kind: "thinking", text: part.text }) }
        else if (renderQuestion && questionOf(part)) {
          const key = part.toolCallId ?? `${message.id}:${index}`
          pushChatBlock(blocks, { kind: "node", key: `question:${key}`, node: renderQuestion(questionOf(part)!, part.status === "running" && !part.result, key) })
        }
        else pushChatBlock(blocks, { kind: "tools", tools: [{
          id: part.toolCallId ?? `${message.id}:${index}`,
          name: part.name,
          args: part.arguments,
          result: part.result,
          status: part.status,
          isError: part.isError,
          truncated: part.truncated,
          media: part.images?.length ? <ChatImages images={part.images} render={renderImage} /> : null,
        }] })
        if (part.type === "toolCall") pushCanvases(blocks, { name: part.name, args: part.arguments, result: part.result, isError: part.isError })
      }
    } else if (message.text.trim()) {
      pushChatBlock(blocks, { kind: "text", text: message.text })
    }
    if (media) pushChatBlock(blocks, { kind: "node", key: `${message.id}:images`, node: media })
    if (message.truncated) {
      // Tool-only previews mark the call; prose gets a quiet note.
      const hasProse = message.parts?.length ? message.parts.some(part => part.type === "text" && part.text.trim()) : Boolean(message.text.trim())
      const last = blocks.at(-1)
      if (!hasProse && last?.kind === "tools") last.tools[last.tools.length - 1].truncated = true
      else pushChatBlock(blocks, { kind: "note", text: "Message preview truncated." })
    }
    if (!blocks.length) turns.pop()
  }
  return turns
}
