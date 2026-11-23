export function normalizeWorkspacePins(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string').map(id => id.trim()).filter(id => id.length > 0 && id.length <= 512))].slice(0, 100);
}

export function toggleWorkspacePin(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter(value => value !== id) : normalizeWorkspacePins([...ids, id]);
}

/** Pin membership changes grouping, not source order inside either group. */
export function partitionWorkspacesByPin<T extends { id: string }>(workspaces: T[], ids: readonly string[]) {
  const pinnedIds = new Set(ids);
  return { pinned: workspaces.filter(w => pinnedIds.has(w.id)), unpinned: workspaces.filter(w => !pinnedIds.has(w.id)) };
}

type ComputerScoped = { id: string; instance?: { id: string; name: string; platform: string } };

/** Unpinned workspaces grouped by the computer that serves them, in source order.
 *  A lone computer is labelled "Workspaces", matching the standalone VibeGhost sidebar. */
export function groupWorkspacesByComputer<T extends ComputerScoped>(workspaces: T[], label: (workspace: T) => string) {
  const groups = new Map<string, { id: string; label: string; items: T[] }>();
  for (const workspace of workspaces) {
    const id = workspace.instance?.id || 'unknown-computer';
    let group = groups.get(id);
    if (!group) groups.set(id, group = { id, label: label(workspace), items: [] });
    group.items.push(workspace);
  }
  const result = [...groups.values()];
  return result.length === 1 ? [{ ...result[0], label: 'Workspaces' }] : result;
}
