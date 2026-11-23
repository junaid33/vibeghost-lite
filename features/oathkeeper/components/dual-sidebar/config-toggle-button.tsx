"use client";

import { useState } from "react";
import { AlertCircle, Check, Laptop, Server } from "@/components/icons/duo";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAiConfig } from "../../hooks/use-ai-config";
import {
  PromptPopoverHeader,
  promptPopoverContentClass,
  promptToolbarControlClass,
} from "./prompt-control-popover";

interface ConfigToggleButtonProps {
  disabled?: boolean;
  globalEnvsExist?: boolean;
}

const MODES = [
  {
    id: "env" as const,
    label: "Global configuration",
    description: "Use the Oathkeeper server settings.",
    icon: Server,
  },
  {
    id: "local" as const,
    label: "Local configuration",
    description: "Use settings stored only in this browser.",
    icon: Laptop,
  },
];

export function ConfigToggleButton({
  disabled = false,
  globalEnvsExist = true,
}: ConfigToggleButtonProps) {
  const { config, setConfig } = useAiConfig();
  const [open, setOpen] = useState(false);
  const isGlobal = config.keyMode === "env";
  const showWarning = isGlobal && !globalEnvsExist;
  const TriggerIcon = isGlobal ? Server : Laptop;

  const selectMode = (keyMode: "env" | "local") => {
    setConfig({ ...config, keyMode });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`AI configuration: ${isGlobal ? "global" : "local"}`}
          title={isGlobal ? "Global configuration" : "Local configuration"}
          className={cn(promptToolbarControlClass, "w-8 justify-center sm:w-auto sm:gap-1.5 sm:px-2.5", showWarning && "text-[#f37996]")}
        >
          <TriggerIcon className="size-3.5" />
          <span className="hidden text-[12px] font-medium sm:inline">{isGlobal ? "Global" : "Local"}</span>
        </button>
      </DialogTrigger>

      <DialogContent hideClose className={promptPopoverContentClass}>
        <PromptPopoverHeader
          title="AI configuration"
          description="Choose where Oathkeeper gets model credentials for this conversation."
        />

        <div className="space-y-2 px-5 pb-5">
          {MODES.map((mode) => {
            const active = config.keyMode === mode.id;
            const ModeIcon = mode.icon;
            const unavailable = mode.id === "env" && !globalEnvsExist;

            return (
              <button
                key={mode.id}
                type="button"
                aria-pressed={active}
                onClick={() => selectMode(mode.id)}
                className={cn("flex min-h-[60px] w-full items-center gap-2.5 rounded-[12px] border border-black bg-black/35 px-3 py-2.5 text-left shadow-[inset_0_1px_0_rgb(255_255_255/.035)] transition-[background,transform] hover:bg-black/45 active:scale-[.99]", active && "bg-black/55")}
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-white/[.045] text-white/40", active && "text-white/75")}><ModeIcon className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[12.5px] text-white/80">{mode.label}{unavailable && <AlertCircle className="size-3 text-[#f37996]" />}</span>
                  <span className="mt-0.5 block truncate text-[12px] text-white/30">{unavailable ? "Server environment variables are not set." : mode.description}</span>
                </span>
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-black bg-black/35">{active && <Check className="size-3 text-white/75" />}</span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-white/[.06] px-5 py-3.5 text-[12px] leading-[1.45] text-white/30">
          {isGlobal
            ? "Global settings are managed by this Oathkeeper deployment."
            : "Local credentials stay in this browser and are only sent with model requests."}
        </div>
      </DialogContent>
    </Dialog>
  );
}
