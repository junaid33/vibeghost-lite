import { getIrohTerminalClient } from "./iroh-terminal-bridge.ts"
import { TERMINAL_STDOUT_CACHE_MAX_BYTES } from "./terminal-output-limits.ts"

const encoder = new TextEncoder()

type WorkspaceResponse = {
  status: number
  body: Uint8Array
  outputEpoch?: string
  outputCursorStart?: number
  outputCursorEnd?: number
  continuityLost?: boolean
  sessionExited?: boolean
}

type WorkspaceTransport = {
  readonly transportGeneration?: number
  request(method: string, path: string): Promise<WorkspaceResponse>
  json(method: string, path: string, body?: Record<string, unknown>): Promise<unknown>
}

type StdoutCache = {
  bytes: Uint8Array
  trusted: boolean
  reconcilable: boolean
  updatedAt: number
}

type SubscribeOptions = {
  stdout?: boolean
  snapshots?: boolean
  events?: boolean
  skipHistory?: boolean
  onStdout?: (data: Uint8Array) => void
  onSnapshot?: (snapshot: unknown) => void
  onEvent?: (data: unknown, sessionId: string) => void
  onError?: (message: string) => void
}

type Feed = {
  sessionId: string
  subscribers: Set<SubscribeOptions>
  epoch?: string
  cursor?: number
  runEpoch: number
  running: boolean
  ready: boolean
  recovering: boolean
  stopTimer?: ReturnType<typeof setTimeout>
}

const SPECIAL_KEYS: Record<string, string> = {
  enter: "\r", ctrl_enter: "\n", shift_enter: "\r\n", escape: "\u001b",
  backspace: "\u007f", tab: "\t", shift_tab: "\u001b[Z",
  arrow_up: "\u001b[A", arrow_down: "\u001b[B", arrow_right: "\u001b[C",
  arrow_left: "\u001b[D", delete: "\u001b[3~", page_up: "\u001b[5~",
  page_down: "\u001b[6~", home: "\u001b[H", end: "\u001b[F",
  ctrl_l: "\u000c", ctrl_c: "\u0003", f1: "\u001bOP", f2: "\u001bOQ",
  f3: "\u001bOR", f4: "\u001bOS", f5: "\u001b[15~", f6: "\u001b[17~",
  f7: "\u001b[18~", f8: "\u001b[19~", f9: "\u001b[20~", f10: "\u001b[21~",
  f11: "\u001b[23~", f12: "\u001b[24~",
}

export class IrohTerminalSocketClient {
  private readonly caches = new Map<string, StdoutCache>()
  private readonly feeds = new Map<string, Feed>()
  private readonly inputBuffers = new Map<string, string>()
  private readonly inputTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly operationChains = new Map<string, Promise<void>>()
  private generation = 1
  private readonly mutationGenerations = new Map<string, number>()

  private readonly getClient: (sessionId: string) => WorkspaceTransport
  private readonly retryMs: number
  private readonly remountGraceMs: number
  private readonly ownerGeneration?: () => number

  constructor(getClient: (sessionId: string) => WorkspaceTransport, retryMs = 500, remountGraceMs = 1_000, ownerGeneration?: () => number) {
    this.getClient = getClient
    this.retryMs = retryMs
    this.remountGraceMs = remountGraceMs
    this.ownerGeneration = ownerGeneration
  }

  getConnectionStatus = () => true
  getTransportGeneration = () => this.generation + (this.ownerGeneration?.() || 0)

  isSessionSubscriptionReady(sessionId: string) {
    return this.feeds.get(sessionId)?.ready === true
  }

  isSubscriptionReadyEvent(_sessionId: string, event: unknown) {
    return Boolean(event && typeof event === "object" && (event as { type?: unknown }).type === "status-sync")
  }

  onConnectionStateChange(handler: (connected: boolean) => void) {
    queueMicrotask(() => handler(true))
    return () => undefined
  }

  onTransportReconnect(handler: () => void) {
    void handler
    return () => undefined
  }

