"use client";
import type { OathkeeperChatThread } from "@/lib/chat-thread-storage";
import { createContext, type ComponentProps, type ReactNode, type RefObject } from "react";
import type { FileUIPart, UIMessage } from "ai";
import type { StickToBottomContext } from "use-stick-to-bottom";
import type { AiModelKind } from "@/lib/ai-model-kind";
import type { HomeComposer } from "./home-composer";

/** Oathkeeper's own chat, owned by OathkeeperApp and shown on Home as the Oathkeeper agent. */
export type HomeChat = {
  messages: UIMessage[];
  status: "error" | "submitted" | "streaming" | "ready";
  loading: boolean;
  pendingGeneration: AiModelKind | null;
  composer: Omit<ComponentProps<typeof HomeComposer>, "placeholder">;
  scrollRef: RefObject<StickToBottomContext | null>;
  followLatest: () => () => void;
  onAttachImage?: (image: FileUIPart) => void;
  /** Chat and dictation notices, shown above the input. */
  notice: ReactNode;
  /** What /chat/v2 needs beyond Home's view: the same thread, model and tools, with its own composer. */
  v2?: {
    threadId: string;
    body: Record<string, unknown>;
    model?: string;
    /** Set when the user's own provider is a custom endpoint; its catalog comes from that endpoint. */
    customProvider?: { endpoint: string; apiKey: string };
    imageGeneration: boolean;
    chatNotice: string | null;
    dictationError: string | null;
    addReference: (image: FileUIPart) => void;
    clearImages: () => void;
    send: (message: { text: string; files?: FileUIPart[]; metadata?: Record<string, unknown> }, extraBody?: Record<string, unknown>) => Promise<void>;
    /** Stops observing the stream (the server run is stopped through /api/completion/[id]/stop). */
    stopObserver: () => void;
    leading: ReactNode;
    tabs: { threads: OathkeeperChatThread[]; activeThreadId: string; disabled: boolean; onSelect: (id: string) => void; onClose: (id: string) => void; onNew: () => void };
  };
};
export const HomeChatContext = createContext<HomeChat | null>(null);
