"use client";
import { SharedWorkspaceError, type SharedWorkspaceClient } from "./shared-workspace-client";
import { liteFetch } from '@/lib/lite-connection';

/** VibeGhost v2's transport: VibeGhost's own HTTP API, asked directly (no iroh, no relay, no WASM).
 *  It has the same surface as SharedWorkspaceClient, so the same mini-app UI runs on either one.
 *  The iroh share gateway renames a few session-scoped calls before they reach VibeGhost; the same
 *  renames are done here so the UI's requests mean the same thing. */
export const VIBEGHOST_V2_API = "/api/vibeghost-v2";
const sessionGit = /^\/api\/sessions\/[A-Za-z0-9_-]+\/(git\/(?:stage|unstage|revert|commit|pull|push))$/;
const sessionUpload = /^\/api\/sessions\/[A-Za-z0-9_-]+\/upload$/;
const agentAction = /^\/api\/sessions\/[A-Za-z0-9_-]+\/actions\/(?:revive|fork)$/;

/** Like the share gateway, a client made for one workspace sees only that workspace: its session
 *  list and workspace list are cut down to it. Without a workspace it sees everything. */
export class DirectWorkspaceClient {
  constructor(readonly workspaceId = "", readonly workspaceName = "") {}
  readonly expiresAt = 0;
  readonly supportsRemoteBrowser = true;
  readonly supportsWorkspaceEditing = true;
  readonly supportsAgentSessions = true;
  readonly supportsGitWrites = true;
  private generation = 0;
  private closed = new AbortController();
  /** Requests made and failed, for the old-vs-v2 comparison. */
  readonly stats = { requests: 0, failures: 0, reconnects: 0 };
  get transportGeneration() { return this.generation; }

  async request(method: string, path: string, body?: Uint8Array | string | Record<string, unknown>, contentType?: string, signal?: AbortSignal) {
    if (!path.startsWith("/api/")) throw new Error("Invalid VibeGhost API path");
    const headers: Record<string, string> = {};
    let route = path;
    let payload: BodyInit | undefined;
    if (method === "POST" && sessionUpload.test(path)) route = "/api/files/upload";
    const git = method === "POST" ? sessionGit.exec(path) : null;
    if (git) route = `/api/${git[1]}`;
    if (body instanceof Uint8Array) payload = body as unknown as BodyInit;
    else if (typeof body === "string") payload = body;
    else if (body) {
      let fields = body;
      if (method === "POST" && agentAction.test(path)) {
        const { idempotencyKey, ...rest } = body;
        if (typeof idempotencyKey === "string") headers["Idempotency-Key"] = idempotencyKey;
        fields = rest;
      }
      payload = JSON.stringify(fields);
    }
    if (payload !== undefined) headers["content-type"] = contentType || "application/json";
    const timeoutMs = method === "POST" && path.endsWith("/upload") ? 120_000 : 45_000;
    const signals = [this.closed.signal, AbortSignal.timeout(timeoutMs)];
    if (signal) signals.push(signal);
    this.stats.requests += 1;
    try {
      const response = await liteFetch(route, { method, headers, body: payload, cache: "no-store", signal: AbortSignal.any(signals) });
      let bytes = new Uint8Array(await response.arrayBuffer());
      if (this.workspaceId && response.ok && method === "GET" && (path === "/api/sessions" || path === "/api/workspaces")) bytes = this.scope(path, bytes);
      const header = (key: string) => response.headers.get(`x-vibeghost-${key}`) ?? undefined;
      const integer = (key: string) => { const value = header(key); return value !== undefined && /^\d+$/.test(value) ? Number(value) : undefined; };
      return {
        status: response.status,
        contentType: response.headers.get("content-type") || "application/octet-stream",
        restoreTruncated: header("restore-truncated") === "1",
        outputEpoch: header("output-epoch"),
        outputCursorStart: integer("output-cursor-start"),
        outputCursorEnd: integer("output-cursor-end"),
        continuityLost: header("continuity-lost") === "1",
        sessionExited: header("session-exited") === "1",
        body: bytes,
      };
    } catch (error) {
      if (!signal?.aborted && !this.closed.signal.aborted) this.stats.failures += 1;
      throw error;
    }
  }

  async json<T>(method: string, path: string, body?: Record<string, unknown>, signal?: AbortSignal) {
    const response = await this.request(method, path, body, undefined, signal);
    const text = new TextDecoder().decode(response.body);
    if (response.status >= 400) {
      let message = `VibeGhost request failed (${response.status})`;
      let code: string | undefined;
      try { const parsed = JSON.parse(text) as { error?: unknown; message?: unknown; code?: unknown }; if (typeof parsed.error === "string") message = parsed.error; if (typeof parsed.code === "string") code = parsed.code; } catch {}
      throw new SharedWorkspaceError(message, response.status, code);
    }
    return JSON.parse(text) as T;
  }

  private scope(path: string, bytes: Uint8Array) {
    const data = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    const mine = (item: unknown, key: "workspaceId" | "id") => Boolean(item) && ((item as Record<string, unknown>)[key] || (key === "workspaceId" ? "default" : "")) === this.workspaceId;
    let scoped: unknown = data;
    if (path === "/api/sessions" && Array.isArray(data)) scoped = data.filter(item => mine(item, "workspaceId"));
    else if (path === "/api/workspaces" && data && typeof data === "object" && Array.isArray((data as { workspaces?: unknown }).workspaces))
      scoped = { ...data, workspaces: (data as { workspaces: unknown[] }).workspaces.filter(item => mine(item, "id")) };
    return new TextEncoder().encode(JSON.stringify(scoped));
  }

  /** Nothing to redial: each request is its own. Open terminals read the new generation and resync. */
  async reconnect() { this.generation += 1; this.stats.reconnects += 1; }
  close() { this.closed.abort(); }
}

/** The UI is typed against the iroh client; the direct client has the same public surface. */
export const asWorkspaceClient = (client: DirectWorkspaceClient) => client as unknown as SharedWorkspaceClient;