  subscribe(sessionId: string, options: SubscribeOptions) {
    let feed = this.feeds.get(sessionId)
    if (!feed) {
      feed = {
        sessionId,
        subscribers: new Set(),
        runEpoch: 0,
        running: false,
        ready: false,
        recovering: false,
      }
      this.feeds.set(sessionId, feed)
    }
    if (feed.stopTimer) {
      clearTimeout(feed.stopTimer)
      feed.stopTimer = undefined
    }
    feed.subscribers.add(options)
    if (feed.ready) queueMicrotask(() => options.onEvent?.({ type: "status-sync" }, sessionId))
    this.startFeed(feed)

    let active = true
    return () => {
      if (!active) return
      active = false
      feed?.subscribers.delete(options)
      if (!feed || feed.subscribers.size !== 0 || feed.stopTimer) return
      // Grace retains output continuity, never permission to send queued input.
      this.cancelPendingMutations(sessionId)
      feed.stopTimer = setTimeout(() => {
        feed!.stopTimer = undefined
        if (feed!.subscribers.size !== 0) return
        feed!.runEpoch += 1
        feed!.running = false
        feed!.ready = false
        if (this.feeds.get(sessionId) === feed) this.feeds.delete(sessionId)
        // Nothing appends to this cache once its feed stops, and the next feed
        // anchors at the server's current end. Never replay it as a checkpoint.
        this.caches.delete(sessionId)
      }, this.remountGraceMs)
    }
  }

  private startFeed(feed: Feed) {
    if (feed.running) return
    feed.running = true
    const runEpoch = ++feed.runEpoch
    void this.pollLoop(feed, runEpoch)
  }

  private async pollLoop(feed: Feed, runEpoch: number) {
    while (this.isCurrent(feed, runEpoch)) {
      const requestedEpoch = feed.epoch
      const requestedCursor = feed.cursor
      const params = new URLSearchParams({ protocol: "2" })
      if (requestedEpoch !== undefined) params.set("epoch", requestedEpoch)
      if (requestedCursor !== undefined) params.set("cursor", String(requestedCursor))

      try {
        const response = await this.getClient(feed.sessionId).request(
          "GET",
          `/api/sessions/${encodeURIComponent(feed.sessionId)}/output-poll?${params}`,
        )
        if (!this.isCurrent(feed, runEpoch)) continue
        if (!this.isValidResponse(response, requestedEpoch, requestedCursor)) {
          this.invalidateFeed(feed, "Invalid terminal continuity response")
          await this.delay()
          continue
        }

        if (response.status === 409 || response.continuityLost) {
          this.invalidateFeed(feed, "Terminal output continuity was lost")
          // Anchor a fresh protocol epoch on the next request. The UI performs
          // authoritative bootstrap after the new listener is confirmed ready.
          feed.epoch = undefined
          feed.cursor = undefined
          continue
        }
        if (response.status >= 400) {
          throw new Error(`Terminal output failed (${response.status})`)
        }

        feed.epoch = response.outputEpoch
        feed.cursor = response.outputCursorEnd
        if (response.body.byteLength > 0) {
          this.appendCache(feed.sessionId, response.body)
          for (const subscriber of feed.subscribers) {
            if (subscriber.stdout) subscriber.onStdout?.(response.body)
          }
        }

        if (!feed.ready || feed.recovering) {
          const wasRecovering = feed.recovering
          feed.ready = true
          feed.recovering = false
          if (wasRecovering) {
            this.emit(feed, {
              type: "remote-transport-state",
              state: "restored",
              continuityInvalidated: true,
            })
          }
          this.emit(feed, { type: "status-sync" })
        }
        if (response.sessionExited) return
      } catch (error) {
        if (!this.isCurrent(feed, runEpoch)) continue
        this.invalidateFeed(
          feed,
          error instanceof Error ? error.message : "Terminal output failed",
        )
        await this.delay()
      }
    }
    if (feed.runEpoch === runEpoch) feed.running = false
  }

  private isCurrent(feed: Feed, runEpoch: number) {
    return this.feeds.get(feed.sessionId) === feed && feed.runEpoch === runEpoch
  }

  private isValidResponse(
    response: WorkspaceResponse,
    requestedEpoch?: string,
    requestedCursor?: number,
  ) {
    const { outputEpoch, outputCursorStart, outputCursorEnd } = response
    if (!outputEpoch || !Number.isSafeInteger(outputCursorStart) || !Number.isSafeInteger(outputCursorEnd)) return false
    if ((outputCursorStart as number) > (outputCursorEnd as number)) return false
    if (response.status !== 409 && response.body.byteLength !== (outputCursorEnd as number) - (outputCursorStart as number)) return false
    if (response.status !== 409 && requestedEpoch !== undefined && outputEpoch !== requestedEpoch) return false
    if (response.status !== 409 && requestedCursor !== undefined && outputCursorStart !== requestedCursor) return false
    return true
  }

