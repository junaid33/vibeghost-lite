'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { Box2, Plus } from '@/components/icons/duo';
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useVibeGhostDirectory } from '../hooks/use-vibeghost-directory';
import { useSessionTabs } from '../hooks/use-session-tabs';
import { MAX_SESSION_TABS, sessionTabsReducer, type SessionSplit, type SessionTab } from '../lib/session-tabs';
import { navigateVibeGhost } from '../lib/vibeghost-navigation';
import { sharedSessionId } from '../lib/shared-workspace-model';
import type { VibeGhostSession } from './vibeghost-view';
import { SessionPickerMenu } from './session-picker-menu';
import { sessionPickerWorkspaces } from './session-picker-workspaces';
import { cn } from '@/lib/utils';
import { useHorizontalScrollFade } from '../hooks/use-horizontal-scroll-fade';
import styles from './vibeghost-tabs.module.css';

/** 'card': the tab row sits on the terminal card's rim, so tabs and screen read
 *  as one object. 'strip': a separate floating bar above the card. */
const TABS_LAYOUT: 'card' | 'strip' = 'card';

/** Controlled target for the same session surface used by the ordinary view. */
export type SessionPaneTarget = {
  id: string;
  visible: boolean;
  onSelect: (id: string) => void;
  onNavigate: (workspace?: string, remoteSession?: string) => void;
  onClose: () => void;
};

function PersistentPane({ visible, render, target, focused, onActivate, ...props }: {
  visible: boolean; render: (target: SessionPaneTarget) => ReactNode; target: SessionPaneTarget;
  id: string; labelledBy: string; side: 'primary' | 'secondary' | 'hidden'; style?: CSSProperties;
  focused: boolean; onActivate: () => void; motion?: PaneMotion;
}) {
  const [visited, setVisited] = useState(visible);
  useEffect(() => { if (visible) setVisited(true); }, [visible]);
  // Never reparent a terminal into another panel: layout changes its rectangle,
  // not its React owner. Hidden tabs stay subscribed but suspend their renderer.
  return <section id={props.id} role="tabpanel" aria-labelledby={props.labelledBy} aria-hidden={!visible} inert={!visible} data-session-pane={target.id} data-pane-side={props.side} data-pane-focused={visible && focused} data-motion={props.motion} className={styles.pane} style={props.style}
    // In split view, pointing or tabbing into a pane focuses it; panes never swap sides.
    onPointerDownCapture={() => { if (visible && !focused) onActivate(); }} onFocusCapture={() => { if (visible && !focused) onActivate(); }}>
    {visible || visited ? render(target) : null}
  </section>;
}

/** The session dropdown's own picker (same rows, pins and status dots),
 *  opened from Tabs' + and empty-state entry points. Never starts a process. */
function AddSessionMenu({ children, activeId, onSelect, side = 'bottom', align = 'end' }: {
  children: ReactNode; activeId: string; onSelect: (id: string) => void; side?: 'top' | 'bottom'; align?: 'start' | 'end';
}) {
  const { directory, pins, ensureDirectoryFresh } = useVibeGhostDirectory();
  const [open, setOpen] = useState(false);
  return <DropdownMenu modal={false} open={open} onOpenChange={next => { setOpen(next); if (next) void ensureDirectoryFresh(); }}>
    <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
    {open ? <SessionPickerMenu side={side} align={align} activeId={activeId}
      workspaces={sessionPickerWorkspaces({ sessions: directory.sessions, workspaces: directory.workspaces, isPinned: pins.isPinned })}
      onSelect={id => { setOpen(false); onSelect(id); }}
      headerAction={{ label: 'Connect shared workspace', icon: <Plus/>, run: () => { setOpen(false); navigateVibeGhost(undefined, undefined, 'workspaces'); } }}/> : null}
  </DropdownMenu>;
}

type PaneMotion = 'enter-next' | 'enter-prev' | 'exit-next' | 'exit-prev';
/** Matches the tab-switch keyframes in vibeghost-tabs.module.css. */
const TAB_SWITCH_MS = 340;

