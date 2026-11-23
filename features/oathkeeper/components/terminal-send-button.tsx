"use client";
import * as Glyph from "@/components/icons/duo";

import { cn } from '@/lib/utils';
import { HoldSendRing, useHoldSend } from "../hooks/use-hold-send";
import { promptToolbarControlClass } from "./dual-sidebar/prompt-control-popover";

export function TerminalSendButton({ disabled, pi, onSend, className, followUpLabel = 'Pi follow-up (Alt+Enter)' }: { disabled: boolean; pi: boolean; onSend: (followUp: boolean) => void; className?: string; followUpLabel?: string }) {
  const { holding, filled, props } = useHoldSend({ disabled, followUp: pi, onSend });
  return <button type="button" disabled={disabled} aria-label="Send terminal command" title={pi ? `Send · hold 0.8 seconds for a ${followUpLabel}` : "Send"} className={cn(promptToolbarControlClass, '!size-[40px] justify-center [--oathkeeper-control:#112945] [--oathkeeper-control-ink:#9dc4ff] text-[#9dc4ff] hover:[--oathkeeper-control:#17355a] touch-none select-none [-webkit-user-select:none]', className)} style={{ WebkitTouchCallout: 'none', touchAction: 'none' }} {...props}
  >{holding ? <HoldSendRing filled={filled} className="size-5 -rotate-90"/> : <Glyph.ArrowUp className="size-4" aria-hidden="true" />}</button>;
}
