// Answering Claude Code's AskUserQuestion dialog by typing into its terminal,
// for sessions with no VibeGhost question hook waiting. The key map was probed
// against the installed Claude Code 2.1.311/2.1.312 TUI (2026-10-27):
//   - Each question tab opens with the cursor on the first row.
//   - Single select: a digit picks that option and moves to the next tab; on a
//     lone question it submits at once (no review screen).
//   - Multi select: a digit toggles that option without moving the cursor.
//     Below the options sit "Type something", then the Next/Submit row.
//   - "Type something": move onto the row and paste; the row checks itself.
//     Enter there picks it (single select); Tab moves on to Next/Submit
//     (multi select).
//   - Several questions, or any multi-select question, end on a review
//     screen whose option 1 is "Submit answers".
// Answers Claude records: labels exactly; multi-select joined by ", ", with a
// label holding ", " or a quote JSON-quoted (matches encodeMultiSelectAnswer).
import type { AgentQuestion } from "./agent-questions.ts"

export type QuestionDraft = { selected: readonly string[]; other?: string }

const DOWN = "\x1b[B"
const TAB = "\t"
const ENTER = "\r"
const paste = (text: string) => `\x1b[200~${text}\x1b[201~`
// Paste content must not end the bracketed paste or drive the TUI.
const CONTROL = /[\x00-\x08\x0b-\x1f\x7f]/

export type KeystrokePlan = { ok: true; steps: string[] } | { ok: false; error: string }

/** Every question needs an answer, digits reach at most nine options, and
 *  only choice questions have a known dialog. */
export function planClaudeQuestionKeys(questions: readonly AgentQuestion[], drafts: readonly QuestionDraft[]): KeystrokePlan {
  if (!questions.length || drafts.length !== questions.length) return { ok: false, error: "Answer every question." }
  const steps: string[] = []
  for (const [index, question] of questions.entries()) {
    const draft = drafts[index]
    const other = draft.other?.trim() ?? ""
    if (question.kind !== "choice") return { ok: false, error: "Answer this question in the terminal." }
    if (question.options.length > 9) return { ok: false, error: "Answer this question in the terminal." }
    if (other && (CONTROL.test(other) || other.includes("\n"))) return { ok: false, error: "Use one line for your own answer." }
    // Every tab opens on row 1 and digits never move the cursor, so rows are
    // counted from the top. (Arrow keys wrap, so "Up to the top" is not safe.)
    const fromTop = (rows: number) => DOWN.repeat(rows)
    const picked = draft.selected.map(label => question.options.findIndex(option => option.label === label))
    if (picked.some(position => position < 0)) return { ok: false, error: "An answer is not one of the options." }
    if (!question.multiSelect) {
      if (other) steps.push(fromTop(question.options.length), paste(other), ENTER)
      else if (picked.length === 1) steps.push(String(picked[0] + 1))
      else return { ok: false, error: "Answer every question." }
      continue
    }
    if (!picked.length && !other) return { ok: false, error: "Answer every question." }
    for (const position of [...new Set(picked)].sort((a, b) => a - b)) steps.push(String(position + 1))
    if (other) steps.push(fromTop(question.options.length), paste(other), TAB)
    else steps.push(fromTop(question.options.length + 1))
    steps.push(ENTER)
  }
  const review = questions.length > 1 || questions.some(question => question.multiSelect)
  if (review) steps.push("1")
  return { ok: true, steps }
}

/** The dialog for these questions is on screen: the first question (or the
 *  one in view) and Claude's dialog footer. Typing anywhere else could answer
 *  a different prompt. */
export function claudeQuestionDialogVisible(screen: string, questions: readonly AgentQuestion[]): boolean {
  const flat = screen.replace(/\s+/g, " ")
  const footer = /Enter to select/.test(flat) && /Esc to cancel/.test(flat)
  if (!footer) return false
  // ☒ marks a tab already answered in the terminal: the plan starts from a
  // fresh dialog, so a half-answered one is left to the terminal.
  if (flat.includes("☒")) return false
  // The first tab is the one in view before anything is typed. Long questions
  // wrap, so compare a whitespace-collapsed opening.
  const first = questions[0]?.question.replace(/\s+/g, " ").slice(0, 60)
  return Boolean(first && flat.includes(first))
}
