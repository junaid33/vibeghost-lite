"use client";

import { memo, useState } from "react";
import { CheckCircle2, ChevronDown, Circle, TerminalSquare } from "@/components/icons/duo";
import { Spinner } from "@/components/ui/spinner";

interface ToolInvocationProps {
  toolName: string;
  state: string;
  args: unknown;
  result: unknown;
  isLatestMessage: boolean;
  status: string;
}

function format(value: unknown) {
  if (typeof value === "string") {
    try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
  }
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

export const ToolInvocation = memo(function ToolInvocation({ toolName, state, args, result, isLatestMessage, status }: ToolInvocationProps) {
  const [expanded, setExpanded] = useState(false);
  const running = state === "call" && isLatestMessage && status !== "ready";

  return (
    <div className="mb-2 min-w-0">
      <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="group flex h-8 w-full min-w-0 items-center gap-1.5 rounded-control pr-2 text-left transition-colors duration-150 hover:bg-hover">
        <span className="relative flex size-3.5 shrink-0 items-center justify-center text-ink-3">
          <TerminalSquare className="size-3.5 group-hover:opacity-0" />
          <ChevronDown className={`absolute size-3 opacity-0 transition-[opacity,transform] duration-150 group-hover:opacity-100 ${expanded ? "" : "-rotate-90"}`} />
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] font-medium text-ink">{toolName}</span>
        <span className="text-[11.5px] text-ink-3">{running ? "Running…" : state === "call" ? "Waiting" : "Done"}</span>
        {running ? <Spinner className="size-3.5 text-signal-ink" /> : state === "call" ? <Circle className="size-3.5 text-ink-3" /> : <CheckCircle2 className="size-3.5 text-green" />}
      </button>
      <div className="grid transition-[grid-template-rows,opacity] duration-300" style={{ gridTemplateRows: expanded ? "1fr" : "0fr", opacity: expanded ? 1 : 0, transitionTimingFunction: "var(--ease-out)" }}>
        <div className="min-h-0 overflow-hidden">
          <div className="ml-4 mt-1 space-y-2 border-l border-line pl-3">
            {args != null ? <div><p className="mb-1 font-mono text-[10px] text-ink-3">Arguments</p><pre className="max-h-56 overflow-auto rounded-control bg-inset p-2.5 font-mono text-[11px] leading-5 text-ink-2 shadow-hairline">{format(args)}</pre></div> : null}
            {result != null ? <div><p className="mb-1 font-mono text-[10px] text-ink-3">Result</p><pre className="max-h-72 overflow-auto rounded-control bg-inset p-2.5 font-mono text-[11px] leading-5 text-ink-2 shadow-hairline">{format(result)}</pre></div> : null}
          </div>
        </div>
      </div>
    </div>
  );
});
