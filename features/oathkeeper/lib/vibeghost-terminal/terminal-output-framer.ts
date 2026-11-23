const DEFAULT_MAX_PENDING_BYTES = 2 * 1024 * 1024
const MIN_DEDUPLICATION_OVERLAP_BYTES = 32

/** Largest suffix/prefix byte overlap using bounded auxiliary memory. */
export function findTerminalOutputOverlap(
  bootstrapBytes: Uint8Array,
  liveBytes: Uint8Array,
): number {
  const maximumLength = Math.min(bootstrapBytes.byteLength, liveBytes.byteLength)
  if (maximumLength === 0) return 0

  const bases = [16777619, 2246822519] as const
  let prefixA = 0
  let prefixB = 0
  let suffixA = 0
  let suffixB = 0
  let powerA = 1
  let powerB = 1
  let candidate = 0

  for (let length = 1; length <= maximumLength; length += 1) {
    const liveByte = liveBytes[length - 1]
    const bootstrapByte = bootstrapBytes[bootstrapBytes.byteLength - length]
    prefixA = (Math.imul(prefixA, bases[0]) + liveByte) >>> 0
    prefixB = (Math.imul(prefixB, bases[1]) + liveByte) >>> 0
    suffixA = (Math.imul(bootstrapByte, powerA) + suffixA) >>> 0
    suffixB = (Math.imul(bootstrapByte, powerB) + suffixB) >>> 0
    powerA = Math.imul(powerA, bases[0]) >>> 0
    powerB = Math.imul(powerB, bases[1]) >>> 0
    if (prefixA === suffixA && prefixB === suffixB) candidate = length
  }

  // Short terminal fragments (prompts, spaces, newlines, SGR resets) repeat naturally.
  // Treating those as transport duplicates silently deletes legitimate output.
  if (candidate < MIN_DEDUPLICATION_OVERLAP_BYTES) return 0
  const bootstrapStart = bootstrapBytes.byteLength - candidate
  for (let index = 0; index < candidate; index += 1) {
    if (bootstrapBytes[bootstrapStart + index] !== liveBytes[index]) return 0
  }
  return candidate
}

function incompleteUtf8Start(bytes: Uint8Array, start: number): number {
  if (start >= bytes.byteLength) return bytes.byteLength

  let lead = bytes.byteLength - 1
  let continuationBytes = 0
  while (lead >= start && (bytes[lead] & 0xc0) === 0x80 && continuationBytes < 3) {
    continuationBytes += 1
    lead -= 1
  }

  if (lead < start) return bytes.byteLength

  const first = bytes[lead]
  const expectedLength =
    first >= 0xc2 && first <= 0xdf ? 2 :
      first >= 0xe0 && first <= 0xef ? 3 :
        first >= 0xf0 && first <= 0xf4 ? 4 : 1

  return expectedLength > bytes.byteLength - lead ? lead : bytes.byteLength
}

/**
 * Find the largest prefix that ends on both a UTF-8 and ANSI control-sequence
 * boundary. Complete prefixes can be decoded and rewritten without corrupting a
 * sequence split across WebSocket/cast chunks.
 */
export function findCompleteTerminalOutputEnd(bytes: Uint8Array): number {
  let index = 0
  let plainTextStart = 0

  while (index < bytes.byteLength) {
    if (bytes[index] !== 0x1b) {
      index += 1
      continue
    }

    // An ESC byte proves the preceding text was not truncated in the middle of a
    // valid UTF-8 code point. Invalid input is intentionally left to TextDecoder's
    // replacement behavior rather than retained forever.
    plainTextStart = index + 1
    if (index + 1 >= bytes.byteLength) return index

    const introducer = bytes[index + 1]
    if (introducer === 0x5b) {
      // CSI: ESC [ parameters/intermediates final-byte
      let cursor = index + 2
      while (cursor < bytes.byteLength) {
        const byte = bytes[cursor]
        if (byte >= 0x40 && byte <= 0x7e) {
          index = cursor + 1
          plainTextStart = index
          break
        }
        if (byte < 0x20 || byte > 0x3f) {
          // Invalid CSI. Emit the ESC introducer and let the terminal parser
          // decide how to recover from the following byte.
          index += 2
          plainTextStart = index
          break
        }
        cursor += 1
      }
      if (cursor >= bytes.byteLength) return index
      continue
    }

    const isOsc = introducer === 0x5d
    const isStringControl =
      introducer === 0x50 || // DCS
      introducer === 0x58 || // SOS
      introducer === 0x5e || // PM
      introducer === 0x5f // APC

    if (isOsc || isStringControl) {
      let cursor = index + 2
      let complete = false
      while (cursor < bytes.byteLength) {
        if (isOsc && bytes[cursor] === 0x07) {
          index = cursor + 1
          plainTextStart = index
          complete = true
          break
        }
        if (
          bytes[cursor] === 0x1b &&
          cursor + 1 < bytes.byteLength &&
          bytes[cursor + 1] === 0x5c
        ) {
          index = cursor + 2
          plainTextStart = index
          complete = true
          break
        }
        cursor += 1
      }
      if (!complete) return index
      continue
    }

    // Other ESC controls are two-byte sequences.
    index += 2
    plainTextStart = index
  }

  return incompleteUtf8Start(bytes, plainTextStart)
}

