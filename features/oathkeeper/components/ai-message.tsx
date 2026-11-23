"use client";

import type { FileUIPart, UIMessage as TMessage } from "ai";
import { memo, type ReactNode } from "react";
import { Sparkle } from "lucide-react";
import { Streamdown, type Components } from "streamdown";
import { markdownTableStyles } from "./markdown-table";
import { cn } from "@/lib/utils";
import { ToolInvocation } from "./tool-invocation";
import { CanvasFrame } from "./canvas/canvas-frame";
import { messageCanvases } from "../lib/chat-canvas";
import { ChatImage } from './chat-image';
import { LightboxZone } from './lightbox';
import { isChatImagePart } from '@/lib/chat-images';

function OathkeeperSpark({ className = "size-3.5" }: { className?: string }) {
  return <Sparkle className={cn(className, "text-signal-ink")} strokeWidth={1.8} aria-hidden="true"/>;
}

const components = {
  p: ({ children }) => <p className="min-w-0 break-words">{children}</p>,
  a: ({ href, children }) => href && href !== "streamdown:incomplete-link" ? <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-signal-ink underline decoration-signal/30 underline-offset-2 hover:decoration-signal">{children}</a> : <span>{children}</span>,
  ul: ({ children }) => <ul className="list-outside list-disc space-y-1.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-outside list-decimal space-y-1.5 pl-5">{children}</ol>,
  li: ({ children }) => <li className="min-w-0 [overflow-wrap:anywhere] [&>p]:inline">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  h1: ({ children }) => <h1 className="font-semibold text-ink">{children}</h1>,
  h2: ({ children }) => <h2 className="font-semibold text-ink">{children}</h2>,
  h3: ({ children }) => <h3 className="font-semibold text-ink">{children}</h3>,
  inlineCode: ({ children }) => <code className="rounded-[4px] bg-inset px-1 py-0.5 font-mono text-[.95em]">{children}</code>,
  code: ({ children, className, ...props }) => "data-block" in props ? <pre className="max-w-full overflow-x-auto rounded-control bg-inset p-3 shadow-hairline" tabIndex={0}><code className={cn("block min-w-max whitespace-pre font-mono text-[12px] leading-5", className)}>{children}</code></pre> : <code className="rounded-[4px] bg-inset px-1 py-0.5 font-mono text-[.95em]">{children}</code>,
} satisfies Components;

/** Records connected to the input are appended as a "Connected:" list; they show as chips. */
export const CONNECTED_PATTERN = /\n\nConnected:\n((?:- .*(?:\n|$))+)$/;
function UserText({ text }: { text: string }) {
  const match = CONNECTED_PATTERN.exec(text);
  if (!match) return <p className="whitespace-pre-wrap">{text}</p>;
  const lines = match[1].trim().split("\n").map(line => line.replace(/^- /, "").replace(/ \(id [^)]*\)/, ""));
  return <><p className="whitespace-pre-wrap">{text.slice(0, match.index)}</p><ul aria-label="Connected records" className="mt-1.5 flex flex-wrap gap-1 p-0">{lines.map((line, index) => <li key={index} className="max-w-full list-none truncate rounded-md bg-white/5 px-1.5 py-px text-[11px] leading-[17px] text-ink-3">{line}</li>)}</ul></>;
}

interface AIMessageProps {
  message: TMessage;
  status: "error" | "submitted" | "streaming" | "ready";
  isLatestMessage: boolean;
  assistantName?: string;
  assistantIcon?: ReactNode;
  isLoading?: boolean;
  onAttachImage?: (image: FileUIPart) => void;
  [key: string]: unknown;
}

const PureAIMessage = ({
  message,
  status,
  isLatestMessage,
  assistantName = "Oathkeeper",
  assistantIcon,
  onAttachImage,
}: AIMessageProps) => (
  <div className={cn("flex w-full", message.role === "user" ? "justify-end" : "justify-start")}>
    <div className={cn("min-w-0 break-words", message.role === "user" ? "max-w-[86%] rounded-xl bg-field px-3 py-2 text-[13px] leading-[1.45] text-ink sm:max-w-[72%]" : "w-full space-y-2.5")}>
      {message.parts?.some(isChatImagePart) ? <LightboxZone className="mb-2 flex flex-wrap gap-2">{message.parts.filter(isChatImagePart).map(image => <ChatImage key={image.url} image={image} generated={message.role === 'assistant'} onUseAsReference={onAttachImage && message.role === 'assistant' ? () => onAttachImage(image) : undefined} className="max-h-80 max-w-full rounded-lg object-contain"/>)}</LightboxZone> : null}
      {message.role === "user" ? <UserText text={message.parts?.filter((part: any) => part.type === "text").map((part: any) => part.text).join("") ?? ""}/> : message.parts?.map((part: any, index) => {
        if (part.type === "text" && part.text) return <div key={index} className="space-y-1.5" style={{ animation: "fade-up 300ms var(--ease-out) both" }}><div className="flex items-center gap-1.5 text-[12px] font-semibold">{assistantIcon ?? <OathkeeperSpark/>}<span className="text-signal-ink">{assistantName}</span></div><Streamdown className={cn("min-w-0 space-y-3 text-[13px] leading-[1.6] text-ink", markdownTableStyles.streamdown)} components={components} controls={false} isAnimating={status === "streaming" && isLatestMessage} lineNumbers={false} remend={{ linkMode: "text-only" }} skipHtml>{part.text}</Streamdown></div>;
        if (part.type === "dynamic-tool" || part.type === "tool-invocation" || part.type?.startsWith("tool-")) {
          const invocation = part.type === "tool-invocation" ? part.toolInvocation : part;
          const canvas = messageCanvases([part])[0];
          if (canvas) return <div key={index} className="space-y-1.5"><ToolInvocation toolName={invocation.toolName || part.type.replace(/^tool-/, "")} state="result" args={invocation.input || invocation.args} result={invocation.output || invocation.result} isLatestMessage={isLatestMessage} status={status} /><CanvasFrame id={canvas.id} title={canvas.title} height={canvas.height} heights={canvas.heights} inline/></div>;
          return <ToolInvocation key={index} toolName={invocation.toolName || part.type.replace(/^tool-/, "")} state={invocation.state === "output-available" ? "result" : "call"} args={invocation.input || invocation.args} result={invocation.output || invocation.result} isLatestMessage={isLatestMessage} status={status} />;
        }
        return null;
      })}
    </div>
  </div>
);

export const AIMessage = memo(PureAIMessage);
