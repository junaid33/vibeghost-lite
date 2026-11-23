"use client";

/* MCP server list, rebuilt from TuffUI `mcp-servers` (https://tuffui.com, MIT, Copyright (c) 2026 TUFFUI contributors).
 * Icons are Phosphor (MIT, Copyright (c) 2023 Phosphor Icons), inlined. See THIRD_PARTY_NOTICES.md.
 * Structure, spacing and states follow the TuffUI source; colours use Oathkeeper's dark lab palette.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";

export type McpPanelStatus = "connected" | "connecting" | "needs-auth" | "error" | "off";

export type McpPanelRow = {
  id: string;
  name: string;
  transport: string;
  status: McpPanelStatus;
  enabled: boolean;
  error?: string;
  tools: string[];
  toolsKnown: boolean;
  switchLabel: string;
  switchDisabled?: boolean;
  onToggle: (enabled: boolean) => void;
  onSettings: () => void;
  settingsLabel: string;
  onAuthorize?: () => void;
  onReconnect?: () => void;
};

type IconProps = { className?: string };
const svg = (paths: string) => function PhosphorIcon({ className }: IconProps) {
  return <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: paths }} />;
};
const CaretDown = svg('<path d="M216.49,104.49l-80,80a12,12,0,0,1-17,0l-80-80a12,12,0,0,1,17-17L128,159l71.51-71.52a12,12,0,0,1,17,17Z"/>');
const CheckCircle = svg('<path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z"/>');
const Key = svg('<path d="M216.57,39.43A80,80,0,0,0,83.91,120.78L28.69,176A15.86,15.86,0,0,0,24,187.31V216a16,16,0,0,0,16,16H72a8,8,0,0,0,8-8V208H96a8,8,0,0,0,8-8V184h16a8,8,0,0,0,5.66-2.34l9.56-9.57A79.73,79.73,0,0,0,160,176h.1A80,80,0,0,0,216.57,39.43ZM180,92a16,16,0,1,1,16-16A16,16,0,0,1,180,92Z"/>');
const WarningCircle = svg('<path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-8,56a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm8,104a12,12,0,1,1,12-12A12,12,0,0,1,128,184Z"/>');
const CircleNotch = svg('<path d="M236,128a108,108,0,0,1-216,0c0-42.52,24.73-81.34,63-98.9A12,12,0,1,1,93,50.91C63.24,64.57,44,94.83,44,128a84,84,0,0,0,168,0c0-33.17-19.24-63.43-49-77.09A12,12,0,1,1,173,29.1C211.27,46.66,236,85.48,236,128Z"/>');
const ArrowClockwise = svg('<path d="M244,56v48a12,12,0,0,1-12,12H184a12,12,0,1,1,0-24H201.1l-19-17.38c-.13-.12-.26-.24-.38-.37A76,76,0,1,0,127,204h1a75.53,75.53,0,0,0,52.15-20.72,12,12,0,0,1,16.49,17.45A99.45,99.45,0,0,1,128,228h-1.37A100,100,0,1,1,198.51,57.06L220,76.72V56a12,12,0,0,1,24,0Z"/>');
const GearSix = svg('<path d="M128,76a52,52,0,1,0,52,52A52.06,52.06,0,0,0,128,76Zm0,80a28,28,0,1,1,28-28A28,28,0,0,1,128,156Zm113.86-49.57A12,12,0,0,0,236,98.34L208.21,82.49l-.11-31.31a12,12,0,0,0-4.25-9.12,116,116,0,0,0-38-21.41,12,12,0,0,0-9.68.89L128,37.27,99.83,21.53a12,12,0,0,0-9.7-.9,116.06,116.06,0,0,0-38,21.47,12,12,0,0,0-4.24,9.1l-.14,31.34L20,98.35a12,12,0,0,0-5.85,8.11,110.7,110.7,0,0,0,0,43.11A12,12,0,0,0,20,157.66l27.82,15.85.11,31.31a12,12,0,0,0,4.25,9.12,116,116,0,0,0,38,21.41,12,12,0,0,0,9.68-.89L128,218.73l28.14,15.74a12,12,0,0,0,9.7.9,116.06,116.06,0,0,0,38-21.47,12,12,0,0,0,4.24-9.1l.14-31.34,27.81-15.81a12,12,0,0,0,5.85-8.11A110.7,110.7,0,0,0,241.86,106.43Zm-22.63,33.18-26.88,15.28a11.94,11.94,0,0,0-4.55,4.59c-.54,1-1.11,1.93-1.7,2.88a12,12,0,0,0-1.83,6.31L184.13,199a91.83,91.83,0,0,1-21.07,11.87l-27.15-15.19a12,12,0,0,0-5.86-1.53h-.29c-1.14,0-2.3,0-3.44,0a12.08,12.08,0,0,0-6.14,1.51L93,210.82A92.27,92.27,0,0,1,71.88,199l-.11-30.24a12,12,0,0,0-1.83-6.32c-.58-.94-1.16-1.91-1.7-2.88A11.92,11.92,0,0,0,63.7,155L36.8,139.63a86.53,86.53,0,0,1,0-23.24l26.88-15.28a12,12,0,0,0,4.55-4.58c.54-1,1.11-1.94,1.7-2.89a12,12,0,0,0,1.83-6.31L71.87,57A91.83,91.83,0,0,1,92.94,45.17l27.15,15.19a11.92,11.92,0,0,0,6.15,1.52c1.14,0,2.3,0,3.44,0a12.08,12.08,0,0,0,6.14-1.51L163,45.18A92.27,92.27,0,0,1,184.12,57l.11,30.24a12,12,0,0,0,1.83,6.32c.58.94,1.16,1.91,1.7,2.88A11.92,11.92,0,0,0,192.3,101l26.9,15.33A86.53,86.53,0,0,1,219.23,139.61Z"/>');
const HardDrives = svg('<path d="M208,40H48A16,16,0,0,0,32,56v48a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V56A16,16,0,0,0,208,40ZM180,92a12,12,0,1,1,12-12A12,12,0,0,1,180,92Z"/><path d="M208,136H48a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V152A16,16,0,0,0,208,136Zm-28,52a12,12,0,1,1,12-12A12,12,0,0,1,180,188Z"/>');

const statuses: Record<McpPanelStatus, { label: string; Icon: (p: IconProps) => React.ReactElement; className: string }> = {
  connected: { label: "Connected", Icon: CheckCircle, className: "text-[#30d158]" },
  connecting: { label: "Connecting", Icon: CircleNotch, className: "text-white/50" },
  "needs-auth": { label: "Needs auth", Icon: Key, className: "text-[#ff9f0a]" },
  error: { label: "Error", Icon: WarningCircle, className: "text-[#ff453a]" },
  off: { label: "Off", Icon: CheckCircle, className: "text-white/40" },
};

function StatusTag({ status }: { status: McpPanelStatus }) {
  const { label, Icon, className } = statuses[status];
  return (
    <span className={cn("flex items-center gap-1 text-xs", className)}>
      {status === "off" ? <span className="mx-[5px] size-1.5 rounded-full bg-current opacity-60" aria-hidden="true" /> : <Icon className={cn("size-3.5", status === "connecting" && "animate-spin motion-reduce:animate-none")} />}
      {label}
    </span>
  );
}

/* TuffUI Switch: 48x28 track, "|" when on, "o" when off. */
function Switch({ checked, disabled, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group relative h-7 w-12 shrink-0 rounded-full shadow-[inset_0_1px_2px_rgb(0_0_0/.35)] transition-colors duration-200 disabled:opacity-40 max-sm:before:absolute max-sm:before:-inset-x-1 max-sm:before:-inset-y-2 max-sm:before:content-['']",
        checked ? "bg-[#30d158]" : "bg-white/[0.12]",
      )}
    >
      <span aria-hidden="true" className={cn("absolute left-[11px] top-1/2 h-2.5 w-[2px] -translate-y-1/2 rounded-full bg-white/80 transition-opacity duration-150", !checked && "opacity-0")} />
      <svg aria-hidden="true" viewBox="0 0 10 10" className={cn("absolute right-[8px] top-1/2 size-2.5 -translate-y-1/2 text-white/40 transition-opacity duration-150", checked && "opacity-0")}>
        <circle cx="5" cy="5" r="3.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span aria-hidden="true" className={cn("absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/.4)] transition-transform duration-200 ease-out", checked && "translate-x-5")} />
    </button>
  );
}

