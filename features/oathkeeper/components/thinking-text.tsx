"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./thinking-text.module.css";

/* Loading text in the manner of Beautiful UI's Loading State (beautifului.dev): the words themselves
   shimmer while they wait. Once the real text is in, they scramble into it: characters settle left to
   right with a few random glyphs churning just ahead, and the waiting letters keep shimmering in the
   places not reached yet. Text already there on arrival shows at once. */

/** Characters churning ahead of the settled text. */
const SPREAD = 6;
const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789";
/** About 30 new glyphs a second: quick, but each one can still be seen. */
const FRAME_MS = 34;
/** A string's characters, an emoji counting as one. */
export const characters = (text: string) => Array.from(text);

/** One of the words a loader says while it waits, picked afresh each time it mounts. */
export function useWaitingWord(words: readonly string[]) {
  const [word] = useState(() => words[Math.floor(Math.random() * words.length)]);
  return word;
}

/** How far a scramble through `total` characters has got: -1 while waiting, rising once `ready`, and
    Infinity once settled. Ready on arrival it starts settled; with reduced motion it settles at once. */
export function useScramble(ready: boolean, total: number) {
  const [progress, setProgress] = useState(() => ready ? Infinity : -1);
  const totalRef = useRef(total);
  useEffect(() => { totalRef.current = total; });
  const running = ready && progress !== Infinity;
  useEffect(() => {
    if (!running) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = Math.min(900, Math.max(500, totalRef.current * 25));
    let frame = 0, start = 0, shown = -Infinity;
    const tick = (now: number) => {
      start ||= now;
      const elapsed = now - start;
      if (reduced || elapsed >= duration) return setProgress(Infinity);
      if (now - shown >= FRAME_MS) { shown = now; setProgress((totalRef.current + SPREAD) * elapsed / duration); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);
  return progress;
}

/** `text`, `offset` characters into a scramble at `progress`, coming from `from` (what it said while
    waiting): the settled part, the glyphs churning, then `from`'s letters still holding later places. */
export function Scrambled({ text, offset = 0, progress, from }: { text: string; offset?: number; progress: number; from: string }) {
  if (progress === Infinity) return text;
  const chars = characters(text), reached = Math.floor(progress) - offset;
  const settled = Math.max(0, Math.min(chars.length, reached - SPREAD)), churning = Math.max(settled, Math.min(chars.length, reached));
  const tick = Math.floor(progress * 4);
  const glyphs = chars.slice(settled, churning).map((char, index) => char === " " ? " " : GLYPHS[(Math.imul(offset + settled + index + 1, 2654435761) + Math.imul(tick, 40503) >>> 0) % GLYPHS.length]).join("");
  const held = characters(from).slice(Math.max(0, reached)).join("");
  return <>{chars.slice(0, settled).join("")}{glyphs ? <span className={styles.churn}>{glyphs}</span> : null}{held ? <span className={styles.waiting}>{held}</span> : null}</>;
}

/** A line that shimmers as `word`, then scrambles into `text` once `ready`. */
export function ThinkingText({ ready, word, text }: { ready: boolean; word: string; text: string }) {
  const progress = useScramble(ready, Math.max(characters(text).length, characters(word).length));
  if (progress === Infinity) return <span>{text}</span>;
  return <span><span aria-hidden="true"><Scrambled text={text} progress={progress} from={word}/></span><span className="sr-only">{ready ? text : word}</span></span>;
}
