"use client";
import { useId, useState, type ReactNode } from "react";
import styles from "./shared-workspace-inspector.module.css";

export function InspectorSection({ title, icon, count, actions, children }: { title: string; icon?: ReactNode; count?: number; actions?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return <section data-expanded={open} className={styles.changeGroup}>
    <header className={styles.groupHeader}>
      <button type="button" className={styles.disclosure} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {icon}<span>{title}</span>{count !== undefined ? <span className={styles.count}>{count}</span> : null}
      </button>{actions}
    </header>
    <div id={id} hidden={!open} className={styles.groupBody}>{children}</div>
  </section>;
}
