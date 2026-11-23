// What the Pi chat view derives from polled inspection pages. Kept in sync with
// VibeGhost's lib/ui/pi-chat-state.ts.

export type PiInspectionState = {
  summary?: string
  reportedAgentPhase?: string
  pendingToolNames?: string[]
}

type PiChatTool = { status?: string }
type PiChatEvent = { id: string; role: string; tools?: PiChatTool[] }

/**
 * Phases in which Pi has told us its run is over (done, failed, or waiting on
 * the person). `idle` is not one: before the OSC 133 fix a running Pi could be
 * reported idle, so idle falls back to the transcript.
 */
const SETTLED_PHASES = new Set(["waiting", "error", "blocked"])

/**
 * Whether Chat should say "Pi is working".
 *
 * The phase Pi reports (OSC 7501 / its VibeGhost extension) is authoritative:
 * `working` means working, and a settled phase means the run is over even when
 * a tool row was never answered. Without a phase, only a tool still running in
 * the newest turn counts; tool rows in older turns or older transcript windows
 * are history, never current activity.
 */
export function piChatIsWorking(state: PiInspectionState | undefined, events: readonly PiChatEvent[]): boolean {
  const phase = state?.reportedAgentPhase
  if (phase === "working" || (!phase && state?.summary === "working")) return true
  if (phase && SETTLED_PHASES.has(phase)) return false
  if (state?.pendingToolNames?.length) return true
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.role === "user") return false
    if (event.role !== "assistant") continue
    if (event.tools?.length) return event.tools.some(tool => tool.status === "running")
    return false
  }
  return false
}

/**
 * Concatenated pages can repeat an event when the transcript grows between two
 * page reads. Keep the first copy of each id, in order.
 */
export function uniqueChatEvents<T extends { id: string }>(events: readonly T[]): T[] {
  const seen = new Set<string>()
  return events.filter(event => {
    if (seen.has(event.id)) return false
    seen.add(event.id)
    return true
  })
}

/**
 * Whether a failed transcript read should replace the conversation with an
 * error. Only the newest page decides whether Chat can show anything: an older
 * page that fails keeps what was read. A background poll that misses once (a
 * huge transcript, a slow host) keeps the conversation on screen; the error
 * shows when there is nothing to show yet or reads keep failing.
 */
export const PI_CHAT_FAILURES_BEFORE_ERROR = 3
export function piChatReadFailureShowsError(input: { pageIndex: number; shownEvents: number; consecutiveFailures: number }) {
  if (input.pageIndex > 0) return false
  return input.shownEvents === 0 || input.consecutiveFailures >= PI_CHAT_FAILURES_BEFORE_ERROR
}
