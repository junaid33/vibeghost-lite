"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Mic as LucideMic } from "lucide-react";
import { Square } from "@/components/icons/duo";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { promptToolbarControlClass } from "./dual-sidebar/prompt-control-popover";
import { DictationGlow } from './dictation-glow';
import { DictationPreview } from './dictation-preview';
import { createDictationSession, newRecognition, type DictationPhase, type Recognition } from "../lib/browser-dictation";
import { attachDictationOwner, cancelDictation, dictationFor, emptyDictation, finishDictation, startDictation, subscribeDictation } from "../lib/dictation-store";

type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
export type BrowserDictationHandle = {
  /** Discard pending speech on edit, navigation or unmount. */
  cancel: () => void;
  /** Drain captured audio. False means interrupted/unconfirmed: review, don't send. */
  finish: () => Promise<boolean>;
};

/**
 * A draft that lives outside React (terminal-composer-draft) can keep receiving
 * words after this button unmounts. Supplying it hands the run to the app-level
 * dictation store, so moving to another Oathkeeper page no longer stops it.
 */
export type PersistentDictation = { key: string; label: string; href?: string; write: (text: string) => void };

type Props = { onTranscript: (text: string) => void; onError: (message: string) => void; disabled?: boolean; inline?: boolean; className?: string; icon?: ReactNode; persistent?: PersistentDictation };

export const dictationUnsupported = "Voice dictation isn’t supported here. Try a browser with speech recognition enabled over HTTPS.";
export const dictationStartFailed = "Couldn’t start dictation. Check microphone permission and try again.";
const unsupported = dictationUnsupported, startFailed = dictationStartFailed;
export const recognitionConstructor = () => { const browser = window as SpeechWindow; return browser.SpeechRecognition || browser.webkitSpeechRecognition; };

export const BrowserDictationButton = forwardRef<BrowserDictationHandle, Props>(function BrowserDictationButton(props, ref) {
  return props.persistent ? <PersistentDictationButton {...props} persistent={props.persistent} ref={ref}/> : <LocalDictationButton {...props} ref={ref}/>;
});

const LocalDictationButton = forwardRef<BrowserDictationHandle, Props>(function LocalDictationButton({ onTranscript, onError, disabled = false, inline = false, className, icon }, ref) {
  const session = useRef<ReturnType<typeof createDictationSession> | null>(null);
  const callbacks = useRef({ onTranscript, onError });
  const [phase, setPhase] = useState<DictationPhase>("idle");
  const [interim, setInterim] = useState("");
  const [committed, setCommitted] = useState("");
  useLayoutEffect(() => { callbacks.current = { onTranscript, onError }; }, [onTranscript, onError]);
  const retire = useCallback(() => { session.current?.cancel(); session.current = null; }, []);
  const cancel = useCallback(() => { retire(); setPhase("idle"); setInterim(""); setCommitted(""); }, [retire]);
  const finish = useCallback(() => session.current?.finish() ?? Promise.resolve(true), []);
  useImperativeHandle(ref, () => ({ cancel, finish }), [cancel, finish]);
  useEffect(() => retire, [retire]);
  useEffect(() => { if (disabled) cancel(); }, [disabled, cancel]);

  const toggle = () => {
    if (disabled) return;
    if (session.current?.active) { void session.current.finish(); return; }
    const Constructor = recognitionConstructor();
    if (!Constructor) { onError(unsupported); return; }
    try {
      setCommitted(""); setInterim("");
      // A factory: the run makes its own recognizer, and a fresh one for its one automatic retry.
      const current = createDictationSession(() => newRecognition(Constructor), {
        // Native speech callbacks are outside React. Commit before resolving
        // finish(), so a queued Send/Copy observes the updated controlled value.
        transcript: (text) => flushSync(() => {
          // Display history only. Submission still reads the parent's draft;
          // interim hypotheses are replaced, never accumulated or deduplicated.
          setCommitted(current => `${current}${current ? " " : ""}${text}`);
          setInterim("");
          callbacks.current.onTranscript(text);
        }),
        update: (next, text) => {
          if (next === "idle") session.current = null;
          setPhase(next); setInterim(text);
        },
        error: (message) => callbacks.current.onError(message),
      });
      session.current = current;
      current.start();
    } catch { retire(); setPhase("idle"); setInterim(""); onError(startFailed); }
  };
  return <DictationControls phase={phase} text={[committed, interim].filter(Boolean).join(" ")} disabled={disabled} inline={inline} className={className} icon={icon} onToggle={toggle}/>;
});

