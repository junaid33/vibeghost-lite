"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";

export type TerminalComposerInputHandle = {
  isComposing: () => boolean;
  retire: () => void;
};

/** A draft editor, not a raw terminal keyboard. Only an explicit activation sends. */
export const TerminalComposerInput = forwardRef<TerminalComposerInputHandle, {
  value: string;
  pi: boolean;
  className?: string;
  onChange: (value: string) => void;
  onSend: (followUp: boolean) => void;
}>(function TerminalComposerInput({ value, pi, className, onChange, onSend }, ref) {
  const element = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const [epoch, setEpoch] = useState(0);
  useImperativeHandle(ref, () => ({
    isComposing: () => composing.current,
    retire: () => {
      // iOS keyboard dictation is NOT the app's SpeechRecognition instance.
      // Invalidate its target before blur can flush a final native input event.
      const current = element.current;
      if (current) { current.readOnly = true; current.blur(); current.value = ""; }
      composing.current = false;
      setEpoch(value => value + 1);
      // Deliberately do not auto-focus: a new draft requires a new editing session.
    },
  }), []);
  const current = (target: HTMLTextAreaElement) => target === element.current && !target.readOnly;
  return <textarea
    key={epoch} ref={element} rows={1} wrap="soft" enterKeyHint="send"
    value={value} className={className}
    placeholder="Send a message…" aria-label="Terminal command"
    autoCapitalize="none" autoComplete="off" spellCheck={false}
    onCompositionStart={event => { if (current(event.currentTarget)) composing.current = true; }}
    onCompositionEnd={event => { if (current(event.currentTarget)) composing.current = false; }}
    onKeyDown={event => {
      if (!current(event.currentTarget) || event.key !== "Enter" || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || composing.current || event.shiftKey) return;
      if (event.altKey && !pi) return;
      event.preventDefault();
      if (!event.repeat) onSend(event.altKey && pi);
    }}
    onChange={event => { if (current(event.currentTarget)) onChange(event.currentTarget.value); }}
    // Never interpret beforeinput insertParagraph/insertLineBreak as Send.
    // Dictation can emit them, even when no Return key was pressed.
  />;
});