type PendingControlState =
  | { mode: "esc" }
  | { mode: "csi" }
  | { mode: "osc" | "string"; sawEsc: boolean }

function combineOutputParts(parts: Uint8Array[]): Uint8Array {
  const nonEmpty = parts.filter((part) => part.byteLength > 0)
  if (nonEmpty.length === 0) return new Uint8Array()
  if (nonEmpty.length === 1) return nonEmpty[0]
  const size = nonEmpty.reduce((total, part) => total + part.byteLength, 0)
  const combined = new Uint8Array(size)
  let offset = 0
  for (const part of nonEmpty) {
    combined.set(part, offset)
    offset += part.byteLength
  }
  return combined
}

/** Buffers only a trailing partial UTF-8/ANSI sequence between transport chunks. */
export class TerminalOutputFramer {
  private pendingBuffer = new Uint8Array()
  private pendingLength = 0
  private pendingKind: "utf8" | "control" | null = null
  private controlState: PendingControlState | null = null
  private totalScannedBytes = 0

  constructor(private readonly maxPendingBytes = DEFAULT_MAX_PENDING_BYTES) {}

  push(bytes: Uint8Array): Uint8Array {
    if (bytes.byteLength === 0) return bytes

    if (this.pendingKind === "utf8") {
      const prefix = this.copyPending()
      this.clearPending()
      return this.processFresh(combineOutputParts([prefix, bytes]))
    }

    if (this.pendingKind === "control" && this.controlState) {
      return this.continueControl(bytes)
    }

    return this.processFresh(bytes)
  }

  private processFresh(bytes: Uint8Array): Uint8Array {
    let index = 0
    let plainTextStart = 0

    while (index < bytes.byteLength) {
      this.totalScannedBytes += 1
      if (bytes[index] !== 0x1b) {
        index += 1
        continue
      }

      plainTextStart = index + 1
      if (index + 1 >= bytes.byteLength) {
        if (!this.storePending(bytes.subarray(index), "control", { mode: "esc" })) return bytes
        return bytes.subarray(0, index)
      }

      const introducer = bytes[index + 1]
      this.totalScannedBytes += 1
      if (introducer === 0x5b) {
        let cursor = index + 2
        while (cursor < bytes.byteLength) {
          this.totalScannedBytes += 1
          const byte = bytes[cursor]
          if (byte >= 0x40 && byte <= 0x7e) {
            index = cursor + 1
            plainTextStart = index
            break
          }
          if (byte < 0x20 || byte > 0x3f) {
            index += 2
            plainTextStart = index
            break
          }
          cursor += 1
        }
        if (cursor >= bytes.byteLength) {
          if (!this.storePending(bytes.subarray(index), "control", { mode: "csi" })) return bytes
          return bytes.subarray(0, index)
        }
        continue
      }

      const isOsc = introducer === 0x5d
      const isStringControl =
        introducer === 0x50 || introducer === 0x58 ||
        introducer === 0x5e || introducer === 0x5f
      if (isOsc || isStringControl) {
        let cursor = index + 2
        let complete = false
        let sawEsc = false
        while (cursor < bytes.byteLength) {
          this.totalScannedBytes += 1
          const byte = bytes[cursor]
          if (isOsc && byte === 0x07) {
            index = cursor + 1
            plainTextStart = index
            complete = true
            break
          }
          if (sawEsc && byte === 0x5c) {
            index = cursor + 1
            plainTextStart = index
            complete = true
            break
          }
          sawEsc = byte === 0x1b
          cursor += 1
        }
        if (!complete) {
          const state: PendingControlState = {
            mode: isOsc ? "osc" : "string",
            sawEsc,
          }
          if (!this.storePending(bytes.subarray(index), "control", state)) return bytes
          return bytes.subarray(0, index)
        }
        continue
      }

      index += 2
      plainTextStart = index
    }

    const completeEnd = incompleteUtf8Start(bytes, plainTextStart)
    if (completeEnd < bytes.byteLength) {
      if (!this.storePending(bytes.subarray(completeEnd), "utf8", null)) return bytes
      return bytes.subarray(0, completeEnd)
    }
    return bytes
  }

