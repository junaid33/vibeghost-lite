'use client';

import { createContext, useContext } from 'react';
import { VIBEGHOST_V2_ROOT, vibeGhostHref, vibeGhostSessionTarget, type VibeGhostSection } from '@/features/oathkeeper/lib/vibeghost-routes';

export type SidebarVibeGhostRoot = '/vibeghost' | typeof VIBEGHOST_V2_ROOT;
/** Which VibeGhost app a sidebar tree links into. v1 and v2 draw the same tree; only the prefix differs. */
export const SidebarVibeGhostRootContext = createContext<SidebarVibeGhostRoot>('/vibeghost');

export function useSidebarVibeGhostHrefs() {
  const root = useContext(SidebarVibeGhostRootContext);
  return {
    root,
    href: (workspace?: string, session?: string, view?: VibeGhostSection) => vibeGhostHref(workspace, session, view, root),
    sessionHref: (session: { id: string; workspaceId?: string; remoteSessionId?: string }, view?: VibeGhostSection) => {
      const target = vibeGhostSessionTarget(session);
      return vibeGhostHref(target.workspace, target.session, view, root);
    },
  };
}