const PersistentDictationButton = forwardRef<BrowserDictationHandle, Props & { persistent: PersistentDictation }>(function PersistentDictationButton({ onError, disabled = false, inline = false, className, icon, persistent }, ref) {
  const { key } = persistent;
  const run = useSyncExternalStore(subscribeDictation, () => dictationFor(key), emptyDictation);
  const errorRef = useRef(onError);
  const targetRef = useRef(persistent);
  useLayoutEffect(() => { errorRef.current = onError; targetRef.current = persistent; });
  // Unmounting no longer cancels: the run keeps writing to the durable draft.
  useEffect(() => attachDictationOwner(key, message => errorRef.current(message)), [key]);
  const cancel = useCallback(() => cancelDictation(key), [key]);
  const finish = useCallback(() => finishDictation(key), [key]);
  useImperativeHandle(ref, () => ({ cancel, finish }), [cancel, finish]);
  // Only a composer that BECOMES disabled retires its run. One that mounts disabled (the chat opened
  // while a reply streams) must not: the run it would cancel was started from the dock.
  const wasDisabled = useRef(disabled);
  useEffect(() => { if (disabled && !wasDisabled.current) cancel(); wasDisabled.current = disabled; }, [disabled, cancel]);

  const toggle = () => {
    if (disabled) return;
    if (run && run.phase !== "idle") { void finishDictation(key); return; }
    const Constructor = recognitionConstructor();
    if (!Constructor) { onError(unsupported); return; }
    const target = targetRef.current;
    try {
      startDictation({
        key, label: target.label, href: target.href, persist: true,
        // Native speech callbacks are outside React. flushSync keeps a queued
        // Send reading the draft only after the final words have landed.
        write: text => flushSync(() => targetRef.current.write(text)),
      }, Constructor, message => errorRef.current(message));
    } catch { cancelDictation(key); onError(startFailed); }
  };
  const phase = run?.phase ?? "idle";
  return <DictationControls phase={phase} paused={Boolean(run?.paused)} text={run ? [run.committed, run.interim].filter(Boolean).join(" ") : ""} disabled={disabled} inline={inline} className={className} icon={icon} onToggle={toggle}/>;
});

function DictationControls({ phase, paused = false, text, disabled, inline, className, icon, onToggle }: { phase: DictationPhase; paused?: boolean; text: string; disabled: boolean; inline: boolean; className?: string; icon?: ReactNode; onToggle: () => void }) {
  const listening = phase !== "idle";
  const finishing = phase === "finishing";
  return <>
    {inline ? <DictationGlow phase={phase === "listening" || phase === "finishing" ? phase : "idle"} paused={paused}/> : null}
    <button type="button" disabled={disabled || finishing} aria-label={finishing ? "Finishing dictation" : listening ? "Stop dictation" : "Start dictation"} aria-pressed={listening} title={finishing ? "Finishing captured speech…" : listening ? "Stop dictation" : "Dictate using your browser’s speech service"} onClick={onToggle} className={cn(inline ? 'pointer-events-auto absolute right-[calc(var(--dictation-action-inset,0px)+4px)] top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-[#919793] hover:text-[#f4f7f5] focus-visible:outline-2 focus-visible:outline-[#8bb8ff]' : promptToolbarControlClass, !inline && 'size-8 justify-center', 'disabled:pointer-events-none disabled:opacity-40', listening && 'text-[#f4a340]', className)}>
      {finishing ? <Spinner className="size-3.5 "/> : listening ? <Square className="size-3.5"/> : icon ?? <LucideMic className="size-4" strokeWidth={2}/>}
    </button>
    {listening ? <DictationPreview text={text} finishing={finishing}/> : null}
    <span role="status" className="sr-only">{finishing ? "Finishing dictation…" : listening ? "Listening… Live transcript available above the input." : ""}</span>
  </>;
}