  private invalidateFeed(feed: Feed, message: string) {
    this.invalidateReconnectStdoutCheckpoint(feed.sessionId)
    if (!feed.recovering) {
      this.cancelPendingMutations(feed.sessionId)
      this.generation += 1
      feed.recovering = true
      feed.ready = false
      this.emit(feed, {
        type: "remote-transport-state",
        state: "reconnecting",
        continuityInvalidated: true,
      })
    }
    for (const subscriber of feed.subscribers) subscriber.onError?.(message)
  }

  private emit(feed: Feed, event: unknown) {
    for (const subscriber of feed.subscribers) {
      if (subscriber.events) subscriber.onEvent?.(event, feed.sessionId)
    }
  }

  private delay() {
    return new Promise<void>((resolve) => setTimeout(resolve, this.retryMs))
  }

  private cancelPendingMutations(sessionId: string) {
    this.mutationGenerations.set(sessionId, (this.mutationGenerations.get(sessionId) || 0) + 1)
    this.inputBuffers.delete(sessionId)
    // Do not clear the timer: it must resolve any already-waiting batch promise.
    this.inputTimers.delete(sessionId)
  }

  private enqueueOperation(sessionId: string, operation: () => Promise<void>, canceled?: () => void) {
    const generation = this.mutationGenerations.get(sessionId) || 0
    const owner = this.getClient(sessionId)
    const transportGeneration = owner.transportGeneration
    const request = (this.operationChains.get(sessionId) || Promise.resolve())
      .catch(() => undefined)
      .then(() => {
        if ((this.mutationGenerations.get(sessionId) || 0) === generation && owner === this.getClient(sessionId) && owner.transportGeneration === transportGeneration) return operation()
        canceled?.()
      })
    this.operationChains.set(sessionId, request)
    const release = () => {
      if (this.operationChains.get(sessionId) === request) this.operationChains.delete(sessionId)
    }
    void request.then(release, release)
    return request
  }

  private queueInput(sessionId: string, text: string) {
    this.inputBuffers.set(sessionId, `${this.inputBuffers.get(sessionId) || ""}${text}`)
    if (this.inputTimers.has(sessionId)) return

    let releaseBatch!: () => void
    const batchWindow = new Promise<void>((resolve) => { releaseBatch = resolve })
    const timer = setTimeout(releaseBatch, 8)
    const generation = this.mutationGenerations.get(sessionId) || 0
    const owner = this.getClient(sessionId)
    const transportGeneration = owner.transportGeneration
    this.inputTimers.set(sessionId, timer)
    // Reserve the mutation-chain position immediately. A resize called during
    // the 8ms input batch window must not overtake the input that preceded it.
    void this.enqueueOperation(sessionId, async () => {
      await batchWindow
      if ((this.mutationGenerations.get(sessionId) || 0) !== generation || owner !== this.getClient(sessionId) || owner.transportGeneration !== transportGeneration) {
        // Only discard this batch; a newer batch may already own these maps.
        if (this.inputTimers.get(sessionId) === timer) {
          this.inputTimers.delete(sessionId)
          this.inputBuffers.delete(sessionId)
        }
        return
      }
      if (this.inputTimers.get(sessionId) === timer) this.inputTimers.delete(sessionId)
      const batchedText = this.inputBuffers.get(sessionId) || ""
      this.inputBuffers.delete(sessionId)
      if (!batchedText) return
      await this.getClient(sessionId).json(
        "POST",
        `/api/sessions/${encodeURIComponent(sessionId)}/input`,
        { text: batchedText },
      )
    }, () => {
      if (this.inputTimers.get(sessionId) === timer) {
        this.inputTimers.delete(sessionId)
        this.inputBuffers.delete(sessionId)
      }
    })
  }

  sendInputText(sessionId: string, text: string) {
    if (!sessionId || !text) return false
    this.queueInput(sessionId, text)
    return true
  }

  sendInputKey(sessionId: string, key: string) {
    const text = SPECIAL_KEYS[key] || key
    if (!sessionId || !text) return false
    this.queueInput(sessionId, text)
    return true
  }

