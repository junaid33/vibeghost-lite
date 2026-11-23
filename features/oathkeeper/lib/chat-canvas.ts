import { readCanvasReference, type CanvasReference } from "@/lib/oathkeeper-canvas/theme";

type Part = { type?: string; state?: string; output?: unknown; result?: unknown; toolInvocation?: { result?: unknown } };

/** Canvases an assistant message published (a canvas_publish result), in order, once each. */
export function messageCanvases(parts: readonly unknown[] | undefined): CanvasReference[] {
  const seen = new Set<string>(), found: CanvasReference[] = [];
  for (const raw of parts ?? []) {
    const part = raw as Part;
    if (!part || typeof part.type !== "string" || !(part.type === "dynamic-tool" || part.type === "tool-invocation" || part.type.startsWith("tool-"))) continue;
    const reference = readCanvasReference(part.type === "tool-invocation" ? part.toolInvocation?.result : part.output ?? part.result);
    if (reference && !seen.has(reference.id)) { seen.add(reference.id); found.push(reference); }
  }
  return found;
}

/** MCP clients prefix tool names: mcp__oathkeeper-canvas__canvas_publish (Claude),
 *  oathkeeper-canvas.canvas_publish / oathkeeper-canvas_canvas_publish (Codex, Pi). */
export const isCanvasPublishTool = (name: string | undefined) => typeof name === "string" && /(^|[^a-z0-9])canvas_publish$/i.test(name.trim());

/** Pi calls MCP tools from codemode scripts, so the tool row is "codemode" and the script names canvas_publish. */
const callsCanvasPublish = (name: string | undefined, args: unknown) =>
  isCanvasPublishTool(name) || (/codemode/i.test(name ?? "") && (typeof args === "string" ? args : JSON.stringify(args ?? "")).includes("canvas_publish"));

/** A canvas reference anywhere in a transcript tool result: plain JSON, MCP content blocks,
 *  or JSON after a prefix (codemode's "Script completed … Output:"), nested a few levels. */
export function findCanvasReference(value: unknown, depth = 0): CanvasReference | undefined {
  if (depth > 6 || value == null) return undefined;
  if (typeof value === "string") {
    if (!value.includes("canvas") || !value.includes("cv_")) return undefined;
    const direct = readCanvasReference(value);
    if (direct) return direct;
    for (const start of [0, value.indexOf("{"), value.indexOf("[")]) {
      if (start < 0) continue;
      const end = Math.max(value.lastIndexOf("}"), value.lastIndexOf("]"));
      if (end <= start) continue;
      try { const found = findCanvasReference(JSON.parse(value.slice(start, end + 1)), depth + 1); if (found) return found; } catch { /* not JSON */ }
    }
    return undefined;
  }
  if (typeof value !== "object") return undefined;
  const direct = readCanvasReference(value);
  if (direct) return direct;
  for (const child of Array.isArray(value) ? value : Object.values(value as Record<string, unknown>)) {
    const found = findCanvasReference(child, depth + 1);
    if (found) return found;
  }
  return undefined;
}

/** Canvases published by session-transcript tool calls (Pi semantic tools, Claude/Codex parts), once each. */
export function toolCanvases(tools: readonly { name?: string; args?: unknown; result?: unknown; isError?: boolean }[] | undefined, seen = new Set<string>()): CanvasReference[] {
  const found: CanvasReference[] = [];
  for (const tool of tools ?? []) {
    if (!tool || tool.isError || !callsCanvasPublish(tool.name, tool.args)) continue;
    const reference = findCanvasReference(tool.result);
    if (reference && !seen.has(reference.id)) { seen.add(reference.id); found.push(reference); }
  }
  return found;
}
