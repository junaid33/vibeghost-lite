// Browser-local view state only. Never store clients, tickets, or terminal data.
export type SessionTab = { id: string; title: string };
/** Two tabs shown side by side. Panes keep their side; activeId is the focused one. */
export type SessionSplit = { left: string; right: string };
export type SessionTabsState = { version: 1; tabs: SessionTab[]; activeId: string | null; split: SessionSplit | null; ratio: number };
export const SESSION_TABS_KEY = 'oathkeeper:vibeghost-tabs:v1';
export const MAX_SESSION_TABS = 12;
export const emptySessionTabs = (): SessionTabsState => ({ version: 1, tabs: [], activeId: null, split: null, ratio: .5 });
const ratio = (value: number) => Math.max(.25, Math.min(.75, Number.isFinite(value) ? value : .5));
const inSplit = (split: SessionSplit | null, id: string | null) => Boolean(split && id && (split.left === id || split.right === id));

export function parseSessionTabs(raw: string | null): SessionTabsState {
  try {
    const data = JSON.parse(raw || 'null');
    if (data?.version !== 1 || !Array.isArray(data.tabs)) return emptySessionTabs();
    const tabs: SessionTab[] = [];
    for (const tab of data.tabs) {
      if (tabs.length >= MAX_SESSION_TABS) break;
      if (typeof tab?.id !== 'string' || !tab.id || tab.id.length > 512 || tabs.some(item => item.id === tab.id)) continue;
      tabs.push({ id: tab.id, title: typeof tab.title === 'string' ? tab.title.slice(0, 256) : 'Session' });
    }
    const known = (id: unknown): id is string => typeof id === 'string' && tabs.some(tab => tab.id === id);
    let activeId: string | null = known(data.activeId) ? data.activeId : tabs[0]?.id ?? null;
    let split: SessionSplit | null = null;
    if (known(data.split?.left) && known(data.split?.right) && data.split.left !== data.split.right) split = { left: data.split.left, right: data.split.right };
    // Earlier layouts stored only the secondary pane; the selected tab was on the left.
    else if (known(data.splitId) && activeId && data.splitId !== activeId) split = { left: activeId, right: data.splitId };
    if (split && !inSplit(split, activeId)) activeId = split.left;
    return { version: 1, tabs, activeId, split, ratio: ratio(typeof data.ratio === 'number' ? data.ratio : .5) };
  } catch { return emptySessionTabs(); }
}

export type SessionTabsAction =
  /** Add or retitle a tab. `beside` shows it next to the focused pane; `into` shows it in that tab's pane. */
  | { type: 'open'; tab: SessionTab; beside?: boolean; into?: string; detach?: boolean }
  /** Focus a visible tab, or show a hidden one in the focused pane. `detach`
   *  (single-pane screens) instead breaks the pair when leaving it. */
  | { type: 'select'; id: string; detach?: boolean }
  | { type: 'close'; id: string }
  | { type: 'replace'; id: string; tab: SessionTab }
  | { type: 'unsplit' }
  | { type: 'ratio'; value: number };

/** Show `id` in the pane currently showing `slot`, and focus it. Never duplicates a pane. */
function showIn(state: SessionTabsState, slot: string | null, id: string): SessionTabsState {
  const { split } = state;
  if (!split || inSplit(split, id) || !inSplit(split, slot)) return { ...state, activeId: inSplit(split, id) || !split ? id : state.activeId };
  return { ...state, activeId: id, split: split.left === slot ? { ...split, left: id } : { ...split, right: id } };
}

export function sessionTabsReducer(state: SessionTabsState, action: SessionTabsAction): SessionTabsState {
  if (action.type === 'ratio') return { ...state, ratio: ratio(action.value) };
  if (action.type === 'unsplit') return state.split ? { ...state, split: null } : state;
  if (action.type === 'open') {
    const exists = state.tabs.some(tab => tab.id === action.tab.id);
    if (!exists && state.tabs.length >= MAX_SESSION_TABS) return state;
    const next = { ...state, tabs: exists ? state.tabs.map(tab => tab.id === action.tab.id ? action.tab : tab) : [...state.tabs, action.tab] };
    const id = action.tab.id;
    if (action.into) return showIn(next, action.into, id);
    if (action.beside && next.activeId && next.activeId !== id) {
      if (!next.split) return { ...next, activeId: id, split: { left: next.activeId, right: id } };
      // Already split: the beside pane is the one that is not focused.
      return showIn(next, next.split.left === next.activeId ? next.split.right : next.split.left, id);
    }
    return sessionTabsReducer(next, { type: 'select', id, detach: action.detach });
  }
  if (action.type === 'select') {
    if (!state.tabs.some(tab => tab.id === action.id)) return state;
    if (action.detach && state.split && !inSplit(state.split, action.id)) return { ...state, split: null, activeId: action.id };
    return showIn(state, state.activeId, action.id);
  }
  if (action.type === 'replace') {
    if (!state.tabs.some(tab => tab.id === action.id)) return state;
    const exists = state.tabs.some(tab => tab.id === action.tab.id && tab.id !== action.id);
    const tabs = exists ? state.tabs.filter(tab => tab.id !== action.id) : state.tabs.map(tab => tab.id === action.id ? action.tab : tab);
    const map = (id: string) => id === action.id ? action.tab.id : id;
    const activeId = state.activeId && map(state.activeId);
    const split = state.split && { left: map(state.split.left), right: map(state.split.right) };
    return { ...state, tabs, activeId, split: split && split.left !== split.right ? split : null };
  }
  const index = state.tabs.findIndex(tab => tab.id === action.id);
  if (index < 0) return state;
  const tabs = state.tabs.filter(tab => tab.id !== action.id);
  // Closing either half of a split returns to its partner as a single pane.
  if (state.split && inSplit(state.split, action.id)) return { ...state, tabs, split: null, activeId: state.split.left === action.id ? state.split.right : state.split.left };
  const activeId = state.activeId === action.id ? tabs[Math.min(index, tabs.length - 1)]?.id || null : state.activeId;
  return { ...state, tabs, activeId };
}
