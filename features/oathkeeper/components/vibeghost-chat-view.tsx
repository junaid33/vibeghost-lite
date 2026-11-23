"use client";

import type { UIMessage } from "ai";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BeautifulUiArtifactView,
  extractBeautifulUiArtifacts,
  extractBeautifulUiToolArtifacts,
} from "@/features/oathkeeper/components/beautiful-ui-pi-converter";
import {
  ChatThread,
  ProviderMark,
  pushChatBlock,
  type ChatTurn,
} from "@/features/oathkeeper/components/chat-thread";
import { encodeAgentComposerInput } from "../lib/agent-composer-input";
import type { SharedWorkspaceClient } from "@/features/oathkeeper/lib/shared-workspace-client";
import { pairQueueSleeve, unconfirmedPendingMessages, type PendingChatMessage } from "@/features/oathkeeper/lib/pending-chat-messages";
import { rememberPiSentText } from "@/features/oathkeeper/lib/pi-sent-texts";
import { piChatIsWorking, piChatReadFailureShowsError, uniqueChatEvents, type PiInspectionState } from "@/features/oathkeeper/lib/pi-chat-state";
import { QueueSleeve } from "@/features/oathkeeper/components/queue-sleeve";
import { useAgentQueue } from "@/features/oathkeeper/hooks/use-agent-interactions";
import { CanvasFrame } from "@/features/oathkeeper/components/canvas/canvas-frame";
import { toolCanvases } from "@/features/oathkeeper/lib/chat-canvas";

type ChatTool = {
  name: string;
  arguments?: string;
  result?: string;
  isError?: boolean;
  status?: string;
  truncated?: boolean;
};

type ChatEvent = {
  id: string;
  role: "user" | "assistant" | "system";
  text?: string;
  timestamp?: string;
  tools?: ChatTool[];
};

type InspectionPage = {
  events?: ChatEvent[];
  pagination?: { nextCursor?: string };
  state?: PiInspectionState;
  error?: string;
};

let pendingSequence = 0;

const PAGE_LIMIT = 60;
const PAGE_CHARS = 40_000;
const MAX_TRANSCRIPT_PAGES = 6;
const TARGET_VISIBLE_MESSAGES = 40;

function inspectionPath(sessionId: string, cursor?: string) {
  const query = new URLSearchParams({
    mode: "semantic",
    limit: String(PAGE_LIMIT),
    maxChars: String(PAGE_CHARS),
  });
  if (cursor) query.set("cursor", cursor);
  return `/api/sessions/${encodeURIComponent(sessionId)}/inspect?${query}`;
}

function toUiMessage(event: ChatEvent, visibleText = event.text): UIMessage | null {
  const text = visibleText?.trim();
  if (!text || (event.role !== "user" && event.role !== "assistant")) return null;

  return {
    id: event.id,
    role: event.role,
    parts: [{ type: "text", text }],
  } satisfies UIMessage;
}

export type VibeGhostChatViewHandle = {
  sendMessage(text: string, followUp?: boolean, signal?: AbortSignal): Promise<void>;
};

export const VibeGhostChatView = forwardRef<
  VibeGhostChatViewHandle,
  {
    client: SharedWorkspaceClient;
    sessionId: string;
    title: string;
    active: boolean;
    refreshEpoch?: number;
    /** The terminal is running (Pi's queue is read from its screen). */
    live?: boolean;
  }
