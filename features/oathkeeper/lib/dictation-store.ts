import { createDictationSession, newRecognition, type DictationPhase, type Recognition } from "./browser-dictation.ts";

/**
 * The one browser dictation run, owned by the app shell rather than by the mic
 * button, so a run that writes to a durable draft keeps going when its page
 * unmounts (another Oathkeeper page). Safari still ends it when the page itself
 * is hidden (another app or tab); that is the platform, not this store.
 *
 * Only drafts that live outside React (terminal-composer-draft) may persist.
 * Composers whose text lives in component state cancel on unmount as before.
 */
export type DictationTarget = {
  /** Stable owner, e.g. "vibeghost:<session id>". */
  key: string;
  /** Shown while you are away from the owner, e.g. the session title. */
  label: string;
  /** Where tapping the away indicator returns to. */
  href?: string;
  /** Appends confirmed words to the owner's draft. Must work while unmounted. */
  write: (text: string) => void;
  persist: boolean;
};

export type DictationSnapshot = Readonly<{
  key: string;
  label: string;
  href?: string;
  persist: boolean;
  phase: DictationPhase;
  committed: string;
  interim: string;
  /** Owners currently showing this run in their own composer. */
  attached: number;
  error: string;
  /** With `error`: the run's words are still in the draft, unsent, and Send can be tried again. */
  retry?: boolean;
  /** The microphone is paused: the run and its words stay, and Resume carries on. */
  paused?: boolean;
  /** Send was pressed: the run is draining, or has ended and its draft is on its way out. */
  sending?: boolean;
  /** The Send being made (or, with `retry`, the one that failed) is a Pi follow-up. */
  followUp?: boolean;
}>;

type Run = {
  target: DictationTarget;
  session: ReturnType<typeof createDictationSession>;
  snapshot: DictationSnapshot;
  onError: ((message: string) => void) | null;
  /** The Send that is draining this run, if any. */
  send?: object;
};

let run: Run | null = null;
/** Last ended persistent run's message, kept until dismissed when no owner saw it. */
let orphanError: DictationSnapshot | null = null;
/** A draft on its way out after its run ended (Send on the recording pill). */
let sendingSnapshot: DictationSnapshot | null = null;
/** The Send that put `sendingSnapshot` up; only it takes it down. */
let sendingBy: object | null = null;
const attachedCounts = new Map<string, number>();
const listeners = new Set<() => void>();

const emit = () => { for (const listener of listeners) listener(); };
const publish = (next: Partial<DictationSnapshot>) => {
  if (!run) return;
  run.snapshot = { ...run.snapshot, ...next };
  emit();
};

