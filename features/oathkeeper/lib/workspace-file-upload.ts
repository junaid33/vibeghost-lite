import type { SharedWorkspaceClient } from "./shared-workspace-client";

// Leave room for multipart framing under Iroh's 12 MiB request limit.
export const MAX_WORKSPACE_UPLOAD_BYTES = 10 * 1024 * 1024;

export function quoteUploadedPath(path: unknown): string {
  if (typeof path !== "string" || !path.startsWith("/") || path.length > 4096
    || [...path].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    throw new Error("VibeGhost returned an invalid upload path.");
  }
  // Shell-safe even when a control directory contains spaces, quotes or $().
  return `'${path.replaceAll("'", "'\\''")}'`;
}

export async function uploadWorkspaceFile(client: Pick<SharedWorkspaceClient, "request">, sessionId: string, file: File, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (!file.size) throw new Error(`${file.name || "File"} is empty.`);
  if (file.size > MAX_WORKSPACE_UPLOAD_BYTES) throw new Error(`${file.name || "File"} exceeds the 10 MB upload limit.`);
  const form = new FormData();
  form.append("file", file, file.name || "pasted-image.png");
  // Response serializes multipart locally, including the boundary; no HTTP request is made here.
  const multipart = new Response(form);
  const bytes = new Uint8Array(await multipart.arrayBuffer());
  signal?.throwIfAborted();
  const response = await client.request("POST", `/api/sessions/${encodeURIComponent(sessionId)}/upload`, bytes, multipart.headers.get("content-type")!, signal);
  signal?.throwIfAborted();
  if (response.status === 403 || response.status === 404) {
    throw new Error("Uploads are unavailable on this connection. Its VibeGhost workspace-sharing gateway may need updating.");
  }
  if (response.status >= 400) throw new Error(`Upload failed (${response.status}). Nothing was sent to the terminal.`);
  let result: { path?: unknown };
  try { result = JSON.parse(new TextDecoder().decode(response.body)); }
  catch { throw new Error("VibeGhost returned an invalid upload response."); }
  return quoteUploadedPath(result?.path);
}
