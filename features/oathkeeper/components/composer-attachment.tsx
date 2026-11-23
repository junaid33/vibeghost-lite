"use client";

import { createContext, useContext, useState, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import styles from "./home-composer.module.css";

const AttachmentHost = createContext<HTMLDivElement | null>(null);

/** Attachments share the input's width and sit behind its rim, not over its field.
 * A local portal lets nested mic controls use the same slot as file uploads.
 * No viewport measurements or document-level positioning are involved. */
export function ComposerAttachmentStack({ children, className, ...props }: ComponentProps<"div">) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return <AttachmentHost.Provider value={host}>
    <div {...props} className={cn(styles.attachmentStack, className)}>
      <div ref={setHost} className={styles.attachments}/>
      {children}
    </div>
  </AttachmentHost.Provider>;
}

export function ComposerAttachment({ children }: { children: ReactNode }) {
  const host = useContext(AttachmentHost);
  return host ? createPortal(children, host) : null;
}
