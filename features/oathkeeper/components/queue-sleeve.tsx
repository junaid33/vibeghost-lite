"use client"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown, X } from "@/components/icons/duo"
import { Spinner } from "@/components/ui/spinner"
import { editableQueueText, type QueuedMessage } from "../lib/agent-queue"
import type { QueueSleeveItem } from "../lib/pending-chat-messages"
import composerStyles from "./home-composer.module.css"
import endedStyles from "./session-ended-status.module.css"
import styles from "./queue-sleeve.module.css"

/** Where the sleeve attaches: the top of the session controls (where
 *  "Session ended" sits, above the session dropdown and the input card), or
 *  just above a standalone composer. Found from the chat's own position so
 *  the session view needs no wiring; without either it stays in the thread. */
function findSleeveSlot(anchor: HTMLElement): { parent: HTMLElement; before: Node | null } | undefined {
  for (let node = anchor.parentElement; node; node = node.parentElement) {
    const controls = node.querySelector<HTMLElement>("[data-terminal-controls]")
    if (controls) return { parent: controls, before: controls.firstChild }
    const form = node.querySelector<HTMLElement>("[data-composer-surface]")?.closest("form")
    if (form?.parentElement) return { parent: form.parentElement, before: form }
  }
  return undefined
}

function useSleeveHost(anchor: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [missing, setMissing] = useState(false)
  useLayoutEffect(() => {
    const element = anchor.current
    if (!enabled || !element) return
    const slot = findSleeveSlot(element)
    setMissing(!slot)
    if (!slot) return
    const div = document.createElement("div")
    div.setAttribute("data-queue-sleeve-host", "")
    div.className = styles.host
    slot.parent.insertBefore(div, slot.before)
    setHost(div)
    return () => { div.remove(); setHost(null) }
  }, [anchor, enabled])
  return { host, missing }
}

/**
 * The agent's own input queue as a sleeve attached above the session
 * controls, the same tab material as "Session ended" and live dictation. The
 * "N queued" row collapses it; each message is one line with its kind and a
 * remove button; tapping a message edits its full text in place. Save
 * rewrites the real queue (agent-queue.ts); nothing is held only in this page.
 * Render only while Chat shows: the terminal has Pi's own queue lines.
 */
export function QueueSleeve({ items, busy, error, onRemove, onEdit }: {
  items: readonly QueueSleeveItem[]
  busy: boolean
  error?: string
  onRemove: (item: QueuedMessage) => void
  onEdit: (item: QueuedMessage, text: string) => void
}) {
  const anchor = useRef<HTMLSpanElement>(null)
  const { host, missing } = useSleeveHost(anchor, items.length > 0)
  const sleeve = items.length ? <SleeveBody items={items} busy={busy} error={error} onRemove={onRemove} onEdit={onEdit}/> : null
  return <>
    <span ref={anchor} hidden/>
    {sleeve && host ? createPortal(sleeve, host) : missing ? sleeve : null}
  </>
}

function SleeveBody({ items, busy, error, onRemove, onEdit }: Parameters<typeof QueueSleeve>[0]) {
  const [draft, setEditing] = useState<{ id: string; text: string; original: string }>()
  const [collapsed, setCollapsed] = useState(false)
  // A message the agent took while it was open is gone, and its editor with it.
  const editing = draft && items.some(item => item.id === draft.id) ? draft : undefined
  const editingId = editing?.id
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const field = textareaRef.current
    if (!editingId || !field) return
    field.focus()
    field.setSelectionRange(field.value.length, field.value.length)
  }, [editingId])
  useEffect(() => {
    const field = textareaRef.current
    if (!field) return
    field.style.height = "auto"
    field.style.height = `${field.scrollHeight}px`
  }, [editing?.text])
  const save = (item: QueuedMessage) => {
    const text = editing?.text.trim()
    const original = editing?.original
    setEditing(undefined)
    if (!text) onRemove(item)
    else if (text !== original) onEdit(item, text)
  }
  return (
    <section data-queue-sleeve aria-label="Queued messages" className={`${composerStyles.uploadStatus} ${endedStyles.status} ${styles.sleeve} font-sans`}>
      <button type="button" className={styles.head} data-busy={busy || undefined} aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)}>
        <span className={styles.headLabel}>{items.length === 1 ? "1 queued" : `${items.length} queued`}</span>
        {busy ? <Spinner className="size-3" /> : null}
        <ChevronDown className={styles.caret} data-collapsed={collapsed || undefined} aria-hidden />
      </button>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      {collapsed ? null : <ol className={styles.list}>
        {items.map(item => {
          const open = editing?.id === item.id
          const mode = item.mode === "followUp" ? "Follow-up" : "Steer"
          return (
            <li key={item.id} className={styles.item} data-editing={open || undefined} data-pending={item.pending || undefined}>
              {open ? (
                <div className={styles.editor}>
                  <span className={styles.mode}>{mode}</span>
                  <textarea
                    ref={textareaRef}
                    className={styles.field}
                    rows={1}
                    aria-label="Edit queued message"
                    value={editing.text}
                    onChange={event => setEditing({ ...editing, text: event.target.value })}
                    onBlur={() => { if (editing.text === editing.original) setEditing(undefined) }}
                    onKeyDown={event => {
                      if (event.key === "Escape") { event.preventDefault(); setEditing(undefined) }
                      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); save(item) }
                    }}
                  />
                </div>
              ) : (
                <button type="button" className={styles.line} disabled={busy || item.pending}
                  aria-label={`Edit queued message: ${item.text}`}
                  onClick={() => { const text = editableQueueText(item); setEditing({ id: item.id, text, original: text }) }}>
                  <span className={styles.mode}>{mode}</span>
                  <span className={styles.text}>{item.text.replace(/\s+/g, " ")}</span>
                </button>
              )}
              {open ? (
                // Pointer down, not click: the field's blur would close the editor first.
                <button type="button" className={styles.action} disabled={busy} aria-label="Save queued message"
                  onPointerDown={event => event.preventDefault()} onClick={() => save(item)}><Check /></button>
              ) : (
                <button type="button" className={styles.action} disabled={busy || item.pending} aria-label={`Remove queued message: ${item.text}`}
                  onClick={() => onRemove(item)}><X /></button>
              )}
            </li>
          )
        })}
      </ol>}
    </section>
  )
}
