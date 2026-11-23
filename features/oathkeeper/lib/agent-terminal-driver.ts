"use client"
// Drives an agent's terminal through VibeGhost's session API: reads its
// visible screen (/text) and writes keys (/input). Steps go one write at a
// time with a short gap, because the dialogs read a burst of keys as typed
// text (a whole plan in one write answers "Chat about this").
import type { SharedWorkspaceClient } from "./shared-workspace-client"

const STEP_GAP_MS = 140

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, ms)
  signal?.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
})

export async function readAgentScreen(client: SharedWorkspaceClient, sessionId: string, signal?: AbortSignal): Promise<string> {
  const response = await client.request("GET", `/api/sessions/${encodeURIComponent(sessionId)}/text`, undefined, undefined, signal)
  if (response.status >= 400) throw new Error("Could not read the terminal.")
  return new TextDecoder().decode(response.body)
}

export async function sendAgentSteps(client: SharedWorkspaceClient, sessionId: string, steps: readonly string[], signal?: AbortSignal) {
  for (const [index, text] of steps.entries()) {
    signal?.throwIfAborted()
    if (index) await sleep(STEP_GAP_MS, signal)
    await client.json("POST", `/api/sessions/${encodeURIComponent(sessionId)}/input`, { text }, signal)
  }
}
