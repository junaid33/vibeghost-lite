// Full texts sent to a Pi session from this browser. Pi draws each queued
// message as one cut line ("Follow-up: first words..."); the queue cards take
// the full text from VibeGhost's Pi extension record first (pi-queue.json,
// which also has texts other sessions sent through the MCP), and from here
// when that record is missing. Kept per session in localStorage,
// not component state: switching to Terminal and back, or reloading, used to
// forget them and the editor opened on the cut line.
// Kept in sync with VibeGhost's lib/ui/pi-sent-texts.ts.

const KEY = "oathkeeper-pi-sent-texts-v1"
const PER_SESSION = 20
const SESSIONS = 40

type Store = Record<string, { at: number; texts: string[] }>

function read(): Store {
  if (typeof window === "undefined") return {}
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) || "{}")
    if (!value || typeof value !== "object" || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).flatMap(([id, entry]) => {
      if (!entry || typeof entry !== "object") return []
      const row = entry as { at?: unknown; texts?: unknown }
      if (typeof row.at !== "number" || !Number.isFinite(row.at) || !Array.isArray(row.texts)) return []
      return [[id, { at: row.at, texts: row.texts.filter((text): text is string => typeof text === "string" && Boolean(text.trim())).slice(-PER_SESSION) }]]
    }))
  } catch { return {} }
}

/** Remembers a message sent to `sessionId` (bounded per session and overall). */
export function rememberPiSentText(sessionId: string, text: string, now = Date.now()) {
  const trimmed = text.trim()
  if (!sessionId || !trimmed || typeof window === "undefined") return
  const store = read()
  const texts = [...(store[sessionId]?.texts ?? []).filter(item => item !== trimmed), trimmed].slice(-PER_SESSION)
  store[sessionId] = { at: now, texts }
  const kept = Object.entries(store).sort(([, a], [, b]) => b.at - a.at).slice(0, SESSIONS)
  try { window.localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept))) } catch { /* storage full: the cards show cut lines */ }
}

export function piSentTexts(sessionId: string): string[] {
  const texts = read()[sessionId]?.texts
  return Array.isArray(texts) ? texts.filter((text): text is string => typeof text === "string") : []
}
