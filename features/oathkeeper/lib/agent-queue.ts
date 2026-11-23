// Messages waiting in an agent's own input queue (typed while it works), and
// the keystrokes that rewrite that queue through the agent's editor.
//
// Claude Code writes every queue change to its transcript as a
// `queue-operation` record (verified on 2.1.310–2.1.312):
//   enqueue {content}          a message joined the queue
//   remove  {content, reason}  taken into the turn (absorbed_mid_turn,
//                              delivered_to_agent, cleared_on_cancel…)
//   popAll / popOne {content}  moved back into the editor (Up)
//   dequeue {}                 the next item was taken at a turn boundary
// Agent and task notifications go through the same queue; only messages a
// person typed are shown.
//
// Pi keeps its queue in memory only and draws it above the editor as
// "Steering: …" / "Follow-up: …" lines (one line each, truncated).

export type QueuedMessage = {
  id: string
  text: string
  mode?: "steer" | "followUp"
  /** Pi only: `text` is still the cut screen line (no full text was found). */
  cut?: boolean
}

/** A full queued text as Pi's VibeGhost extension records it
 *  (`<control dir>/<session>/pi-queue.json`, see the extension's queue-mirror.ts). */
export type PiQueueText = { mode: "steer" | "followUp"; text: string }

type QueueRecord = { type?: unknown; operation?: unknown; content?: unknown; timestamp?: unknown }

/** Harness-written queue items: notifications, subagent hand-backs, hooks. */
export function isInjectedQueueText(text: string) {
  return /^\s*<(task-notification|agent-message|local-command-|command-|system-reminder|bash-|user-prompt-submit-hook|event)/.test(text)
}

/** Claude's live queue from its transcript lines, oldest first. Dequeue takes
 *  the oldest item (Claude's priority order is FIFO for prompts), and a user
 *  record that repeats a queued text settles it, so a missed record cannot
 *  leave a card behind. */
