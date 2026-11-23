'use client';

import { useRef } from 'react';
import { liteFetch } from '@/lib/lite-connection';
import { useMutation, useQuery } from '@tanstack/react-query';
import { workspaceQueries } from '../lib/workspace-directory-cache';
import { normalizeWorkspacePins, toggleWorkspacePin } from '../lib/workspace-pins';

const queryKey = ['vibeghost', 'workspace-pins'] as const;
async function requestPins(options?: RequestInit) {
  const response = await liteFetch('/api/workspace-pins', { cache: 'no-store', ...options });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error.slice(0, 200) : `Could not ${options?.method === 'PUT' ? 'save' : 'load'} workspace pins (${response.status}).`);
  if (!Array.isArray(data?.workspaceIds)) throw new Error('Could not load workspace pins. Retry.');
  return normalizeWorkspacePins(data.workspaceIds);
}

/** Mounted once by the directory owner; all pin controls share pending/error state. */
export function useWorkspacePins() {
  const pending = useRef(false);
  const failedIntent = useRef<{ id: string; pinned: boolean } | null>(null);
  const query = useQuery({ queryKey, queryFn: ({ signal }) => requestPins({ signal }), staleTime: 5_000, refetchInterval: 30_000 }, workspaceQueries);
  const mutation = useMutation({
    scope: { id: 'oathkeeper-workspace-pins' },
    mutationFn: (workspaceIds: string[]) => requestPins({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceIds }) }),
    onMutate: async (ids) => {
      await workspaceQueries.cancelQueries({ queryKey });
      const previous = workspaceQueries.getQueryData<string[]>(queryKey) || [];
      workspaceQueries.setQueryData(queryKey, ids);
      return { previous };
    },
    onError: (_error, _ids, context) => { workspaceQueries.setQueryData(queryKey, context?.previous || []); },
    onSuccess: (ids) => { failedIntent.current = null; workspaceQueries.setQueryData(queryKey, ids); },
    onSettled: async () => {
      try { await workspaceQueries.invalidateQueries({ queryKey }); }
      finally { pending.current = false; }
    },
  }, workspaceQueries);
  const ids = query.data || [];
  return {
    ids,
    isPinned: (id: string) => ids.includes(id),
    pending: query.isPending || mutation.isPending,
    error: query.error?.message || mutation.error?.message || '',
    toggle: (id: string) => {
      if (pending.current || !query.isSuccess) return;
      const current = workspaceQueries.getQueryData<string[]>(queryKey) || [];
      if (!current.includes(id) && current.length >= 100) return;
      pending.current = true;
      failedIntent.current = { id, pinned: !current.includes(id) };
      mutation.mutate(toggleWorkspacePin(current, id));
    },
    disabled: (id: string) => query.isPending || mutation.isPending || !query.isSuccess || (!ids.includes(id) && ids.length >= 100),
    retry: () => {
      if (pending.current) return;
      const intent = failedIntent.current;
      if (mutation.error && intent && query.isSuccess) {
        const current = workspaceQueries.getQueryData<string[]>(queryKey) || [];
        pending.current = true;
        mutation.mutate(intent.pinned ? normalizeWorkspacePins([...current, intent.id]) : current.filter(id => id !== intent.id));
      } else { void query.refetch(); }
    },
  };
}
export type WorkspacePins = ReturnType<typeof useWorkspacePins>;
