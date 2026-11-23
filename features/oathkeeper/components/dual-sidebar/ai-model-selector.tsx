"use client";

/* Hallmark · component: model selector dialog · genre: modern-minimal · theme: existing lab
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Image as ImageIcon, RefreshCw, Sparkles } from "@/components/icons/duo";
import { Spinner } from "@/components/ui/spinner";
import { IconMagnifierOutlineDuo18 as Search } from "@/components/icons/duo";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { selectedModelKind, type AiModelKind } from '@/lib/ai-model-kind';
import { useModelName } from "../../hooks/use-model-name";
import { useAiConfig } from "../../hooks/use-ai-config";
import { PromptPopoverHeader, promptPopoverContentClass, promptToolbarControlClass } from "./prompt-control-popover";
import { plural } from "@/lib/plural";

type CatalogModel = {
  id: string;
  name: string;
  kind?: AiModelKind;
  description?: string;
  family?: string;
  attachment?: boolean;
  reasoning?: boolean;
  toolCall?: boolean;
  context?: number;
  ownedBy?: string;
  popularRank?: number;
};

interface AIModelSelectorProps {
  disabled?: boolean;
  globalModel?: string;
  globalModelKind?: AiModelKind;
  showLabelOnMobile?: boolean;
}

function compactNumber(value?: number) {
  if (!value) return null;
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 0 }).format(value);
}

export function AIModelSelector({ disabled = false, globalModel, globalModelKind, showLabelOnMobile = false }: AIModelSelectorProps) {
  const { config, setConfig } = useAiConfig();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const isCustomProvider = config.keyMode === "local" && config.localKeys?.provider === "custom";
  const customEndpoint = config.localKeys?.customEndpoint || "";
  const customApiKey = config.localKeys?.apiKey || "";
  const currentModel = config.keyMode === "local" ? config.localKeys?.model || "openai/gpt-4o-mini" : globalModel || "openai/gpt-4o-mini";

  const loadModels = useCallback(async (signal: AbortSignal) => {
    if (isCustomProvider && !customEndpoint.trim()) {
      setLoading(false);
      setModels([]);
      setError("Add a custom endpoint in Model settings first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai-models", isCustomProvider ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: customEndpoint, apiKey: customApiKey }),
        signal,
      } : { signal });
      const payload = await response.json().catch(() => ({}));
      if (signal.aborted) return;
      if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "Unable to load models");
      const nextModels = Array.isArray(payload?.models) ? payload.models.map((model: CatalogModel) => ({ ...model, name: model.name || model.id })) : [];
      setModels(nextModels);
      if (typeof payload.warning === 'string') setError(payload.warning);
      if (!nextModels.length) setError("No models were returned.");
    } catch (cause) {
      if (signal.aborted) return;
      setModels([]);
      setError(cause instanceof Error ? cause.message : "Unable to load models");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [customApiKey, customEndpoint, isCustomProvider]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void loadModels(controller.signal);
    return () => controller.abort();
  }, [loadModels, open, refreshVersion]);

  const selectModel = (modelId: string) => {
    if (config.keyMode !== "local") return;
    setConfig({
      ...config,
      localKeys: {
        provider: config.localKeys?.provider || "openrouter",
        apiKey: config.localKeys?.apiKey || "",
        model: modelId,
        modelKind: selectedModelKind(modelId, models.find(model => model.id === modelId)?.kind),
        maxTokens: config.localKeys?.maxTokens || "4000",
        customEndpoint: config.localKeys?.customEndpoint,
      },
    });
    setOpen(false);
    setQuery("");
  };

  const normalizedQuery = query.trim().toLowerCase();
  const orderedModels = useMemo(() => [...models].sort((a, b) =>
    (a.popularRank ?? 9999) - (b.popularRank ?? 9999) || a.name.localeCompare(b.name)
  ), [models]);

  const filteredModels = useMemo(() => {
    if (!normalizedQuery) return orderedModels;
    return orderedModels.filter((model) => `${model.name} ${model.id} ${model.family || ""} ${selectedModelKind(model.id, model.kind) === 'image' ? 'image generation' : ''}`.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery, orderedModels]);

  const visibleModels = filteredModels.slice(0, normalizedQuery ? 200 : 100);
  const exactId = query.trim();
  const canUseExactId = Boolean(exactId && !models.some((model) => model.id.toLowerCase() === exactId.toLowerCase()));
  const selectedCatalogModel = models.find((model) => model.id === currentModel);
  // The chip names the model before the picker has ever opened (same cached catalog as chat v2).
  const catalogName = useModelName(currentModel, isCustomProvider ? { endpoint: customEndpoint, apiKey: customApiKey } : undefined);
  const displayText = selectedCatalogModel?.name || catalogName;
  const modelKind = selectedModelKind(currentModel, config.keyMode === 'local' ? config.localKeys?.modelKind : globalModelKind);

  const selector = (
    <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setQuery(""); }}>
      <DialogTrigger asChild>
        <button type="button" disabled={disabled} data-model-kind={modelKind} title={`${displayText}${modelKind === 'image' ? ' · Image generation' : ''}`} className={`${promptToolbarControlClass} min-w-0 justify-center gap-1.5 px-2.5 text-[12px] font-medium ${showLabelOnMobile ? "w-full flex-1 sm:w-auto sm:flex-none sm:max-w-36" : "w-8 sm:w-auto"}`}>
          {modelKind === 'image' ? <><ImageIcon aria-hidden="true" className="pointer-events-none size-3.5 shrink-0 text-ink-2"/><span className="sr-only">Image generation: </span></> : null}
          <span className={`${showLabelOnMobile ? "inline min-w-0 flex-1 sm:max-w-28" : "hidden max-w-28 sm:inline"} truncate`}>{displayText}</span>
          {modelKind !== 'image' ? <Sparkles aria-hidden="true" className={`size-3 shrink-0 text-ink-3 ${showLabelOnMobile ? "hidden" : "sm:hidden"}`} /> : null}
          <ChevronDown className={`size-3 shrink-0 text-ink-3 ${showLabelOnMobile ? "block" : "hidden sm:block"}`} />
        </button>
      </DialogTrigger>

      <DialogContent hideClose className={promptPopoverContentClass}>
        <PromptPopoverHeader title="Choose a model" description={isCustomProvider ? "Models reported by your configured endpoint." : "Chat models from models.dev and image models from OpenRouter."} />

        <div className="px-5 pb-3">
          <label className="flex h-10 items-center gap-2 rounded-[11px] border border-black bg-black/55 px-3 shadow-[inset_0_1px_3px_rgb(0_0_0/.5)] focus-within:border-white/20">
            <Search className="size-3.5 shrink-0 text-white/25" />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && canUseExactId) selectModel(exactId); }} placeholder="Search by name or model ID" className="min-w-0 flex-1 self-stretch bg-transparent text-[13px] text-white/80 outline-none placeholder:text-white/25" />
          </label>
        </div>

        <div className="max-h-[min(390px,calc(100dvh-13rem))] overflow-y-auto border-t border-black py-2 [scrollbar-width:thin]">
          <div className="flex items-center justify-between px-5 py-2">
            <span className="text-[12px] uppercase tracking-[.08em] text-white/30">{normalizedQuery ? plural(filteredModels.length, "result") : isCustomProvider ? "Available models" : "Popular first · all models"}</span>
            <button type="button" onClick={() => setRefreshVersion((version) => version + 1)} disabled={loading} aria-label="Refresh models" className="flex size-7 max-sm:size-9 items-center justify-center rounded-[8px] text-white/30 transition-colors hover:bg-white/[.05] hover:text-white/70 disabled:opacity-40">{loading ? <Spinner className="size-3.5"/> : <RefreshCw className="size-3.5"/>}</button>
          </div>

          {loading && !models.length ? <div className="flex items-center gap-2 px-5 py-8 text-[12px] text-white/30"><Spinner className="size-3.5 "/>Loading model catalog…</div> : null}
          {error ? <div className="mx-5 mb-2 rounded-[9px] bg-[#ee4169]/8 px-3 py-2 text-[12px] leading-4 text-[#f37996]">{error}</div> : null}

          <div className="px-2">
            {visibleModels.map((model) => {
              const selected = currentModel === model.id;
              const popular = typeof model.popularRank === "number";
              return <button key={model.id} type="button" onClick={() => selectModel(model.id)} className={cn("flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-white/[.05]", selected && "bg-white/[.06]")}>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[12.5px] text-white/80">{model.name}</span>
                    {selectedModelKind(model.id, model.kind) === 'image' ? <span className="shrink-0 rounded-full bg-[#6fa8ff]/10 px-1.5 py-0.5 text-[12px] leading-4 text-[#8bb8ff]">Image generation</span> : null}
                    {popular ? <span className="shrink-0 rounded-full bg-white/[.06] px-1.5 py-0.5 text-[12px] leading-4 text-white/40">Weekly #{model.popularRank}</span> : null}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[12px] text-white/30">{model.id}</span>
                </span>
                <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                  {model.reasoning ? <span className="text-[12px] text-white/30">Reasoning</span> : null}
                  {model.attachment ? <span className="text-[12px] text-white/30">Vision</span> : null}
                  {model.context ? <span className="text-[12px] text-white/30">{compactNumber(model.context)}</span> : null}
                </span>
                <span className="flex size-5 shrink-0 items-center justify-center">{selected ? <Check className="size-3.5 text-white/75"/> : null}</span>
              </button>;
            })}

            {!loading && !visibleModels.length && !canUseExactId ? <p className="px-3 py-8 text-[12px] text-white/30">No models match this search.</p> : null}
            {canUseExactId ? <button type="button" onClick={() => selectModel(exactId)} className="mt-1 flex w-full items-center gap-3 rounded-[10px] border-t border-black px-3 py-3 text-left transition-colors hover:bg-white/[.05]"><span className="flex size-7 max-sm:size-9 items-center justify-center rounded-[8px] bg-white/[.05] text-white/45"><Sparkles className="size-3.5"/></span><span className="min-w-0"><span className="block text-[12px] text-white/70">Use exact model ID</span><span className="block truncate font-mono text-[12px] text-white/30">{exactId}</span></span></button> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (disabled) {
    return <TooltipProvider><Tooltip><TooltipTrigger asChild><div className={showLabelOnMobile ? "min-w-0 flex-1 sm:flex-none" : undefined}>{selector}</div></TooltipTrigger><TooltipContent><p className="text-xs">Model is set by global configuration</p></TooltipContent></Tooltip></TooltipProvider>;
  }
  return selector;
}
