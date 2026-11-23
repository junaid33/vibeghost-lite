"use client";

import { useId } from 'react';
import { Spinner } from "@/components/ui/spinner";
import { RefreshCw } from '@/components/icons/duo';
import { cn } from '@/lib/utils';

/** A failed metadata check is not proof that the terminal is disconnected, so a
 *  failure only turns the control red; tapping it always refreshes directly. The
 *  reason stays available as the tooltip and to screen readers. */
export function WorkspaceRefreshControl({ label, error = '', refreshing = false, disabled = false, onRefresh, className }: {
  label: string; error?: string; refreshing?: boolean; disabled?: boolean; onRefresh: () => void; className?: string;
}) {
  const descriptionId = useId();
  const checking = refreshing && !disabled;
  const failure = disabled ? '' : error;
  return <>
    <button type="button" disabled={disabled} aria-label={label} aria-busy={checking} aria-describedby={failure || checking ? descriptionId : undefined}
      title={failure ? `Last refresh failed: ${failure} Tap to retry.` : checking ? 'Refreshing…' : label}
      data-refresh-failed={failure ? '' : undefined}
      className={cn(className, 'disabled:cursor-default disabled:opacity-40', failure && '!bg-[#2a1719] !text-[#e89a94] shadow-[0_0_0_1px_rgb(230_123_115/.28)]')}
      onClick={() => { if (!disabled && !checking) onRefresh(); }}>
      {checking ? <Spinner className="size-3.5"/> : <RefreshCw aria-hidden="true" className="size-3.5"/>}
    </button>
    <span id={descriptionId} role="status" className="sr-only">{failure ? `Last refresh failed. ${failure}` : checking ? 'Refreshing workspace details' : ''}</span>
  </>;
}
