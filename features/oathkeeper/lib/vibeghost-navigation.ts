'use client';

import { useSyncExternalStore } from 'react';
import { parseVibeGhostPath, vibeGhostHref, type VibeGhostSection } from './vibeghost-routes';

export { vibeGhostAppName, vibeGhostV1Href, vibeGhostV1SessionHref, vibeGhostActiveHref, vibeGhostHref, vibeGhostSessionHref, vibeGhostSessionTarget, vibeGhostTimelineHref, vibeGhostWorkspacesHref, type VibeGhostLocation, type VibeGhostSection } from './vibeghost-routes';

const navigationEvent = 'oathkeeper:vibeghost-navigation';
export const workspaceNavigationEvent = 'oathkeeper:vibeghost-workspaces';

const subscribe = (notify: () => void) => {
  window.addEventListener('popstate', notify);
  window.addEventListener('hashchange', notify);
  window.addEventListener(navigationEvent, notify);
  return () => {
    window.removeEventListener('popstate', notify);
    window.removeEventListener('hashchange', notify);
    window.removeEventListener(navigationEvent, notify);
  };
};
// Read the URL itself: pushState entries keep Next's earlier tree, so route params can be stale.
const snapshot = () => window.location.hash.slice(1) || '/vibeghost-v2';
const serverSnapshot = () => '';

export function useVibeGhostLocation() {
  const url = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const query = url.indexOf('?');
  return parseVibeGhostPath(query < 0 ? url : url.slice(0, query), query < 0 ? '' : url.slice(query));
}

/** Next supports native history updates without remounting the connection owner. */
export function navigateVibeGhost(workspace?: string, session?: string, view?: VibeGhostSection) {
  const href = vibeGhostHref(workspace, session, view);
  if (window.location.hash !== href) {
    window.history.pushState(null, '', href);
    window.dispatchEvent(new Event(navigationEvent));
  }
}

/** Plain clicks on a VibeGhost link stay in place; modified and middle clicks open the href. */
export const isVibeGhostPath = (pathname: string) => pathname === '/vibeghost' || pathname.startsWith('/vibeghost/');
