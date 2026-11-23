export type TerminalWheelDelta = {
  deltaY: number
  deltaMode: number
}

export const WHEEL_DELTA_PIXEL = 0
export const WHEEL_DELTA_LINE = 1
export const WHEEL_DELTA_PAGE = 2

export function terminalWheelDeltaLines(
  event: TerminalWheelDelta,
  options: { rowHeight: number; viewportRows: number }
) {
  if (!Number.isFinite(event.deltaY) || event.deltaY === 0) return 0

  if (event.deltaMode === WHEEL_DELTA_LINE) return event.deltaY
  if (event.deltaMode === WHEEL_DELTA_PAGE) {
    return event.deltaY * Math.max(1, options.viewportRows)
  }

  const rowHeight = Math.max(1, options.rowHeight)
  return event.deltaY / rowHeight
}

/**
 * Trackpads deliver momentum as a stream of small pixel deltas. Alternate-screen
 * terminal apps consume whole key rows, so retain the fractional remainder until
 * enough physical movement has accumulated instead of rounding every event to 0.
 */
export class TerminalWheelAccumulator {
  private remainder = 0

  consume(
    event: TerminalWheelDelta,
    options: { rowHeight: number; viewportRows: number }
  ) {
    this.remainder += terminalWheelDeltaLines(event, options)
    const lines =
      this.remainder >= 1 - 1e-9
        ? Math.floor(this.remainder + 1e-9)
        : this.remainder <= -1 + 1e-9
          ? Math.ceil(this.remainder - 1e-9)
          : 0
    if (lines === 0) return 0
    this.remainder -= lines
    return lines
  }

  reset() {
    this.remainder = 0
  }
}

export function terminalArrowSequence(lines: number) {
  if (!Number.isFinite(lines) || lines === 0) return ""
  const count = Math.min(128, Math.abs(Math.trunc(lines)))
  return (lines < 0 ? "\x1b[A" : "\x1b[B").repeat(count)
}

/** Negotiated VT wheel reports for our UTF-8 INPUT_TEXT transport. Do not send
 * arrows when a fullscreen app requests mouse input: they edit its prompt.
 * SGR is used by Claude's fullscreen renderer; legacy encodings are explicit.
 * Unrepresentable legacy byte coordinates are dropped, never guessed. */
export function terminalMouseWheelSequence(lines: number, options: {
  col: number; row: number
  sgr: boolean
  utf8?: boolean
  urxvt?: boolean
  shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean
}) {
  if (!Number.isFinite(lines) || !lines) return ""
  const { col, row } = options
  if (![col, row].every((value) => Number.isSafeInteger(value) && value > 0 && value <= 32767)) return ""
  const count = Math.min(128, Math.abs(Math.trunc(lines)))
  const button = (lines < 0 ? 64 : 65) |
    (options.shiftKey ? 4 : 0) | (options.altKey ? 8 : 0) | (options.ctrlKey ? 16 : 0)
  if (options.sgr) return `\x1b[<${button};${col};${row}M`.repeat(count)
  if (options.urxvt) return `\x1b[${button + 32};${col};${row}M`.repeat(count)
  // JS strings are UTF-8 encoded by transport. X10 only works for ASCII
  // coordinates; encoding a >127 code unit would silently send the wrong bytes.
  if (!options.utf8 && (col > 95 || row > 95)) return ""
  if (options.utf8 && (col > 2015 || row > 2015)) return ""
  return (`\x1b[M${String.fromCharCode(button + 32, col + 32, row + 32)}`).repeat(count)
}

type TouchPoint = { identifier: number; clientX: number; clientY: number }
type MouseModes = { cols: number; rows: number; getMode(mode: number): boolean }
type Rect = { left: number; top: number; width: number; height: number }

/** 1-based report cell (or SGR-pixel 1016 position) for a client point. */
export function terminalMousePoint(terminal: MouseModes, rect: Rect, clientX: number, clientY: number) {
  const pixels = terminal.getMode(1016)
  return {
    col: Math.max(1, Math.min(pixels ? Math.ceil(rect.width) : terminal.cols,
      Math.floor((clientX - rect.left) * (pixels ? 1 : terminal.cols / rect.width)) + 1)),
    row: Math.max(1, Math.min(pixels ? Math.ceil(rect.height) : terminal.rows,
      Math.floor((clientY - rect.top) * (pixels ? 1 : terminal.rows / rect.height)) + 1)),
  }
}

/**
 * Touch screens never emit wheel events. A fullscreen app that asked for mouse
 * reports (Claude Code's alternate-screen renderer) has no scrollback for the
 * native overlay to move, so a drag must become the wheel reports a desktop
 * wheel would send. Natural scrolling: finger down = wheel up (older content).
 */
export class TerminalTouchWheel {
  private identifier: number | undefined
  private lastY = 0
  private readonly accumulator = new TerminalWheelAccumulator()

  begin(touch: TouchPoint) {
    this.identifier = touch.identifier
    this.lastY = touch.clientY
    this.accumulator.reset()
  }

  /** Returns signed wheel lines (negative = up) since the last move. */
  move(touches: ArrayLike<TouchPoint>, options: { rowHeight: number; viewportRows: number }) {
    if (this.identifier === undefined || touches.length !== 1) return { lines: 0 }
    const touch = touches[0]
    if (touch.identifier !== this.identifier) return { lines: 0 }
    const deltaY = this.lastY - touch.clientY
    this.lastY = touch.clientY
    return { lines: this.accumulator.consume({ deltaY, deltaMode: WHEEL_DELTA_PIXEL }, options), touch }
  }

  end() {
    this.identifier = undefined
    this.accumulator.reset()
  }
}

/** Encodes a touch drag for a terminal with mouse tracking on, else "". */
export function terminalTouchWheelSequence(
  wheel: TerminalTouchWheel,
  touches: ArrayLike<TouchPoint>,
  terminal: MouseModes & { hasMouseTracking(): boolean },
  rect: Rect | undefined,
) {
  if (!terminal.hasMouseTracking() || !rect || rect.width <= 0 || rect.height <= 0 || terminal.rows <= 0) {
    wheel.end()
    return ""
  }
  const { lines, touch } = wheel.move(touches, { rowHeight: rect.height / terminal.rows, viewportRows: terminal.rows })
  if (!lines || !touch) return ""
  return terminalMouseWheelSequence(lines, {
    ...terminalMousePoint(terminal, rect, touch.clientX, touch.clientY),
    sgr: terminal.getMode(1006) || terminal.getMode(1016),
    utf8: terminal.getMode(1005),
    urxvt: terminal.getMode(1015),
  })
}