export function claudeQueueFromLines(lines: readonly string[]): QueuedMessage[] {
  let queue: { text: string; at: string; seq: number }[] = []
  let seq = 0
  const drop = (text: string) => {
    const index = queue.findIndex(item => item.text === text)
    if (index >= 0) queue.splice(index, 1)
  }
  for (const line of lines) {
    if (!line.includes('"queue-operation"') && !line.includes('"type":"user"')) continue
    let record: QueueRecord & { message?: { content?: unknown } }
    try { record = JSON.parse(line) } catch { continue }
    if (record.type === "user") {
      const content = record.message?.content
      const text = typeof content === "string" ? content : Array.isArray(content)
        ? content.flatMap(part => part && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string" ? [(part as { text: string }).text] : []).join("\n")
        : ""
      if (text) drop(text.trim())
      continue
    }
    if (record.type !== "queue-operation") continue
    const text = typeof record.content === "string" ? record.content : ""
    switch (record.operation) {
      case "enqueue":
        queue.push({ text, at: typeof record.timestamp === "string" ? record.timestamp : "", seq: seq++ })
        break
      case "remove": case "popAll": case "popOne":
        if (text) drop(text)
        break
      case "dequeue":
        // A window that starts mid-queue can see a dequeue before its enqueue.
        queue.shift()
        break
    }
  }
  queue = queue.filter(item => item.text.trim() && !isInjectedQueueText(item.text))
  return queue.map(item => ({ id: `claude:${item.seq}:${item.at}`, text: item.text.trim() }))
}

/** Pi's queue as drawn above its editor. Lines are cut to one terminal row,
 *  so `text` may be a prefix ending in "..." (see `knownPiQueueText`). */
export function piQueueFromScreen(screen: string): QueuedMessage[] {
  const lines = screen.split("\n")
  // The queue block sits just above the hint line, below the transcript.
  const hint = lines.findLastIndex(line => /to edit all queued messages/.test(line))
  if (hint < 0) return []
  const result: QueuedMessage[] = []
  for (let index = hint - 1; index >= 0; index -= 1) {
    const match = /^\s*(Steering|Follow-up): (.*)$/.exec(lines[index])
    if (!match) break
    result.unshift({ id: `pi:${index}`, mode: match[1] === "Steering" ? "steer" : "followUp", text: match[2].trimEnd() })
  }
  return result.map((item, index) => ({ ...item, id: `pi:${index}:${item.mode}` }))
}

/** A Pi line is the full message, or a prefix of it ending in "...". */
export function knownPiQueueText(line: string, sent: readonly string[]): string | undefined {
  const single = (text: string) => text.split("\n")[0]
  const exact = sent.find(text => single(text).trimEnd() === line && !text.includes("\n"))
  if (exact) return exact
  const prefix = line.endsWith("...") ? line.slice(0, -3) : line
  const matches = sent.filter(text => single(text).startsWith(prefix))
  return matches.length ? matches[matches.length - 1] : undefined
}

export const PI_QUEUE_FILE = "pi-queue.json"

/** The `items` of a pi-queue.json body, or [] when it is not one. */
export function parsePiQueueTexts(body: unknown): PiQueueText[] {
  const items = body && typeof body === "object" ? (body as { items?: unknown }).items : undefined
  if (!Array.isArray(items)) return []
  return items.flatMap(item => {
    const entry = item && typeof item === "object" ? item as { mode?: unknown; text?: unknown } : undefined
    return entry && (entry.mode === "steer" || entry.mode === "followUp") && typeof entry.text === "string" && entry.text.trim()
      ? [{ mode: entry.mode, text: entry.text }] : []
  })
}

/** Whether a Pi screen line was drawn from `text` (whole, or cut with "..."). */
function piLineShows(line: string, text: string) {
  const first = text.split("\n")[0]
  if (first.trimEnd() === line) return true
  return line.endsWith("...") && first.startsWith(line.slice(0, -3))
}

/** Pi's queue lines with their full texts. Each line takes the oldest
 *  recorded text of its mode that it shows (Pi's own queue, so messages sent
 *  by another session or through the VibeGhost MCP are full too), then a text
 *  sent from this browser. A line with neither stays cut and is marked so. */
export function fullPiQueue(lines: readonly QueuedMessage[], recorded: readonly PiQueueText[], sent: readonly string[]): QueuedMessage[] {
  const pool = [...recorded]
  return lines.map(item => {
    const at = pool.findIndex(entry => entry.mode === item.mode && piLineShows(item.text, entry.text))
    if (at >= 0) return { ...item, text: pool.splice(at, 1)[0].text }
    const known = knownPiQueueText(item.text, sent)
    if (known) return { ...item, text: known }
    return item.text.endsWith("...") ? { ...item, cut: true } : item
  })
}

/** The text the inline editor opens with: the full message, or for a line Pi
 *  cut and no record completed, the words that are known (without "..."). */
export function editableQueueText(item: QueuedMessage) {
  return item.cut ? item.text.replace(/\.\.\.$/, "").trimEnd() : item.text
}

/** The queue to write back. Pi's current queue keeps its order; each message
 *  the person saw (`shown`) becomes its version in `next`, or is dropped when
 *  `next` no longer has it. A message queued after the sleeve was drawn (an
 *  MCP follow-up, another browser) is kept as it is, never silently removed.
 *  A cut line nobody completed is re-queued with the words that are known. */
export function planQueueRewrite(current: readonly QueuedMessage[], shown: readonly QueuedMessage[], next: readonly QueuedMessage[]): QueuedMessage[] {
  const unused = [...shown]
  return current.flatMap(item => {
    const at = unused.findIndex(old => old.text === item.text && (!old.mode || !item.mode || old.mode === item.mode))
    if (at < 0) return [item.cut ? { ...item, text: editableQueueText(item), cut: undefined } : item]
    const [old] = unused.splice(at, 1)
    const wanted = next.find(candidate => candidate.id === old.id)
    if (!wanted) return []
    const text = wanted.cut && wanted.text === old.text ? editableQueueText(wanted) : wanted.text
    return [{ ...item, text, mode: wanted.mode ?? item.mode, cut: undefined }]
  })
}

/** Texts to size the editor clear by. Pi restores a cut message whole, and
 *  its hidden lines must be cleared too, so a cut one counts generously. */
export function piQueueClearTexts(current: readonly QueuedMessage[]) {
  return current.map(item => item.cut ? `${item.text}${"\n".repeat(60)}` : item.text)
}

const UP = "\x1b[A"
const ALT_UP = "\x1b[1;3A"
const paste = (text: string) => `\x1b[200~${text}\x1b[201~`

/** Clears the editor line by line: Ctrl+U empties a line, Backspace joins it
 *  to the one above. Both agents bind Ctrl+U to delete-to-line-start, and both
 *  are harmless on an empty editor. */
function clearEditor(texts: readonly string[]) {
  const lines = texts.reduce((count, text) => count + text.split("\n").length, 0) + texts.length + 2
  return "\x15\x7f".repeat(Math.min(lines, 400))
}

export type QueueRewrite = { steps: string[] }

/** Claude: Up moves every queued message into the editor (`popAll`), the
 *  editor is cleared, and the messages that stay are queued again in order
 *  with Enter. Requires an empty editor (see `claudeQueueEditable`). */
export function claudeQueueRewrite(current: readonly string[], next: readonly string[]): QueueRewrite {
  return { steps: [UP, clearEditor(current), ...next.map(text => `${paste(text)}\r`)] }
}

/** Pi: Alt+Up restores the whole queue into the editor; the kept messages are
 *  queued again with their own mode (Enter steers, Alt+Enter follows up). */
export function piQueueRewrite(current: readonly string[], next: readonly QueuedMessage[], altEnter: string): QueueRewrite {
  return { steps: [ALT_UP, clearEditor(current), ...next.map(item => `${paste(item.text)}${item.mode === "followUp" ? altEnter : "\r"}`)] }
}

/** Claude shows this placeholder only while its editor is empty and messages
 *  are queued; any draft would be merged into the popped text. */
export function claudeQueueEditable(screen: string) {
  return /Press up to edit queued messages/.test(screen)
}

/** Pi draws its editor between two rule lines (the top one carries the
 *  working status) below the queue hint. The editor is empty when every row
 *  between them is blank. Without that certainty a restore would merge a
 *  draft into the queue, so the caller refuses. */
export function piEditorEmpty(screen: string) {
  const lines = screen.split("\n")
  const hint = lines.findLastIndex(line => /to edit all queued messages/.test(line))
  if (hint < 0) return false
  const rule = (line: string) => /^\s*──/.test(line)
  const top = lines.findIndex((line, index) => index > hint && rule(line))
  if (top < 0) return false
  const bottom = lines.findIndex((line, index) => index > top && rule(line))
  if (bottom < 0) return false
  return lines.slice(top + 1, bottom).every(line => !line.trim())
}
