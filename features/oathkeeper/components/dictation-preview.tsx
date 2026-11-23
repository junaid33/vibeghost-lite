"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "@/components/icons/duo";
import { Spinner } from "@/components/ui/spinner";
import { ComposerAttachment } from "./composer-attachment";
import composerStyles from "./home-composer.module.css";
import styles from "./dictation-preview.module.css";

/** Read-only display of this recognition run; never a source for submitted text. */
export function DictationPreview({ text, finishing }: { text: string; finishing: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const id = useId();

  const updateEdges = () => {
    const element = viewport.current;
    if (!element) return;
    element.dataset.fadeTop = String(element.scrollTop > 1);
    element.dataset.fadeBottom = String(element.scrollHeight - element.clientHeight - element.scrollTop > 1);
  };
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    // New words follow the bottom only while the user is already there.
    // Scrolling back to read must not be interrupted by recognition updates.
    if (following.current) element.scrollTop = element.scrollHeight;
    updateEdges();
  }, [text, expanded]);
  useLayoutEffect(() => {
    const element = viewport.current;
    const body = content.current;
    if (!element || !body) return;
    const observer = new ResizeObserver(() => {
      if (following.current) element.scrollTop = element.scrollHeight;
      updateEdges();
    });
    observer.observe(element);
    observer.observe(body);
    return () => observer.disconnect();
  }, []);

  return <ComposerAttachment>
    <aside data-dictation-preview className={`${composerStyles.uploadStatus} ${styles.preview}`} aria-label="Live dictation preview">
      <div className={styles.body}>
        <div className={styles.label}>{finishing ? <><Spinner aria-hidden="true" className="size-3 "/>Finishing dictation…</> : "Live dictation"}</div>
        <div id={id} ref={viewport} role="region" aria-label="Current dictation transcript" tabIndex={0} data-expanded={expanded} className={styles.transcript} onScroll={() => {
          const element = viewport.current;
          if (element) following.current = element.scrollHeight - element.clientHeight - element.scrollTop < 20;
          updateEdges();
        }}>
          <div ref={content} className={styles.text}>{text || "Listening…"}</div>
        </div>
      </div>
      <button type="button" className={styles.expand} aria-label={expanded ? "Collapse dictation preview" : "Expand dictation preview"} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
        {expanded ? <ChevronDown aria-hidden="true" className="size-4"/> : <ChevronUp aria-hidden="true" className="size-4"/>}
      </button>
    </aside>
  </ComposerAttachment>;
}
