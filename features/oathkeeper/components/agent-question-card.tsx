"use client"
import { useId, useState } from "react"
import { Check, ChevronLeft, ChevronRight, MessageCircle, TerminalSquare } from "@/components/icons/duo"
import { Spinner } from "@/components/ui/spinner"
import { encodeMultiSelectAnswer, type AgentQuestion, type AgentQuestionAnswers, type AgentQuestionRequest } from "../lib/agent-questions"
import type { QuestionDraft } from "../lib/claude-question-keys"
import styles from "./agent-question-card.module.css"

type Draft = { selected: string[]; other: string; otherOn: boolean; text: string }
const emptyDraft: Draft = { selected: [], other: "", otherOn: false, text: "" }

/** What the card sends for a question: Claude's exact answer string. */
export function answerFor(question: AgentQuestion, draft: Draft): string {
  if (question.kind !== "choice") return draft.text.trim()
  const other = draft.otherOn ? draft.other.trim() : ""
  if (!question.multiSelect) return other || draft.selected[0] || ""
  const labels = question.options.map(option => option.label).filter(label => draft.selected.includes(label))
  return labels.length || other ? encodeMultiSelectAnswer(other ? [...labels, other] : labels) : ""
}

export type QuestionSubmit = {
  /** Strings keyed by exact question text (the hook path). */
  answers: AgentQuestionAnswers
  /** Per question, in order: picked labels and the Other text (the terminal path). */
  drafts: QuestionDraft[]
}

/**
 * A question set the agent asked (Claude's AskUserQuestion), one question at
 * a time behind a ‹ n of m › pager. While it is open the terminal dialog is
 * live too; the first answer is the one used.
 */
