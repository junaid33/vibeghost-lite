import { KITTY_ALT_ENTER_SEQUENCE } from "./vibeghost-terminal/terminal-key-sequences.ts"

export type ComposerAgent = "pi" | "codex" | "claude"
export type AgentComposerDelivery = "enter" | "alt-enter"

/** Explicit tags opt into agent framing; names/commands are not reliable identity. */
export function getComposerAgent(
  tags?: readonly string[]
): ComposerAgent | undefined {
  const normalized = new Set(tags?.map((tag) => tag.trim().toLowerCase()))
  const agents = (["pi", "codex", "claude"] as const).filter((agent) => normalized.has(agent))
  return agents.length === 1 ? agents[0] : undefined
}

// Keep a complete paste + submit in one frame, comfortably below the default
// 1 MiB inbound limit. Never split a submit key into a separately retried write.
export const MAX_AGENT_COMPOSER_BYTES = 256 * 1024

export function encodeAgentComposerInput(
  text: string,
  mode: AgentComposerDelivery,
  agent: ComposerAgent
) {
  if (agent === "claude" && mode !== "enter") {
    throw new Error("Claude does not support this follow-up delivery mode.")
  }
  // Verified native Claude input: LF is content, CR is Return. The complete
  // paste plus ONE submit stays in the existing single shared-workspace RPC.
  const draft = (agent === "claude" ? text.replace(/\r\n?/g, "\n") : text).trim()
  if (!draft) throw new Error("Enter a message before sending.")
  // Escape/control bytes could terminate bracketed paste or invoke TUI actions.
  // Newlines and tabs are ordinary, intentional prompt content.
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(draft)) {
    throw new Error(
      "Remove terminal control characters from the message before sending."
    )
  }
  // Both Codex and Claude distinguish long raw text from explicit paste.
  // Native Claude 2.1.283 probes verified long/multiline paste + immediate CR.
  // Explicit paste boundaries clear that state before the actual submit key.
  // Codex queues with Tab; Pi queues with Kitty Alt+Enter. Never interchange them.
  const submit = mode === "alt-enter" ? agent === "pi" ? KITTY_ALT_ENTER_SEQUENCE : "\t" : "\r";
  const payload = `\x1b[200~${draft}\x1b[201~${submit}`
  if (new TextEncoder().encode(payload).byteLength > MAX_AGENT_COMPOSER_BYTES) {
    throw new Error("This message is too large. Upload it as a file instead.")
  }
  return payload
}