/** Owner-supplied compass mark: a recessed disc on every tab; when active it
 *  turns green-black and the tilted rhombus needle fades in. Also the CRM v2
 *  record mark: `className` sizes it and `tone` lets the host retint the disc
 *  and needle via --compass-* custom properties (defaults are the tab green). */
export function CompassMark({ active = true, className, tone }: { active?: boolean; className?: string; tone?: string }) {
  const gradient = useId();
  return <span className={className ? `${styles.compass} ${className}` : styles.compass} data-active={active} data-tone={tone} aria-hidden="true"><svg viewBox="0 0 16 16">
    <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--compass-hi, #bdf5cc)' }}/><stop offset=".3" style={{ stopColor: 'var(--compass-mid, #7cf774)' }}/><stop offset="1" style={{ stopColor: 'var(--compass-lo, #6ee866)' }}/></linearGradient></defs>
    <path d="M4.4 11.7 6.5 6.8 11.4 4.7 9.3 9.6Z" fill={`url(#${gradient})`} stroke={`url(#${gradient})`} strokeWidth=".7" strokeLinejoin="round"/>
  </svg></span>;
}

/** Fades a label's tail only when it is actually truncated. */
export function TabLabel({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [clipped, setClipped] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setClipped(node.scrollWidth > node.clientWidth + 1);
    const observer = new ResizeObserver(update);
    observer.observe(node); update();
    return () => observer.disconnect();
  }, [text]);
  return <span ref={ref} className={styles.label} data-fade={clipped || undefined}>{text}</span>;
}

/** Tabs scroll under edge fades; the divider, split control and + stay pinned at
 *  the right. In split view the visible pair renders as one combined pill whose
 *  halves map to the left and right panes; clicking a half focuses that pane. */
