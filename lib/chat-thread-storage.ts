import type { UIMessage } from 'ai';

export const CHAT_THREADS_STORAGE_KEY = 'oathkeeper_chat_threads';
export const CHAT_THREADS_UPDATED_EVENT = 'oathkeeperChatThreadsUpdated';
// History is shared across tabs; the selected conversation belongs to this tab.
export const CHAT_ACTIVE_THREAD_STORAGE_KEY = 'oathkeeper_chat_active_thread';
export const NEW_CHAT_TITLE = 'New chat';

const STORAGE_VERSION = 1 as const;
const MAX_THREADS = 50;
const MAX_MESSAGES_PER_THREAD = 100;
const MAX_STORAGE_BYTES = 3_750_000;
const SENSITIVE_KEYS = new Set([
  '_meta',
  'authorization',
  'apikey',
  'cartproof',
  'clientsecret',
  'cookie',
  'ctoken',
  'paypalorderid',
  'proof',
  'sessiontoken',
  'set-cookie',
]);

export interface OathkeeperChatThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: UIMessage[];
  draft?: string;
}

export interface OathkeeperChatThreadState {
  version: typeof STORAGE_VERSION;
  activeThreadId: string;
  threads: OathkeeperChatThread[];
}

function emptyState(): OathkeeperChatThreadState {
  return { version: STORAGE_VERSION, activeThreadId: '', threads: [] };
}

function generateThreadId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createOathkeeperChatThread(now = Date.now()): OathkeeperChatThread {
  return {
    id: generateThreadId(),
    title: NEW_CHAT_TITLE,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStoredMessage(value: unknown): value is UIMessage {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' &&
    (value.role === 'user' || value.role === 'assistant' || value.role === 'system') &&
    Array.isArray(value.parts);
}

function normalizeThread(value: unknown): OathkeeperChatThread | null {
  if (!isRecord(value) ||
      typeof value.id !== 'string' ||
      typeof value.title !== 'string' ||
      typeof value.createdAt !== 'number' ||
      typeof value.updatedAt !== 'number' ||
      !Array.isArray(value.messages)) {
    return null;
  }

  const title = value.title.trim().slice(0, 80) || NEW_CHAT_TITLE;
  const messages = value.messages.filter(isStoredMessage).slice(-MAX_MESSAGES_PER_THREAD);
  const draft = typeof value.draft === 'string' ? value.draft.slice(0, 20_000) : undefined;
  return {
    id: value.id,
    title,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    messages,
    ...(draft ? { draft } : {}),
  };
}

function normalizeState(value: unknown): OathkeeperChatThreadState {
  if (!isRecord(value) || value.version !== STORAGE_VERSION || !Array.isArray(value.threads)) {
    return emptyState();
  }

  const seen = new Set<string>();
  const threads = value.threads.flatMap((candidate) => {
    const thread = normalizeThread(candidate);
    if (!thread || seen.has(thread.id)) return [];
    seen.add(thread.id);
    return [thread];
  }).slice(-MAX_THREADS);
  const requestedActiveId = typeof value.activeThreadId === 'string' ? value.activeThreadId : '';
  const activeThreadId = threads.some((thread) => thread.id === requestedActiveId)
    ? requestedActiveId
    : threads.at(-1)?.id || '';

  return { version: STORAGE_VERSION, activeThreadId, threads };
}

function sanitizeUnknown(value: unknown, seen: WeakSet<object>): { value: unknown; redacted: boolean } {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return { value, redacted: false };
    }
    try {
      const parsed = JSON.parse(value);
      const sanitized = sanitizeUnknown(parsed, seen);
      return sanitized.redacted
        ? { value: JSON.stringify(sanitized.value, null, 2), redacted: true }
        : { value, redacted: false };
    } catch {
      return { value, redacted: false };
    }
  }

  if (Array.isArray(value)) {
    let redacted = false;
    const sanitized = value.map((item) => {
      const result = sanitizeUnknown(item, seen);
      redacted ||= result.redacted;
      return result.value;
    });
    return { value: sanitized, redacted };
  }

  if (!isRecord(value)) return { value, redacted: false };
  if (seen.has(value)) return { value: undefined, redacted: true };
  seen.add(value);

  let redacted = false;
  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      redacted = true;
      continue;
    }
    if (
      key === '__clientAction' &&
      isRecord(nestedValue) &&
      nestedValue.type === 'saveSessionToken'
    ) {
      redacted = true;
      continue;
    }
    const result = sanitizeUnknown(nestedValue, seen);
    redacted ||= result.redacted;
    if (result.value !== undefined) sanitized[key] = result.value;
  }
  seen.delete(value);
  return { value: sanitized, redacted };
}

