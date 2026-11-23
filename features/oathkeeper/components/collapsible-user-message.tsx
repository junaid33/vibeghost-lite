"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./chat-thread.module.css";

/** Measure rendered lines, including wrapping, rather than guessing by characters. */
export function CollapsibleUserMessage({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [long, setLong] = useState(false);
  const paragraph = useRef<HTMLParagraphElement>(null);
  const id = useId();
  useEffect(() => {
    const node = paragraph.current;
    if (!node) return;
    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(node).lineHeight);
      setLong(node.scrollHeight > lineHeight * 6 + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [text]);
  return <div className={styles.userMessage}>
    <div id={id} className={styles.userMessageText} data-collapsed={long && !expanded || undefined}><p ref={paragraph}>{text}</p></div>
    {long ? <button type="button" className={styles.messageToggle} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>{expanded ? "Show less" : "Show more"}</button> : null}
  </div>;
}
