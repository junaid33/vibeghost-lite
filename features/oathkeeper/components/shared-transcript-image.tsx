"use client"
/* eslint-disable @next/next/no-img-element -- scoped binary RPC produces a local object URL. */
import { useEffect, useState } from "react"
import type { SharedWorkspaceClient } from "../lib/shared-workspace-client"
import type { AgentChatImage } from "../lib/session-integrations/agent-chat"

export function SharedTranscriptImage({ image, client, sessionId }: { image: AgentChatImage; client: SharedWorkspaceClient; sessionId: string }) {
  const [result, setResult] = useState<{ key: string; src?: string; failed?: boolean }>()
  const key = `${client.transportGeneration}:${sessionId}:${image.src ?? image.data}`
  const allowed = /^image\/(png|jpeg|gif|webp)$/.test(image.mimeType)
  const prefix = `/api/sessions/${encodeURIComponent(sessionId)}/inspect/events/`
  const scoped = image.src?.startsWith(prefix) && /^[A-Za-z0-9_%:.-]+\/images\/[A-Za-z0-9_%:-]+(?:\?cursor=[A-Za-z0-9_-]+)?$/.test(image.src.slice(prefix.length))
  useEffect(() => {
    if (!allowed || !image.src || !scoped) return
    const controller = new AbortController(); let url: string | undefined
    void client.request('GET', image.src, undefined, undefined, controller.signal).then(response => {
      const mime = response.contentType.split(';')[0]
      if (response.status !== 200 || mime !== image.mimeType || !response.body.length || response.body.length > 20 * 1024 * 1024) throw Error('Invalid transcript image')
      if (controller.signal.aborted) return
      url = URL.createObjectURL(new Blob([new Uint8Array(response.body).buffer], { type: mime }))
      setResult({ key, src: url })
    }).catch(() => { if (!controller.signal.aborted) setResult({ key, failed: true }) })
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [client, key, allowed, scoped, image.src, image.mimeType])
  if (!allowed) return null
  if (!image.src) return image.data ? <img alt="Conversation attachment" src={`data:${image.mimeType};base64,${image.data}`} /> : null
  if (!scoped || (result?.key === key && result.failed)) return <p role="status">Attachment unavailable.</p>
  return result?.key === key && result.src ? <img alt="Conversation attachment" src={result.src} /> : <p role="status">Reading attachment…</p>
}
