"use client"
/* eslint-disable @next/next/no-img-element -- Authenticated transcript data URIs must not pass through an image proxy. */

// One chat presentation for every agent, shared with VibeGhost
// (components/oathkeeper/chat-thread.tsx there). Pi (vibeghost-chat-view.tsx)
// and Claude/Codex (agent-conversation.tsx) build ChatTurns and render them
// here, so bubbles, tool calls, type scale and surfaces stay identical.
import { memo, useState, type ReactNode } from "react"
import { LightboxZone } from "./lightbox"
import { CollapsibleUserMessage } from "./collapsible-user-message"
import { Streamdown, type Components } from "streamdown"
import { MarkdownTable } from "./markdown-table"
import {
  AlertCircle,
  ChevronRight,
  ChevronUp,
  FileText,
  Globe,
  Pencil,
  Search,
  Sparkle,
  TerminalSquare,
  Wrench,
} from "@/components/icons/duo"
import { Spinner } from "@/components/ui/spinner"
import { HalftoneDots } from "@/components/ui/halftone-dots"
import { CustomAppIcon } from "@/components/CustomAppIcon"
import { OathkeeperOrb } from "@/components/OathkeeperOrb"
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "./dual-sidebar/chat-container"
import { ScrollButton } from "./dual-sidebar/scroll-button"
import styles from "./chat-thread.module.css"

export type ChatToolCall = {
  id?: string
  name: string
  /** A record, or a JSON string as Pi's semantic transcript sends it. */
  args?: unknown
  result?: string
  status?: string
  isError?: boolean
  truncated?: boolean
  media?: ReactNode
}

export type ChatBlock =
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string }
  | { kind: "tools"; tools: ChatToolCall[] }
  | { kind: "node"; key: string; node: ReactNode }
  | { kind: "note"; text: string }

export type ChatTurn =
  | { id: string; role: "user"; text: string; pending?: boolean; media?: ReactNode }
  | { id: string; role: "assistant"; author: string; icon?: ReactNode; blocks: ChatBlock[] }
  | { id: string; role: "system"; text: string }

const PROVIDER_COLORS: Record<string, string> = {
  pi: "#3b82f6",
  claude: "#d97757",
  codex: "#10a37f",
}

/** The assistant's mark beside its name: a colored app dot per provider. */
export function ProviderMark({ provider }: { provider?: string }) {
  return <CustomAppIcon color={(provider && PROVIDER_COLORS[provider]) || "#8b918d"} centered />
}

/** Appends a block, folding consecutive tool calls into one group. */
export function pushChatBlock(blocks: ChatBlock[], block: ChatBlock) {
  const last = blocks.at(-1)
  if (block.kind === "tools" && last?.kind === "tools") last.tools.push(...block.tools)
  else if (block.kind === "tools") blocks.push({ kind: "tools", tools: [...block.tools] })
  else blocks.push(block)
}