/** Remove source credentials and non-model MCP metadata before persisting history. */
export function sanitizeOathkeeperChatMessages(messages: UIMessage[]): UIMessage[] {
  const bounded = messages.slice(-MAX_MESSAGES_PER_THREAD);
  return sanitizeUnknown(bounded, new WeakSet<object>()).value as UIMessage[];
}

function firstUserText(messages: UIMessage[]): string {
  for (const message of messages) {
    if (message.role !== 'user' || !Array.isArray(message.parts)) continue;
    const text = message.parts
      .filter((part): part is Extract<typeof part, { type: 'text' }> => part.type === 'text')
      .map((part) => part.text)
      .join(' ')
      // Connected records ride along as a trailing "Connected:" list; they are not the title.
      .replace(/\n\nConnected:\n(?:- .*(?:\n|$))+$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) return text;
  }
  return '';
}

export function deriveOathkeeperChatTitle(messages: UIMessage[]): string {
  const text = firstUserText(messages);
  if (!text) return NEW_CHAT_TITLE;
  if (text.length <= 48) return text;
  const shortened = text.slice(0, 48).replace(/\s+\S*$/, '').trim();
  return `${shortened || text.slice(0, 48).trim()}…`;
}

function serializedBytes(value: OathkeeperChatThreadState): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function compactState(value: OathkeeperChatThreadState): OathkeeperChatThreadState {
  let state = normalizeState(value);
  if (state.threads.length > MAX_THREADS) {
    const oldestFirst = [...state.threads].sort((left, right) => left.updatedAt - right.updatedAt);
    const removeIds = new Set(oldestFirst.slice(0, state.threads.length - MAX_THREADS).map((thread) => thread.id));
    state = { ...state, threads: state.threads.filter((thread) => !removeIds.has(thread.id)) };
  }

  while (serializedBytes(state) > MAX_STORAGE_BYTES && state.threads.length > 1) {
    const removable = state.threads
      .filter((thread) => thread.id !== state.activeThreadId)
      .sort((left, right) => left.updatedAt - right.updatedAt)[0];
    if (!removable) break;
    state = { ...state, threads: state.threads.filter((thread) => thread.id !== removable.id) };
  }

  while (serializedBytes(state) > MAX_STORAGE_BYTES) {
    const activeIndex = state.threads.findIndex((thread) => thread.id === state.activeThreadId);
    if (activeIndex < 0 || state.threads[activeIndex].messages.length <= 1) break;
    const threads = [...state.threads];
    threads[activeIndex] = {
      ...threads[activeIndex],
      messages: threads[activeIndex].messages.slice(1),
    };
    state = { ...state, threads };
  }

  return state;
}

// Storage is a persistence adapter, not the owner of the live conversation.
// A failed write must not make the next read invent a new thread or restore an
// older on-disk snapshot over edits that are still alive in this tab.
let memoryState: OathkeeperChatThreadState | null = null;
let persistedState: OathkeeperChatThreadState | null = null;
let hasUnpersistedChanges = false;
let storageUnavailable = false;

export function getOathkeeperChatStorageNotice(): string | null {
  return storageUnavailable
    ? 'Browser storage is unavailable or full. Chat changes are kept in this tab only; keep it open and retry saving.'
    : null;
}

let tabActiveThreadId: string | null = null;
function rememberActiveThread(threadId: string) {
  tabActiveThreadId = threadId;
  try { sessionStorage.setItem(CHAT_ACTIVE_THREAD_STORAGE_KEY, threadId); } catch { /* Keep the tab-local selection in memory. */ }
}

function mergePendingThreads(state: OathkeeperChatThreadState): OathkeeperChatThreadState {
  if (!hasUnpersistedChanges) return state;
  try {
    const latest = normalizeState(JSON.parse(localStorage.getItem(CHAT_THREADS_STORAGE_KEY) || 'null'));
    const base = new Map(persistedState?.threads.map(thread => [thread.id, thread]));
    const local = new Map(state.threads.map(thread => [thread.id, thread]));
    const changed = new Map(state.threads.filter(thread => JSON.stringify(thread) !== JSON.stringify(base.get(thread.id))).map(thread => [thread.id, thread]));
    // Retry only this tab's edits/deletions. Do not overwrite unrelated chats
    // another tab created or updated while this tab could not persist.
    const threads = latest.threads
      .filter(thread => !base.has(thread.id) || local.has(thread.id))
      .map(thread => changed.get(thread.id) || thread);
    const included = new Set(threads.map(thread => thread.id));
    for (const thread of changed.values()) if (!included.has(thread.id)) threads.push(thread);
    persistedState = latest;
    return { ...state, threads };
  } catch {
    return state;
  }
}

