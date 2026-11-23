"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { DEFAULT_OATHKEEPER_ORB, normalizeOrbLogoKey } from "./orb-logo-catalog";
export { DEFAULT_OATHKEEPER_ORB } from "./orb-logo-catalog";

export const OATHKEEPER_ORB_STORAGE_KEY = "oathkeeper:orb-logo";
export const OATHKEEPER_ORB_ANIMATION_STORAGE_KEY = "oathkeeper:orb-animation";

const CHANGE_EVENT = "oathkeeper:orb-preference-change";

function read(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function setOrbPreference(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key } }));
  } catch {
    // Storage can be unavailable in private or locked-down browser contexts.
  }
}

function subscribe(key: string, callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) callback();
  };
  const onPreference = (event: Event) => {
    if ((event as CustomEvent<{ key?: string }>).detail?.key === key) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onPreference);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onPreference);
  };
}

function usePreference(key: string, fallback: string) {
  const subscribeToKey = useCallback((callback: () => void) => subscribe(key, callback), [key]);
  const getSnapshot = useCallback(() => read(key, fallback), [key, fallback]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);
  return useSyncExternalStore(subscribeToKey, getSnapshot, getServerSnapshot);
}

export function useOrbLogoPreferences() {
  const savedOrb = usePreference(OATHKEEPER_ORB_STORAGE_KEY, DEFAULT_OATHKEEPER_ORB);
  const orb = normalizeOrbLogoKey(savedOrb);
  const animation = usePreference(OATHKEEPER_ORB_ANIMATION_STORAGE_KEY, "true");
  useEffect(() => {
    // Render the safe fallback immediately; also repair old persisted selections
    // so the menu checkmark, other tabs and later visits agree. Keep pause state.
    if (savedOrb !== orb) setOrbPreference(OATHKEEPER_ORB_STORAGE_KEY, orb);
  }, [savedOrb, orb]);
  return { orb, running: animation !== "false" };
}
