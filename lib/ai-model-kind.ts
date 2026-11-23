export type AiModelKind = 'chat' | 'image';

/** Fallback for exact IDs and proxies that expose only id/owned_by in /models.
 * Do not infer image generation from a model merely supporting vision input. */
export function inferredModelKind(id: string): AiModelKind {
  return /(?:^|\/)(?:gpt-image(?:-|$)|dall-e(?:-|$))/i.test(id.trim()) ? 'image' : 'chat';
}

export function selectedModelKind(id: string, kind?: unknown): AiModelKind {
  return kind === 'image' || inferredModelKind(id) === 'image' ? 'image' : 'chat';
}

export function requestModelKind(body: Record<string, unknown>, globalModel = 'openai/gpt-4o-mini', globalKind?: unknown): AiModelKind {
  return body.useGlobalKeys === true
    ? selectedModelKind(globalModel, globalKind)
    : selectedModelKind(typeof body.model === 'string' ? body.model : '', body.modelKind);
}

export function catalogModelKind(id: string, architecture?: { output_modalities?: unknown }): AiModelKind {
  const output = architecture?.output_modalities;
  return Array.isArray(output) && output.includes('image') && !output.includes('text') ? 'image' : inferredModelKind(id);
}
