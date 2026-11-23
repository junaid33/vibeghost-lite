"use client";
import { useEffect, useState } from "react";

// The model chip reads like /chat's selector: the catalog's display name for the active model (from the
// user's own provider when they chose one), else the raw model id.
type CatalogModel = { id: string; name?: string };
const catalogs = new Map<string, Promise<CatalogModel[]>>();
function loadCatalog(custom?: { endpoint: string; apiKey: string }) {
  if (custom && !custom.endpoint.trim()) return Promise.resolve([]);
  const key = custom ? `custom:${custom.endpoint}` : "shared";
  let pending = catalogs.get(key);
  if (!pending) {
    pending = fetch("/api/ai-models", custom ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: custom.endpoint, apiKey: custom.apiKey }) } : undefined)
      .then(response => response.ok ? response.json() as Promise<{ models?: unknown }> : {}).then((payload: { models?: unknown }) => Array.isArray(payload?.models) ? payload.models as CatalogModel[] : [])
      .catch(() => { catalogs.delete(key); return []; });
    catalogs.set(key, pending);
  }
  return pending;
}
export function useModelName(model: string | undefined, custom?: { endpoint: string; apiKey: string }) {
  const [names, setNames] = useState<Record<string, string>>({});
  const endpoint = custom?.endpoint, apiKey = custom?.apiKey;
  useEffect(() => {
    if (!model) return;
    let live = true;
    void loadCatalog(endpoint === undefined ? undefined : { endpoint, apiKey: apiKey ?? "" }).then(models => {
      const name = models.find(entry => entry.id === model)?.name;
      if (live && name) setNames(current => current[model] === name ? current : { ...current, [model]: name });
    });
    return () => { live = false; };
  }, [apiKey, endpoint, model]);
  return model ? names[model] || model : "Oathkeeper";
}
