'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SESSION_TABS_KEY, emptySessionTabs, parseSessionTabs, sessionTabsReducer, type SessionTabsAction } from '../lib/session-tabs';

/** v1 and v2 list the same sessions under the same ids, so they share one tab layout. */
const tabsKey = () => SESSION_TABS_KEY;

export function useSessionTabs() {
  const [state, setState] = useState(emptySessionTabs);
  const [ready, setReady] = useState(false);
  const [storageNotice, setStorageNotice] = useState('');
  const current = useRef(state);
  useEffect(() => {
    try { current.current = parseSessionTabs(localStorage.getItem(tabsKey())); }
    catch { setStorageNotice('Browser storage is unavailable. This layout will last until you leave this page.'); }
    setState(current.current);
    setReady(true);
  }, []);
  const dispatch = useCallback((action: SessionTabsAction) => {
    const next = sessionTabsReducer(current.current, action);
    if (next === current.current) return;
    current.current = next;
    setState(next);
    try { localStorage.setItem(tabsKey(), JSON.stringify(next)); setStorageNotice(''); }
    catch { setStorageNotice('Could not save this layout. Your sessions are still running.'); }
  }, []);
  // Each browser window owns its live arrangement; another window's writes must
  // never move the terminal under the user's keyboard. Reload restores last save.
  return { state, dispatch, ready, storageNotice };
}