>(function VibeGhostChatView(
  { client, sessionId, title, active, refreshEpoch = 0, live = true },
  ref,
) {
  const requestRef = useRef(0);
  const scopeRef = useRef(new AbortController());
  const requestControllerRef = useRef<AbortController | null>(null);
  const [events, setEvents] = useState<ChatEvent[]>([]);
  // Sends that became queue rows; never drawn as bubbles again (see pendingOutsideQueue).
  const queuedIdsRef = useRef(new Set<string>());
  const eventsRef = useRef<ChatEvent[]>([]);
  eventsRef.current = events;
  const failuresRef = useRef(0);
  const [inspectionState, setInspectionState] = useState<PiInspectionState | undefined>();
  const [pending, setPending] = useState<PendingChatMessage[]>([]);
  // Transcript user messages that already replaced a bubble; never reused.
  const claimedRef = useRef(new Set<string>());
  const pendingRef = useRef<PendingChatMessage[]>([]);
  pendingRef.current = pending;
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [pageBudget, setPageBudget] = useState(MAX_TRANSCRIPT_PAGES);
  const [visibleTarget, setVisibleTarget] = useState(TARGET_VISIBLE_MESSAGES);
  const [error, setError] = useState("");
  const loadingOlderRef = useRef(false);

  const load = useCallback(async (
    maxPages = pageBudget,
    minimumVisible = visibleTarget,
  ) => {
    const request = ++requestRef.current;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const signal = AbortSignal.any([controller.signal, scopeRef.current.signal]);
    try {
      let cursor: string | undefined;
      let next: ChatEvent[] = [];
      let newestState: PiInspectionState | undefined;

      for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
        let page: InspectionPage;
        try {
          page = await client.json<InspectionPage>(
            "GET",
            inspectionPath(sessionId, cursor),
            undefined,
            signal,
          );
          if (page.error) throw new Error(page.error);
        } catch (caught) {
          // Only the newest page decides whether Chat can show anything. An
          // older page that fails keeps the pages already read on screen
          // instead of replacing the whole conversation with an error.
          if (signal.aborted || piChatReadFailureShowsError({ pageIndex, shownEvents: next.length, consecutiveFailures: 0 })) throw caught;
          cursor = undefined;
          break;
        }
        if (request !== requestRef.current) return;
        if (pageIndex === 0) newestState = page.state;

        const pageEvents = Array.isArray(page.events) ? page.events : [];
        next = [...pageEvents, ...next];
        const visibleCount = next.reduce(
          (count, event) => count + (toUiMessage(event) ? 1 : 0),
          0,
        );
        cursor = page.pagination?.nextCursor;
        if (!cursor || visibleCount >= minimumVisible) break;
      }

      next = uniqueChatEvents(next);
      setHasOlder(Boolean(cursor));
      setEvents(next);
      setInspectionState(newestState);
      // Exact text with a 2 s window left bubbles grey (whitespace, wrapped
      // pastes, host clock skew) and let one transcript copy hide two bubbles.
      // Matching claims transcript messages, so it runs once here, never inside
      // a state updater: React may call an updater twice, and the second call
      // found the message already claimed and kept the grey copy beside it.
      const current = pendingRef.current;
      if (current.length) {
        const remaining = unconfirmedPendingMessages(current, next, claimedRef.current);
        if (remaining.length !== current.length) {
          const settled = new Set(current.filter((message) => !remaining.includes(message)).map((message) => message.id));
          setPending((latest) => latest.filter((message) => !settled.has(message.id)));
        }
      }
      failuresRef.current = 0;
      setError("");
    } catch (caught) {
      if (request !== requestRef.current || signal.aborted) return;
      // A background poll that misses once keeps the conversation on screen;
      // the next poll usually succeeds. Show the error only when there is
      // nothing to show yet or reads keep failing.
      failuresRef.current += 1;
      if (!piChatReadFailureShowsError({ pageIndex: 0, shownEvents: eventsRef.current.length, consecutiveFailures: failuresRef.current })) return;
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not read the Pi conversation",
      );
    } finally {
      if (request === requestRef.current && !signal.aborted) setLoading(false);
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  }, [client, pageBudget, sessionId, visibleTarget]);

  useEffect(() => {
    const scope = new AbortController();
    scopeRef.current = scope;
    requestRef.current += 1;
    setEvents([]);
    setInspectionState(undefined);
    setPending([]);
    claimedRef.current = new Set();
    queuedIdsRef.current = new Set();
    failuresRef.current = 0;
    setLoading(true);
    setLoadingOlder(false);
    setHasOlder(false);
    setPageBudget(MAX_TRANSCRIPT_PAGES);
    setVisibleTarget(TARGET_VISIBLE_MESSAGES);
    loadingOlderRef.current = false;
    setError("");
    return () => { scope.abort(); requestRef.current += 1; requestControllerRef.current?.abort(); };
  }, [client, sessionId]);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (!loadingOlderRef.current && document.visibilityState !== "hidden") await load();
      // Right after a send, poll faster so the transcript's copy replaces the bubble.
      if (!disposed) timer = setTimeout(() => void poll(), pendingRef.current.length ? 700 : 2500);
    };
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
      requestRef.current += 1;
      requestControllerRef.current?.abort();
    };
  }, [active, load, refreshEpoch]);

  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !hasOlder) return;
    const nextPageBudget = pageBudget + MAX_TRANSCRIPT_PAGES;
    const nextVisibleTarget = visibleTarget + TARGET_VISIBLE_MESSAGES;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    setPageBudget(nextPageBudget);
    setVisibleTarget(nextVisibleTarget);
    try {
      await load(nextPageBudget, nextVisibleTarget);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [hasOlder, load, pageBudget, visibleTarget]);

  // A running tool anywhere in the loaded history used to keep this on after
  // Pi finished; the reported phase and the newest turn decide instead.
  const piIsWorking = piChatIsWorking(inspectionState, events);
  // Pi draws each queued message on one cut line; the full texts sent from
  // here let a card show and re-queue the whole message.
  const [sentTexts, setSentTexts] = useState<string[]>([]);
  const queue = useAgentQueue({ client, sessionId, provider: "pi", working: live && piIsWorking, active: active && live, sentTexts });
  const workingRef = useRef(false);
  workingRef.current = live && piIsWorking;
  // A queued send is a sleeve row only, never also a grey bubble.
  const paired = useMemo(() => pairQueueSleeve(queue.items, pending, queuedIdsRef.current), [pending, queue.items]);

  const displayEvents = useMemo<ChatEvent[]>(() => {
    const grouped: ChatEvent[] = [];
    for (const event of events) {
      if (
        event.role === "system" ||
        (!event.text?.trim() && !event.tools?.length)
      ) {
        continue;
      }

      const previous = grouped.at(-1);
      if (
        event.tools?.length &&
        !event.text?.trim() &&
        previous?.tools?.length &&
        !previous.text?.trim()
      ) {
        previous.tools = [...previous.tools, ...event.tools];
        continue;
      }
      grouped.push({ ...event, tools: event.tools ? [...event.tools] : undefined });
    }

    return [
      ...grouped,
      ...paired.bubbles.map((message) => ({ id: message.id, text: message.text, role: "user" as const })),
    ];
  }, [events, paired.bubbles]);


  useImperativeHandle(
    ref,
    () => ({
      async sendMessage(value: string, followUp = false, callerSignal?: AbortSignal) {
        const text = value.trim();
        if (!text) return;
        const payload = encodeAgentComposerInput(text, followUp ? 'alt-enter' : 'enter', 'pi');
        const signal = callerSignal ? AbortSignal.any([callerSignal, scopeRef.current.signal]) : scopeRef.current.signal;
        signal.throwIfAborted();

        setSentTexts((current) => [...current.slice(-19), text]);
        rememberPiSentText(sessionId, text);
        const sentAt = Date.now();
        // Sent while Pi works, it joins Pi's queue (Enter steers, Alt+Enter follows up).
        const optimistic: PendingChatMessage = { id: `pending-${sentAt}-${++pendingSequence}`, text, sentAt, ...(workingRef.current ? { queued: true, mode: followUp ? "followUp" as const : "steer" as const } : {}) };
        setPending((current) => [...current, optimistic]);
        setError("");

        try {
          await client.json(
            "POST",
            `/api/sessions/${encodeURIComponent(sessionId)}/input`,
            { text: payload },
            signal,
          );
          if (!signal.aborted) void load();
        } catch (caught) {
          if (signal.aborted) throw caught;
          setPending((current) =>
            current.filter((message) => message.id !== optimistic.id),
          );
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not send this message",
          );
          throw caught;
        }
      },
    }),
    [client, load, sessionId],
  );

  const turns = useMemo(() => {
    const result: ChatTurn[] = [];
    const canvasSeen = new Set<string>();
    for (const event of displayEvents) {
      if (event.role === "user") {
        const text = event.text?.trim();
        if (text) result.push({ id: event.id, role: "user", text, pending: event.id.startsWith("pending-") });
        continue;
      }
      const converted = extractBeautifulUiArtifacts(event.text);
      const toolArtifacts = extractBeautifulUiToolArtifacts(event.tools);
      let turn = result.at(-1);
      if (turn?.role !== "assistant") {
        turn = { id: event.id, role: "assistant", author: "Pi", icon: <ProviderMark provider="pi" />, blocks: [] };
        result.push(turn);
      }
      if (event.tools?.length && !toolArtifacts.length) {
        pushChatBlock(turn.blocks, {
          kind: "tools",
          tools: event.tools.map((tool, index) => ({
            id: `${event.id}:${index}`,
            name: tool.name,
            args: tool.arguments,
            result: tool.result,
            status: tool.status,
            isError: tool.isError,
            truncated: tool.truncated,
          })),
        });
      }
      // A canvas_publish result shows the published page inline, as in Oathkeeper's own chat.
      for (const canvas of toolCanvases(event.tools?.map((tool) => ({ name: tool.name, args: tool.arguments, result: tool.result, isError: tool.isError })), canvasSeen)) {
        pushChatBlock(turn.blocks, {
          kind: "node",
          key: `${event.id}-canvas-${canvas.id}`,
          node: <CanvasFrame id={canvas.id} title={canvas.title} height={canvas.height} heights={canvas.heights} inline />,
        });
      }
      [...toolArtifacts, ...converted.artifacts].forEach((artifact, index) =>
        pushChatBlock(turn.blocks, {
          kind: "node",
          key: `${event.id}-${artifact.component}-${index}`,
          node: <BeautifulUiArtifactView artifact={artifact} />,
        }),
      );
      const text = converted.text?.trim();
      if (text) pushChatBlock(turn.blocks, { kind: "text", text });
      if (!turn.blocks.length) result.pop();
    }
    return result;
  }, [displayEvents]);

  return (
    <>
    {active && live ? <QueueSleeve items={paired.sleeve} busy={queue.busy} error={queue.error} onRemove={queue.remove} onEdit={queue.edit} /> : null}
    <ChatThread
      label={`${title} Pi conversation`}
      turns={turns}
      loading={loading}
      loadingLabel="Reading conversation…"
      emptyLabel="No messages yet."
      error={error || undefined}
      onRetry={() => void load()}
      earlier={hasOlder ? { loading: loadingOlder, onLoad: () => void loadOlder() } : undefined}
      working={piIsWorking ? "Pi is working" : undefined}
    />
    </>
  );
});
