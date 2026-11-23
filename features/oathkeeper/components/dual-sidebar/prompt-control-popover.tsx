"use client";

import { ArrowLeft, X } from "@/components/icons/duo";
import { DialogClose, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import surfaceStyles from "./prompt-surfaces.module.css";

export const promptToolbarControlClass =
  "oathkeeper-raised-control flex h-8 shrink-0 items-center disabled:pointer-events-none";

export const promptPopoverContentClass =
  "block w-[calc(100%-2rem)] max-w-[440px] overflow-hidden rounded-[22px] border border-[#1b1b1b] bg-[#111]/95 p-0 font-mono text-[13px] font-medium text-white shadow-[0_24px_70px_rgb(0_0_0/.55)] ring-0 backdrop-blur-xl";

export const promptComposerSendButtonClass =
  `${surfaceStyles.sendControl} flex size-8 shrink-0 items-center justify-center disabled:pointer-events-none`;

export const promptPopoverFieldClass =
  "h-10 rounded-[12px] border border-black bg-black/55 px-3 text-[14px] text-white/85 shadow-[inset_0_1px_3px_rgb(0_0_0/.5)] outline-none ring-0 placeholder:text-white/25 focus-visible:border-white/20 focus-visible:ring-0 focus-visible:ring-offset-0";

export const labDialogPrimaryButtonClass =
  "oathkeeper-raised-control h-[38px] disabled:cursor-not-allowed";

export function PromptPopoverHeader({
  title,
  description,
  className,
  onBack,
  actions,
}: {
  title: string;
  description: string;
  className?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-4 px-5 pb-4 pt-5", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label="Back" className="mt-0.5 flex size-8 max-sm:size-9 shrink-0 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/[.05] hover:text-white/85 active:translate-y-px">
            <ArrowLeft className="size-4" />
          </button>
        ) : null}
        <div className="min-w-0">
        <DialogTitle className="font-sans text-[19px] font-normal tracking-[-.025em] text-white/90">{title}</DialogTitle>
        <DialogDescription className="mt-1 text-[12px] leading-[1.45] text-white/40">{description}</DialogDescription>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {actions}
        <DialogClose
          aria-label={`Close ${title}`}
          className="oathkeeper-raised-control -mt-0.5 flex size-[32px] max-sm:size-9 shrink-0 items-center justify-center"
        >
          <X className="size-4" />
        </DialogClose>
      </div>
    </header>
  );
}

export function PromptPopoverSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[14px] bg-black/40 p-3.5 shadow-[inset_0_1px_3px_rgb(0_0_0/.45),0_1px_0_rgb(255_255_255/.06)] ring-1 ring-white/[.07]",
        className
      )}
    >
      {children}
    </div>
  );
}
