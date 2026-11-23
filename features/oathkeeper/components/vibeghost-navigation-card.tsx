'use client';

import type { MouseEvent, ReactNode } from 'react';
import { ChevronRight } from '@/components/icons/duo';
import { cn } from '@/lib/utils';
import { isModifiedClick } from '@/lib/modified-click';
import dockStyles from './dock-surface.module.css';

/** Shared landing/workspace card: fixed icon well, flexible label, trailing arrow. */
export function VibeGhostNavigationCard({ title, description, icon, disabled = false, selected = false, exited = false, ariaLabel, href, onClick, trailingAction }: {
  title: string;
  description: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  selected?: boolean;
  exited?: boolean;
  ariaLabel?: string;
  /** With a path, the card is a link: plain clicks run onClick in place, Cmd/middle clicks open a new tab. */
  href?: string;
  onClick?: () => void;
  trailingAction?: ReactNode;
}) {
  const follow = (event: MouseEvent<HTMLAnchorElement>) => { if (isModifiedClick(event)) return; event.preventDefault(); if (!disabled) onClick?.(); };
  const content = <>
    {icon ? <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-white/[.05] text-[#b7c7bd] shadow-[inset_0_1px_0_rgb(255_255_255/.06)]">{icon}</span> : null}
    <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium text-[#f4f7f5]" title={title}>{title}</span>{description}</span>
    <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-[#65756b]"/>
  </>;
  const className = cn(dockStyles.surface, dockStyles.compactSurface, 'block w-full min-w-0 overflow-hidden rounded-[10px] p-[2px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bb8ff]', disabled && 'pointer-events-none opacity-45 grayscale');
  const innerClass = cn('flex min-h-14 min-w-0 items-center rounded-[8px] shadow-[inset_0_1px_0_rgb(244_247_245/.07),0_2px_4px_rgb(0_0_0/.2)]', trailingAction ? 'gap-0' : 'gap-3 px-3 py-2', exited ? (selected ? 'bg-[#382326]' : 'bg-[#251a1c]') : selected ? 'bg-[#25272a]' : 'bg-[#141617]', !disabled && (exited ? 'transition-colors hover:bg-[#302023]' : 'transition-colors hover:bg-[#191b1c]'));
  if (trailingAction && onClick) return <div data-navigation-card className={className}><div className={innerClass}>
    {href && !disabled ? <a href={href} aria-label={ariaLabel || `Open ${title}`} aria-current={selected ? 'true' : undefined} data-selected={selected} onClick={follow} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-[8px] px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8bb8ff]">{content}</a> : <button type="button" disabled={disabled} aria-label={ariaLabel || `Open ${title}`} aria-current={selected ? 'true' : undefined} data-selected={selected} onClick={onClick} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-[8px] px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8bb8ff]">{content}</button>}
    <div className="mr-2 flex shrink-0 items-center">{trailingAction}</div>
  </div></div>;
  if (href && onClick && !disabled) return <a href={href} aria-label={ariaLabel || `Open ${title}`} aria-current={selected ? 'true' : undefined} data-selected={selected} onClick={follow} className={className}><span className={innerClass}>{content}</span></a>;
  return onClick ? <button type="button" disabled={disabled} aria-label={ariaLabel || `Open ${title}`} aria-current={selected ? 'true' : undefined} data-selected={selected} onClick={onClick} className={className}><span className={innerClass}>{content}</span></button> : <div aria-disabled="true" className={className}><div className={innerClass}>{content}</div></div>;
}
