/**
 * PTY size marks inside served terminal output.
 *
 * A cast replays correctly only at the size each byte was written for. Claude
 * Code moves between words with absolute column jumps (CSI n G) and never
 * clears scrollback, so a history written at 121 columns and replayed into a
 * 63-column terminal clamps every jump to the right margin and overwrites text.
 * The server marks each size change with a private OSC that terminals ignore;
 * a client that understands it replays history at the recorded sizes and then
 * fits the result to its own view, like a real terminal reflowing on resize.
 */
export type TerminalSize = { cols: number; rows: number }

export type TerminalSizeMarkerPart =
  | { kind: "output"; bytes: Uint8Array }
  | { kind: "size"; size: TerminalSize }

const PREFIX = "\x1b]7502;size="
const PREFIX_BYTES = new TextEncoder().encode(PREFIX)
const BEL = 0x07
const ESC = 0x1b
// The server resize route's range; a mark is also printable by any program,
// so a larger one is treated as plain output rather than allocated.
const MAX_DIMENSION = 1000
// "1000x1000" plus the terminator.
const MAX_MARKER_BYTES = PREFIX_BYTES.byteLength + 10

export function encodeTerminalSizeMarker(size: TerminalSize): string {
  return `${PREFIX}${size.cols}x${size.rows}\x07`
}

/** Parses the asciinema "COLSxROWS" form; null for anything else. */
export function parseTerminalDimensions(value: string): TerminalSize | null {
  const match = /^(\d{1,4})x(\d{1,4})$/.exec(value)
  if (!match) return null
  const cols = Number(match[1])
  const rows = Number(match[2])
  if (cols < 1 || rows < 1 || cols > MAX_DIMENSION || rows > MAX_DIMENSION) return null
  return { cols, rows }
}

export function sameTerminalSize(a: TerminalSize | null | undefined, b: TerminalSize | null | undefined): boolean {
  return Boolean(a && b && a.cols === b.cols && a.rows === b.rows)
}

/** Output drawn for `pty` garbles in `terminal` only when the PTY is wider or
 * taller: absolute and relative cursor moves then clamp at the margins. */
export function terminalSizeGarbles(pty: TerminalSize, terminal: TerminalSize): boolean {
  return pty.cols > terminal.cols || pty.rows > terminal.rows
}

/** How many leading bytes of `bytes` (from `start`) match the marker prefix. */
function prefixMatch(bytes: Uint8Array, start: number): number {
  let matched = 0
  while (matched < PREFIX_BYTES.byteLength && start + matched < bytes.byteLength) {
    if (bytes[start + matched] !== PREFIX_BYTES[matched]) return -1
    matched += 1
  }
  return matched
}

/**
 * Splits output into bytes and size marks. Streaming: a marker cut across
 * chunks is held back (at most one marker's length) until it completes.
 */
export class TerminalSizeMarkerParser {
  private pending: Uint8Array | null = null

  reset() {
    this.pending = null
  }

  push(chunk: Uint8Array): TerminalSizeMarkerPart[] {
    let bytes = chunk
    if (this.pending) {
      const joined = new Uint8Array(this.pending.byteLength + chunk.byteLength)
      joined.set(this.pending)
      joined.set(chunk, this.pending.byteLength)
      bytes = joined
      this.pending = null
    }
    const parts: TerminalSizeMarkerPart[] = []
    let outputStart = 0
    let index = bytes.indexOf(ESC)
    while (index !== -1) {
      const matched = prefixMatch(bytes, index)
      if (matched === -1) {
        index = bytes.indexOf(ESC, index + 1)
        continue
      }
      const end = matched < PREFIX_BYTES.byteLength
        ? -1
        : bytes.subarray(index + matched, index + MAX_MARKER_BYTES).indexOf(BEL)
      if (end === -1) {
        // Incomplete at the end of this chunk: wait for the rest.
        if (bytes.byteLength - index < MAX_MARKER_BYTES) {
          if (index > outputStart) parts.push({ kind: "output", bytes: bytes.subarray(outputStart, index) })
          this.pending = bytes.slice(index)
          return parts
        }
        index = bytes.indexOf(ESC, index + 1)
        continue
      }
      const markerEnd = index + matched + end + 1
      const size = parseTerminalDimensions(new TextDecoder().decode(bytes.subarray(index + matched, markerEnd - 1)))
      if (!size) {
        index = bytes.indexOf(ESC, index + 1)
        continue
      }
      if (index > outputStart) parts.push({ kind: "output", bytes: bytes.subarray(outputStart, index) })
      parts.push({ kind: "size", size })
      outputStart = markerEnd
      index = bytes.indexOf(ESC, markerEnd)
    }
    if (outputStart < bytes.byteLength) parts.push({ kind: "output", bytes: bytes.subarray(outputStart) })
    return parts
  }

