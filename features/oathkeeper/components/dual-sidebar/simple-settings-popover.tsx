"use client";

import { Settings } from "@/components/icons/duo";
import { useState, useEffect, type ReactElement } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAiConfig } from "../../hooks/use-ai-config";
import {
  PromptPopoverHeader,
  labDialogPrimaryButtonClass,
  promptPopoverContentClass,
  promptPopoverFieldClass,
  promptToolbarControlClass,
} from "./prompt-control-popover";

interface SimpleSettingsPopoverProps {
  disabled?: boolean;
  trigger?: ReactElement | false;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const PROVIDERS = [
  { value: "openrouter", label: "OpenRouter" },
  { value: "custom", label: "Custom OpenAI" },
];

export function SimpleSettingsPopover({ disabled = false, trigger, open: controlledOpen, onOpenChange }: SimpleSettingsPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const { config, setConfig } = useAiConfig();
  const [provider, setProvider] = useState<"openrouter" | "custom">("openrouter");
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [maxTokens, setMaxTokens] = useState("4000");

  // Check if we should show warning (local mode but no API key)
  const isLocalMode = config.keyMode === "local";
  const hasApiKey = !!(config.localKeys?.apiKey);
  const showWarning = isLocalMode && !hasApiKey;

  // Sync with current config when popover opens
  useEffect(() => {
    if (open) {
      const currentProvider = config.localKeys?.provider as "openrouter" | "custom" | undefined;
      setProvider(currentProvider || "openrouter");
      setCustomEndpoint(config.localKeys?.customEndpoint || "");
      setApiKey(config.localKeys?.apiKey || "");
      setMaxTokens(config.localKeys?.maxTokens || "4000");
    }
  }, [open, config]);

  const handleSave = () => {
    const finalApiKey = apiKey || config.localKeys?.apiKey || "";
    setConfig({
      ...config,
      localKeys: {
        provider,
        customEndpoint,
        apiKey: finalApiKey,
        model: config.localKeys?.model || "openai/gpt-4o-mini",
        modelKind: config.localKeys?.provider === provider && (provider !== 'custom' || config.localKeys?.customEndpoint === customEndpoint) ? config.localKeys?.modelKind : undefined,
        maxTokens,
      },
    });
    setOpen(false);
  };

  const button = trigger === false ? null : trigger ?? (
    <button
      type="button"
      aria-label="AI settings"
      disabled={disabled}
      className={`${promptToolbarControlClass} size-8 justify-center ${showWarning ? "text-[#f37996]" : ""}`}
    >
      <Settings className="size-3.5" />
    </button>
  );

  if (disabled && button) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              {button}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Switch to local configuration to bring your own key</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {button ? <DialogTrigger asChild>
        {button}
      </DialogTrigger> : null}
      <DialogContent
        hideClose
        className={`flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col ${promptPopoverContentClass}`}
      >
        <PromptPopoverHeader
          title="Model settings"
          description="Configure the provider and credentials used by local mode."
        />

        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-5 pb-5 [-webkit-overflow-scrolling:touch]">
          <div className="space-y-5">
            <div>
              <Label htmlFor="provider" className="text-[12px] text-white/75">Provider</Label>
              <Select value={provider} onValueChange={(value: "openrouter" | "custom") => setProvider(value)}>
                <SelectTrigger id="provider" className="mt-2 h-10 rounded-[11px] border border-black bg-black/45 text-[13px] text-white/80 shadow-[inset_0_1px_3px_rgb(0_0_0/.45)] ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="mt-2 text-[10.5px] leading-[1.45] text-white/30">Choose OpenRouter or an OpenAI-compatible endpoint.</p>
            </div>

            {provider === "custom" && (
              <div>
                <Label htmlFor="custom-endpoint" className="text-[12px] text-white/75">Endpoint</Label>
                <Input id="custom-endpoint" placeholder="8317 or https://…/v1" value={customEndpoint} onChange={(e) => setCustomEndpoint(e.target.value)} className={`mt-2 ${promptPopoverFieldClass}`} />
                <p className="mt-2 text-[10.5px] leading-[1.45] text-white/30">Models are discovered automatically.</p>
              </div>
            )}

            <div>
              <Label htmlFor="api-key" className="text-[12px] text-white/75">API key</Label>
              <Input id="api-key" type="password" autoComplete="off" placeholder={provider === "custom" ? "Enter your API key" : "sk-or-v1-…"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} className={`mt-2 font-mono ${promptPopoverFieldClass}`} />
              <p className="mt-2 text-[10.5px] leading-[1.45] text-white/30">{provider === "custom" ? "Use any non-empty value if your proxy needs no key." : "Saved only in this browser."}</p>
            </div>

            <div>
              <Label htmlFor="max-tokens" className="text-[12px] text-white/75">Response limit</Label>
              <Select value={maxTokens} onValueChange={setMaxTokens}>
                <SelectTrigger id="max-tokens" className="mt-2 h-10 rounded-[11px] border border-black bg-black/45 text-[13px] text-white/80 shadow-[inset_0_1px_3px_rgb(0_0_0/.45)] ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2000">2,000 tokens</SelectItem>
                  <SelectItem value="4000">4,000 tokens</SelectItem>
                  <SelectItem value="8000">8,000 tokens</SelectItem>
                  <SelectItem value="16000">16,000 tokens</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end border-t border-white/[.06] px-4 py-3.5">
          <button type="button" onClick={handleSave} disabled={(!apiKey && !config.localKeys?.apiKey) || (provider === "custom" && !customEndpoint.trim())} className={`px-5 text-[12px] ${labDialogPrimaryButtonClass}`}>
            Save settings
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