export function AgentQuestionCard({ request, running, author, onAnswer, onOpenTerminal, unanswerable }: {
  request: AgentQuestionRequest
  /** The tool call has no result yet. */
  running: boolean
  author: string
  onAnswer?: (submit: QuestionSubmit) => Promise<void>
  onOpenTerminal?: () => void
  /** Why this open question can only be answered in the terminal. */
  unanswerable?: string
}) {
  const baseId = useId()
  const count = request.questions.length
  const [page, setPage] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string>()
  const answered = Boolean(request.answers) || !running
  const canAnswer = running && !answered && Boolean(onAnswer) && !unanswerable && !sent
  const draftOf = (question: AgentQuestion) => drafts[question.question] ?? emptyDraft
  const update = (question: AgentQuestion, change: (draft: Draft) => Draft) => {
    setError(undefined)
    setDrafts(current => ({ ...current, [question.question]: change(current[question.question] ?? emptyDraft) }))
  }
  const answers = Object.fromEntries(request.questions.flatMap(question => {
    const answer = answerFor(question, draftOf(question))
    return answer ? [[question.question, answer]] : []
  }))
  const done = request.questions.filter(question => answers[question.question]).length
  const complete = done === count
  const current = request.questions[Math.min(page, count - 1)]

  const submit = async () => {
    if (!onAnswer || !complete || sending) return
    setSending(true); setError(undefined)
    try {
      await onAnswer({
        answers,
        drafts: request.questions.map(question => {
          const draft = draftOf(question)
          return question.kind !== "choice" ? { selected: [], other: draft.text.trim() }
            : { selected: question.options.map(option => option.label).filter(label => draft.selected.includes(label)), other: draft.otherOn ? draft.other.trim() : undefined }
        }),
      })
      setSent(true)
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The answer was not sent.") }
    finally { setSending(false) }
  }
  // Picking a single answer moves on to the next unanswered question.
  const advance = () => {
    if (page < count - 1) setPage(page + 1)
  }

  const state = answered ? "answered" : sent ? "sent" : canAnswer || sending ? "open" : "closed"
  const label = answered ? "Answered" : sent ? "Sent" : running ? "Waiting for you" : "Not answered"
  const title = request.title || (count > 1 ? `${author} asked ${count} questions` : `${author} asked`)

  if (answered) {
    return (
      <section className={styles.card} data-state="answered" aria-label={title}>
        <header className={styles.head}>
          <span className={styles.mark} aria-hidden="true"><MessageCircle /></span>
          <h3 className={styles.title}>{title}</h3>
          <span className={styles.state}>{label}</span>
        </header>
        <div className={styles.summary}>
          {request.questions.map(question => (
            <span key={question.question}>{question.header || question.question} <b>{request.answers?.[question.question] ?? "—"}</b></span>
          ))}
        </div>
      </section>
    )
  }

  const draft = draftOf(current)
  const name = `${baseId}-${page}`
  const preview = current.options.find(option => option.preview && draft.selected.includes(option.label))?.preview
  return (
    <section className={styles.card} data-state={state} aria-label={title}>
      <header className={styles.head}>
        <span className={styles.mark} aria-hidden="true"><MessageCircle /></span>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.state} role="status">{label}</span>
      </header>
      <div className={styles.body}>
        <fieldset key={current.question} className={styles.question} disabled={!canAnswer || sending}>
          <legend className={styles.legend}>
            {current.header || current.multiSelect ? (
              <span className={styles.legendRow}>
                {current.header ? <span className={styles.chip}>{current.header}</span> : null}
                {current.multiSelect ? <span className={styles.multi}>Choose any</span> : null}
              </span>
            ) : null}
            <span className={styles.text}>{current.question}</span>
          </legend>
          {current.description ? <p className={styles.hint}>{current.description}</p> : null}
          {current.kind === "number" ? (
            <div className={styles.numberRow}>
              <input className={styles.otherInput} type="number" inputMode="decimal" aria-label={current.question} min={current.min} max={current.max} step={current.step}
                value={draft.text} onChange={event => update(current, value => ({ ...value, text: event.target.value }))}/>
              {current.unit ? <span className={styles.hint}>{current.unit}</span> : null}
            </div>
          ) : current.kind === "text" ? (
            <textarea className={styles.textarea} aria-label={current.question} placeholder={current.placeholder} rows={3}
              value={draft.text} onChange={event => update(current, value => ({ ...value, text: event.target.value }))}/>
          ) : (
          <div className={styles.options} role={current.multiSelect ? "group" : "radiogroup"} aria-label={current.question}>
            {current.options.map(option => {
              const checked = draft.selected.includes(option.label)
              return (
                <label key={option.label} className={styles.option} data-checked={checked || undefined}>
                  <input
                    type={current.multiSelect ? "checkbox" : "radio"}
                    name={name}
                    checked={checked}
                    onChange={() => {
                      update(current, value => current.multiSelect
                        ? { ...value, selected: checked ? value.selected.filter(label => label !== option.label) : [...value.selected, option.label] }
                        : { ...value, selected: [option.label], otherOn: false })
                      if (!current.multiSelect) advance()
                    }}
                  />
                  <span className={styles.tick} data-shape={current.multiSelect ? "box" : undefined} aria-hidden="true"><Check /></span>
                  <span className={styles.optionBody}>
                    <span className={styles.label}>{option.label}</span>
                    {option.description ? <span className={styles.description}>{option.description}</span> : null}
                  </span>
                </label>
              )
            })}
            <label className={styles.option} data-checked={draft.otherOn || undefined}>
              <input
                type={current.multiSelect ? "checkbox" : "radio"}
                name={name}
                checked={draft.otherOn}
                onChange={() => update(current, value => ({ ...value, otherOn: current.multiSelect ? !value.otherOn : true, selected: current.multiSelect ? value.selected : [] }))}
              />
              <span className={styles.tick} data-shape={current.multiSelect ? "box" : undefined} aria-hidden="true"><Check /></span>
              <span className={styles.optionBody}>
                <span className={styles.label}>Other</span>
                {draft.otherOn ? (
                  <input
                    className={styles.otherInput}
                    aria-label={`Your answer to: ${current.question}`}
                    value={draft.other}
                    autoFocus
                    maxLength={2000}
                    onChange={event => update(current, value => ({ ...value, other: event.target.value.replace(/[\r\n]+/g, " ") }))}
                    onKeyDown={event => {
                      if (event.key !== "Enter" || event.nativeEvent.isComposing) return
                      event.preventDefault()
                      if (page < count - 1) advance(); else void submit()
                    }}
                  />
                ) : null}
              </span>
            </label>
          </div>
          )}
          {preview ? <pre className={styles.preview} tabIndex={0}>{preview}</pre> : null}
        </fieldset>
      </div>
      <footer className={styles.foot}>
        {count > 1 ? (
          <span className={styles.pager}>
            <span className={styles.pillTrack}><button type="button" className={styles.pill} data-icon="" aria-label="Previous question" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /></button></span>
            <span className={styles.count} aria-live="polite">{page + 1} of {count}</span>
            <span className={styles.pillTrack}><button type="button" className={styles.pill} data-icon="" aria-label="Next question" disabled={page === count - 1} onClick={() => setPage(page + 1)}><ChevronRight /></button></span>
          </span>
        ) : null}
        {error ? <span role="alert" className={styles.error}>{error}</span>
          : sent ? <span role="status" className={styles.note}>Waiting for {author}</span>
          : unanswerable && running ? <span className={styles.note}>{unanswerable}</span>
          : <span className={styles.spacer} />}
        <span className={styles.actions}>
          {onOpenTerminal && (unanswerable || error) ? (
            <span className={styles.pillTrack}><button type="button" className={styles.pill} onClick={onOpenTerminal}><TerminalSquare />Terminal</button></span>
          ) : null}
          {canAnswer || sending ? (
            <span className={styles.pillTrack}>
              <button type="button" className={styles.pill} data-primary="" disabled={!complete || sending} onClick={() => void submit()}>
                {sending ? <Spinner className="size-3" /> : null}
                {sending ? "Sending" : count > 1 && !complete ? `Answer ${done} of ${count}` : "Send"}
              </button>
            </span>
          ) : null}
        </span>
      </footer>
    </section>
  )
}

/** Answers from Claude's tool result text (`"Q"="A", "Q2"="B"`), for
 *  transcripts whose projection carries no structured answers. */
export function answersFromResult(result: string | undefined, questions: readonly AgentQuestion[]): AgentQuestionAnswers | undefined {
  if (!result) return undefined
  const found: AgentQuestionAnswers = {}
  for (const question of questions) {
    const key = JSON.stringify(question.question)
    const index = result.indexOf(`${key}=`)
    if (index < 0) continue
    const match = /^"(?:[^"\\]|\\.)*"/.exec(result.slice(index + key.length + 1))
    if (!match) continue
    try { found[question.question] = JSON.parse(match[0]) } catch { /* not this question */ }
  }
  return Object.keys(found).length ? found : undefined
}
