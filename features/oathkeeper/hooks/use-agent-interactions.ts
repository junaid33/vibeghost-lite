"use client"
// The interactive half of agent chat: answering an agent's question and
// rewriting the messages waiting in its input queue. Both act on the agent's
// real state through VibeGhost (the question hook route, or keys typed into
// its terminal) and re-read that state afterwards; nothing is kept only here.
import { useCallback, useEffect, useRef, useState } from "react"
import { SharedWorkspaceError, type SharedWorkspaceClient } from "../lib/shared-workspace-client"
import {
  claudeQueueEditable,
  claudeQueueRewrite,
  fullPiQueue,
  parsePiQueueTexts,
  type PiQueueText,
  piEditorEmpty,
  piQueueClearTexts,
  piQueueFromScreen,
  piQueueRewrite,
  planQueueRewrite,
  type QueuedMessage,
} from "../lib/agent-queue"
import { claudeQuestionDialogVisible, planClaudeQuestionKeys } from "../lib/claude-question-keys"
import { readAgentScreen, sendAgentSteps } from "../lib/agent-terminal-driver"
import { KITTY_ALT_ENTER_SEQUENCE } from "../lib/vibeghost-terminal/terminal-key-sequences"
import type { AgentQuestionRequest } from "../lib/agent-questions"
import { piSentTexts, rememberPiSentText } from "../lib/pi-sent-texts"
import type { QuestionSubmit } from "../components/agent-question-card"

type Provider = "claude" | "pi" | "codex"

/** Answers a Claude question: the VibeGhost hook when one waits on it, else
 *  keys typed into the dialog while it is on screen. */
export async function answerAgentQuestion(client: SharedWorkspaceClient, sessionId: string, request: AgentQuestionRequest, submit: QuestionSubmit, signal?: AbortSignal) {
  const questions = request.questions.map(question => question.question)
  try {
    await client.json("POST", `/api/sessions/${encodeURIComponent(sessionId)}/agent-questions/answer`, { questions, answers: submit.answers }, signal)
    return
  } catch (error) {
    // 409: no hook waits on this question; 404: the server predates the route.
    if (!(error instanceof SharedWorkspaceError) || (error.status !== 409 && error.status !== 404 && error.status !== 403)) throw error
  }
  const plan = planClaudeQuestionKeys(request.questions, submit.drafts)
  if (!plan.ok) throw new Error(plan.error)
  const screen = await readAgentScreen(client, sessionId, signal)
  if (!claudeQuestionDialogVisible(screen, request.questions)) throw new Error("The question isn't open in the terminal anymore.")
  await sendAgentSteps(client, sessionId, plan.steps, signal)
}

const POLL_MS = 1500

/** Full texts of Pi's queued messages, recorded by VibeGhost's Pi extension
 *  in the session's control folder. Read first through Oathkeeper's own route
 *  (same computer, no VibeGhost server change needed); only a session whose
 *  file is not on this computer (a remote host) asks VibeGhost (`piTexts`).
 *  Messages another session sent through the MCP are only whole here; a
 *  failed read leaves the screen's cut lines. */
async function readPiQueueTexts(client: SharedWorkspaceClient, sessionId: string, signal?: AbortSignal): Promise<PiQueueText[]> {
  try {
    const response = await fetch(`/api/vibeghost/pi-queue?session=${encodeURIComponent(sessionId)}`, { cache: "no-store", signal })
    if (response.ok) {
      const body = await response.json() as { found?: unknown; piTexts?: unknown }
      if (body.found === true) return parsePiQueueTexts({ items: body.piTexts })
    }
  } catch { /* not on this computer */ }
  try {
    const body = await client.json<{ piTexts?: unknown }>("GET", `/api/sessions/${encodeURIComponent(sessionId)}/agent-queue`, undefined, signal)
    if (Array.isArray(body.piTexts)) return parsePiQueueTexts({ items: body.piTexts })
  } catch { /* older or remote VibeGhost */ }
  return []
}

/** The agent's queue while it works. Claude: from its transcript (needs the
 *  session's transcript path on this computer). Pi: from its screen, matched
 *  back to the full texts this page sent. */