const actionClass = "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-[background,transform] active:scale-[.97] max-sm:h-9";

function action(row: McpPanelRow) {
  if (row.status === "needs-auth" && row.onAuthorize) return <button type="button" onClick={row.onAuthorize} className={cn(actionClass, "bg-white text-black hover:bg-white/90")}>Authorize</button>;
  if (row.status === "error" && row.onReconnect) return <button type="button" onClick={row.onReconnect} className={cn(actionClass, "bg-white/[0.08] text-white/85 hover:bg-white/[0.12]")}><ArrowClockwise className="size-3.5" />Reconnect</button>;
  return null;
}

export function McpServersPanel({ rows, onAddExternal }: { rows: McpPanelRow[]; onAddExternal: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const connected = rows.filter((row) => row.status === "connected").length;
  return (
    <section aria-label="MCP servers" className="@container w-full rounded-[1.375rem] bg-[#17191b] p-1.5">
      <header className="flex items-center gap-3 px-2.5 py-2.5">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/55"><HardDrives className="size-4" /></span>
        <h2 className="min-w-0 flex-1 truncate font-sans text-sm font-medium text-white/90">MCP servers</h2>
        <span className="shrink-0 text-[0.8125rem] tabular-nums text-white/50">{connected} of {rows.length} connected</span>
      </header>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const expanded = open === row.id;
          const panelId = `mcp-tools-${row.id}`;
          const hasTools = row.tools.length > 0;
          return (
            <li key={row.id} className="rounded-2xl bg-black/35">
              <div className="flex items-center gap-2 py-2.5 pl-3.5 pr-2.5">
                <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpen(expanded ? null : row.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left max-sm:min-h-9">
                  <CaretDown className={cn("size-4 shrink-0 text-white/45 transition-transform duration-200 motion-reduce:transition-none", !expanded && "-rotate-90")} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-sans text-sm font-medium text-white/90">{row.name}</span>
                      <span className="shrink-0 font-mono text-xs text-white/40">{row.transport}</span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-white/50">
                      <StatusTag status={row.status} />
                      {row.status === "connected" || hasTools ? <><span aria-hidden="true">·</span><span className="tabular-nums">{row.toolsKnown ? `${row.tools.length} ${row.tools.length === 1 ? "tool" : "tools"}` : "—"}</span></> : null}
                    </span>
                  </span>
                </button>
                <span className="max-sm:hidden sm:contents">{action(row)}</span>
                <button type="button" onClick={row.onSettings} aria-label={row.settingsLabel} className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/40 transition-[background,color,transform] hover:bg-white/[0.06] hover:text-white/80 active:scale-[.95] max-sm:size-9"><GearSix className="size-4" /></button>
                <Switch checked={row.enabled} disabled={row.switchDisabled} label={row.switchLabel} onChange={row.onToggle} />
              </div>
              {action(row) ? <div className="mx-3.5 mb-2.5 pl-7 sm:hidden">{action(row)}</div> : null}
              {row.status === "error" && row.error ? <p className="mx-3.5 mb-3 block break-words rounded-xl bg-[#ff453a]/10 px-3 py-2 font-mono text-xs text-[#ff6961]">{row.error}</p> : null}
              {expanded ? (
                <div id={panelId} className="mx-1.5 mb-1.5 rounded-xl bg-white/[0.04] p-1">
                  {hasTools ? (
                    <ul className="max-h-60 overflow-y-auto overscroll-contain">
                      {row.tools.map((tool) => <li key={tool} className="truncate px-3 py-2 font-mono text-[0.8125rem] text-white/80">{tool}</li>)}
                    </ul>
                  ) : <p className="px-3 py-2 text-xs text-white/50">{row.status === "connecting" ? "Checking tools…" : row.enabled ? "No tool list yet" : "Turn the server on to list its tools"}</p>}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={onAddExternal} className="mt-1.5 flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.06] text-xs font-medium text-white/65 transition-[background,color,transform] hover:bg-white/[0.09] hover:text-white/90 active:scale-[.99]">Add external MCP</button>
    </section>
  );
}
