export class TerminalReplayContinuityError extends Error {
  constructor() {
    super("Terminal replay queue rejected authoritative output")
    this.name = "TerminalReplayContinuityError"
  }
}

type BootstrapCoordinatorOptions = {
  onRetry: () => void
  scheduleRetry?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>
  cancelRetry?: (timer: ReturnType<typeof setTimeout>) => void
}

/** One restore at a time. Failed restores retry with backoff, never a hot reset loop. */
export class TerminalBootstrapCoordinator {
  private running = false
  private pendingFresh = false
  private disposed = false
  private retryAttempt = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retryGeneration = 0
  private readonly scheduleRetry: NonNullable<BootstrapCoordinatorOptions["scheduleRetry"]>
  private readonly cancelRetry: NonNullable<BootstrapCoordinatorOptions["cancelRetry"]>

  constructor(private readonly options: BootstrapCoordinatorOptions) {
    this.scheduleRetry = options.scheduleRetry ?? ((callback, delayMs) => setTimeout(callback, delayMs))
    this.cancelRetry = options.cancelRetry ?? ((timer) => clearTimeout(timer))
  }

  begin(forceFresh = false): boolean {
    if (this.disposed) return false
    if (this.running) {
      if (forceFresh) this.pendingFresh = true
      return false
    }
    // An explicit refresh/reconnect supersedes a scheduled retry. Keep its
    // backoff history until a restore actually succeeds.
    this.clearRetry()
    this.running = true
    return true
  }

  queueFreshAfterCurrent(): void {
    if (!this.disposed && this.running) this.pendingFresh = true
  }

  /** Returns true only when the caller must start recovery immediately. */
  requestContinuityRecovery(): boolean {
    if (this.disposed) return false
    if (this.running) {
      this.pendingFresh = true
      return false
    }
    // A failed recovery already has a retry owner. Output bursts must not
    // bypass its backoff or launch a second snapshot request.
    return this.retryTimer === null
  }

  /** Returns whether a successful run has one coalesced fresh restore to start. */
  finish(success: boolean): boolean {
    if (this.disposed || !this.running) return false
    this.running = false
    const fresh = this.pendingFresh
    this.pendingFresh = false
    if (success) {
      this.retryAttempt = 0
      return fresh
    }

    const delayMs = Math.min(1_000 * 2 ** this.retryAttempt, 30_000)
    this.retryAttempt = Math.min(this.retryAttempt + 1, 5)
    const generation = ++this.retryGeneration
    this.retryTimer = this.scheduleRetry(() => {
      if (this.disposed || generation !== this.retryGeneration) return
      this.retryTimer = null
      this.options.onRetry()
    }, delayMs)
    return false
  }

  private clearRetry(): void {
    this.retryGeneration += 1
    if (this.retryTimer !== null) this.cancelRetry(this.retryTimer)
    this.retryTimer = null
  }

  dispose(): void {
    this.disposed = true
    this.pendingFresh = false
    this.clearRetry()
  }
}

export async function enqueueTerminalReplayChunks(options: {
  bytes: Uint8Array
  chunkBytes: number
  enqueue: (chunk: Uint8Array) => boolean
  yieldAfterChunk: () => Promise<void>
  isCurrent: () => boolean
}): Promise<boolean> {
  for (let offset = 0; offset < options.bytes.byteLength; offset += options.chunkBytes) {
    if (!options.isCurrent()) return false
    if (!options.enqueue(options.bytes.subarray(offset, offset + options.chunkBytes))) {
      return false
    }
    await options.yieldAfterChunk()
  }
  return options.isCurrent()
}