export function subscribeDictation(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function readDictation(): DictationSnapshot | null { return run?.snapshot ?? sendingSnapshot ?? orphanError; }
export const emptyDictation = () => null;

export function dictationFor(key: string): DictationSnapshot | null {
  const current = readDictation();
  return current?.key === key ? current : null;
}

/** A mounted owner shows the run itself; the shell's away indicator hides. */
export function attachDictationOwner(key: string, onError: (message: string) => void) {
  attachedCounts.set(key, (attachedCounts.get(key) ?? 0) + 1);
  if (run?.target.key === key) { run.onError = onError; publish({ attached: attachedCounts.get(key)! }); }
  // An error that happened while away: the returning composer reports it once.
  if (orphanError?.key === key) { onError(orphanError.error); orphanError = null; emit(); }
  return () => {
    const count = (attachedCounts.get(key) ?? 1) - 1;
    if (count > 0) attachedCounts.set(key, count); else attachedCounts.delete(key);
    if (run?.target.key !== key) return;
    if (!run.target.persist && count <= 0) { cancelDictation(key); return; }
    if (count <= 0) run.onError = null;
    publish({ attached: Math.max(0, count) });
  };
}

export function startDictation(target: DictationTarget, Constructor: new () => Recognition, onError: (message: string) => void) {
  // One microphone run at a time: a new start retires any other owner's run.
  if (run) cancelDictation(run.target.key);
  orphanError = null;
  const owner: Run = {
    target,
    // Errors reach the composer only while it is on screen; otherwise the shell keeps them.
    onError: attachedCounts.get(target.key) ? onError : null,
    snapshot: { key: target.key, label: target.label, href: target.href, persist: target.persist, phase: "listening", committed: "", interim: "", attached: attachedCounts.get(target.key) ?? 0, error: "" },
    session: null as unknown as Run["session"],
  };
  let ended = false;
  // With no composer on screen, an ending that only left a doubt (the browser never finalized the
  // last words, was slow to end) is not a failure: the words are in the draft. Say nothing.
  const quiet = () => !owner.onError && owner.session.outcome === "soft";
  const unsent = () => Boolean(owner.snapshot.committed.trim()) && canSendDictation(target.key);
  // A factory, so every run (and its one automatic second attempt) gets a recognizer of its own.
  owner.session = createDictationSession(() => newRecognition(Constructor), {
    transcript: (text) => {
      if (run !== owner) return;
      target.write(text);
      publish({ committed: `${owner.snapshot.committed}${owner.snapshot.committed ? " " : ""}${text}`, interim: "" });
    },
    update: (phase, interim) => {
      if (run !== owner) return;
      if (phase === "idle") {
        // Nobody on the owner's page saw the ending: keep its message for the shell.
        if (owner.snapshot.error && !owner.onError && !quiet()) orphanError = { ...owner.snapshot, phase: "idle", interim: "", sending: false, retry: unsent() };
        ended = true;
        run = null;
        // A run that Send is draining goes straight to "sending" in this same update, so the pill
        // never has a moment with nothing to show between the two. Not when it ended with nothing
        // sendable: then its own message is what shows.
        if (owner.send && owner.session.outcome !== "hard") {
          sendingSnapshot = { ...owner.snapshot, phase: "idle", interim: "", error: "", retry: false, sending: true, attached: attachedCounts.get(target.key) ?? 0 };
          sendingBy = owner.send;
        }
        emit();
        return;
      }
      publish({ phase, interim });
    },
    paused: (paused) => { if (run === owner) publish({ paused }); },
    error: (message) => {
      if (run !== owner) {
        // The session reports its closing message after it has gone idle (a start that threw, words
        // the browser never finalized). It still belongs to this run unless another has begun.
        if (!ended || run || quiet()) return;
        if (owner.onError) owner.onError(message);
        else if (!orphanError) { orphanError = { ...owner.snapshot, phase: "idle", interim: "", sending: false, error: message, retry: unsent() }; emit(); }
        return;
      }
      owner.snapshot = { ...owner.snapshot, error: message };
      owner.onError?.(message);
      emit();
    },
  });
  run = owner;
  emit();
  owner.session.start();
  return owner.session;
}

/** Drain captured audio. False means interrupted/unconfirmed: review, don't send. */
export function finishDictation(key?: string): Promise<boolean> {
  if (!run || (key !== undefined && run.target.key !== key)) return Promise.resolve(true);
  return run.session.finish();
}

/** Pause the microphone of the run owned by `key`, keeping the run. */
export function pauseDictation(key?: string) {
  if (!run || (key !== undefined && run.target.key !== key)) return;
  run.session.pause();
}

/** Continue a paused run, in the same session and draft. */
export function resumeDictation(key?: string) {
  if (!run || (key !== undefined && run.target.key !== key)) return;
  run.session.resume();
}

export function cancelDictation(key?: string) {
  if (!run || (key !== undefined && run.target.key !== key)) return;
  const current = run;
  run = null;
  current.session.cancel();
  emit();
}

/** A run that could not begin (no speech recognition, no chat to write to): the shell shows why. */
export function failDictation(target: Pick<DictationTarget, "key" | "label" | "href">, message: string) {
  orphanError = { key: target.key, label: target.label, href: target.href, persist: true, phase: "idle", committed: "", interim: "", attached: 0, error: message };
  emit();
}

/**
 * How a run's draft is sent as a message. The app shell provides it, because a run that
 * outlived its composer has nothing on screen to press Send on.
 */
export type DictationSendFailure = { message: string; retry: boolean };
/** `followUp`: send it as an agent follow-up (Pi's queue), not a normal message. */
export type DictationSendOptions = { followUp: boolean };
type Sender = (options: DictationSendOptions) => void | DictationSendFailure | Promise<void | DictationSendFailure>;
/** How long Send gives the browser to deliver its final words before the words on screen go out. */
export const SEND_FINALIZE_WAIT_MS = 2500;
const sendFailed = "Couldn’t send the message. Your words are still in the draft.";
/** The Send in flight for each draft: the run it is sending (null: a retry of an ended run's draft) and when it settles. */
const sends = new Map<string, { owner: Run | null; done: Promise<void> }>();
let senderFor: ((key: string) => Sender | undefined) | null = null;
export function provideDictationSender(resolve: (key: string) => Sender | undefined) {
  senderFor = resolve;
  return () => { if (senderFor === resolve) senderFor = null; };
}
export const canSendDictation = (key: string) => Boolean(senderFor?.(key));
/**
 * Stop the run, give the browser a bounded time to finalize, then send the draft. Words the browser
 * never finalized were on screen when Send was pressed, so they are sent as they stand. Only a run
 * that heard nothing, or whose recognition failed and may have dropped speech, is left unsent; its
 * own message says why. A send that fails says so and can be retried while the words are in the draft.
 * From the tap until the message is out the run reads as "sending": one state, no gap.
 * `followUp` (a held Send on a Pi session) sends it as a follow-up; a failed one is retried as one.
 */
export async function sendDictation(key: string, { followUp = false }: Partial<DictationSendOptions> = {}): Promise<boolean> {
  const send = senderFor?.(key);
  if (!send) return false;
  const owner = run?.target.key === key ? run : null;
  const earlier = sends.get(key);
  // One send per run: a second tap while the first drains or sends is the same request. A NEW run's
  // Send is a new message: it waits for the earlier one to settle, then goes out after it.
  if (earlier && earlier.owner === owner) return false;
  const base = dictationFor(key);
  let settle!: () => void;
  const entry = { owner, done: new Promise<void>((resolve) => { settle = resolve; }) };
  sends.set(key, entry);
  try {
    if (owner) { owner.send = entry; if (run === owner) publish({ sending: true, followUp }); }
    if (owner && !await owner.session.finish(SEND_FINALIZE_WAIT_MS) && owner.session.outcome !== "soft") return false;
    if (earlier) await earlier.done;
    // Another run began for this draft while this one drained: its words are not ready to send.
    if (run?.target.key === key) return false;
    if (orphanError?.key === key) orphanError = null;
    const shown = sendingBy === entry ? sendingSnapshot : base;
    if (shown) { sendingSnapshot = { ...shown, phase: "idle", interim: "", error: "", retry: false, sending: true, followUp, attached: attachedCounts.get(key) ?? 0 }; sendingBy = entry; }
    emit();
    let failure: void | DictationSendFailure;
    try { failure = await send({ followUp }); }
    catch { failure = { message: sendFailed, retry: true }; }
    if (sendingBy === entry) { sendingSnapshot = null; sendingBy = null; }
    // Shown above the dock even when the chat is open: nothing else reports a send made from here.
    if (failure && !run) orphanError = { key, label: shown?.label ?? "", href: shown?.href, persist: true, phase: "idle", committed: shown?.committed ?? "", interim: "", attached: 0, error: failure.message, retry: failure.retry, followUp };
    emit();
    return !failure;
  } finally {
    if (sends.get(key) === entry) sends.delete(key);
    if (owner?.send === entry) { owner.send = undefined; if (run === owner && owner.snapshot.sending) publish({ sending: false }); }
    if (sendingBy === entry) { sendingSnapshot = null; sendingBy = null; emit(); }
    settle();
  }
}

export function dismissDictationError() {
  if (!orphanError) return;
  orphanError = null;
  emit();
}