function TabStrip({ tabs, activeId, split, label, tabId, panelId, onSelect, onClose, onUnsplit, splitControl, addMenu }: {
  tabs: SessionTab[]; activeId: string | null; split: SessionSplit | null; label: (tab: SessionTab) => string;
  tabId: (id: string) => string; panelId: (id: string) => string;
  onSelect: (id: string) => void; onClose: (id: string) => void; onUnsplit: () => void; splitControl: ReactNode; addMenu: ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const tabButtons = useRef(new Map<string, HTMLButtonElement>());
  // Shared progressive edge fade (scroll-fade-x): ramps in with scroll distance.
  useHorizontalScrollFade(scroller);
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      if (node.scrollWidth <= node.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault(); node.scrollLeft += event.deltaY;
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, []);
  useEffect(() => { if (activeId) tabButtons.current.get(activeId)?.closest('[data-tab-entry]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [activeId]);
  const byId = new Map(tabs.map(tab => [tab.id, tab]));
  // Strip entries: the split pair collapses into one group at the first of its positions.
  const entries: (SessionTab | [SessionTab, SessionTab])[] = [];
  for (const tab of tabs) {
    if (split && (tab.id === split.left || tab.id === split.right)) {
      if (!entries.some(entry => Array.isArray(entry))) entries.push([byId.get(split.left)!, byId.get(split.right)!]);
    } else entries.push(tab);
  }
  const order = entries.flatMap(entry => Array.isArray(entry) ? entry : [entry]);
  const renderTab = (tab: SessionTab, half?: 'left' | 'right') => {
    const selected = tab.id === activeId;
    const index = order.indexOf(tab);
    return <div key={tab.id} className={styles.tab} data-selected={selected} data-half={half} data-tab-entry={half ? undefined : ''}>
      <button ref={node => { if (node) tabButtons.current.set(tab.id, node); else tabButtons.current.delete(tab.id); }} id={tabId(tab.id)} type="button" role="tab" aria-selected={selected} aria-controls={panelId(tab.id)} tabIndex={selected ? 0 : -1} title={half ? `${label(tab)} · ${half} pane` : label(tab)} className={styles.tabButton} onClick={() => onSelect(tab.id)} onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % order.length : event.key === 'ArrowLeft' ? (index - 1 + order.length) % order.length : event.key === 'Home' ? 0 : event.key === 'End' ? order.length - 1 : -1;
        if (next >= 0) { event.preventDefault(); onSelect(order[next].id); requestAnimationFrame(() => tabButtons.current.get(order[next].id)?.focus()); }
        if (event.key === 'Delete') { event.preventDefault(); onClose(tab.id); }
      }}>{half ? null : <CompassMark active={selected}/>}<TabLabel text={label(tab)}/></button>
      <button type="button" tabIndex={selected ? 0 : -1} className={styles.close} aria-label={`Close ${label(tab)} tab`} title="Close tab (session keeps running)" onClick={() => onClose(tab.id)}><svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2L2 8"/></svg></button>
    </div>;
  };
  return <div className={styles.strip}>
    <div className={styles.bar}>
      <div ref={scroller} role="tablist" aria-label="Session tabs" className={cn('scroll-fade-x', styles.scroller)}>
        {entries.map(entry => Array.isArray(entry)
          ? <div key="split" role="group" aria-label="Split view" className={styles.group} data-tab-entry>
            {/* The compass marks the pair and stays put; white vs grey ink marks the focused half. */}
            <span className={styles.groupMark}><CompassMark/></span>
            {renderTab(entry[0], 'left')}
            <button type="button" className={styles.groupDivider} aria-label="Separate split tabs" title="Separate into two tabs (both stay open)" onClick={onUnsplit}/>
            {renderTab(entry[1], 'right')}
          </div>
          : renderTab(entry))}
      </div>
      <span className={styles.divider}/>
      {splitControl}
      {addMenu}
    </div>
  </div>;
}

const FINE_POINTER = '(any-pointer: fine)';
const subscribeFinePointer = (notify: () => void) => { const query = matchMedia(FINE_POINTER); query.addEventListener('change', notify); return () => query.removeEventListener('change', notify); };

export function VibeGhostTabs({ renderSession }: { renderSession: (target: SessionPaneTarget) => ReactNode }) {
  const { directory, ensureDirectoryFresh } = useVibeGhostDirectory();
  const { state, dispatch, ready, storageNotice } = useSessionTabs();
  const [actionNotice, setActionNotice] = useState('');
  const stageRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const namespace = useId();
  // Split view is for wide stages only. Narrow (mobile) stages show plain tabs:
  // switching within a saved pair keeps it for later, leaving it breaks it up,
  // and a horizontal swipe on the terminal moves to the next/previous tab.
  // Desktop only: wide enough for two panes and a fine pointer, so a phone in
  // landscape stays on plain tabs and swipe.
  const finePointer = useSyncExternalStore(subscribeFinePointer, () => matchMedia(FINE_POINTER).matches, () => true);
  const canSplit = width >= 760 && finePointer;
  const narrow = width > 0 && !canSplit;
  const split = canSplit ? state.split : null;
  // Tab switch animation (single pane): the outgoing card recedes while the
  // incoming one slides over it from the side of the tab being opened.
  const [transition, setTransition] = useState<{ from: string; to: string; dir: 'next' | 'prev' } | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (transitionTimer.current) clearTimeout(transitionTimer.current); }, []);
  const switchTo = (id: string, detach = narrow) => {
    const from = state.activeId;
    const fromIndex = state.tabs.findIndex(tab => tab.id === from), toIndex = state.tabs.findIndex(tab => tab.id === id);
    if (!split && from && from !== id && fromIndex >= 0 && toIndex >= 0) {
      setTransition({ from, to: id, dir: toIndex > fromIndex ? 'next' : 'prev' });
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      transitionTimer.current = setTimeout(() => setTransition(null), TAB_SWITCH_MS + 60);
    }
    dispatch({ type: 'select', id, detach });
  };
  const switchRef = useRef(switchTo);
  const swipe = useRef<(step: 1 | -1) => void>(() => {});
  // Latest tabs for the passive touch listener, without re-binding it per render.
  useLayoutEffect(() => {
    switchRef.current = switchTo;
    swipe.current = step => {
      const index = state.tabs.findIndex(tab => tab.id === state.activeId);
      const next = state.tabs[index + step];
      if (index < 0 || !next) return;
      switchRef.current(next.id, true);
    };
  });
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !narrow) return;
    let start: { x: number; y: number; time: number } | null = null;
    // Passive and observe-only: the terminal keeps its own scrolling and gestures.
    const begin = (event: TouchEvent) => {
      const touch = event.touches[0];
      start = event.touches.length === 1 && (event.target as Element).closest?.('[data-tabs-terminal-card]') ? { x: touch.clientX, y: touch.clientY, time: event.timeStamp } : null;
    };
    const end = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!start || !touch) return;
      const dx = touch.clientX - start.x, dy = touch.clientY - start.y, quick = event.timeStamp - start.time < 700;
      start = null;
      if (quick && Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.8) swipe.current(dx < 0 ? 1 : -1);
    };
    const cancel = () => { start = null; };
    stage.addEventListener('touchstart', begin, { capture: true, passive: true });
    stage.addEventListener('touchend', end, { capture: true, passive: true });
    stage.addEventListener('touchcancel', cancel, { capture: true, passive: true });
    return () => { stage.removeEventListener('touchstart', begin, { capture: true }); stage.removeEventListener('touchend', end, { capture: true }); stage.removeEventListener('touchcancel', cancel, { capture: true }); };
  }, [narrow]);
  const fraction = width ? Math.max(320 / width, Math.min(1 - 320 / width, state.ratio)) : .5;
  const panelId = (id: string) => `${namespace}-panel-${encodeURIComponent(id)}`;
  const tabId = (id: string) => `${namespace}-tab-${encodeURIComponent(id)}`;
  const label = (tab: SessionTab) => directory.sessions.find(session => session.id === tab.id)?.title || tab.title;
  useEffect(() => { void ensureDirectoryFresh(); }, [ensureDirectoryFresh]);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const resize = () => setWidth(stage.clientWidth);
    const observer = new ResizeObserver(resize);
    observer.observe(stage); resize();
    return () => observer.disconnect();
  }, [ready]);

  const openSession = (session: VibeGhostSession, placement: { beside?: boolean; into?: string; detach?: boolean } = {}) => {
    if (state.tabs.length >= MAX_SESSION_TABS && !state.tabs.some(tab => tab.id === session.id)) {
      setActionNotice(`Up to ${MAX_SESSION_TABS} tabs. Close a tab before adding another session.`);
      return;
    }
    setActionNotice('');
    dispatch({ type: 'open', tab: { id: session.id, title: session.title }, ...placement });
  };
  const closeTab = (id: string) => {
    const next = sessionTabsReducer(state, { type: 'close', id });
    dispatch({ type: 'close', id });
    setActionNotice('');
    // Keep keyboard focus on the selected tab, never on a terminal after close.
    requestAnimationFrame(() => document.getElementById(next.activeId ? tabId(next.activeId) : `${namespace}-add`)?.focus());
  };
  const addSession = (id: string, placement: { beside?: boolean; into?: string; detach?: boolean } = { detach: narrow }) => { const session = directory.sessions.find(item => item.id === id); if (session) openSession(session, placement); };
  const splitIcon = <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2.5"/><path d="M8 2.75v10.5"/></svg>;
  const splitControl = !canSplit ? null : state.split
    ? <button type="button" className={styles.plus} data-active aria-label="Close split view" title="Close split view (both sessions stay open as tabs)" onClick={() => dispatch({ type: 'unsplit' })}>{splitIcon}</button>
    : <AddSessionMenu activeId={state.activeId || ''} onSelect={id => addSession(id, { beside: true })}><button type="button" className={styles.plus} aria-label="Open a session beside" title={canSplit ? 'Split view: open a session beside this one' : 'Stack a second session with this one'}>{splitIcon}</button></AddSessionMenu>;
  const addMenu = (trigger: ReactNode, placement: { side?: 'top' | 'bottom'; align?: 'start' | 'end' } = {}) => <AddSessionMenu activeId={state.activeId || ''} onSelect={addSession} {...placement}>{trigger}</AddSessionMenu>;

  if (!ready) return <div role="status" className={styles.empty}>Loading session tabs…</div>;
  return <div className={styles.root} data-session-tabs data-tabs-layout={TABS_LAYOUT} data-has-strip={state.tabs.length > 0 || undefined}>
    {state.tabs.length ? <TabStrip tabs={state.tabs} activeId={state.activeId} split={split} onUnsplit={() => dispatch({ type: 'unsplit' })} splitControl={splitControl} label={label} tabId={tabId} panelId={panelId} onSelect={id => switchTo(id)} onClose={closeTab}
      addMenu={addMenu(<button type="button" className={styles.plus} aria-label="Add session tab" title="Add a session tab"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5v13M1.5 8h13"/></svg></button>)}/> : null}
    {storageNotice || actionNotice ? <p role="status" className={styles.notice}>{actionNotice || storageNotice}</p> : null}
    {state.tabs.length > 0 && !directory.sessions.some(session => session.id === state.activeId) ? <div className={styles.notice}>{addMenu(<button type="button">Choose another session</button>, { align: 'start' })}</div> : null}
    <div ref={stageRef} className={styles.stage} data-split-view={Boolean(split)}>
      {!state.tabs.length ? <div data-tabs-placeholder className={styles.empty}><Box2 aria-hidden="true"/><h1>Your sessions, together.</h1><p>Add existing sessions as tabs. On a wider screen, split two side by side.</p>{addMenu(<button id={`${namespace}-add`} type="button" className="oathkeeper-raised-control"><Plus aria-hidden="true"/>Add a session</button>, { align: 'start' })}<small>Closing a tab never stops its session.</small></div> : null}
      {state.tabs.map(tab => {
        const side = split ? tab.id === split.left ? 'primary' : tab.id === split.right ? 'secondary' : 'hidden' : tab.id === state.activeId ? 'primary' : 'hidden';
        const target: SessionPaneTarget = {
          id: tab.id, visible: side !== 'hidden', onClose: () => closeTab(tab.id),
          // A pane's own session dropdown swaps what that pane shows.
          onSelect: id => addSession(id, narrow ? { detach: true } : { into: tab.id }),
          onNavigate: (workspace, remoteSession) => {
            if (!remoteSession) { closeTab(tab.id); return; }
            // A freshly resumed session may not be in the rendered directory yet.
            const id = workspace ? sharedSessionId(workspace, remoteSession) : remoteSession;
            const session = directory.sessions.find(item => item.id === id);
            dispatch({ type: 'replace', id: tab.id, tab: { id, title: session?.title || tab.title } });
          },
        };
        const geometry: CSSProperties = side === 'primary' && split ? { right: `${(1 - fraction) * 100}%` } : side === 'secondary' ? { left: `${fraction * 100}%` } : {};
        return <PersistentPane key={tab.id} id={panelId(tab.id)} labelledBy={tabId(tab.id)} side={side} visible={target.visible} target={target} render={renderSession} style={geometry} focused={tab.id === state.activeId} onActivate={() => dispatch({ type: 'select', id: tab.id })} motion={transition?.to === tab.id ? `enter-${transition.dir}` : transition?.from === tab.id ? `exit-${transition.dir}` : undefined}/>;
      })}
      {split ? <div role="separator" aria-label="Resize session panes" aria-orientation="vertical" aria-valuemin={Math.round(Math.max(.25, 320 / width) * 100)} aria-valuemax={Math.round(Math.min(.75, 1 - 320 / width) * 100)} aria-valuenow={Math.round(fraction * 100)} tabIndex={0} className={styles.resize} style={{ left: `${fraction * 100}%` }} onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const rect = stageRef.current!.getBoundingClientRect();
        dispatch({ type: 'ratio', value: Math.max(320 / width, Math.min(1 - 320 / width, (event.clientX - rect.left) / rect.width)) });
      }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onKeyDown={event => {
        const value = event.key === 'ArrowLeft' ? fraction - .025 : event.key === 'ArrowRight' ? fraction + .025 : event.key === 'Home' ? .25 : event.key === 'End' ? .75 : event.key === 'Enter' ? .5 : null;
        if (value !== null) { event.preventDefault(); dispatch({ type: 'ratio', value: Math.max(320 / width, Math.min(1 - 320 / width, value)) }); }
      }} onDoubleClick={() => dispatch({ type: 'ratio', value: .5 })}><span/></div> : null}
    </div>
  </div>;
}
