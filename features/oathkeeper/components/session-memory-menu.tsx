"use client";

import { Chip } from "@/components/icons/duo";
import { Kbd } from "@/components/ui/kbd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sessionIntegration, type IntegrationSession } from "../lib/session-integrations";

const PI_MEMORY_ACTIONS = [
  ["Memory on", "/workspace memory on", "Load a frozen Workspace Memory snapshot"],
  ["Memory off", "/workspace memory off", "Stop injecting memory into future prompts"],
  ["Refresh memory", "/workspace memory refresh", "Replace this session’s frozen snapshot"],
  ["Memory status", "/workspace memory status", "Show binding, profile, and entry status"],
] as const;

export type PiMemoryCommand = typeof PI_MEMORY_ACTIONS[number][1];

/** Pi controls from the native VibeGhost toolbar, using the shared input transport. */
export function SessionMemoryMenu({ session, disabled = false, pending = false, onCommand }: {
  session: IntegrationSession;
  disabled?: boolean;
  pending?: boolean;
  onCommand: (command: PiMemoryCommand) => void;
}) {
  if (sessionIntegration(session).provider?.id !== "pi") return null;
  const unavailable = disabled || pending || session.status !== "running";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Pi Workspace Memory"
          title="Workspace Memory"
          aria-busy={pending || undefined}
          disabled={unavailable}
          className="oathkeeper-raised-control flex size-9 shrink-0 items-center justify-center text-[#949a96] data-[state=open]:text-[#d7dbd8] disabled:opacity-40"
        >
          <Chip className="size-3.5" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={7} className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-[min(22rem,calc(100vw-1rem))] rounded-xl bg-[var(--oathkeeper-panel)] p-1 font-sans text-[#f4f7f5] ring-1 ring-white/10">
        <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[9px] font-semibold uppercase tracking-[.12em] text-[#777e79]">
          Workspace Memory
        </DropdownMenuLabel>
        <p className="px-2 pb-2 text-[10px] leading-4 text-[#919793]">
          Turning memory on captures a frozen snapshot for this Pi session. Commands and results appear in the terminal.
        </p>
        <DropdownMenuSeparator className="bg-white/[.08]" />
        {PI_MEMORY_ACTIONS.map(([label, command, description]) => (
          <DropdownMenuItem
            key={command}
            disabled={unavailable}
            className="group min-h-11 rounded-lg px-2 text-[11px] focus:bg-white/10 focus:text-white"
            onSelect={() => onCommand(command)}
            textValue={`${label} ${command}`}
          >
            <span className="min-w-0 py-1">
              <span className="block leading-4 text-[#e2e6e3]">{label}</span>
              <span className="mt-0.5 block text-[9px] leading-3 text-[#777e79]">{description}</span>
            </span>
            <Kbd className="ml-auto max-w-[12rem] truncate">{command}</Kbd>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