  private continueControl(bytes: Uint8Array): Uint8Array {
    const state = this.controlState as PendingControlState
    let completionIndex = -1

    for (let index = 0; index < bytes.byteLength; index += 1) {
      this.totalScannedBytes += 1
      const byte = bytes[index]
      if (state.mode === "esc") {
        if (byte === 0x5b) this.controlState = { mode: "csi" }
        else if (byte === 0x5d) this.controlState = { mode: "osc", sawEsc: false }
        else if (byte === 0x50 || byte === 0x58 || byte === 0x5e || byte === 0x5f) {
          this.controlState = { mode: "string", sawEsc: false }
        } else completionIndex = index
      } else if (state.mode === "csi") {
        if ((byte >= 0x40 && byte <= 0x7e) || byte < 0x20 || byte > 0x3f) {
          completionIndex = index
        }
      } else {
        if ((state.mode === "osc" && byte === 0x07) || (state.sawEsc && byte === 0x5c)) {
          completionIndex = index
        } else {
          state.sawEsc = byte === 0x1b
        }
      }

      if (completionIndex !== -1) break
      // The ESC branch replaces controlState with a new object; continue against it.
      if (state.mode === "esc" && this.controlState !== state) {
        return this.continueControlFromTransition(bytes, index + 1)
      }
    }

    if (completionIndex === -1) {
      if (this.pendingLength + bytes.byteLength > this.maxPendingBytes) {
        const output = combineOutputParts([this.copyPending(), bytes])
        this.clearPending()
        return output
      }
      this.appendPending(bytes)
      return new Uint8Array()
    }

    return this.finishControl(bytes, completionIndex)
  }

  private continueControlFromTransition(bytes: Uint8Array, start: number): Uint8Array {
    const prefix = bytes.subarray(0, start)
    this.appendPending(prefix)
    if (start >= bytes.byteLength) return new Uint8Array()
    return this.continueControl(bytes.subarray(start))
  }

  private finishControl(bytes: Uint8Array, completionIndex: number): Uint8Array {
    const completed = combineOutputParts([
      this.copyPending(),
      bytes.subarray(0, completionIndex + 1),
    ])
    const remainder = bytes.subarray(completionIndex + 1)
    this.clearPending()
    return remainder.byteLength > 0
      ? combineOutputParts([completed, this.processFresh(remainder)])
      : completed
  }

  private storePending(
    bytes: Uint8Array,
    kind: "utf8" | "control",
    state: PendingControlState | null,
  ): boolean {
    if (bytes.byteLength > this.maxPendingBytes) return false
    this.clearPending()
    this.pendingKind = kind
    this.controlState = state
    this.appendPending(bytes)
    return true
  }

  private appendPending(bytes: Uint8Array): void {
    if (bytes.byteLength === 0) return
    const required = this.pendingLength + bytes.byteLength
    if (this.pendingBuffer.byteLength < required) {
      let capacity = Math.max(16, this.pendingBuffer.byteLength || 16)
      while (capacity < required) capacity = Math.min(this.maxPendingBytes, capacity * 2)
      if (capacity < required) capacity = required
      const next = new Uint8Array(capacity)
      next.set(this.pendingBuffer.subarray(0, this.pendingLength))
      this.pendingBuffer = next
    }
    this.pendingBuffer.set(bytes, this.pendingLength)
    this.pendingLength = required
  }

  private copyPending(): Uint8Array {
    const copy = new Uint8Array(this.pendingLength)
    copy.set(this.pendingBuffer.subarray(0, this.pendingLength))
    return copy
  }

  private clearPending(): void {
    this.pendingBuffer = new Uint8Array()
    this.pendingLength = 0
    this.pendingKind = null
    this.controlState = null
  }

  reset(): void {
    this.clearPending()
  }

  get pendingBytes(): number {
    return this.pendingLength
  }

  /** Diagnostic hook used to prove unterminated controls are scanned incrementally. */
  get scannedBytes(): number {
    return this.totalScannedBytes
  }
}
