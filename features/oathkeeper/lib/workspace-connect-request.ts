"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { navigateVibeGhost } from "./vibeghost-navigation";

/** "Add workspace…" from any menu. A visible VibeGhost view opens its connect dialog at once; when none is
 *  mounted, the request waits briefly for the one the caller navigates to. */
const listeners = new Set<() => boolean>();
let pendingAt = 0;

export function requestWorkspaceConnect(): boolean {
  for (const listener of listeners) if (listener()) { pendingAt = 0; return true; }
  pendingAt = Date.now();
  return false;
}

export function useWorkspaceConnectRequests(open: () => void, enabled = true) {
  const latest = useRef({ open, enabled });
  useLayoutEffect(() => { latest.current = { open, enabled }; });
  useEffect(() => {
    const handle = () => { if (!latest.current.enabled) return false; latest.current.open(); return true; };
    listeners.add(handle);
    if (pendingAt && Date.now() - pendingAt < 10_000 && handle()) pendingAt = 0;
    return () => { listeners.delete(handle); };
  }, []);
}

/** For menus outside a VibeGhost view (the sidebar): open the dialog here, or on the Workspaces page. */
export function connectWorkspace() {
  if (!requestWorkspaceConnect()) navigateVibeGhost(undefined, undefined, "workspaces");
}
