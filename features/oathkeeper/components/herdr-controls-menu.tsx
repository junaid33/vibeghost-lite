"use client"

import { useState } from "react"
import { Kbd } from '@/components/ui/kbd'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { HERDR_CONTROL_GROUPS, encodeHerdrControl } from "../lib/session-integrations/herdr-controls"

export function HerdrControlsMenu({ disabled, onSendInput }: {
  disabled: boolean
  onSendInput: (text: string) => void
}) {
  const [group, setGroup] = useState(0)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={disabled} aria-label="Herdr commands" className="oathkeeper-raised-control flex h-8 shrink-0 items-center gap-2 px-2.5 font-sans text-[10px] font-medium tracking-[0.1em] uppercase">
          Herdr <span className="opacity-50">Ctrl+B</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl bg-[var(--oathkeeper-panel)] p-1 font-sans text-[#f4f7f5] ring-1 ring-white/10">
        <div className="px-2 py-1.5 text-[10px] leading-relaxed text-[#949a96]">
          Default Herdr bindings. Custom keymaps may differ. Tab numbers are shortcuts, not a discovered tab list.
        </div>
        {HERDR_CONTROL_GROUPS.map((item, index) => (
          <DropdownMenuItem key={item.label} onSelect={event => { event.preventDefault(); setGroup(index) }} className="min-h-8 rounded-lg px-2 text-[11px] focus:bg-white/10 focus:text-white">
            <span className="flex-1">{item.label}</span>{group === index ? <span aria-label="Selected category">✓</span> : null}
          </DropdownMenuItem>
        ))}
        <div className="my-1 border-t border-white/10" />
        <div className="max-h-[40vh] overflow-y-auto">
          {HERDR_CONTROL_GROUPS[group].actions.map(action => (
            <DropdownMenuItem key={action.key} disabled={disabled} onSelect={() => onSendInput(encodeHerdrControl(action.key))} className="min-h-9 gap-3 rounded-lg px-2 text-[11px] focus:bg-white/10 focus:text-white">
              <span className="flex-1">{action.label}</span>
              <Kbd>^B {action.key}</Kbd>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
