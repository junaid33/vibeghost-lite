export type SpeechResults = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
export type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: SpeechResults }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onnomatch?: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
export type DictationPhase = "idle" | "listening" | "finishing";
/**
 * How a run ended. "clean": every word was confirmed. "soft": words were heard and none are known
 * to be missing, but the browser left a doubt (it never finalized the last words, flagged some
 * speech as unclear, or was slow to end). "hard": nothing was heard, or a recognition error may
 * have dropped speech. A composer treats soft as "review first"; an explicit Send of the words
 * on screen (the recording pill) may go ahead.
 */
export type DictationOutcome = "clean" | "soft" | "hard";
export const DICTATION_FINISH_TIMEOUT_MS = 10_000;
const messages: Record<string, string> = {
  "not-allowed": "Microphone permission was denied. Allow microphone access in your browser settings.",
  "service-not-allowed": "Your browser’s speech service is unavailable or disabled. In Safari, check that Siri is enabled.",
  "audio-capture": "No microphone is available.",
  network: "The browser’s speech service couldn’t connect. Check your connection and try again.",
  "no-speech": "No speech was detected. Tap the mic to try again.",
  "language-not-supported": "The browser’s speech service doesn’t support the selected language.",
  aborted: "Dictation was interrupted. Review your draft before sending.",
};
/** Short state labels for the recording pill, which has no room for the sentences above. */
const labels: Record<string, string> = {
  "not-allowed": "Microphone blocked",
  "service-not-allowed": "Speech service off",
  "audio-capture": "No microphone",
  network: "Speech service offline",
  "no-speech": "No speech heard",
  "language-not-supported": "Language not supported",
  aborted: "Dictation interrupted",
};
export function dictationErrorLabel(message: string) {
  const code = Object.keys(messages).find(key => message.startsWith(messages[key]));
  if (code) return labels[code];
  if (message.includes("no transcript")) return "No speech heard";
  if (message.includes("isn’t supported")) return "Dictation not supported";
  if (message.includes("Couldn’t start")) return "Microphone unavailable";
  if (message.includes("didn’t finalize")) return "Last words unconfirmed";
  if (message.includes("couldn’t recognize some speech")) return "Some speech unclear";
  if (message.includes("took too long")) return "Dictation timed out";
  if (message.includes("Couldn’t finish")) return "Couldn’t finish dictation";
  if (message.includes("Voice dictation failed")) return "Dictation failed";
  if (message.includes("Nothing to send")) return "Nothing to send";
  if (message.includes("still being sent")) return "Last message still sending";
  if (message.includes("still replying")) return "Oathkeeper still replying";
  if (message.includes("has ended")) return "Session has ended";
  if (message.includes("refused")) return "Session refused it";
  if (message.includes("confirm delivery")) return "Delivery not confirmed";
  if (message.includes("Couldn’t send")) return "Couldn’t send";
  return "Dictation stopped";
}

/** How long a new run waits for the previous recognizer's own `end` before it starts. */
export const PREVIOUS_END_WAIT_MS = 700;
/** A run that fails or ends this soon after starting, with nothing heard, is started again once. */
export const EARLY_END_MS = 4000;
/** The pause before that second start, so the browser has let go of the first recognizer. */
export const RESTART_DELAY_MS = 250;
/** Errors a second start cannot cure. */
const noRestart = new Set(["not-allowed", "language-not-supported"]);

/** A recognizer configured the one way every run uses it. */
export function newRecognition(Constructor: new () => Recognition) {
  const recognition = new Constructor();
  recognition.lang = (typeof navigator === "undefined" ? "" : navigator.language) || "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  return recognition;
}

/**
 * The last recognizer this page let go of before the browser reported its `end` (a cancel, or a
 * stop that timed out). Safari runs one recognizer per page: a start() while the previous one is
 * still closing can throw, or end at once with nothing heard. The next run waits for this, briefly.
 */
let previousEnd: Promise<void> | null = null;
function awaitNativeEnd(recognition: Recognition) {
  let done!: () => void;
  const ended = new Promise<void>((resolve) => { done = resolve; });
  const settle = () => { clearTimeout(timer); recognition.onend = null; if (previousEnd === ended) previousEnd = null; done(); };
  const timer = setTimeout(settle, PREVIOUS_END_WAIT_MS);
  recognition.onend = settle;
  previousEnd = ended;
}
/** Tests only: their fake recognizers never report `end` after abort(), so nothing is owed. */
export function forgetPreviousRecognizer() { previousEnd = null; }

