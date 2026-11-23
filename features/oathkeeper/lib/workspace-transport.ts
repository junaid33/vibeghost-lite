export type WorkspaceTransportHandle = { readonly connectionClosed?: boolean; close(): Promise<void>; free(): void };

type Lease<T> = { handle: T; active: number; retired: boolean; closeSettled: boolean; freed: boolean; retirement: AbortController };

/** One invite-scoped owner. Retiring a connection never retries a mutation.
 * close() interrupts native streams; free() waits for every WASM borrow to end.
 * A caller deadline/cancellation is not proof that its native promise settled.
 */
export class WorkspaceTransport<T extends WorkspaceTransportHandle> {
  private current?: Lease<T>;
  private connecting?: Promise<Lease<T>>;
  private reconnecting?: Promise<void>;
  private generation = 0;
  private closed = false;
  private idleTimer?: ReturnType<typeof setTimeout>;

  private readonly dial: () => Promise<T>;
  private readonly idleMs: number;

  get generationId() { return this.generation; }

  /** `idleMs`: hang up a connection nothing has used for this long; the next request dials again.
   *  A live endpoint is never quiet (keep-alives, relay pings, about 600 timers a minute each), so
   *  eight saved workspaces held open on a page that shows none of them kept a phone's CPU and
   *  radio awake. 0 keeps connections open for good. */
  constructor(dial: () => Promise<T>, initial?: T, idleMs = 0) {
    this.dial = dial;
    this.idleMs = idleMs;
    if (initial) { this.current = this.lease(initial); this.restIfIdle(this.current); }
  }

  /** True while a native connection is open. */
  get connected() { return Boolean(this.current); }

  private restIfIdle(lease: Lease<T>) {
    clearTimeout(this.idleTimer);
    if (!this.idleMs || this.closed || lease.retired || lease.active || this.current !== lease) return;
    this.idleTimer = setTimeout(() => {
      // Nothing is in flight, so no caller is interrupted and nothing can be replayed.
      if (this.current === lease && !lease.active) this.retire(lease, true);
    }, this.idleMs);
    (this.idleTimer as { unref?: () => void }).unref?.();
  }

  /** Hang up now if nothing is in flight (the page went to the background). */
  rest() {
    const lease = this.current;
    if (lease && !lease.active) { clearTimeout(this.idleTimer); this.retire(lease, true); }
  }

  private lease(handle: T): Lease<T> {
    return { handle, active: 0, retired: false, closeSettled: false, freed: false, retirement: new AbortController() };
  }

  private freeIfIdle(lease: Lease<T>) {
    if (!lease.retired || !lease.closeSettled || lease.active || lease.freed) return;
    lease.freed = true;
    lease.handle.free();
  }

  /** `resting`: an idle hang-up. Nothing was in flight, so no delivery is in doubt and the
   *  generation stands: input typed a moment later is sent, once, over the next dial. */
  private retire(lease: Lease<T>, resting = false) {
    if (lease.retired) return;
    lease.retired = true;
    if (this.current === lease) {
      this.current = undefined;
      // Queued callers must not carry unsent mutations into a replacement dial.
      if (!resting) this.generation += 1;
    }
    lease.retirement.abort();
    const settled = () => { lease.closeSettled = true; this.freeIfIdle(lease); };
    // Native close takes &self, not &mut self. It may run alongside requests,
    // unlike free. Handle synchronous boundary errors as well as rejections.
    void Promise.resolve().then(() => lease.handle.close()).then(settled, settled);
  }

  private getLease(): Promise<Lease<T>> {
    if (this.closed) return Promise.reject(new Error("Shared connection is closed"));
    if (this.current) return Promise.resolve(this.current);
    if (this.connecting) return this.connecting;
    const generation = this.generation;
    const attempt = Promise.resolve().then(this.dial).then(handle => {
      const lease = this.lease(handle);
      if (this.closed || generation !== this.generation) {
        this.retire(lease);
        throw new Error("Shared connection was replaced");
      }
      this.current = lease;
      this.restIfIdle(lease);
      return lease;
    });
    this.connecting = attempt;
    const release = () => { if (this.connecting === attempt) this.connecting = undefined; };
    void attempt.then(release, release);
    return attempt;
  }

  async run<R>(operation: (handle: T) => Promise<R>, timeoutMs: number, signal?: AbortSignal): Promise<R> {
    signal?.throwIfAborted();
    const lease = await this.getLease();
    signal?.throwIfAborted();
    if (this.closed || lease.retired) throw new Error("Shared connection was replaced");
    lease.active += 1;
    clearTimeout(this.idleTimer);
    const native = Promise.resolve().then(() => {
      if (lease.retired) throw new Error("Shared connection was replaced");
      return operation(lease.handle);
    });
    // This accounting follows the native promise, not the UI deadline.
    void native.then(() => this.release(lease), () => this.release(lease));
    return new Promise<R>((resolve, reject) => {
      let done = false;
      const finish = (action: () => void, keepNativeDeadline = false) => {
        if (done) return;
        done = true;
        if (!keepNativeDeadline) clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        lease.retirement.signal.removeEventListener("abort", interrupted);
        action();
      };
      const abort = () => finish(() => reject(new DOMException("Request canceled", "AbortError")), true);
      const interrupted = () => finish(() => reject(new Error("Shared transport interrupted. Retry the operation; terminal output will reconnect.")));
      const timer = setTimeout(() => {
        // A canceled UI wait still needs a bounded native lifetime. There is no
        // per-stream abort API: retire a hung generation, never free it early.
        if (done) { this.retire(lease); return; }
        finish(() => {
          this.retire(lease);
          reject(new Error("Shared request timed out. Retry the operation; terminal output will reconnect."));
        });
      }, timeoutMs);
      lease.retirement.signal.addEventListener("abort", interrupted, { once: true });
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      native.then(value => { clearTimeout(timer); finish(() => resolve(value)); }, () => {
        clearTimeout(timer);
        // An isolated reset/stopped stream is not a dead QUIC connection.
        // Native state avoids classifying display strings. Older fixture/client
        // bindings without this getter conservatively replace a failed handle.
        if (!lease.retired) {
          let connectionClosed = true;
          try { connectionClosed = lease.handle.connectionClosed !== false; } catch {}
          if (connectionClosed) this.retire(lease);
        }
        // Never replay input/upload: delivery may already have occurred.
        finish(() => reject(new Error("Shared transport interrupted. Retry the operation; terminal output will reconnect.")));
      });
    });
  }

  private release(lease: Lease<T>) {
    lease.active -= 1;
    this.freeIfIdle(lease);
    this.restIfIdle(lease);
  }

  reconnect(): Promise<void> {
    if (this.closed) return Promise.reject(new Error("Shared connection is closed"));
    if (this.reconnecting) return this.reconnecting;
    this.generation += 1;
    this.connecting = undefined;
    if (this.current) this.retire(this.current);
    const attempt = this.getLease().then(() => undefined);
    this.reconnecting = attempt;
    const release = () => { if (this.reconnecting === attempt) this.reconnecting = undefined; };
    void attempt.then(release, release);
    return attempt;
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.idleTimer);
    this.generation += 1;
    if (this.current) this.retire(this.current);
  }
}
