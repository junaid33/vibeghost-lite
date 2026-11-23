// Browser restore output and raw cast storage have different byte costs: cast
// records contain JSON escaping and timestamps. Replay complete decoded output
// from the bounded cast window; Ghostty then evicts old rows at its own budget.
export const TERMINAL_RESTORE_OUTPUT_MAX_BYTES = 16 * 1024 * 1024
export const TERMINAL_CAST_REPLAY_MAX_BYTES = 16 * 1024 * 1024
export const TERMINAL_SERVER_CAST_REPLAY_MAX_BYTES = 16 * 1024 * 1024
export const TERMINAL_STDOUT_CACHE_MAX_BYTES = 16 * 1024 * 1024

// ghostty-web 0.4.0 exposes `scrollback` as an xterm-style line count, but passes
// the value directly to Ghostty's byte-based max_scrollback field. Keep this
// bounded because Mobile Safari shares the budget with decoded restore data and WASM.
export const TERMINAL_CLIENT_SCROLLBACK_BYTES = 16 * 1024 * 1024
export const TERMINAL_SERVER_SCROLLBACK_BYTES = 10 * 1024 * 1024

export const TERMINAL_WRITE_CHUNK_BYTES = 8 * 1024
export const TERMINAL_WRITE_FRAME_BUDGET_BYTES = 16 * 1024
export const TERMINAL_INPUT_CHUNK_BYTES = 8 * 1024

export function splitUint8Array(data: Uint8Array, maxChunkBytes: number): Uint8Array[] {
  if (maxChunkBytes <= 0) {
    throw new Error("maxChunkBytes must be greater than 0")
  }

  if (data.byteLength <= maxChunkBytes) return [data]

  const chunks: Uint8Array[] = []
  for (let offset = 0; offset < data.byteLength; offset += maxChunkBytes) {
    chunks.push(data.subarray(offset, Math.min(offset + maxChunkBytes, data.byteLength)))
  }
  return chunks
}

function isUtf8ContinuationByte(byte: number): boolean {
  return (byte & 0xc0) === 0x80
}

export function trimUtf8ToMaxBytes(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return ""

  const encoder = new TextEncoder()
  const bytes = encoder.encode(text)
  if (bytes.byteLength <= maxBytes) return text

  let start = bytes.byteLength - maxBytes
  while (start < bytes.byteLength && isUtf8ContinuationByte(bytes[start])) {
    start += 1
  }

  return new TextDecoder().decode(bytes.subarray(start))
}

export function splitTextByUtf8Bytes(text: string, maxChunkBytes: number): string[] {
  if (maxChunkBytes <= 0) {
    throw new Error("maxChunkBytes must be greater than 0")
  }

  if (!text) return []

  const encoder = new TextEncoder()
  const chunks: string[] = []
  let current = ""
  let currentBytes = 0

  for (const char of text) {
    const charBytes = encoder.encode(char).byteLength

    if (current && currentBytes + charBytes > maxChunkBytes) {
      chunks.push(current)
      current = ""
      currentBytes = 0
    }

    current += char
    currentBytes += charBytes
  }

  if (current) chunks.push(current)
  return chunks
}
