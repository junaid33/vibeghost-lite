"use client";

import { createContext, useContext, useLayoutEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { ArrowUp, Paperclip, X } from "@/components/icons/duo";
import type { FileUIPart } from 'ai';
import { CHAT_IMAGE_ACCEPT } from '@/lib/chat-images';
import { ChatImage } from './chat-image';
import { BrowserDictationButton, type BrowserDictationHandle, type PersistentDictation } from "./browser-dictation-button";
import { ModeSplitButton } from "./dual-sidebar/mode-split-button";
import { promptToolbarControlClass } from "./dual-sidebar/prompt-control-popover";
import styles from "./home-composer.module.css";
import { ComposerAttachmentStack } from "./composer-attachment";

type Props = {
  value: string;
  disabled: boolean;
  placeholder: string;
  className?: string;
  ariaLabel?: string;
  configuration?: ReactNode;
  attachments?: boolean;
  /** The images are shown elsewhere (the chat page's References node). */
  hideImages?: boolean;
  sharedKeys: ComponentProps<typeof ModeSplitButton>["sharedKeys"];
  onChange: (value: string) => void;
  onSubmit: () => void;
  onBlur: () => void;
  onTranscript: (text: string) => void;
  onDictationError: (message: string) => void;
  images: FileUIPart[];
  imageGeneration?: boolean;
  uploading: boolean;
  imageError: string | null;
  onAddImages: (files: File[]) => void;
  onRemoveImage: (url: string) => void;
  /** While a reply is running, the send button becomes Stop. */
  onStop?: () => void;
  running?: boolean;
  /** Placed after the configuration in the toolbar row: /chat's reasoning-effort control. */
  effort?: ReactNode;
  /** The draft lives above this composer, so dictation may outlive it (closing the dock's chat, changing page). */
  persistent?: PersistentDictation;
};

/** A control placed first in the composer's toolbar row: Home's agent picker. */
export const ComposerLeading = createContext<ReactNode>(null);

/** Same compact field as VibeGhost, with a stationary toolbar row: the leading control, the
 *  configuration (model pickers by default), and attach. */
export function HomeComposer({ value, disabled, placeholder, className, sharedKeys, onChange, onSubmit, onBlur, onTranscript, onDictationError, images, uploading, imageError, onAddImages, onRemoveImage, imageGeneration = false, ariaLabel = "Command", configuration, attachments = true, hideImages = false, onStop, running = false, effort, persistent }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const dictation = useRef<BrowserDictationHandle | null>(null);
  const composing = useRef(false);
  const sending = useRef(false);
  const mounted = useRef(true);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const leading = useContext(ComposerLeading);
  const canSend = Boolean(value.trim() || (!imageGeneration && images.length));
  const latest = useRef({ disabled, onSubmit, canSend });
  useLayoutEffect(() => { latest.current = { disabled, onSubmit, canSend }; }, [disabled, onSubmit, canSend]);
  const send = async () => {
    if (disabled || composing.current || sending.current) return;
    sending.current = true;
    try {
      // Stop capture, then wait for the final result before reading the draft.
      // An interim fallback/error requires a second, deliberate Send after review.
      if (dictation.current && !await dictation.current.finish()) return;
      if (!mounted.current || composing.current || latest.current.disabled || !latest.current.canSend) return;
      latest.current.onSubmit();
    } finally { sending.current = false; }
  };
  const hint = imageGeneration ? 'Describe an image or an edit…' : placeholder;
  const field = (
          <textarea
            value={value}
            onChange={event => { dictation.current?.cancel(); onChange(event.target.value); }}
            onPaste={event => {
              const files = Array.from(event.clipboardData.items).filter(item => item.kind === 'file').flatMap(item => { const file = item.getAsFile(); return file ? [file] : []; });
              if (!files.length || !attachments) return;
              event.preventDefault();
              if (!disabled) onAddImages(files);
            }}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={() => { composing.current = false; }}
            onKeyDown={event => {
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || composing.current) return;
              event.preventDefault();
              if (!event.repeat) void send();
            }}
            onBlur={onBlur}
            placeholder={hint}
            aria-label={ariaLabel}
            disabled={disabled}
            rows={1}
            wrap="soft"
            enterKeyHint="send"
            className={`${styles.field} ${styles.singleLine}`}
          />
  );
  const imageStrip = images.length ? <div aria-label="Attached images" className="flex gap-2 overflow-x-auto p-2">{images.map(image => <div key={image.url} className="relative flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/25"><ChatImage image={image} className="h-full w-full object-contain"/><button type="button" aria-label={`Remove ${image.filename || 'image'}`} disabled={disabled} onClick={() => onRemoveImage(image.url)} className="absolute right-0 top-0 flex size-7 items-center justify-center rounded-bl-lg bg-black/80 text-white"><X className="pointer-events-none size-3"/></button></div>)}</div> : null;
  const fileChooser = <input ref={fileInput} type="file" accept={CHAT_IMAGE_ACCEPT} multiple hidden aria-label="Choose images" onChange={event => { onAddImages(Array.from(event.target.files ?? [])); event.target.value = ''; }} />;
  return (
    <form className={className} onSubmit={event => { event.preventDefault(); void send(); }}>
      <ComposerAttachmentStack>
      <div data-home-composer data-composer-surface className={`oathkeeper-content-panel ${styles.panel} ${styles.compactHome}`}>
        {hideImages ? null : imageStrip}
        {uploading ? <p role="status" className="px-2 text-[12px] text-ink-3">Attaching images…</p> : null}
        {imageError ? <p role="alert" className="px-2 text-[12px] text-[#f37996]">{imageError}</p> : null}
        {fileChooser}
        <div className="relative min-w-0 w-full">
          {field}
          {value ? null : <span aria-hidden="true" data-composer-hint className={styles.hint} data-disabled={disabled || undefined}>{hint}</span>}
          <div className={`pointer-events-none absolute inset-0 [--dictation-action-inset:2.25rem] ${styles.micSlot}`}>
            <BrowserDictationButton
              inline ref={dictation} disabled={disabled}
              className="oathkeeper-raised-control !absolute [--oathkeeper-control:#302044] [--oathkeeper-control-ink:#d3b2ff] hover:[--oathkeeper-control:#3b2854] [&[aria-pressed=true]]:[--oathkeeper-control:#4b3068] [&[aria-pressed=true]]:[--oathkeeper-control-ink:#ecd9ff]"
              onTranscript={onTranscript} onError={onDictationError} persistent={persistent}
            />
          </div>
          <div className={`absolute right-[5px] top-[5px] ${styles.sendSlot}`}>
            {running && onStop
              ? <button type="button" aria-label="Stop" title="Stop" onClick={onStop} className={`${promptToolbarControlClass} size-8 justify-center [--oathkeeper-control:#2a2d31] [--oathkeeper-control-ink:#e8eaec] hover:[--oathkeeper-control:#33373c]`}>
                  <span aria-hidden="true" className="pointer-events-none size-2.5 rounded-[2px] bg-current"/>
                </button>
              : <button type="submit" aria-label="Send command" disabled={disabled || !canSend} className={`${promptToolbarControlClass} size-8 justify-center [--oathkeeper-control:#112945] [--oathkeeper-control-ink:#9dc4ff] hover:[--oathkeeper-control:#17355a]`}>
                  <ArrowUp className="pointer-events-none size-3.5" aria-hidden="true" />
                </button>}
          </div>
        </div>
        <div data-home-composer-controls className={styles.toolbar}>
          {leading}
          <div className={styles.toolbarMain}>{configuration === undefined ? <ModeSplitButton disabled={disabled} mcpDisabled={imageGeneration} sharedKeys={sharedKeys} showModelLabelOnMobile /> : configuration}</div>
          {effort}
          {attachments ? <button type="button" aria-label="Attach images" title="Attach images, or paste into the input" disabled={disabled} onClick={() => fileInput.current?.click()} className={`${promptToolbarControlClass} size-8 shrink-0 justify-center`}><Paperclip className="pointer-events-none size-3.5"/></button> : null}
        </div>
      </div>
      </ComposerAttachmentStack>
    </form>
  );
}
