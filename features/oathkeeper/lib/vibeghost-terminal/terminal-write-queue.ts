import {
  splitUint8Array,
  TERMINAL_RESTORE_OUTPUT_MAX_BYTES,
  TERMINAL_WRITE_CHUNK_BYTES,
  TERMINAL_WRITE_FRAME_BUDGET_BYTES,
} from "./terminal-output-limits"

export type TerminalWriteTarget = {
  wasmTerm?: {
    write: (data: Uint8Array) => void
    readResponse?: () => string | null
  } | null
  processTerminalResponses?: () => void
  getViewportY: () => number
  getScrollbackLength: () => number
  scrollToLine: (line: number) => void
  /** Wake ghostty-web's event-driven renderer after a direct WASM write. */
  requestRender?: () => void
}

type FrameScheduler = {
  requestFrame: (callback: () => void) => number
  cancelFrame: (id: number) => void
  requestFallback: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>
  cancelFallback: (id: ReturnType<typeof setTimeout>) => void
}

type WriteBarrier = {
  targetChunkCount: number
  resolve: () => void
}

type QueuedWrite = {
  data: Uint8Array
  terminalResponses: "emit" | "discard"
  // Packing/retrying must retain enqueue accounting used by restore barriers.
  logicalChunkCount: number
  storage?: Uint8Array
  /** Runs in order with writes, e.g. a resize between replayed segments. */
  action?: () => void
}

export type TerminalWriteQueueMetrics = {
  queuedBytes: number
  queuedChunks: number
  enqueuedChunks: number
  completedChunks: number
  continuityValid: boolean
}

export type TerminalWriteContinuityLoss = {
  reason: "overflow" | "write-failed" | "terminal-unavailable"
  metrics: TerminalWriteQueueMetrics
  error?: unknown
}

type SafeTerminalWriteQueueOptions = Partial<FrameScheduler> & {
  maxQueuedBytes?: number
  maxQueuedChunks?: number
  fallbackDelayMs?: number
  onContinuityLost?: (event: TerminalWriteContinuityLoss) => void
  now?: () => number
}

const defaultScheduler: FrameScheduler = {
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
  requestFallback: (callback, delayMs) => setTimeout(callback, delayMs),
  cancelFallback: (id) => clearTimeout(id),
}

const DEFAULT_MAX_QUEUED_BYTES = TERMINAL_RESTORE_OUTPUT_MAX_BYTES
const DEFAULT_MAX_QUEUED_CHUNKS = 1024
const DEFAULT_FALLBACK_DELAY_MS = 100

/** Serializes terminal writes and exposes barriers for deterministic restoration. */
export class SafeTerminalWriteQueue {
  private queue: QueuedWrite[] = []
  private queuedBytes = 0
  private isProcessing = false
  private terminal: TerminalWriteTarget | null = null
  private frameId: number | null = null
  private fallbackId: ReturnType<typeof setTimeout> | null = null
  private retryId: ReturnType<typeof setTimeout> | null = null
  private disposed = false
  private retryCount = 0
  private continuityValid = true
  private continuityLossNotified = false
  private viewportStateProvider: (() => {
    preserveViewport: boolean
    viewportY: number
    scrollbackLength: number
  }) | null = null
  private afterWrite: (() => void) | null = null
  private readonly maxRetries = 3
  private batchBudgetBytes = TERMINAL_WRITE_FRAME_BUDGET_BYTES
  private frameTimeBudgetMs = 0
  private readonly now: () => number
  private enqueuedChunkCount = 0
  private completedChunkCount = 0
  private barriers: WriteBarrier[] = []
  private readonly scheduler: FrameScheduler
  private readonly maxQueuedBytes: number
  private readonly maxQueuedChunks: number
  private readonly fallbackDelayMs: number
  private onContinuityLost: ((event: TerminalWriteContinuityLoss) => void) | null