/**
 * One dictation run. No transcript logging, transport or React state. Given a factory, the run
 * makes its own recognizer and, when the first one fails to start or ends within EARLY_END_MS
 * with nothing heard and no stop asked for, starts once more on a fresh one before reporting
 * anything. Every handler belongs to the recognizer it was bound to: an event from one that was
 * let go of (the first attempt, or a previous run) is ignored.
 */
export function createDictationSession(source: Recognition | (() => Recognition), callbacks: {
  transcript: (text: string) => void;
  update: (phase: DictationPhase, interim: string) => void;
  error: (message: string) => void;
  /** The run was paused (true) or resumed (false). Its phase stays "listening" throughout. */
  paused?: (paused: boolean) => void;
}, timeoutMs = DICTATION_FINISH_TIMEOUT_MS) {
  const fresh = typeof source === "function" ? source : null;
  let recognition = fresh ? fresh() : source as Recognition;
  let active = true;
  let stopping = false;
  /** Pause() stopped the recognizer; the run, its words and its place in the draft stay. */
  let paused = false;
  /** finish() was called: the ending is wanted, never a reason to start again. */
  let asked = false;
  let pending = "";
  let confirmed = false;
  /** Any words at all arrived, final or not. */
  let heard = false;
  let issue = "";
  /** A recognition error that can drop speech (anything but "no speech detected"). */
  let lossy = false;
  /** The browser flagged speech it couldn’t recognize, and nothing recognized has followed yet. */
  let unmatched = false;
  let outcome: DictationOutcome | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  /** start() was accepted by the current recognizer, and its `end` has not arrived. */
  let open = false;
  let startedAt = 0;
  let restarted = false;
  let delivered = new Set<number>();
  let resolve!: (safeToSubmit: boolean) => void;
  const finished = new Promise<boolean>((done) => { resolve = done; });
  const startFailed = "Couldn’t start dictation. Check microphone permission and try again.";
  /** Let go of the current recognizer; if the browser still owes its `end`, the next start waits for it. */
  const release = () => {
    recognition.onresult = recognition.onerror = recognition.onnomatch = null;
    if (open) awaitNativeEnd(recognition); else recognition.onend = null;
    open = false;
  };
  const detach = () => {
    active = false; paused = false;
    clearTimeout(timer); clearTimeout(startTimer);
    release();
  };
  const abort = (target = recognition) => { try { target.abort(); } catch { /* Cleanup must not strand a waiting submission. */ } };
  const end = (forceAbort = false) => {
    if (!active) return;
    detach();
    if (forceAbort) abort();
    // Only the CURRENT interim hypothesis is recoverable, never a superseded
    // or retracted one. It is editable draft text, not a confirmed transcript.
    const unconfirmed = pending.trim();
    if (unconfirmed) callbacks.transcript(unconfirmed);
    const problem = issue || (unmatched ? "The browser couldn’t recognize some speech. Review the ending before sending." : "");
    const warning = unconfirmed
      ? "The browser didn’t finalize the last words. They were kept in your draft; review them before sending."
      : !confirmed && !problem ? "The browser returned no transcript. Check your draft and try dictating again." : "";
    // Set before the callbacks: they read it to decide whether the ending needs reporting.
    outcome = !problem && !warning ? "clean" : (confirmed || unconfirmed) && !lossy ? "soft" : "hard";
    callbacks.update("idle", "");
    if (problem || warning) callbacks.error([problem, warning].filter(Boolean).join(" "));
    resolve(!problem && !warning);
  };
  const armTimeout = (ms = timeoutMs) => {
    // A shorter wait (Send) replaces a longer one that is already running, never the reverse.
    if (timer !== undefined) { if (ms >= timeoutMs) return; clearTimeout(timer); }
    timer = setTimeout(() => {
      issue ||= "Dictation took too long to finish. Your draft was kept; check the ending before sending.";
      end(true);
    }, Math.min(ms, timeoutMs));
  };
  const restartable = (code = "") => Boolean(fresh) && !restarted && !asked && !heard && !issue && !noRestart.has(code) && Date.now() - startedAt < EARLY_END_MS;
  /** Start the current recognizer, once the previous one has closed (bounded) and `delay` has passed. */
  const launch = (delay = 0) => {
    const go = () => {
      startTimer = undefined;
      if (!active) return;
      startedAt = Date.now();
      try { recognition.start(); open = true; }
      catch { if (restartable()) restart(); else { issue = startFailed; end(true); } }
    };
    const wait = previousEnd;
    // The usual case starts inside the tap that asked for it.
    if (!wait && !delay) { go(); return; }
    startTimer = setTimeout(() => { if (previousEnd) void previousEnd.then(go); else go(); }, delay);
  };
  const bind = () => {
    const own = recognition;
    const mine = () => active && own === recognition;
    own.onresult = ({ results }) => {
      if (!mine()) return;
      const final: string[] = [];
      const interim: string[] = [];
      // Results is the complete current snapshot. Interim entries can shrink or
      // change at resultIndex, including resultIndex === results.length.
      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        if (result.isFinal) {
          if (!delivered.has(index)) { delivered.add(index); final.push(result[0].transcript); }
        } else interim.push(result[0].transcript);
      }
      pending = interim.join(" ").trim();
      const text = final.join(" ").trim();
      confirmed ||= Boolean(text);
      heard ||= Boolean(text || pending);
      if (text || pending) unmatched = false;
      if (text) callbacks.transcript(text);
      callbacks.update(stopping ? "finishing" : "listening", pending);
    };
    own.onerror = ({ error }) => {
      if (!mine()) return;
      // Paused: the recognizer was stopped on purpose, and whatever it reports now is that stop.
      if (paused) return;
      // Nothing was heard and nobody asked to stop: try a fresh recognizer before saying anything.
      if (restartable(error)) { restart(); return; }
      issue = messages[error] || "Voice dictation failed. Review your draft and try again.";
      lossy ||= error !== "no-speech";
      stopping = true;
      callbacks.error(issue);
      callbacks.update("finishing", pending);
      // Keep result handlers through end: a browser may still deliver queued
      // results. A missing end is bounded, rather than leaving the mic stuck.
      armTimeout();
    };
    own.onnomatch = () => {
      // Not an ending: recognition carries on, and words recognized afterwards clear it.
      if (mine()) unmatched = true;
    };
    own.onend = () => {
      if (!mine()) return;
      open = false;
      if (paused) {
        // The stop is done. Words still unconfirmed are kept now, so none is lost across the pause.
        const unconfirmed = pending.trim();
        pending = "";
        if (unconfirmed) { confirmed = true; callbacks.transcript(unconfirmed); }
        callbacks.update("listening", "");
        return;
      }
      if (restartable()) restart(); else end();
    };
  };
  /** The one automatic second attempt: a new recognizer, the same run, still "listening". */
  function restart() {
    restarted = true;
    const old = recognition, wasOpen = open;
    clearTimeout(timer); timer = undefined;
    release();
    if (wasOpen) abort(old);
    issue = ""; lossy = false; unmatched = false; stopping = false; pending = ""; delivered = new Set();
    try { recognition = fresh!(); }
    catch { issue = startFailed; end(); return; }
    bind();
    callbacks.update("listening", "");
    launch(RESTART_DELAY_MS);
  }
  bind();
  return {
    get active() { return active; },
    /** Null until the run ends by itself or through finish(); stays null when cancelled. */
    get outcome() { return outcome; },
    start() {
      callbacks.update("listening", "");
      launch();
    },
    get paused() { return paused; },
    /** Stop capturing, keep the run: its words stay, and resume() carries on in the same run. */
    pause() {
      if (!active || stopping || paused || asked) return;
      paused = true;
      clearTimeout(startTimer); startTimer = undefined;
      // Never started (still waiting its turn): there is nothing to stop.
      if (open) { try { recognition.stop(); } catch { abort(); open = false; } }
      callbacks.paused?.(true);
    },
    resume() {
      if (!active || !paused) return;
      paused = false;
      // Its end never arrived: keep what it held, and let the next start wait for that end (bounded).
      if (open) {
        const unconfirmed = pending.trim();
        if (unconfirmed) { confirmed = true; callbacks.transcript(unconfirmed); }
        const old = recognition;
        release();
        abort(old);
      }
      pending = ""; delivered = new Set();
      issue = ""; lossy = false; unmatched = false;
      try { recognition = fresh ? fresh() : recognition; }
      catch { issue = startFailed; end(); return; }
      bind();
      callbacks.paused?.(false);
      callbacks.update("listening", "");
      launch();
    },
    /** Stop and drain. `waitMs` shortens how long the browser gets to deliver its final words. */
    finish(waitMs?: number) {
      asked = true;
      // Stopped before the recognizer was started (it was waiting its turn): there is nothing to drain.
      if (active && !open && !stopping) { end(); return finished; }
      if (active && !stopping) {
        stopping = true;
        callbacks.update("finishing", pending);
        armTimeout(waitMs);
        try { recognition.stop(); }
        catch { issue = "Couldn’t finish dictation. Review the ending before sending."; end(true); }
      } else if (active && waitMs !== undefined) armTimeout(waitMs);
      return finished;
    },
    cancel() {
      if (!active) return;
      detach(); abort(); pending = "";
      resolve(false);
    },
  };
}
