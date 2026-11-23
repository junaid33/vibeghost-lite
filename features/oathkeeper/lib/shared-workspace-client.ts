"use client";
import { workspaceDeadline, workspaceDiagnostic } from './workspace-connection-lifecycle';
import { WorkspaceTransport } from './workspace-transport';

type WasmWorkspaceResponse = {
  readonly status: number;
  readonly contentType: string;
  readonly restoreTruncated: boolean;
  readonly outputEpoch?: string;
  readonly outputCursorStart?: bigint;
  readonly outputCursorEnd?: bigint;
  readonly continuityLost: boolean;
  readonly sessionExited: boolean;
  readonly body: Uint8Array;
  free(): void;
};

type WasmWorkspaceClient = {
  readonly connectionClosed?: boolean;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly expiresAt: bigint;
  request(method: string, path: string, body?: Uint8Array | null, contentType?: string | null): Promise<WasmWorkspaceResponse>;
  close(): Promise<void>;
  free(): void;
};

type WasmModule = {
  default(options?: {module_or_path: string}): Promise<unknown>;
  WorkspaceClient: { connect(ticket: string): Promise<WasmWorkspaceClient> };
};

const dynamicImport = new Function("url", "return import(url)") as (url: string) => Promise<WasmModule>;
let modulePromise: Promise<WasmModule> | null = null;

async function loadModule() {
  if (!modulePromise) {
    modulePromise = dynamicImport("/iroh/vibeghost_share_web.js?v=terminal-owner-4").then(async (wasmModule) => {
      await wasmModule.default({module_or_path:'/iroh/vibeghost_share_web_bg.wasm?v=terminal-owner-4'});
      return wasmModule;
    }).catch(error=>{modulePromise=null;throw error;});
  }
  return modulePromise;
}

/* A workspace connection nothing has asked anything of for this long is hung up, and dialled again
   by the next request. An open terminal or chat keeps asking (its output poll waits 25 s at a time),
   so only connections no page is using go quiet. */
const IDLE_HANG_UP_MS = 20_000;
const openTransports = new Set<WorkspaceTransport<WasmWorkspaceClient>>();
// In the background nothing is shown: hang up whatever is not mid-request.
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") for (const transport of openTransports) transport.rest();
});

export class SharedWorkspaceError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); this.name = 'SharedWorkspaceError'; }
}

export class SharedWorkspaceClient {
  private readonly transport: WorkspaceTransport<WasmWorkspaceClient>;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly expiresAt: number;
  private gitWritesAvailable = false;
  private agentSessionsAvailable = false;
  private workspaceEditingAvailable = false;
  private remoteBrowserAvailable = false;
  /** Full-access share on a VibeGhost with the remote browser (a Chrome on that machine). */
  get supportsRemoteBrowser() { return this.remoteBrowserAvailable; }
  get supportsWorkspaceEditing() { return this.workspaceEditingAvailable; }
  get supportsAgentSessions() { return this.agentSessionsAvailable; }

  get supportsGitWrites() { return this.gitWritesAvailable; }
  get transportGeneration() { return this.transport.generationId; }

  private constructor(inner: WasmWorkspaceClient, dial: () => Promise<WasmWorkspaceClient>) {
    // Metadata is copied while the handle is live, never read from retired WASM.
    this.workspaceId = inner.workspaceId;
    this.workspaceName = inner.workspaceName;
    this.expiresAt = Number(inner.expiresAt);
    this.transport = new WorkspaceTransport(dial, inner, IDLE_HANG_UP_MS);
    openTransports.add(this.transport);
  }

  static async connect(ticket: string) {
    const dial = () => SharedWorkspaceClient.dial(ticket);
    return new SharedWorkspaceClient(await dial(), dial);
  }

  private static async dial(ticket: string) {
    const attempt=crypto.randomUUID().slice(0,8);const start=performance.now();
    let phase: 'loading module' | 'connecting to gateway' = 'loading module';
    workspaceDiagnostic(attempt,phase,'started',0);
    try {
      const wasmModule = await workspaceDeadline(loadModule(),phase,15_000);
      workspaceDiagnostic(attempt,phase,'completed',performance.now()-start);
      phase='connecting to gateway';workspaceDiagnostic(attempt,phase,'started',performance.now()-start);
      const client=await workspaceDeadline(wasmModule.WorkspaceClient.connect(ticket),phase,25_000,inner=>{new WorkspaceTransport(async () => inner, inner).close();});
      workspaceDiagnostic(attempt,phase,'completed',performance.now()-start);
      return client;
    }catch(error){workspaceDiagnostic(attempt,phase,'failed',performance.now()-start);throw error;}
  }

  async request(method: string, path: string, body?: Uint8Array | string | Record<string, unknown>, contentType?: string, signal?: AbortSignal) {
    const encodedBody = body instanceof Uint8Array ? body : typeof body === "string" ? new TextEncoder().encode(body) : body ? new TextEncoder().encode(JSON.stringify(body)) : undefined;
    // Server output polls normally wait 25s. An idle 204 is success, not a dial
    // timeout. Uploads use VibeGhost's proven 120s budget, independently of RPCs.
    const timeoutMs = method === "POST" && path.endsWith("/upload") ? 120_000 : 45_000;
    return this.transport.run(async inner => {
      const response = await inner.request(method, path, encodedBody, contentType);
      try {
        return {
          status: response.status,
          contentType: response.contentType,
          restoreTruncated: response.restoreTruncated,
          outputEpoch: response.outputEpoch,
          outputCursorStart: response.outputCursorStart === undefined ? undefined : Number(response.outputCursorStart),
          outputCursorEnd: response.outputCursorEnd === undefined ? undefined : Number(response.outputCursorEnd),
          continuityLost: response.continuityLost,
          sessionExited: response.sessionExited,
          body: new Uint8Array(response.body),
        };
      } finally {
        response.free();
      }
    }, timeoutMs, signal);
  }

  async json<T>(method: string, path: string, body?: Record<string, unknown>, signal?: AbortSignal) {
    const response = await this.request(method, path, body, undefined, signal);
    const text = new TextDecoder().decode(response.body);
    if (response.status >= 400) {
      let message = `Shared session request failed (${response.status})`;
      let code: string | undefined;
      try { const parsed = JSON.parse(text) as { error?: unknown; code?: unknown }; if (typeof parsed.error === "string") message = parsed.error; if (typeof parsed.code === 'string') code = parsed.code; } catch {}
      throw new SharedWorkspaceError(message, response.status, code);
    }
    const data = JSON.parse(text);
    if (method === "GET" && path === "/api/workspaces") {
      this.gitWritesAvailable = data?.capabilities?.gitWrites === true;
      this.agentSessionsAvailable = data?.capabilities?.agentSessions === true;
      this.workspaceEditingAvailable = data?.capabilities?.workspaceEditing === true;
      this.remoteBrowserAvailable = data?.capabilities?.remoteBrowser === true;
    }
    return data as T;
  }

  reconnect() { return this.transport.reconnect(); }
  close() { openTransports.delete(this.transport); this.transport.close(); }
}