  resize(sessionId: string, cols: number, rows: number) {
    if (!sessionId) return false
    void this.enqueueOperation(sessionId, async () => {
      await this.getClient(sessionId).json(
        "POST",
        `/api/sessions/${encodeURIComponent(sessionId)}/resize`,
        { cols, rows },
      )
    })
    return true
  }

  replaceStdoutCache(sessionId: string, bytes: Uint8Array, options: { trusted?: boolean } = {}) {
    if (!bytes.byteLength) {
      this.caches.delete(sessionId)
      return
    }
    const start = Math.max(0, bytes.byteLength - TERMINAL_STDOUT_CACHE_MAX_BYTES)
    const retained = new Uint8Array(bytes.subarray(start))
    const trusted = options.trusted !== false && start === 0
    this.commitCache(sessionId, { bytes: retained, trusted, reconcilable: trusted, updatedAt: Date.now() })
  }

  getCachedStdout(sessionId: string) {
    const cache = this.caches.get(sessionId)
    return cache?.trusted ? new Uint8Array(cache.bytes) : null
  }

  getReconnectStdoutCheckpoint(sessionId: string) {
    const cache = this.caches.get(sessionId)
    return cache?.reconcilable ? new Uint8Array(cache.bytes) : null
  }

  invalidateReconnectStdoutCheckpoint(sessionId: string) {
    const cache = this.caches.get(sessionId)
    if (!cache) return
    this.commitCache(sessionId, { ...cache, trusted: false, reconcilable: false, updatedAt: Date.now() })
  }

  private appendCache(sessionId: string, bytes: Uint8Array) {
    if (!bytes.byteLength) return
    const prior = this.caches.get(sessionId)
    const combinedLength = (prior?.bytes.byteLength || 0) + bytes.byteLength
    const retainedLength = Math.min(combinedLength, TERMINAL_STDOUT_CACHE_MAX_BYTES)
    const combined = new Uint8Array(retainedLength)
    const dropped = combinedLength - retainedLength
    if (prior?.bytes.byteLength) {
      const priorStart = Math.min(prior.bytes.byteLength, dropped)
      const priorTail = prior.bytes.subarray(priorStart)
      combined.set(priorTail)
      const remaining = retainedLength - priorTail.byteLength
      combined.set(bytes.subarray(bytes.byteLength - remaining), priorTail.byteLength)
    } else {
      combined.set(bytes.subarray(bytes.byteLength - retainedLength))
    }
    const continuous = dropped === 0
    this.commitCache(sessionId, {
      bytes: combined,
      trusted: Boolean(prior?.trusted && continuous),
      reconcilable: Boolean(prior?.reconcilable && continuous),
      updatedAt: Date.now(),
    })
  }

  private commitCache(sessionId: string, cache: StdoutCache) {
    if (this.caches.has(sessionId)) this.caches.delete(sessionId)
    this.caches.set(sessionId, cache)
    while (this.caches.size > 6) {
      const oldest = this.caches.keys().next().value
      if (!oldest) break
      this.caches.delete(oldest)
    }
    let total = 0
    for (const entry of this.caches.values()) total += entry.bytes.byteLength
    while (total > 32 * 1024 * 1024 && this.caches.size > 1) {
      const oldest = this.caches.keys().next().value
      if (!oldest) break
      total -= this.caches.get(oldest)?.bytes.byteLength || 0
      this.caches.delete(oldest)
    }
  }
}

// One adapter per stable workspace owner. Remote session IDs are only unique
// within a server; caches, polls and queued input must never cross owners.
const workspaceSockets = new WeakMap<WorkspaceTransport, IrohTerminalSocketClient>()
export function getWorkspaceTerminalSocketClient(client: WorkspaceTransport) {
  let socket = workspaceSockets.get(client)
  if (!socket) {
    socket = new IrohTerminalSocketClient(() => client, 500, 1_000, () => client.transportGeneration || 0)
    workspaceSockets.set(client, socket)
  }
  return socket
}

// Compatibility export for consumers that explicitly register a bridge client.
export const terminalSocketClient = new IrohTerminalSocketClient(getIrohTerminalClient)

export function terminalBytesToText(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes)
}

export function textToTerminalBytes(text: string) {
  return encoder.encode(text)
}
