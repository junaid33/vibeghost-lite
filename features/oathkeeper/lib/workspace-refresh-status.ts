export type WorkspaceRefreshState = { checking: boolean; error: string };
export type WorkspaceRefreshSnapshot = Readonly<Record<string, WorkspaceRefreshState>>;
const empty: WorkspaceRefreshSnapshot = Object.freeze({});

/** Per-view check results, not terminal connectivity or persistent authority. */
export class WorkspaceRefreshStatus {
  private snapshot: WorkspaceRefreshSnapshot = empty;
  private attempts = new Map<string, symbol>();
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => empty;
  private publish(next: WorkspaceRefreshSnapshot) {
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
  begin(id: string) {
    const token = Symbol(id); this.attempts.set(id, token);
    this.publish({ ...this.snapshot, [id]: { checking: true, error: this.snapshot[id]?.error || '' } });
    return token;
  }
  finish(id: string, token: symbol, error: string | undefined) {
    if (this.attempts.get(id) !== token) return;
    this.attempts.delete(id);
    // Cancellation is not success or failure. Preserve the last settled result.
    this.publish({ ...this.snapshot, [id]: { checking: false, error: error ?? this.snapshot[id]?.error ?? '' } });
  }
  retain(ids: ReadonlySet<string>) {
    const next = { ...this.snapshot };
    for (const id of Object.keys(next)) if (!ids.has(id)) { delete next[id]; this.attempts.delete(id); }
    this.publish(next);
  }
}

export function workspaceRefreshSummary(states: WorkspaceRefreshSnapshot, names: ReadonlyMap<string, string>) {
  const failed = Object.entries(states).filter(([id, state]) => names.has(id) && state.error);
  if (!failed.length) return '';
  return `Could not refresh ${failed.map(([id]) => names.get(id)).join(', ')}. Showing saved details for ${failed.length === 1 ? 'that workspace' : 'those workspaces'}; other workspaces may still be available.`;
}
