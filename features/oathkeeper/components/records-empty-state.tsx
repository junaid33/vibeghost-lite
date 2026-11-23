import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Decorative record preview fades into the surface, like the supplied reference. */
export function RecordsEmptyState({title,description,children,className,surface = 'panel',graphic = 'records'}:{title:string;description?:string;children?:ReactNode;className?:string;surface?:'panel'|'plain';graphic?:'records'|'unavailable'|'loading'}) {
  return <div data-records-empty data-surface={surface} aria-busy={graphic === 'loading' || undefined} className={cn('flex min-h-72 min-w-0 flex-1 flex-col items-center justify-center px-5 py-12 text-center font-sans',surface === 'panel' && 'rounded-[18px] bg-gradient-to-b from-[#191c1e] to-[#222628] ring-1 ring-white/[.07] shadow-[inset_0_1px_0_rgb(255_255_255/.05),0_6px_16px_rgb(0_0_0/.15)]',className)}>
    <div data-empty-graphic={graphic} aria-hidden="true" className={cn('mb-5 max-w-full select-none overflow-hidden rounded-[14px] bg-[#151819] p-4 shadow-[inset_0_1px_0_rgb(255_255_255/.06),0_0_0_1px_rgb(255_255_255/.025)] [mask-image:linear-gradient(black_25%,transparent)]',surface === 'plain' ? 'h-20 w-40 sm:h-28 sm:w-52' : 'h-28 w-52', graphic === 'loading' && 'motion-safe:animate-pulse')}>
      {graphic === 'unavailable' ? <><div className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#a99b86]/60"/><span className="h-1.5 w-10 rounded-full bg-white/[.08]"/></div><svg viewBox="0 0 140 42" className="mt-3 h-9 w-full" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 22h43m48 0h43" stroke="#59605d" strokeDasharray="4 5"/><path d="m63 12 14 20m0-20L63 32" stroke="#a99b86"/></svg></> : <><div className="flex items-center gap-3"><span className="size-3.5 rounded-full bg-[#3c6485]/60 shadow-[0_0_12px_rgb(73_125_180/.15)]"/><span className="h-2.5 flex-1 rounded-full bg-gradient-to-r from-white/[.025] via-white/[.12] to-white/[.025]"/></div><div className="mt-4 flex items-center gap-3"><span className="h-2.5 flex-1 rounded-full bg-white/[.08]"/><span className="h-2.5 w-12 rounded-full bg-white/[.06]"/><span className="size-3 rounded-full bg-[#28694f]/60"/></div></>}</div>
    <h2 className="text-[17px] font-medium leading-6 tracking-[-.015em] text-[#e4e8e5]">{title}</h2>
    {description ? <p className="mt-2 max-w-sm text-[13px] leading-6 text-[#919793]">{description}</p> : null}
    {children?<div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div>:null}
  </div>;
}
