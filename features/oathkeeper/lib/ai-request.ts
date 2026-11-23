import type { AiModelKind } from '@/lib/ai-model-kind';

export type AiRequestConfig = {
  keyMode: 'env' | 'local';
  localKeys?: { provider?: string; apiKey?: string; model?: string; modelKind?: AiModelKind; maxTokens?: string; customEndpoint?: string };
};

export type AiRequestFields =
  | { useGlobalKeys: true }
  | { useLocalKeys: true; provider: 'openrouter' | 'custom'; apiKey: string; model: string; modelKind?: AiModelKind; maxTokens?: string; customEndpoint?: string };

/** The configuration fields `resolveAiConfiguration` reads. Missing local values
 * take the defaults Model settings and the model picker display. Returns null
 * for local settings the server would reject, so callers can open Model
 * settings instead of sending a request that cannot succeed. */
export function aiRequestFields(config: AiRequestConfig): AiRequestFields | null {
  if (config.keyMode !== 'local') return { useGlobalKeys: true };
  const keys = config.localKeys;
  const provider = keys?.provider || 'openrouter';
  if (provider !== 'openrouter' && provider !== 'custom') return null;
  const apiKey = keys?.apiKey?.trim() || '';
  const customEndpoint = keys?.customEndpoint?.trim() || '';
  if (!apiKey || (provider === 'custom' && !customEndpoint)) return null;
  return {
    useLocalKeys: true,
    provider,
    apiKey,
    model: keys?.model?.trim() || 'openai/gpt-4o-mini',
    modelKind: keys?.modelKind,
    maxTokens: keys?.maxTokens,
    ...(provider === 'custom' ? { customEndpoint } : {}),
  };
}
