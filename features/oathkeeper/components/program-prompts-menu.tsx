"use client"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Fragment, useCallback } from 'react'
import { Kbd } from '@/components/ui/kbd'
import styles from './program-prompts-menu.module.css'
import type { ProgramControl } from "../lib/session-integrations/program-controls"

/** Matches VibeGhost’s Memory menu: touch-sized rows and separate command badges. */
export function ProgramPromptsMenu({ label, description, controls, disabled, onSendInput, onFollowUp, followUpDisabled, followUpShortcut = "Alt+Enter" }: {
  label: string
  description: string
  controls: readonly ProgramControl[]
  disabled: boolean
  onSendInput: (text: string) => void
  onFollowUp?: () => void
  followUpDisabled?: boolean
  followUpShortcut?: string
}) {
  const scrollRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const update = () => {
      node.style.setProperty('--fade-top', node.scrollTop > 1 ? '12px' : '0px');
      node.style.setProperty('--fade-bottom', node.scrollHeight - node.clientHeight - node.scrollTop > 1 ? '12px' : '0px');
    };
    update();
    const observer = new ResizeObserver(update); observer.observe(node);
    node.addEventListener('scroll', update, { passive: true });
    return () => { observer.disconnect(); node.removeEventListener('scroll', update); };
  }, []);
  const rowClass = "group min-h-11 gap-3 rounded-lg px-2 text-[11px] focus:bg-white/10 focus:text-white"
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button type="button" disabled={disabled} aria-label={label} title={label} className="oathkeeper-raised-control flex h-8 shrink-0 items-center px-2.5 font-sans text-[10px] font-medium tracking-[.1em] uppercase disabled:opacity-40">{label}</button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" sideOffset={7} className="max-h-[min(32rem,70dvh,var(--radix-dropdown-menu-content-available-height))] w-[min(22rem,calc(100vw-1rem))] flex flex-col overflow-hidden rounded-xl bg-[var(--oathkeeper-panel)] p-1 font-sans text-[#f4f7f5] ring-1 ring-white/10">
      <DropdownMenuLabel className="px-2 pt-1.5 text-[9px] font-semibold tracking-[.12em] text-[#777e79] uppercase">{label}</DropdownMenuLabel>
      <p className="px-2 pb-2 text-[10px] leading-4 text-[#919793]">{description}</p>
      <DropdownMenuSeparator className="bg-white/[.08]" />
      <div ref={scrollRef} data-shortcut-scroll className={styles.scroll}>
      {onFollowUp ? <><DropdownMenuItem disabled={disabled || followUpDisabled} onSelect={onFollowUp} textValue="Queue follow-up" className={rowClass}>
        <span className="min-w-0 py-1"><span className="block leading-4">Queue follow-up</span><span className="mt-0.5 block text-[9px] leading-3 text-[#777e79]">Send the composer draft after current work</span></span>
        {followUpShortcut === "Alt+Enter" ? <Kbd className="ml-auto" keys={['alt', 'enter']} aria-label="Alt+Enter"/> : <Kbd className="ml-auto">{followUpShortcut}</Kbd>}
      </DropdownMenuItem><DropdownMenuSeparator /></> : null}
      {controls.map((control, index) => <Fragment key={control.label}>{index > 0 ? <DropdownMenuSeparator /> : null}<DropdownMenuItem disabled={disabled} onSelect={() => onSendInput(control.input)} textValue={control.label} className={rowClass}>
        <span className="min-w-0 py-1"><span className="block leading-4 text-[#e2e6e3]">{control.label}</span><span className="mt-0.5 block text-[9px] leading-3 text-[#777e79]">{control.description}</span></span>
        <Kbd className="ml-auto">{control.shortcut}</Kbd>
      </DropdownMenuItem></Fragment>)}
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
}