export function useAgentQueue({ client, sessionId, provider, transcriptPath, working, active, sentTexts }: {
  client: SharedWorkspaceClient
  sessionId: string
  provider: Provider
  transcriptPath?: string
  working: boolean
  active: boolean
  /** Full texts this page queued (Pi's screen shows one cut line each). */
  sentTexts?: readonly string[]
}) {
  const [items, setItems] = useState<QueuedMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const busyRef = useRef(false)
  // This page's sends, then every send to this session that was remembered
  // (another view, before a reload), so a cut queue line finds its full text.
  const sentRef = useRef(sentTexts ?? [])
  sentRef.current = sentTexts ?? []
  const knownTexts = useCallback(() => provider === "pi" ? [...sentRef.current, ...piSentTexts(sessionId)] : sentRef.current, [provider, sessionId])
  const supported = provider === "claude" || provider === "pi"

  const read = useCallback(async (signal?: AbortSignal): Promise<QueuedMessage[]> => {
    if (provider === "claude") {
      // VibeGhost serves the queue itself once restarted with the route; until
      // then the transcript is read on this computer.
      try {
        const body = await client.json<{ items?: QueuedMessage[] }>("GET", `/api/sessions/${encodeURIComponent(sessionId)}/agent-queue`, undefined, signal)
        if (Array.isArray(body.items)) return body.items
      } catch (error) {
        if (!(error instanceof SharedWorkspaceError) || (error.status !== 404 && error.status !== 403)) throw error
      }
      if (!transcriptPath) return []
      const response = await fetch(`/api/vibeghost/agent-queue?path=${encodeURIComponent(transcriptPath)}`, { cache: "no-store", signal })
      if (!response.ok) return []
      const body = await response.json() as { items?: QueuedMessage[] }
      return Array.isArray(body.items) ? body.items : []
    }
    if (provider === "pi") {
      const [screen, recorded] = await Promise.all([readAgentScreen(client, sessionId, signal), readPiQueueTexts(client, sessionId, signal)])
      return fullPiQueue(piQueueFromScreen(screen), recorded, knownTexts())
    }
    return []
  }, [client, knownTexts, provider, sessionId, transcriptPath])

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (busyRef.current) return
    try { const next = await read(signal); if (!busyRef.current && !signal?.aborted) setItems(next) }
    catch { /* a missed poll keeps the last cards */ }
  }, [read])

  // Poll while the agent works, and once after it stops so drained cards go.
  useEffect(() => {
    if (!supported || !active) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      if (document.visibilityState !== "hidden") await refresh(controller.signal)
      if (!controller.signal.aborted && working) timer = setTimeout(() => void tick(), POLL_MS)
    }
    void tick()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [supported, active, working, refresh])
  useEffect(() => { setItems([]); setError(undefined) }, [sessionId, provider])

  /** Replaces the queue with `next`, through the agent's editor. */
  const rewrite = useCallback(async (next: QueuedMessage[]) => {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); setError(undefined)
    try {
      const screen = await readAgentScreen(client, sessionId)
      const current = provider === "claude" ? await read() : fullPiQueue(piQueueFromScreen(screen), await readPiQueueTexts(client, sessionId), knownTexts())
      if (!current.length) { setItems([]); return }
      // Pi or another sender may have changed the queue since the sleeve was
      // drawn: rewrite the queue as it is now, with only the shown rows changed.
      const wanted = planQueueRewrite(current, items, next)
      if (provider === "claude") {
        if (!claudeQueueEditable(screen)) throw new Error("Clear the draft in Claude's terminal first.")
        await sendAgentSteps(client, sessionId, claudeQueueRewrite(current.map(item => item.text), wanted.map(item => item.text)).steps)
      } else {
        if (!piEditorEmpty(screen)) throw new Error("Clear the draft in Pi's terminal first.")
        // A cut line with no full text is restored whole by Pi; the clear is
        // sized for it and the words known here are queued again.
        await sendAgentSteps(client, sessionId, piQueueRewrite(piQueueClearTexts(current), wanted, KITTY_ALT_ENTER_SEQUENCE).steps)
        for (const item of wanted) rememberPiSentText(sessionId, item.text)
      }
      setItems(wanted)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The queue was not changed.")
    } finally {
      busyRef.current = false; setBusy(false)
      setTimeout(() => void refresh(), 400)
    }
  }, [client, items, knownTexts, provider, read, refresh, sessionId])

  const remove = useCallback((target: QueuedMessage) => void rewrite(items.filter(item => item.id !== target.id)), [items, rewrite])
  const edit = useCallback((target: QueuedMessage, text: string) => void rewrite(items.map(item => item.id === target.id ? { ...item, text } : item)), [items, rewrite])
  return { items: supported ? items : [], busy, error, remove, edit, refresh }
}
