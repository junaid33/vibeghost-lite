/** Published default keymaps only; these are terminal bytes, not shell commands. */
export type ProgramControl = { label: string; shortcut: string; input: string; description: string }

export const TMUX_CONTROLS: readonly ProgramControl[] = [
  { label: "New window", shortcut: "^B c", input: "\x02c", description: "Create a tmux window" },
  { label: "Previous window", shortcut: "^B p", input: "\x02p", description: "Select the previous window" },
  { label: "Next window", shortcut: "^B n", input: "\x02n", description: "Select the next window" },
  { label: "Split left/right", shortcut: "^B %", input: "\x02%", description: "Split the current pane vertically" },
  { label: "Split top/bottom", shortcut: '^B "', input: '\x02"', description: "Split the current pane horizontally" },
  { label: "Focus left", shortcut: "^B ←", input: "\x02\x1b[D", description: "Select the pane on the left" },
  { label: "Focus down", shortcut: "^B ↓", input: "\x02\x1b[B", description: "Select the pane below" },
  { label: "Focus up", shortcut: "^B ↑", input: "\x02\x1b[A", description: "Select the pane above" },
  { label: "Focus right", shortcut: "^B →", input: "\x02\x1b[C", description: "Select the pane on the right" },
]

/** Claude Code defaults. Busy Enter may join ongoing work, not wait for its end.
 * Ctrl+X Ctrl+S consumes pending input immediately and may interrupt work;
 * neither it nor Enter is an after-work follow-up. Custom keymaps may differ. */
export const CLAUDE_PROMPT_CONTROLS: readonly ProgramControl[] = [
  { label: "Recall queued prompt", shortcut: "↑", input: "\x1b[A", description: "On the first editor row, recall queued messages or prompt history" },
  { label: "Send immediately (may interrupt)", shortcut: "Ctrl+X Ctrl+S", input: "\x18\x13", description: "Consume pending native input immediately; may interrupt ongoing work. Not an after-work follow-up." },
  { label: "Detailed transcript", shortcut: "Ctrl+O", input: "\x0f", description: "Toggle Claude’s detailed transcript view" },
  { label: "Search history", shortcut: "Ctrl+R", input: "\x12", description: "Search Claude’s prompt history" },
  { label: "Cycle permission mode", shortcut: "Shift+Tab", input: "\x1b[Z", description: "Cycle Claude’s available permission modes" },
  { label: "Scroll transcript up", shortcut: "PageUp", input: "\x1b[5~", description: "Scroll within Claude’s fullscreen transcript, not the terminal buffer" },
  { label: "Scroll transcript down", shortcut: "PageDown", input: "\x1b[6~", description: "Scroll within Claude’s fullscreen transcript" },
  { label: "Interrupt", shortcut: "Escape", input: "\x1b", description: "Interrupt Claude’s current response" },
]

export const CODEX_PROMPT_CONTROLS: readonly ProgramControl[] = [
  { label: "Recall prompt", shortcut: "↑", input: "\x1b[A", description: "Recall older prompts from Codex’s editor" },
  { label: "Interrupt", shortcut: "Escape", input: "\x1b", description: "Interrupt Codex’s current response" },
]

export const PI_PROMPT_CONTROLS: readonly ProgramControl[] = [
  { label: "Cycle thinking level", shortcut: "Shift+Tab", input: "\x1b[Z", description: "Cycle the model’s reasoning effort" },
  // Ctrl+L opens the same picker as /model without appending to or submitting a draft.
  { label: "Choose model", shortcut: "/model", input: "\x0c", description: "Open the model picker with Ctrl+L; keep your draft" },
  { label: "Edit queued messages", shortcut: "Alt+↑", input: "\x1b[1;3A", description: "Restore queued messages into Pi’s editor" },
  { label: "Recall prompt", shortcut: "↑", input: "\x1b[A", description: "Browse older prompts at the top of the editor" },
  { label: "Toggle tool output", shortcut: "Ctrl+O", input: "\x0f", description: "Expand or collapse tool results" },
  { label: "Toggle thinking", shortcut: "Ctrl+T", input: "\x14", description: "Expand or collapse thinking blocks" },
]
