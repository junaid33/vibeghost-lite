"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { focusMobileTerminalInput } from "../lib/vibeghost-terminal/mobile-terminal-focus";

const SENTINEL = "\u200b";

export type MobileTerminalInputHandle = { focus: () => void };

export const MobileTerminalInput = forwardRef<MobileTerminalInputHandle, {
  id: string;
  onSendInput: (text: string) => void;
}>(function MobileTerminalInput({ id, onSendInput }, ref) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const suppressCompositionInputRef = useRef(false);
  const compositionEndAtRef = useRef(Number.NEGATIVE_INFINITY);

  useImperativeHandle(ref, () => ({
    focus: () => focusMobileTerminalInput(inputRef.current),
  }), []);

  const resetInput = useCallback((input: HTMLTextAreaElement) => {
    input.value = SENTINEL;
    input.setSelectionRange(SENTINEL.length, SENTINEL.length);
  }, []);

  const flushInput = useCallback((input: HTMLTextAreaElement, fallback = "") => {
    const text = input.value.split(SENTINEL).join("") || fallback;
    if (text) onSendInput(text);
    resetInput(input);
  }, [onSendInput, resetInput]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const handleBeforeInput = (event: InputEvent) => {
      // If native editing cannot be canceled, let onInput own this operation.
      // Sending here as well would deliver Enter/Delete twice on such keyboards.
      if (!event.cancelable || event.isComposing || composingRef.current) return;
      const sequence = beforeInputSequence(event.inputType);
      if (!sequence) return;
      event.preventDefault();
      onSendInput(sequence);
      resetInput(input);
    };
    input.addEventListener("beforeinput", handleBeforeInput);
    return () => input.removeEventListener("beforeinput", handleBeforeInput);
  }, [onSendInput, resetInput]);

  return <textarea
    ref={inputRef}
    id={id}
    data-mobile-terminal-input="true"
    aria-label="Direct terminal input"
    tabIndex={-1}
    rows={1}
    inputMode="text"
    enterKeyHint="send"
    autoCapitalize="off"
    autoComplete="off"
    autoCorrect="off"
    spellCheck={false}
    onFocus={(event) => resetInput(event.currentTarget)}
    onBlur={(event) => {
      composingRef.current = false;
      suppressCompositionInputRef.current = false;
      event.currentTarget.value = "";
    }}
    onInput={(event) => {
      if (composingRef.current) return;
      if (suppressCompositionInputRef.current) {
        suppressCompositionInputRef.current = false;
        if (performance.now() - compositionEndAtRef.current < 100) {
          resetInput(event.currentTarget);
          return;
        }
      }
      const sequence = beforeInputSequence((event.nativeEvent as InputEvent).inputType);
      if (sequence) onSendInput(sequence);
      else flushInput(event.currentTarget);
      resetInput(event.currentTarget);
    }}
    onCompositionStart={() => { composingRef.current = true; suppressCompositionInputRef.current = false; }}
    onCompositionEnd={(event) => {
      composingRef.current = false;
      flushInput(event.currentTarget, event.data ?? "");
      suppressCompositionInputRef.current = true;
      compositionEndAtRef.current = performance.now();
    }}
    onKeyDown={(event) => {
      if (event.nativeEvent.isComposing || composingRef.current || event.key === "Process") return;
      const sequence = keySequence(event);
      if (!sequence) return;
      event.preventDefault();
      event.stopPropagation();
      onSendInput(sequence);
      resetInput(event.currentTarget);
    }}
    onPaste={(event) => {
      event.preventDefault();
      event.stopPropagation();
      const text = event.clipboardData.getData("text/plain") || event.clipboardData.getData("text");
      if (text) onSendInput(text.replace(/\r\n/g, "\n"));
      resetInput(event.currentTarget);
    }}
    style={{ position: "absolute", left: 16, bottom: 16, width: 1, height: 1, padding: 0, border: 0, margin: 0, overflow: "hidden", resize: "none", outline: "none", fontSize: 16, lineHeight: "16px", color: "transparent", caretColor: "transparent", background: "transparent" }}
  />;
});

function beforeInputSequence(inputType: string) {
  if (inputType === "deleteContentBackward") return "\x7f";
  if (inputType === "deleteContentForward") return "\x1b[3~";
  if (inputType === "insertLineBreak" || inputType === "insertParagraph") return "\r";
  return null;
}

function keySequence(event: { key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) {
  const { key, altKey = false, ctrlKey = false, metaKey = false, shiftKey = false } = event;
  if (key === "Enter") return null;
  if (key === "Backspace" || metaKey) return null;
  if (ctrlKey && key.length === 1) {
    const code = key.toLowerCase().charCodeAt(0);
    if (code >= 97 && code <= 122) return `${altKey ? "\x1b" : ""}${String.fromCharCode(code - 96)}`;
  }
  if (key === "Tab" && shiftKey) return "\x1b[Z";
  const fixed: Record<string, string> = { ArrowDown: "\x1b[B", ArrowLeft: "\x1b[D", ArrowRight: "\x1b[C", ArrowUp: "\x1b[A", Delete: "\x1b[3~", End: "\x1b[F", Escape: "\x1b", Home: "\x1b[H", PageDown: "\x1b[6~", PageUp: "\x1b[5~", Tab: "\t" };
  const sequence = fixed[key];
  if (sequence) return altKey ? `\x1b${sequence}` : sequence;
  if (altKey && key.length === 1) return `\x1b${key}`;
  return null;
}
