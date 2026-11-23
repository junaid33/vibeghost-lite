// Pure VibeGhost URL scheme, shared by server routes, client navigation and tests. Paths, not
// query strings: every segment is encoded, so workspace ids such as `peer:one` round-trip.
//   /vibeghost                                   landing
//   /vibeghost/workspaces | /active | /timeline | /tabs  sections
//   /vibeghost/workspaces/<ws>[/sessions/<sid>]  a workspace, or one of its sessions
//   /vibeghost/sessions/<id>                     a local session
//   /vibeghost/active/workspaces/<ws>[/sessions/<sid>], /vibeghost/active/sessions/<id>
//                                                the same, opened from the Active Feed
//   /vibeghost/timeline/workspaces/<ws>/sessions/<sid>  the same, opened from the Timeline
// Legacy `/vibeghost?view=&workspace=&session=` URLs still parse, and the route redirects them;
// so do the Timeline's first paths, /vibeghost/agents[/…].

export type VibeGhostSection = 'workspaces' | 'active' | 'timeline' | 'tabs';
export type VibeGhostLocation = { workspace: string; session: string; view: VibeGhostSection | '' };

const V1_ROOT = '/vibeghost';
/** VibeGhost v2 (direct transport) is the same app under its own prefix, with the same paths below it. */
export const VIBEGHOST_V2_ROOT = '/vibeghost-v2';
const under = (pathname: string, root: string) => pathname === root || pathname.startsWith(`${root}/`);
/** The app the browser is on: links made on a v2 page stay in v2. On the server, and everywhere else, v1. */
export function vibeGhostRoot() {
  return VIBEGHOST_V2_ROOT;
}
export const vibeGhostAppName = () => 'VibeGhost';
const isSection = (value: string | null | undefined): value is VibeGhostSection => value === 'workspaces' || value === 'active' || value === 'timeline' || value === 'tabs';
/** Sections whose sessions open under their own path, so the way back leads to them. */
const isReturnSection = (value: string | null | undefined): value is 'active' | 'timeline' => value === 'active' || value === 'timeline';
const decode = (value: string) => { try { return decodeURIComponent(value); } catch { return value; } };

export function vibeGhostHref(workspace?: string, session?: string, view?: VibeGhostSection, ROOT = vibeGhostRoot()) {
  const base = isReturnSection(view) ? `${ROOT}/${view}` : ROOT;
  if (workspace) return `#${base}/workspaces/${encodeURIComponent(workspace)}${session ? `/sessions/${encodeURIComponent(session)}` : ''}`;
  if (session) return `#${base}/sessions/${encodeURIComponent(session)}`;
  return view ? `#${ROOT}/${view}` : `#${ROOT}`;
}

export function vibeGhostSessionTarget(session: { id: string; workspaceId?: string; remoteSessionId?: string }) {
  return { workspace: session.workspaceId, session: session.remoteSessionId || session.id };
}

export function vibeGhostSessionHref(session: { id: string; workspaceId?: string; remoteSessionId?: string }) {
  const target = vibeGhostSessionTarget(session);
  return vibeGhostHref(target.workspace, target.session);
}

export const vibeGhostWorkspacesHref = () => vibeGhostHref(undefined, undefined, 'workspaces');
export const vibeGhostActiveHref = () => vibeGhostHref(undefined, undefined, 'active');
export const vibeGhostTimelineHref = () => vibeGhostHref(undefined, undefined, 'timeline');

/** The old query form, read only when the path itself carries no location. */
function legacyLocation(search: string): VibeGhostLocation {
  const params = new URLSearchParams(search);
  const view = params.get('view');
  return { workspace: params.get('workspace') || '', session: params.get('session') || '', view: isSection(view) ? view : '' };
}

/** Segments after /vibeghost (already split, encoded or not) → location. Unknown shapes are the landing. */
export function vibeGhostLocationFromSegments(segments: string[]): VibeGhostLocation {
  const parts = segments.filter(Boolean).map(decode).map((part, index) => index === 0 && part === 'agents' ? 'timeline' : part);
  const empty: VibeGhostLocation = { workspace: '', session: '', view: '' };
  if (!parts.length) return empty;
  if (parts.length === 1 && isSection(parts[0])) return { ...empty, view: parts[0] };
  const view = isReturnSection(parts[0]) ? parts[0] : '';
  const rest = view ? parts.slice(1) : parts;
  if (rest[0] === 'workspaces' && rest[1]) return { view, workspace: rest[1], session: rest[2] === 'sessions' && rest[3] ? rest[3] : '' };
  if (rest[0] === 'sessions' && rest[1]) return { view, workspace: '', session: rest[1] };
  return { ...empty, view };
}

export function parseVibeGhostPath(pathname: string, search = ''): VibeGhostLocation {
  const path = pathname.replace(/\/+$/, '');
  const ROOT = under(path, VIBEGHOST_V2_ROOT) ? VIBEGHOST_V2_ROOT : V1_ROOT;
  if (path !== ROOT && !path.startsWith(`${ROOT}/`)) return { workspace: '', session: '', view: '' };
  const segments = path.slice(ROOT.length).split('/').filter(Boolean);
  return segments.length ? vibeGhostLocationFromSegments(segments) : legacyLocation(search);
}

/** The path a legacy query URL should move to, or null when there is nothing to move. */
export function legacyVibeGhostRedirect(segments: string[] | undefined, query: Record<string, string | string[] | undefined>, ROOT = V1_ROOT) {
  if (segments?.[0] === 'agents') return `${ROOT}/timeline${segments.slice(1).map(segment => `/${encodeURIComponent(decode(segment))}`).join('')}`;
  if (segments?.length) return null;
  const first = (key: string) => { const value = query[key]; return Array.isArray(value) ? value[0] : value; };
  const view = first('view'), workspace = first('workspace'), session = first('session');
  if (!view && !workspace && !session) return null;
  return vibeGhostHref(workspace || undefined, session || undefined, isSection(view) ? view : undefined, ROOT);
}

/** The first app's links, whatever page they are drawn on: the sidebar's VibeGhost tree lists iroh
 *  workspaces, so it must not follow the browser into v2. */
export const vibeGhostV1Href = (workspace?: string, session?: string, view?: VibeGhostSection) => vibeGhostHref(workspace, session, view, V1_ROOT);
export function vibeGhostV1SessionHref(session: { id: string; workspaceId?: string; remoteSessionId?: string }) {
  const target = vibeGhostSessionTarget(session);
  return vibeGhostV1Href(target.workspace, target.session);
}