export function ChatThread({
  label,
  turns,
  loading = false,
  loadingLabel = "Reading conversation…",
  emptyLabel = "No messages yet.",
  error,
  onRetry,
  earlier,
  working,
  prelude,
  footer,
}: {
  label: string
  turns: ChatTurn[]
  loading?: boolean
  loadingLabel?: string
  emptyLabel?: string
  error?: string
  onRetry?: () => void
  earlier?: { loading: boolean; onLoad: () => void }
  /** Shown under the last turn while the agent is mid-task. */
  working?: string
  /** Provider-specific panels above the messages (e.g. conversation recovery). */
  prelude?: ReactNode
  /** Pinned under the messages, just above the composer (the agent's queue). */
  footer?: ReactNode
}) {
  return (
    <section className={styles.thread} aria-label={label}>
      <ChatContainerRoot className={styles.scroller}>
        <ChatContainerContent className={styles.column}>
          {earlier && turns.length ? (
            <div className={styles.earlier}>
              <button type="button" className={styles.pill} disabled={earlier.loading} onClick={earlier.onLoad}>
                {earlier.loading ? <Spinner className="size-3" /> : <ChevronUp size={13} />}
                {earlier.loading ? "Loading earlier messages" : "Load earlier messages"}
              </button>
            </div>
          ) : null}
          {prelude}
          {error ? (
            <div role="alert" className={styles.error}>
              <AlertCircle size={14} />
              <span>{error}</span>
              {onRetry ? <button type="button" onClick={onRetry}>Retry</button> : null}
            </div>
          ) : null}
          {turns.length ? (
            <div className={styles.turns}>
              {turns.map((turn) => <ChatTurnView key={turn.id} turn={turn} />)}
            </div>
          ) : !error && (loading || emptyLabel) ? (
            <div role="status" className={styles.empty} data-loading={loading || undefined}>
              {loading ? <><span aria-hidden="true"><OathkeeperOrb size={40} /></span><span className="sr-only">{loadingLabel}</span></> : <span>{emptyLabel}</span>}
            </div>
          ) : null}
          {working ? (
            <div role="status" className={styles.working}>
              <span className={styles.workingDots}><HalftoneDots spacing={4} /></span>
              <span>{working}</span>
            </div>
          ) : null}
          <ChatContainerScrollAnchor />
        </ChatContainerContent>
        <div className={styles.scrollDock}>
          <ScrollButton />
        </div>
      </ChatContainerRoot>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </section>
  )
}

const ChatTurnView = memo(function ChatTurnView({ turn }: { turn: ChatTurn }) {
  if (turn.role === "user") {
    return (
      <article className={styles.user} data-role="user" data-pending={turn.pending || undefined} aria-label="Your message">
        <div className={styles.bubble}>
          {turn.text ? <CollapsibleUserMessage key={turn.id} text={turn.text}/> : null}
          {turn.media}
        </div>
      </article>
    )
  }
  if (turn.role === "system") {
    return (
      <article className={styles.system} data-role="system" aria-label="System message">
        <span>{turn.text}</span>
      </article>
    )
  }
  return (
    <article className={styles.assistant} data-role="assistant" aria-label={`${turn.author} message`}>
      <header className={styles.author}>
        {turn.icon}
        <span>{turn.author}</span>
      </header>
      <div className={styles.blocks}>
        {turn.blocks.map((block, index) =>
          block.kind === "text" ? (
            <ChatMarkdown key={index} text={block.text} />
          ) : block.kind === "thinking" ? (
            <ThinkingRow key={index} text={block.text} />
          ) : block.kind === "tools" ? (
            <ToolGroup key={index} tools={block.tools} />
          ) : block.kind === "node" ? (
            <div key={block.key} className={styles.node}>{block.node}</div>
          ) : (
            <p key={index} className={styles.note}>{block.text}</p>
          )
        )}
      </div>
    </article>
  )
})

// Plain elements so every provider's markdown takes the thread's type scale.
const markdownComponents = {
  p: "p", ul: "ul", ol: "ol", li: "li", strong: "strong", em: "em",
  h1: "h3", h2: "h3", h3: "h4", h4: "h4", h5: "h4", h6: "h4",
  blockquote: "blockquote", hr: "hr",
  table: MarkdownTable, thead: "thead", tbody: "tbody", tr: "tr", th: "th", td: "td",
  a: ({ href, children }) =>
    href && href !== "streamdown:incomplete-link" ? (
      <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    ) : (
      <span>{children}</span>
    ),
  inlineCode: ({ children }) => <code>{children}</code>,
  code: ({ children, className, ...props }) =>
    "data-block" in props ? (
      <pre tabIndex={0}><code className={className}>{children}</code></pre>
    ) : (
      <code>{children}</code>
    ),
} satisfies Components

export function ChatMarkdown({ text }: { text: string }) {
  return (
    <Streamdown
      className={styles.markdown}
      components={markdownComponents}
      controls={false}
      isAnimating={false}
      lineNumbers={false}
      remend={{ linkMode: "text-only" }}
      skipHtml
    >
      {text}
    </Streamdown>
  )
}