function publishState(state: OathkeeperChatThreadState): OathkeeperChatThreadState {
  if (typeof window === 'undefined') return state;
  const compacted = compactState(mergePendingThreads(state));
  memoryState = compacted;
  hasUnpersistedChanges = true;
  rememberActiveThread(compacted.activeThreadId);
  try {
    localStorage.setItem(CHAT_THREADS_STORAGE_KEY, JSON.stringify(compacted));
    persistedState = compacted;
    hasUnpersistedChanges = false;
    storageUnavailable = false;
  } catch {
    // This failure is handled below and in the UI. console.error would turn it
    // into a blocking Next.js development overlay during ordinary navigation.
    if (!storageUnavailable) console.warn('Chat storage could not be written; keeping changes in this tab.');
    storageUnavailable = true;
  }
  // Same-tab consumers must see the live state even if persistence failed.
  window.dispatchEvent(new CustomEvent(CHAT_THREADS_UPDATED_EVENT, { detail: compacted }));
  return compacted;
}

export function getOathkeeperChatThreadState(): OathkeeperChatThreadState {
  if (typeof window === 'undefined') return emptyState();
  if (hasUnpersistedChanges && memoryState) return memoryState;
  try {
    const stored = localStorage.getItem(CHAT_THREADS_STORAGE_KEY);
    const state = stored ? normalizeState(JSON.parse(stored)) : emptyState();
    let selected = tabActiveThreadId;
    if (!selected) {
      try { selected = sessionStorage.getItem(CHAT_ACTIVE_THREAD_STORAGE_KEY); } catch { /* History still works without sessionStorage. */ }
    }
    if (selected && state.threads.some(thread => thread.id === selected)) state.activeThreadId = selected;
    // Pin the initial legacy selection too. Later storage events must not adopt
    // another tab's selection. A removed ID falls back only to a surviving chat.
    if (state.activeThreadId) rememberActiveThread(state.activeThreadId);
    memoryState = state;
    persistedState = state;
    storageUnavailable = false;
    return state;
  } catch {
    if (!storageUnavailable) console.warn('Chat storage could not be read; keeping the current in-memory history.');
    storageUnavailable = true;
    return memoryState || emptyState();
  }
}

export function initializeOathkeeperChatThreads(): OathkeeperChatThreadState {
  const state = getOathkeeperChatThreadState();
  if (state.threads.length) return state;
  const thread = createOathkeeperChatThread();
  return publishState({ version: STORAGE_VERSION, activeThreadId: thread.id, threads: [thread] });
}

export function createOathkeeperChatThreadInStorage(): OathkeeperChatThreadState {
  const current = initializeOathkeeperChatThreads();
  const thread = createOathkeeperChatThread();
  return publishState({
    ...current,
    activeThreadId: thread.id,
    threads: [...current.threads, thread],
  });
}

export function selectOathkeeperChatThread(threadId: string): OathkeeperChatThreadState {
  const current = initializeOathkeeperChatThreads();
  if (!current.threads.some((thread) => thread.id === threadId)) return current;
  return publishState({ ...current, activeThreadId: threadId });
}

export function saveOathkeeperChatThread(
  threadId: string,
  messages: UIMessage[],
  draft = '',
): OathkeeperChatThreadState {
  const current = initializeOathkeeperChatThreads();
  const sanitizedMessages = sanitizeOathkeeperChatMessages(messages);
  const title = deriveOathkeeperChatTitle(sanitizedMessages);
  const currentThread = current.threads.find((thread) => thread.id === threadId);
  if (!currentThread) return current;

  const normalizedDraft = draft.slice(0, 20_000);
  if (
    currentThread.title === title &&
    (currentThread.draft || '') === normalizedDraft &&
    JSON.stringify(currentThread.messages) === JSON.stringify(sanitizedMessages)
  ) {
    return hasUnpersistedChanges || storageUnavailable ? publishState(current) : current;
  }

  const now = Date.now();
  return publishState({
    ...current,
    threads: current.threads.map((thread) => thread.id === threadId
      ? {
          ...thread,
          title,
          updatedAt: now,
          messages: sanitizedMessages,
          ...(normalizedDraft ? { draft: normalizedDraft } : { draft: undefined }),
        }
      : thread),
  });
}

export function closeOathkeeperChatThread(threadId: string): OathkeeperChatThreadState {
  const current = initializeOathkeeperChatThreads();
  const closingIndex = current.threads.findIndex((thread) => thread.id === threadId);
  if (closingIndex < 0) return current;

  const remaining = current.threads.filter((thread) => thread.id !== threadId);
  if (!remaining.length) {
    const replacement = createOathkeeperChatThread();
    return publishState({ version: STORAGE_VERSION, activeThreadId: replacement.id, threads: [replacement] });
  }

  const fallback = remaining[Math.min(closingIndex, remaining.length - 1)];
  return publishState({
    ...current,
    activeThreadId: current.activeThreadId === threadId ? fallback.id : current.activeThreadId,
    threads: remaining,
  });
}
