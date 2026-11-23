"use client";

import { useSyncExternalStore } from "react";
import type { WorkspaceViewChromeProps } from "../workspace-view-shell";
import { VibeGhostView } from "../vibeghost-view";
import { VibeGhostV2DirectoryProvider } from "../../hooks/use-vibeghost-v2-directory";

const never = () => () => {};

/** VibeGhost v2: the same mini app as /vibeghost, every screen of it, with one thing changed: it
 *  asks VibeGhost directly (features/oathkeeper/lib/direct-workspace-client.ts) instead of through
 *  iroh and its relay. Its pages live under /vibeghost-v2 with the same paths as the first app.
 *  Links read the app's prefix from the browser's address, so the view is drawn in the browser only. */
export function VibeGhostV2View(chrome: WorkspaceViewChromeProps) {
  const inBrowser = useSyncExternalStore(never, () => true, () => false);
  if (!inBrowser) return null;
  return <VibeGhostV2DirectoryProvider><VibeGhostView {...chrome}/></VibeGhostV2DirectoryProvider>;
}