type ToolKind = "read" | "write" | "run" | "search" | "web" | "think" | "tool"
const TOOL_ICONS: Record<ToolKind, typeof FileText> = {
  read: FileText,
  write: Pencil,
  run: TerminalSquare,
  search: Search,
  web: Globe,
  think: Sparkle,
  tool: Wrench,
}
const TOOL_VERBS: Record<ToolKind, [done: string, active: string]> = {
  read: ["Read", "Reading"],
  write: ["Edited", "Editing"],
  run: ["Ran", "Running"],
  search: ["Searched", "Searching"],
  web: ["Fetched", "Fetching"],
  think: ["Delegated", "Delegating"],
  tool: ["Used", "Using"],
}

function parseArgs(args: unknown): Record<string, unknown> | null {
  if (typeof args === "string") {
    try {
      const parsed: unknown = JSON.parse(args)
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  return args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : null
}

function firstLine(value: string) {
  const line = value.split("\n").find((entry) => entry.trim())?.trim() ?? ""
  return line.length > 120 ? `${line.slice(0, 117)}…` : line
}

function pick(args: Record<string, unknown> | null, ...keys: string[]) {
  for (const key of keys) {
    const value = args?.[key]
    if (typeof value === "string" && value.trim()) return firstLine(value)
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      // Codex shells arrive as ["bash", "-lc", "<script>"].
      const parts = value as string[]
      return firstLine(parts.length === 3 && /^-l?c$/.test(parts[1]) ? parts[2] : parts.join(" "))
    }
  }
  return ""
}

/** Maps Pi, Claude and Codex tool names onto one vocabulary of row labels. */
export function describeTool(name: string, rawArgs: unknown): { kind: ToolKind; target: string; label?: string } {
  const args = parseArgs(rawArgs)
  const lower = name.toLowerCase().replace(/^mcp__.*__/, "")
  const path = pick(args, "file_path", "path", "filePath", "notebook_path", "file")
  if (/^(read|read_file|view|cat|notebookread)$/.test(lower)) return { kind: "read", target: path }
  if (/^(write|create_file)$/.test(lower)) return { kind: "write", target: path, label: "Wrote" }
  if (/^(edit|multiedit|str_replace_editor|str_replace_based_edit_tool|notebookedit)$/.test(lower)) return { kind: "write", target: path }
  if (lower === "apply_patch") {
    const patch = typeof rawArgs === "string" ? rawArgs : pick(args, "input", "patch")
    const file = /\*\*\* (?:Update|Add|Delete) File: (.+)/.exec(String(args?.input ?? patch))?.[1]
    return { kind: "write", target: file?.trim() || "patch", label: "Patched" }
  }
  if (/^(bash|shell|local_shell|exec_command|run|terminal|run_command)$/.test(lower))
    return { kind: "run", target: pick(args, "command", "cmd", "script") }
  if (/^(grep|glob|search|ripgrep|find|ls|list|list_dir|codebase_search)$/.test(lower) || lower.includes("search") && !lower.includes("web"))
    return { kind: "search", target: pick(args, "pattern", "query", "q", "path") }
  if (/^(webfetch|web_fetch|fetch|websearch|web_search)$/.test(lower))
    return { kind: "web", target: pick(args, "url", "query"), label: lower.includes("search") ? "Searched the web" : undefined }
  if (/^(task|agent|subagent)$/.test(lower)) return { kind: "think", target: pick(args, "description", "prompt") }
  if (/^(todowrite|update_plan|todo)$/.test(lower)) return { kind: "tool", target: "", label: "Updated the plan" }
  const firstString = args ? Object.values(args).find((value) => typeof value === "string" && value.trim()) : undefined
  return { kind: "tool", target: typeof firstString === "string" ? firstLine(firstString) : "", label: name.replaceAll("_", " ") }
}

function formatArgs(args: unknown) {
  if (args == null || args === "") return ""
  const parsed = parseArgs(args)
  if (parsed) return Object.keys(parsed).length ? JSON.stringify(parsed, null, 2) : ""
  return typeof args === "string" ? args : JSON.stringify(args, null, 2)
}

const VISIBLE_TOOLS = 6

function ToolGroup({ tools }: { tools: ChatToolCall[] }) {
  const [showAll, setShowAll] = useState(false)
  const hidden = showAll ? 0 : Math.max(0, tools.length - VISIBLE_TOOLS)
  return (
    <div className={styles.tools}>
      {hidden ? (
        <button type="button" className={styles.moreTools} onClick={() => setShowAll(true)}>
          <ChevronUp size={12} />
          {hidden} earlier tool {hidden === 1 ? "call" : "calls"}
        </button>
      ) : null}
      <ul className={styles.toolList}>
        {tools.slice(hidden).map((tool, index) => (
          <ToolRow key={tool.id ?? index + hidden} tool={tool} />
        ))}
      </ul>
    </div>
  )
}

function ToolRow({ tool }: { tool: ChatToolCall }) {
  const [open, setOpen] = useState(false)
  const { kind, target, label } = describeTool(tool.name, tool.args)
  const running = tool.status === "running"
  const failed = tool.isError === true
  const Icon = TOOL_ICONS[kind]
  const input = formatArgs(tool.args)
  const verb = label ?? TOOL_VERBS[kind][running ? 1 : 0]
  return (
    <li className={styles.toolRow} data-state={failed ? "error" : running ? "running" : "done"}>
      <button type="button" className={styles.toolHead} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className={styles.toolIcon}>
          <Icon className={styles.glyph} />
          <ChevronRight className={styles.chevron} />
        </span>
        <span className={styles.toolVerb}>{verb}</span>
        {target ? <code className={styles.toolTarget} title={target}>{target}</code> : null}
        <span className={styles.toolStatus}>
          {running ? <Spinner className="size-3" /> : failed ? "Failed" : null}
        </span>
      </button>
      {open ? (
        <div className={styles.detail}>
          {input ? <><span className={styles.detailLabel}>Input</span><pre tabIndex={0}>{input}</pre></> : null}
          {tool.result ? <><span className={styles.detailLabel}>Output</span><pre tabIndex={0}>{tool.result}</pre></> : null}
          {!input && !tool.result ? <p className={styles.note}>{running ? "Still running." : "No details recorded."}</p> : null}
          {tool.truncated ? <p className={styles.note}>Output truncated.</p> : null}
          {tool.media}
        </div>
      ) : null}
    </li>
  )
}

function ThinkingRow({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={styles.toolRow} data-state="done">
      <button type="button" className={styles.toolHead} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className={styles.toolIcon}>
          <Sparkle className={styles.glyph} />
          <ChevronRight className={styles.chevron} />
        </span>
        <span className={styles.toolVerb}>Thought</span>
        <span className={styles.thinkingPreview}>{firstLine(text)}</span>
      </button>
      {open ? <div className={`${styles.detail} ${styles.thinking}`}><ChatMarkdown text={text} /></div> : null}
    </div>
  )
}

/** Renders transcript images in a message or tool output. */
type TranscriptImage = { mimeType: string; data?: string; src?: string }
export function ChatImages<Image extends TranscriptImage>({ images, render }: { images?: Image[]; render?: (image: Image, index: number) => ReactNode }) {
  const safe = images?.filter((image) => /^image\/(png|jpeg|gif|webp)$/.test(image.mimeType)) ?? []
  if (!safe.length) return null
  return (
    <LightboxZone className={styles.images} title="Attachment">
      {safe.map((image, index) =>
        render ? render(image, index) : <img key={index} alt="Attachment" src={image.src || `data:${image.mimeType};base64,${image.data}`} />
      )}
    </LightboxZone>
  )
}
