// Messages sent from Chat, shown before Pi's transcript records them. Matching
// mirrors VibeGhost's lib/ui/optimistic-chat.ts so both apps reconcile alike.

import type { QueuedMessage } from "./agent-queue"

/** `queued`: sent while the agent was working, so it goes into the agent's own
 *  queue (`mode`: Enter steers, Alt+Enter follows up) rather than straight in. */
export type PendingChatMessage = Readonly<{ id: string; text: string; sentAt: number; queued?: boolean; mode?: "steer" | "followUp" }>
export type TranscriptChatMessage = { id?: string; role: string; text?: string; timestamp?: string }

/** How long an unmatched bubble may wait (a Pi steer waits for the running tool). */
export const PENDING_MAX_AGE_MS = 5 * 60_000
/** Transcript timestamps come from the agent host; allow some clock skew. */
const CLOCK_SKEW_MS = 15_000

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

/** Short replies must match exactly; a long paste may be wrapped or cut by the transcript. */
function sameMessage(recorded: string, sent: string) {
  if (!recorded || !sent) return false
  if (recorded === sent) return true
  if (sent.length >= 24 && recorded.includes(sent)) return true
  const prefix = Math.min(sent.length, 160)
  return prefix >= 48 && recorded.slice(0, prefix) === sent.slice(0, prefix)
}

/**
 * Bubbles the transcript has not recorded yet. Each transcript user message
 * confirms at most one bubble, only one recorded after the bubble was sent, and
 * never one an earlier bubble already claimed (`claimed`, updated in place).
 */
export function unconfirmedPendingMessages(
  pending: readonly PendingChatMessage[],
  transcript: readonly TranscriptChatMessage[],
  claimed: Set<string> = new Set(),
  now = Date.now(),
): PendingChatMessage[] {
  const users = transcript.filter(message => message.role === "user").map(message => ({
    id: message.id,
    text: normalize(message.text ?? ""),
    at: message.timestamp ? Date.parse(message.timestamp) : Number.NaN,
  }))
  const used = new Set<number>(users.flatMap((user, index) => user.id && claimed.has(user.id) ? [index] : []))
  return pending.filter(message => {
    if (now - message.sentAt > PENDING_MAX_AGE_MS) return false
    const sent = normalize(message.text)
    const index = users.findIndex((user, position) => !used.has(position) &&
      (Number.isNaN(user.at) || user.at >= message.sentAt - CLOCK_SKEW_MS) && sameMessage(user.text, sent))
    if (index < 0) return true
    used.add(index)
    const id = users[index].id
    if (id) {
      claimed.add(id)
      if (claimed.size > 200) claimed.delete(claimed.values().next().value as string)
    }
    return false
  })
}

/**
 * Bubbles to draw as grey messages. One the agent holds in its own queue is
 * already a queue card, so it is not drawn twice. Once matched it stays hidden
 * (`queuedIds`, updated in place): removing or editing the card, or the agent
 * taking it, must not bring a grey copy back. The transcript's copy is the
 * message from then on. Queue cards show the full text when it is known, else
 * the agent's cut line ("first words...").
 */
export function pendingOutsideQueue<T extends { id: string; text: string }>(pending: readonly T[], queued: readonly { text: string }[], queuedIds: Set<string> = new Set()): T[] {
  const left = queued.map(item => normalize(item.text))
  return pending.filter(message => {
    if (queuedIds.has(message.id)) return false
    const sent = normalize(message.text)
    // Pi draws the first line of a multi-line message.
    const first = normalize(message.text.split("\n")[0] ?? "")
    const index = left.findIndex(line => line === sent || (line === first && first.length > 0) || (line.endsWith("...") && line.length > 3 && sent.startsWith(line.slice(0, -3).trimEnd())))
    if (index < 0) return true
    left.splice(index, 1)
    queuedIds.add(message.id)
    return false
  })
}

/** One row of the queue sleeve; `pending` is a send the agent has not drawn yet. */
export type QueueSleeveItem = QueuedMessage & { pending?: boolean }

/**
 * Splits Chat's sends between the queue sleeve and the conversation. A send
 * the agent holds in its queue is that queue row only. A send made while the
 * agent was working (`queued`) is going into its queue, so it waits in the
 * sleeve (never as a grey bubble) until the agent draws it there or the
 * transcript records it as a normal sent message. Only a send made while the
 * agent was idle stays a bubble until its transcript copy lands.
 */
export function pairQueueSleeve<T extends PendingChatMessage>(queue: readonly QueuedMessage[], pending: readonly T[], queuedIds: Set<string> = new Set()): { sleeve: QueueSleeveItem[]; bubbles: T[] } {
  const outside = pendingOutsideQueue(pending, queue, queuedIds)
  const waiting = outside.filter(message => message.queued)
  return {
    sleeve: [...queue, ...waiting.map(message => ({ id: `pending:${message.id}`, text: message.text, mode: message.mode ?? "steer", pending: true }))],
    bubbles: outside.filter(message => !message.queued),
  }
}