  constructor(options: SafeTerminalWriteQueueOptions = {}) {
    this.scheduler = {
      requestFrame: options.requestFrame ?? defaultScheduler.requestFrame,
      cancelFrame: options.cancelFrame ?? defaultScheduler.cancelFrame,
      requestFallback: options.requestFallback ?? defaultScheduler.requestFallback,
      cancelFallback: options.cancelFallback ?? defaultScheduler.cancelFallback,
    }
    this.maxQueuedBytes = Math.max(TERMINAL_WRITE_CHUNK_BYTES, options.maxQueuedBytes ?? DEFAULT_MAX_QUEUED_BYTES)
    this.maxQueuedChunks = Math.max(1, options.maxQueuedChunks ?? DEFAULT_MAX_QUEUED_CHUNKS)
    this.fallbackDelayMs = Math.max(0, options.fallbackDelayMs ?? DEFAULT_FALLBACK_DELAY_MS)
    this.onContinuityLost = options.onContinuityLost ?? null
    this.now = options.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()))
  }

  /**
   * With a time budget, one frame keeps writing batches until the budget is
   * spent, then yields. Throughput then follows what the device can parse, and
   * the page still returns to the event loop every frame, so the socket keeps
   * being read. 0 (the default) writes one batch a frame.
   */
  setFrameTimeBudgetMs(budgetMs: number) {
    this.frameTimeBudgetMs = Math.max(0, budgetMs)
  }

  setTerminal(terminal: TerminalWriteTarget | null) {
    this.terminal = terminal
    if (terminal && this.queue.length > 0) this.scheduleFlush()
  }

  setViewportStateProvider(provider: (() => {
    preserveViewport: boolean
    viewportY: number
    scrollbackLength: number
  }) | null) {
    this.viewportStateProvider = provider
  }

  setAfterWrite(callback: (() => void) | null) {
    this.afterWrite = callback
  }

  setOnContinuityLost(callback: ((event: TerminalWriteContinuityLoss) => void) | null) {
    this.onContinuityLost = callback
  }

  setBatchBudgetBytes(bytes: number) {
    this.batchBudgetBytes = Math.max(TERMINAL_WRITE_CHUNK_BYTES, bytes)
  }

  enqueue(
    data: Uint8Array,
    options: { terminalResponses?: "emit" | "discard" } = {}
  ): boolean {
    if (this.disposed || data.byteLength === 0) return false
    if (!this.continuityValid) return false
    const terminalResponses = options.terminalResponses ?? "emit"
    const chunks: QueuedWrite[] = splitUint8Array(data, TERMINAL_WRITE_CHUNK_BYTES).map((chunk) => ({
      data: chunk,
      terminalResponses,
      logicalChunkCount: 1,
    }))
    const tail = this.queue.at(-1)
    const packsIntoTail = tail && !tail.action && tail.terminalResponses === terminalResponses &&
      tail.data.byteLength + chunks[0].data.byteLength <= TERMINAL_WRITE_CHUNK_BYTES

    if (
      this.queuedBytes + data.byteLength > this.maxQueuedBytes ||
      this.queue.length + chunks.length - (packsIntoTail ? 1 : 0) > this.maxQueuedChunks
    ) {
      this.invalidateContinuity("overflow")
      return false
    }

    for (const chunk of chunks) {
      const last = this.queue.at(-1)
      if (last && !last.action && last.terminalResponses === chunk.terminalResponses &&
          last.data.byteLength + chunk.data.byteLength <= TERMINAL_WRITE_CHUNK_BYTES) {
        if (!last.storage) {
          last.storage = new Uint8Array(TERMINAL_WRITE_CHUNK_BYTES)
          last.storage.set(last.data)
        }
        const length = last.data.byteLength + chunk.data.byteLength
        last.storage.set(chunk.data, last.data.byteLength)
        last.data = last.storage.subarray(0, length)
        last.logicalChunkCount += chunk.logicalChunkCount
      } else {
        this.queue.push(chunk)
      }
    }
    this.queuedBytes += data.byteLength
    this.enqueuedChunkCount += chunks.length
    this.scheduleFlush()
    return true
  }

  /** Runs `action` after every write queued before it and before any after it. */
  enqueueAction(action: () => void): boolean {
    if (this.disposed || !this.continuityValid) return false
    if (this.queue.length + 1 > this.maxQueuedChunks) {
      this.invalidateContinuity("overflow")
      return false
    }
    this.queue.push({ data: new Uint8Array(), terminalResponses: "discard", logicalChunkCount: 1, action })
    this.enqueuedChunkCount += 1
    this.scheduleFlush()
    return true
  }

  waitForPendingWrites(): Promise<void> {
    const targetChunkCount = this.enqueuedChunkCount
    if (this.disposed || this.completedChunkCount >= targetChunkCount) {
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      this.barriers.push({ targetChunkCount, resolve })
    })
  }

  /** Drop bytes superseded by an authoritative reset and revalidate continuity. */
  discardPendingWrites() {
    if (this.disposed || this.isProcessing) return
    this.cancelScheduledFlush()
    const discardedChunkCount = this.queue.reduce((count, write) => count + write.logicalChunkCount, 0)
    this.queue = []
    this.queuedBytes = 0
    if (discardedChunkCount > 0) this.completeChunks(discardedChunkCount)
    this.retryCount = 0
    this.continuityValid = true
    this.continuityLossNotified = false
  }

  private scheduleFlush() {
    if (this.disposed || this.frameId !== null || this.fallbackId !== null || this.retryId !== null || this.isProcessing) return
    const run = () => {
      this.cancelScheduledFlush()
      this.flush()
    }
    this.frameId = this.scheduler.requestFrame(run)
    // requestAnimationFrame can be suspended indefinitely in a hidden tab. A
    // bounded timer drains the same queue without creating a second writer.
    this.fallbackId = this.scheduler.requestFallback(run, this.fallbackDelayMs)
  }

  private cancelScheduledFlush() {
    if (this.frameId !== null) {
      this.scheduler.cancelFrame(this.frameId)
      this.frameId = null
    }
    if (this.fallbackId !== null) {
      this.scheduler.cancelFallback(this.fallbackId)
      this.fallbackId = null
    }
    if (this.retryId !== null) {
      this.scheduler.cancelFallback(this.retryId)
      this.retryId = null
    }
  }

  private takeNextBatch(): {
    data: Uint8Array
    chunkCount: number
    writes: QueuedWrite[]
    terminalResponses: "emit" | "discard"
    action?: () => void
  } | null {
    if (this.queue.length === 0) return null
    const head = this.queue[0]
    if (head.action) {
      this.queue.shift()
      return { data: head.data, chunkCount: head.logicalChunkCount, writes: [head], terminalResponses: head.terminalResponses, action: head.action }
    }

    const chunks: Uint8Array[] = []
    const writes: QueuedWrite[] = []
    let chunkCount = 0
    let totalLength = 0
    const terminalResponses = this.queue[0].terminalResponses

    while (this.queue.length > 0) {
      const next = this.queue[0]
      if (next.action || next.terminalResponses !== terminalResponses) break
      if (chunks.length > 0 && totalLength + next.data.byteLength > this.batchBudgetBytes) break

      const removed = this.queue.shift() as QueuedWrite
      chunks.push(removed.data)
      writes.push(removed)
      chunkCount += removed.logicalChunkCount
      totalLength += removed.data.byteLength
      this.queuedBytes = Math.max(0, this.queuedBytes - removed.data.byteLength)
      if (totalLength >= this.batchBudgetBytes) break
    }

    if (chunks.length === 0) return null
    if (chunks.length === 1) {
      return { data: chunks[0], chunkCount, writes, terminalResponses }
    }

    const combined = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.byteLength
    }
    return { data: combined, chunkCount, writes, terminalResponses }
  }

  private completeChunks(chunkCount: number) {
    this.completedChunkCount += chunkCount
    const pending: WriteBarrier[] = []
    for (const barrier of this.barriers) {
      if (this.completedChunkCount >= barrier.targetChunkCount) barrier.resolve()
      else pending.push(barrier)
    }
    this.barriers = pending
  }

  private invalidateContinuity(
    reason: TerminalWriteContinuityLoss["reason"],
    error?: unknown,
  ) {
    if (!this.continuityValid) return
    this.continuityValid = false
    this.cancelScheduledFlush()
    const discardedChunkCount = this.queue.reduce((count, write) => count + write.logicalChunkCount, 0)
    this.queue = []
    this.queuedBytes = 0
    if (discardedChunkCount > 0) this.completeChunks(discardedChunkCount)
    this.retryCount = 0

    if (!this.continuityLossNotified) {
      this.continuityLossNotified = true
      try {
        this.onContinuityLost?.({ reason, metrics: this.getMetrics(), error })
      } catch (hookError) {
        console.error("[SafeTerminalWriteQueue] continuity hook failed", hookError)
      }
    }
  }

  private flush() {
    const budgetMs = this.frameTimeBudgetMs
    if (budgetMs <= 0) {
      this.flushBatch()
      return
    }
    const deadline = this.now() + budgetMs
    do {
      if (!this.flushBatch()) return
      // A batch may have changed the budget (the action that ends a repaint).
    } while (this.frameTimeBudgetMs > 0 && this.queue.length > 0 && this.now() < deadline)
  }

  /** Writes one batch. Returns false when the frame must stop writing. */
  private flushBatch(): boolean {
    if (this.disposed || !this.continuityValid || this.queue.length === 0 || this.isProcessing) return false
    if (!this.terminal?.wasmTerm) {
      this.invalidateContinuity("terminal-unavailable")
      return false
    }

    const batch = this.takeNextBatch()
    if (!batch) return false

    this.isProcessing = true
    let completed = false

    try {
      if (this.disposed || !this.terminal?.wasmTerm) {
        completed = true
        return false
      }
      if (batch.action) {
        completed = true
        try {
          batch.action()
        } catch (error) {
          console.warn("[SafeTerminalWriteQueue] queued action failed:", error)
        }
        return true
      }

      const viewportState = this.viewportStateProvider?.() ?? {
        preserveViewport: false,
        viewportY: 0,
        scrollbackLength: 0,
      }
      this.terminal.wasmTerm.write(batch.data)
      if (batch.terminalResponses === "emit") {
        this.terminal.processTerminalResponses?.()
      } else {
        while (this.terminal.wasmTerm.readResponse?.()) {
          // Historical queries must not be answered again during bootstrap.
        }
      }

      if (viewportState.preserveViewport) {
        const nextScrollbackLength = this.terminal.getScrollbackLength()
        const distanceFromBottom = Math.max(0, viewportState.scrollbackLength - viewportState.viewportY)
        const targetViewportY = Math.max(0, nextScrollbackLength - distanceFromBottom)
        if (this.terminal.getViewportY() !== targetViewportY) {
          this.terminal.scrollToLine(targetViewportY)
        }
      }

      this.terminal.requestRender?.()
      this.afterWrite?.()
      this.retryCount = 0
      completed = true
      return true
    } catch (error) {
      const isWasmError = error instanceof Error &&
        (error.message.includes("out of bounds") || error.message.includes("memory access"))

      if (isWasmError && this.retryCount < this.maxRetries) {
        this.retryCount += 1
        // Re-splitting a combined batch loses the logical enqueue count and
        // leaves waitForPendingWrites() stuck forever after a successful retry.
        this.queue.unshift(...batch.writes)
        this.queuedBytes += batch.data.byteLength
        this.retryId = this.scheduler.requestFallback(() => {
          this.retryId = null
          if (!this.disposed && this.continuityValid) this.scheduleFlush()
        }, 50 * this.retryCount)
      } else {
        console.warn("[SafeTerminalWriteQueue] Write failed; invalidating terminal continuity:", error)
        completed = true
        this.invalidateContinuity("write-failed", error)
      }
      return false
    } finally {
      if (completed) this.completeChunks(batch.chunkCount)
      this.isProcessing = false
      if (!this.disposed && this.continuityValid && this.queue.length > 0 && this.retryCount === 0) {
        this.scheduleFlush()
      }
    }
  }

  getMetrics(): TerminalWriteQueueMetrics {
    return {
      queuedBytes: this.queuedBytes,
      queuedChunks: this.queue.length,
      enqueuedChunks: this.enqueuedChunkCount,
      completedChunks: this.completedChunkCount,
      continuityValid: this.continuityValid,
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.cancelScheduledFlush()
    this.queue = []
    this.queuedBytes = 0
    this.terminal = null
    for (const barrier of this.barriers) barrier.resolve()
    this.barriers = []
  }
}
