"use client";
import { MessageSquareText, TerminalSquare } from "@/components/icons/duo";
import type { SessionView } from "../lib/session-integrations";
export function SessionViewToggle({ secondaryView, view, providerName = 'Agent', onChange, className }: { secondaryView?: 'chat'; view: SessionView; providerName?: string; onChange: (view: SessionView) => void; className?: string }) {
  if (!secondaryView) return null;
  const secondary = view === secondaryView;
  const label = secondary ? 'Show terminal' : `Show ${providerName} chat`;
  return <button type="button" aria-label={label} title={label} aria-pressed={secondary} onClick={() => onChange(secondary ? 'terminal' : secondaryView)} className={className}>
    {secondary ? <TerminalSquare className="size-3.5"/> : <MessageSquareText className="size-3.5"/>}
  </button>;
}
