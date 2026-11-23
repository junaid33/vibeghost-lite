"use client";

import { ConfigToggleButton } from "./config-toggle-button";
import { SimpleSettingsPopover } from "./simple-settings-popover";
import { AIModelSelector } from "./ai-model-selector";
import { McpSelector } from "./mcp-selector";
import { useAiConfig } from "../../hooks/use-ai-config";
import type { AiModelKind } from '@/lib/ai-model-kind';

interface ModeSplitButtonProps {
  disabled?: boolean;
  mcpDisabled?: boolean;
  sharedKeys?: {
    apiKey: string;
    model: string;
    modelKind?: AiModelKind;
    maxTokens: number;
  } | null;
  showModelLabelOnMobile?: boolean;
}

export function ModeSplitButton({
  disabled = false,
  mcpDisabled = false,
  sharedKeys,
  showModelLabelOnMobile = false,
}: ModeSplitButtonProps) {
  const { config: aiConfig, localAiEnabled } = useAiConfig();
  const isGlobalMode = aiConfig.keyMode === "env";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-[6px] whitespace-nowrap">
      {localAiEnabled ? (
        <ConfigToggleButton disabled={disabled} globalEnvsExist={!!sharedKeys} />
      ) : null}
      <SimpleSettingsPopover disabled={disabled || isGlobalMode} />
      <AIModelSelector
        disabled={disabled || isGlobalMode}
        globalModel={sharedKeys?.model}
        globalModelKind={sharedKeys?.modelKind}
        showLabelOnMobile={showModelLabelOnMobile}
      />
      <McpSelector disabled={disabled || mcpDisabled} />
    </div>
  );
}