  /** Releases a held-back incomplete marker as plain output. */
  flush(): TerminalSizeMarkerPart[] {
    const pending = this.pending
    this.pending = null
    return pending ? [{ kind: "output", bytes: pending }] : []
  }
}

/** Splits a complete buffer (a snapshot or a cached checkpoint). */
export function splitTerminalSizeMarkers(bytes: Uint8Array): TerminalSizeMarkerPart[] {
  const parser = new TerminalSizeMarkerParser()
  return [...parser.push(bytes), ...parser.flush()]
}

/** The last complete marker in `text`, verbatim, if any. */
export function lastTerminalSizeMarkerText(text: string): string | null {
  let last: string | null = null
  for (const match of text.matchAll(/\x1b\]7502;size=(\d{1,4}x\d{1,4})\x07/g)) {
    if (parseTerminalDimensions(match[1])) last = match[0]
  }
  return last
}

/**
 * Keeps the newest output within `maxBytes` (via `trim`, which keeps a UTF-8
 * safe tail). When the cut drops size marks, the size in effect at the cut is
 * marked again at the head, or the kept head would replay at the wrong size.
 */
export function trimSizeMarkedOutput(text: string, maxBytes: number, trim: (text: string, maxBytes: number) => string): string {
  const tail = trim(text, maxBytes)
  if (tail === text) return tail
  const carried = lastTerminalSizeMarkerText(text.slice(0, text.length - tail.length))
  if (!carried) return tail
  return carried + trim(text, maxBytes - new TextEncoder().encode(carried).byteLength)
}

/** The last size a complete buffer records, if any. */
export function lastTerminalSizeMarker(bytes: Uint8Array): TerminalSize | null {
  let last: TerminalSize | null = null
  for (const part of splitTerminalSizeMarkers(bytes)) if (part.kind === "size") last = part.size
  return last
}

/**
 * Tracks the PTY size behind live output that is written at the client's own
 * size. Output drawn for a larger PTY (another device owns the size) garbles
 * in this terminal; once the PTY returns to this terminal's size, the caller
 * must replay an authoritative snapshot to repair the buffer.
 */
export class TerminalPtySizeTracker {
  private readonly parser = new TerminalSizeMarkerParser()
  private ptySize: TerminalSize | null = null
  private garbled = false

  get size(): TerminalSize | null {
    return this.ptySize
  }

  /** Starts a new stream position, e.g. at a bootstrap cutover. */
  reset(size: TerminalSize | null) {
    this.parser.reset()
    this.ptySize = size
    this.garbled = false
  }

  /** Returns live output without marks, and `resync` when the buffer holds
   * garbled output that a snapshot replay can now repair. */
  live(bytes: Uint8Array, terminal: TerminalSize): { output: Uint8Array; resync: boolean } {
    const outputs: Uint8Array[] = []
    let resync = false
    for (const part of this.parser.push(bytes)) {
      if (part.kind === "size") {
        this.ptySize = part.size
        if (this.garbled && sameTerminalSize(part.size, terminal)) {
          this.garbled = false
          resync = true
        }
        continue
      }
      if (part.bytes.byteLength === 0) continue
      if (this.ptySize && terminalSizeGarbles(this.ptySize, terminal)) this.garbled = true
      outputs.push(part.bytes)
    }
    if (outputs.length <= 1) return { output: outputs[0] ?? new Uint8Array(), resync }
    const total = outputs.reduce((sum, chunk) => sum + chunk.byteLength, 0)
    const output = new Uint8Array(total)
    let offset = 0
    for (const chunk of outputs) {
      output.set(chunk, offset)
      offset += chunk.byteLength
    }
    return { output, resync }
  }
}
