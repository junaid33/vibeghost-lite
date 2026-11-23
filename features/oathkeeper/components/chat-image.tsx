"use client";

import { useEffect, useState } from 'react';
import type { FileUIPart } from 'ai';
import { parseChatImageUrl } from '@/lib/chat-images';
import { homeChatKey } from '../lib/home-chat-key';
import { ImageGeneration } from '@/components/beui/image-generation';

export function ChatImage({ image, className, generated = false, onUseAsReference }: { image: FileUIPart; className?: string; generated?: boolean; onUseAsReference?: () => void }) {
  const [loaded, setLoaded] = useState<{ url: string; src: string } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let objectUrl: string | undefined;
    const controller = new AbortController();
    setFailed(false);
    void (async () => {
      try {
        const reference = parseChatImageUrl(image.url);
        if (!reference) throw new Error('Invalid image reference');
        const key = homeChatKey(reference.threadId);
        if (!key) throw new Error('Chat authorization unavailable');
        const response = await fetch(image.url, { headers: { 'x-oathkeeper-chat-key': key }, signal: controller.signal });
        if (!response.ok) throw new Error('Image unavailable');
        const blob = await response.blob();
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ url: image.url, src: objectUrl });
      } catch { if (!disposed) setFailed(true); }
    })();
    return () => { disposed = true; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [image.url]);
  if (generated && !failed && (!loaded || loaded.url !== image.url)) return <ImageGeneration label="Loading image"/>;
  if (!loaded || loaded.url !== image.url) return <span role="status" className="text-[11px] text-ink-3">{failed ? 'Image unavailable' : 'Loading image…'}</span>;
  // Blob URL is fetched with the chat credential, not exposed in image URLs.
  const filename = image.filename || `generated-image.${image.mediaType === 'image/jpeg' ? 'jpg' : image.mediaType.split('/')[1]}`;
  // eslint-disable-next-line @next/next/no-img-element
  const preview = <img src={loaded.src} alt={generated ? 'Generated image' : image.filename || 'Attached image'} className={className} onError={() => { setLoaded(null); setFailed(true); }} />;
  if (!generated) return preview;
  return <figure className="min-w-0 max-w-full space-y-2">{preview}<figcaption className="flex flex-wrap gap-4 text-[12px] text-ink-3"><a href={loaded.src} download={filename} className="underline underline-offset-2">Download image</a>{onUseAsReference ? <button type="button" onClick={onUseAsReference} className="underline underline-offset-2">Use as reference</button> : null}</figcaption></figure>;
}
