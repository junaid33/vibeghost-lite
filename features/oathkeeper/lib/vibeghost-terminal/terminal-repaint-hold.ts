/**
 * Full-transcript repaints inside live terminal output.
 *
 * Pi (and other TUIs that keep their transcript in normal scrollback) cannot
 * patch a row that has already scrolled out of the window. When such a row
 * changes, or the PTY is resized, they clear the screen and the scrollback
 * (CSI 2J, CSI H, CSI 3J) and write the whole transcript again, inside one
 * synchronized update (DEC mode 2026). For a long session that is megabytes on
 * every repaint. Drawn as it arrives, the view jumps to the oldest history and
 * scrolls through all of it again before it is back at the latest output.
 *
 * A synchronized update is meant to be shown only once it is complete. The
 * scanner finds a scrollback clear inside one; the hold keeps the last painted
 * frame until the update ends, so the view stays where it was.
 */

const ESC = 0x1b
const SYNC_BEGIN = bytesOf("\x1b[?2026h")
const SYNC_END = bytesOf("\x1b[?2026l")
const CLEAR_SCROLLBACK = bytesOf("\x1b[3J")
// The longest marker minus one: what a marker cut across two chunks can leave behind.
const MAX_CARRY_BYTES = SYNC_BEGIN.byteLength - 1

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function matchAt(bytes: Uint8Array, index: number, marker: Uint8Array): "full" | "partial" | "none" {
  for (let offset = 0; offset < marker.byteLength; offset += 1) {
    if (index + offset >= bytes.byteLength) return "partial"
    if (bytes[index + offset] !== marker[offset]) return "none"
  }
  return "full"
}

/** Streaming: tells whether the output is inside a full repaint after each chunk. */
export class TerminalRepaintScanner {
  private carry: Uint8Array | null = null
  private synchronized = false
  private repainting = false
  private startedInLastPush = false

  /** Whether a repaint began inside the last pushed chunk, even if it also ended there. */
  get started(): boolean {
    return this.startedInLastPush
  }

  /** True from a scrollback clear inside a synchronized update until that update ends. */
  get active(): boolean {
    return this.repainting
  }

  reset() {
    this.carry = null
    this.synchronized = false
    this.repainting = false
    this.startedInLastPush = false
  }

  push(chunk: Uint8Array): boolean {
    this.startedInLastPush = false
    let bytes = chunk
    if (this.carry) {
      const joined = new Uint8Array(this.carry.byteLength + chunk.byteLength)
      joined.set(this.carry)
      joined.set(chunk, this.carry.byteLength)
      bytes = joined
      this.carry = null
    }

    let index = bytes.indexOf(ESC)
    while (index !== -1) {
      const begin = matchAt(bytes, index, SYNC_BEGIN)
      const end = begin === "full" ? "none" : matchAt(bytes, index, SYNC_END)
      const clear = begin === "full" || end === "full" ? "none" : matchAt(bytes, index, CLEAR_SCROLLBACK)
      if (begin === "full") {
        this.synchronized = true
      } else if (end === "full") {
        this.synchronized = false
        this.repainting = false
      } else if (clear === "full") {
        if (this.synchronized) {
          this.repainting = true
          this.startedInLastPush = true
        }
      } else if (begin === "partial" || end === "partial" || clear === "partial") {
        // Cut at the end of this chunk: decide once the rest arrives.
        if (bytes.byteLength - index <= MAX_CARRY_BYTES) this.carry = bytes.slice(index)
        break
      }
      index = bytes.indexOf(ESC, index + 1)
    }
    return this.repainting
  }
}

type TerminalRepaintHoldOptions = {
  /** Freeze the visible frame. */
  begin: () => void
  /** Show the terminal again, at its final state. */
  end: (reason: "complete" | "timeout" | "cancelled") => void
  /** A repaint that never ends must not freeze the terminal for good. */
  maxHoldMs?: number
  /**
   * A repaint that begins and ends inside one chunk is still drawn over many
   * frames when the chunk is larger than this (the write queue's frame budget).
   */
  wholeChunkHoldBytes?: number
  schedule?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>
  cancel?: (timer: ReturnType<typeof setTimeout>) => void
}

export const TERMINAL_REPAINT_MAX_HOLD_MS = 15_000

/** Owns one hold at a time, with a deadline. */
export class TerminalRepaintHold {
  private readonly scanner = new TerminalRepaintScanner()
  private holding = false
  // After a deadline release, the rest of that same repaint is shown as it arrives.
  private expired = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly maxHoldMs: number
  private readonly wholeChunkHoldBytes: number
  private readonly schedule: NonNullable<TerminalRepaintHoldOptions["schedule"]>
  private readonly cancelTimer: NonNullable<TerminalRepaintHoldOptions["cancel"]>

  private readonly options: TerminalRepaintHoldOptions

  constructor(options: TerminalRepaintHoldOptions) {
    this.options = options
    this.maxHoldMs = options.maxHoldMs ?? TERMINAL_REPAINT_MAX_HOLD_MS
    this.wholeChunkHoldBytes = options.wholeChunkHoldBytes ?? 16 * 1024
    this.schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs))
    this.cancelTimer = options.cancel ?? ((timer) => clearTimeout(timer))
  }

  get active(): boolean {
    return this.holding
  }

  /**
   * Call with live output before it is queued for the terminal. Returns true
   * when the repaint ends inside these bytes: the caller then calls
   * `release()` once the terminal has processed them.
   */
  observe(bytes: Uint8Array): boolean {
    const repainting = this.scanner.push(bytes)
    if (!repainting) {
      this.expired = false
      // Began and ended in this chunk, but too large to draw in one frame.
      if (!this.holding && this.scanner.started && bytes.byteLength > this.wholeChunkHoldBytes) this.start()
      return this.holding
    }
    if (!this.holding && !this.expired) this.start()
    return false
  }

  private start() {
    this.holding = true
    this.timer = this.schedule(() => {
      this.timer = null
      this.expired = true
      this.finish("timeout")
    }, this.maxHoldMs)
    this.options.begin()
  }

  release() {
    this.finish("complete")
  }

  /** The buffer is being replaced (snapshot replay) or the terminal is going away. */
  cancel() {
    this.scanner.reset()
    this.expired = false
    this.finish("cancelled")
  }

  private finish(reason: "complete" | "timeout" | "cancelled") {
    if (this.timer !== null) {
      this.cancelTimer(this.timer)
      this.timer = null
    }
    if (!this.holding) return
    this.holding = false
    this.options.end(reason)
  }
}
