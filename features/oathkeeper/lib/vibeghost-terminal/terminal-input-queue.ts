export type PacedTerminalInputQueueTransport = {
  sendText: (sessionId: string, text: string) => boolean
  isConnected: () => boolean
  generation: () => number
}

export type PacedTerminalInputOptions = {
  bracketed?: boolean
  chunkBytes: number
  delayMs: number
}

export class PacedTerminalInputQueueFullError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PacedTerminalInputQueueFullError"
  }
}

const DEFAULT_MAX_QUEUED_TASKS = 8
const DEFAULT_MAX_QUEUED_BYTES = 8 * 1024 * 1024

function abortableDelay(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, delayMs)
    const onAbort = () => {
      clearTimeout(timeout)
      reject(signal.reason)
    }
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

async function sendUtf8Chunks(
  text: string,
  maxChunkBytes: number,
  delayMs: number,
  signal: AbortSignal,
  sendChunk: (chunk: string) => boolean,
): Promise<void> {
  if (maxChunkBytes <= 0) throw new Error("maxChunkBytes must be greater than 0")

  const encoder = new TextEncoder()
  let current = ""
  let currentBytes = 0
  const flush = async () => {
    if (!current) return
    if (signal.aborted) throw signal.reason
    const chunk = current
    current = ""
    currentBytes = 0
    if (!sendChunk(chunk)) throw new Error("Terminal transport disconnected")
    if (delayMs > 0) await abortableDelay(delayMs, signal)
  }

  for (const char of text) {
    if (signal.aborted) throw signal.reason
    const charBytes = encoder.encode(char).byteLength
    if (current && currentBytes + charBytes > maxChunkBytes) await flush()
    current += char
    currentBytes += charBytes
  }

  if (current) {
    if (signal.aborted) throw signal.reason
    if (!sendChunk(current)) throw new Error("Terminal transport disconnected")
  }
}

/** Owns and cancels paced large-input tasks for one mounted terminal session. */
export class PacedTerminalInputQueue {
  private epoch = 0
  private tail: Promise<void> = Promise.resolve()
  private activeController: AbortController | null = null
  private disposed = false
  private queuedTasks = 0
  private queuedBytes = 0

  constructor(
    private readonly transport: PacedTerminalInputQueueTransport,
    private readonly limits: { maxTasks?: number; maxBytes?: number } = {},
  ) {}

  enqueue(
    sessionId: string,
    text: string,
    options: PacedTerminalInputOptions,
  ): Promise<boolean> {
    if (this.disposed || !text) return Promise.resolve(false)
    const taskBytes = new TextEncoder().encode(text).byteLength
    const maxTasks = this.limits.maxTasks ?? DEFAULT_MAX_QUEUED_TASKS
    const maxBytes = this.limits.maxBytes ?? DEFAULT_MAX_QUEUED_BYTES
    if (this.queuedTasks >= maxTasks || this.queuedBytes + taskBytes > maxBytes) {
      return Promise.reject(new PacedTerminalInputQueueFullError(
        `Terminal input queue is full (${this.queuedTasks}/${maxTasks} tasks, ${this.queuedBytes}/${maxBytes} bytes)`,
      ))
    }
    this.queuedTasks += 1
    this.queuedBytes += taskBytes
    const taskEpoch = this.epoch

    const run = async (): Promise<boolean> => {
      if (this.disposed || taskEpoch !== this.epoch || !this.transport.isConnected()) return false
      const controller = new AbortController()
      this.activeController = controller
      const transportGeneration = this.transport.generation()
      let bracketOpened = false

      try {
        if (options.bracketed) {
          bracketOpened = this.transport.sendText(sessionId, "\x1b[200~")
          if (!bracketOpened) return false
        }

        await sendUtf8Chunks(
          text,
          options.chunkBytes,
          options.delayMs,
          controller.signal,
          (chunk) => {
            if (
              this.disposed ||
              taskEpoch !== this.epoch ||
              !this.transport.isConnected() ||
              this.transport.generation() !== transportGeneration
            ) return false
            return this.transport.sendText(sessionId, chunk)
          },
        )
        return true
      } catch (error) {
        if (!controller.signal.aborted) throw error
        return false
      } finally {
        // If cancellation happened while the same transport is still alive, close
        // bracketed paste on the old session before releasing ownership. Never
        // retain/replay the terminator across a transport generation.
        if (
          bracketOpened &&
          this.transport.isConnected() &&
          this.transport.generation() === transportGeneration
        ) {
          this.transport.sendText(sessionId, "\x1b[201~")
        }
        if (this.activeController === controller) this.activeController = null
      }
    }

    const result = this.tail.then(run, run)
    const tracked = result.finally(() => {
      this.queuedTasks = Math.max(0, this.queuedTasks - 1)
      this.queuedBytes = Math.max(0, this.queuedBytes - taskBytes)
    })
    this.tail = tracked.then(() => undefined, () => undefined)
    return tracked
  }

  cancel(reason = "Terminal input task cancelled"): void {
    this.epoch += 1
    this.activeController?.abort(new DOMException(reason, "AbortError"))
    this.activeController = null
    this.tail = Promise.resolve()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.cancel("Terminal input queue disposed")
  }
}
