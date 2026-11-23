// Provider-neutral questions an agent asks the person (Claude's AskUserQuestion
// today). Shared by the transcript projection, the chat card and the server's
// answer route, so it must stay free of Node-only imports.

export const ASK_USER_QUESTION_TOOL = "AskUserQuestion"

export type AgentQuestionKind = "choice" | "text" | "number"

export type AgentQuestionOption = {
  /** Exact label: a choice answer is this string, unchanged. */
  label: string
  description?: string
  /** Markdown or HTML preview text. Always rendered as plain text. */
  preview?: string
}

export type AgentQuestion = {
  /** Exact question text: answers are keyed by it, unchanged. */
  question: string
  header?: string
  description?: string
  kind: AgentQuestionKind
  multiSelect: boolean
  options: AgentQuestionOption[]
  placeholder?: string
  min?: number
  max?: number
  step?: number
  unit?: string
}

export type AgentQuestionSet = { title?: string; questions: AgentQuestion[] }

export type AgentQuestionAnswers = Record<string, string>

/** One question call as the chat shows it. */
export type AgentQuestionRequest = AgentQuestionSet & {
  /** The provider's tool-use id, when the transcript records one. */
  toolUseId?: string
  /** Answers recorded in the transcript once the call completed. */
  answers?: AgentQuestionAnswers
  /** Set by the owning server: a live hook can take this answer from chat. */
  answerable?: boolean
}

export const AGENT_QUESTION_LIMITS = {
  questions: 12,
  options: 12,
  questionChars: 4_000,
  headerChars: 200,
  labelChars: 1_000,
  descriptionChars: 2_000,
  previewChars: 8_000,
  titleChars: 300,
  answerChars: 8_000,
} as const

// Control characters other than tab and newline. The transcript parser strips
// the same set, so answer keys compare against what the chat received.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

/** Display text: control characters removed, trimmed, bounded. */
function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined
  const cleaned = value.replace(CONTROL, "").trim()
  return cleaned ? cleaned.slice(0, max) : undefined
}

/** Identity text (question, label): kept exactly, or rejected. */
function exact(value: unknown, max: number): string | undefined {
  if (typeof value !== "string" || !value.trim() || value.length > max || CONTROL.test(value)) {
    CONTROL.lastIndex = 0
    return undefined
  }
  return value
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

/** Parses a question tool's input. Anything malformed returns undefined, so
 * the call falls back to an ordinary tool row instead of a half-built card. */
export function parseAgentQuestionSet(input: unknown): AgentQuestionSet | undefined {
  const value = record(input)
  const questions = value?.questions
  if (!Array.isArray(questions) || questions.length === 0 || questions.length > AGENT_QUESTION_LIMITS.questions) return undefined
  const parsed: AgentQuestion[] = []
  const seen = new Set<string>()
  for (const item of questions) {
    const entry = record(item)
    const question = exact(entry?.question, AGENT_QUESTION_LIMITS.questionChars)
    if (!entry || !question || seen.has(question)) return undefined
    seen.add(question)
    const kind: AgentQuestionKind = entry.kind === "text" || entry.kind === "number" ? entry.kind : "choice"
    const options: AgentQuestionOption[] = []
    if (Array.isArray(entry.options)) {
      if (entry.options.length > AGENT_QUESTION_LIMITS.options) return undefined
      for (const raw of entry.options) {
        const option = record(raw)
        const label = exact(option?.label, AGENT_QUESTION_LIMITS.labelChars)
        if (!option || !label) return undefined
        const description = text(option.description, AGENT_QUESTION_LIMITS.descriptionChars)
        const preview = text(option.preview, AGENT_QUESTION_LIMITS.previewChars)
        options.push({ label, ...(description ? { description } : {}), ...(preview ? { preview } : {}) })
      }
    }
    if (kind === "choice" && options.length === 0) return undefined
    const header = text(entry.header, AGENT_QUESTION_LIMITS.headerChars)
    const description = text(entry.description, AGENT_QUESTION_LIMITS.descriptionChars)
    const placeholder = text(entry.placeholder, AGENT_QUESTION_LIMITS.headerChars)
    const unit = text(entry.unit, 40)
    const min = finite(entry.min), max = finite(entry.max), step = finite(entry.step)
    parsed.push({
      question, kind, multiSelect: kind === "choice" && entry.multiSelect === true,
      options: kind === "choice" ? options : [],
      ...(header ? { header } : {}), ...(description ? { description } : {}),
      ...(placeholder ? { placeholder } : {}), ...(unit ? { unit } : {}),
      ...(kind === "number" && min !== undefined ? { min } : {}),
      ...(kind === "number" && max !== undefined ? { max } : {}),
      ...(kind === "number" && step !== undefined ? { step } : {}),
    })
  }
  const title = text(value?.title, AGENT_QUESTION_LIMITS.titleChars)
  return { ...(title ? { title } : {}), questions: parsed }
}

/** Answers a finished call recorded (`toolUseResult.answers`), bounded. */
export function parseRecordedAnswers(value: unknown): AgentQuestionAnswers | undefined {
  const answers = record(value)
  if (!answers) return undefined
  const result: AgentQuestionAnswers = {}
  for (const [question, answer] of Object.entries(answers).slice(0, AGENT_QUESTION_LIMITS.questions)) {
    const joined = Array.isArray(answer) ? answer.filter(item => typeof item === "string").join(", ") : answer
    const bounded = text(joined, AGENT_QUESTION_LIMITS.answerChars)
    if (bounded) result[question.replace(CONTROL, "").slice(0, AGENT_QUESTION_LIMITS.questionChars)] = bounded
  }
  return Object.keys(result).length ? result : undefined
}

/** Claude's multi-select encoding: labels joined by ", "; a label that holds
 * ", " or a quote is JSON-quoted so the list still splits unambiguously. */
export function encodeMultiSelectAnswer(labels: readonly string[]): string {
  return labels.map(label => label.includes(", ") || label.includes('"') ? JSON.stringify(label) : label).join(", ")
}

export type AnswerValidation = { ok: true; answers: AgentQuestionAnswers } | { ok: false; error: string }

/** Answers must name questions in the set, as bounded single strings. Empty
 * answers are dropped; at least one must remain. */
export function validateAgentQuestionAnswers(questions: readonly string[], value: unknown): AnswerValidation {
  const answers = record(value)
  if (!answers) return { ok: false, error: "Answers must be an object keyed by question text." }
  const known = new Set(questions)
  const result: AgentQuestionAnswers = {}
  for (const [question, answer] of Object.entries(answers)) {
    if (!known.has(question)) return { ok: false, error: "An answer names a question that was not asked." }
    if (typeof answer !== "string") return { ok: false, error: "Each answer must be a string." }
    if (answer.length > AGENT_QUESTION_LIMITS.answerChars) return { ok: false, error: "An answer is too long." }
    const cleaned = answer.replace(CONTROL, "")
    if (cleaned.trim()) result[question] = cleaned
  }
  return Object.keys(result).length ? { ok: true, answers: result } : { ok: false, error: "Answer at least one question." }
}

/** The question texts that key answers and correlate a waiting hook. */
export function agentQuestionTexts(set: AgentQuestionSet): string[] {
  return set.questions.map(question => question.question)
}
