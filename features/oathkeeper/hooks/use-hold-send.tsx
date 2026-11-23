"use client";
import { useEffect, useLayoutEffect, useState, type ButtonHTMLAttributes } from "react";
import { createHoldSend, type HoldSend, type HoldSendVisual } from "../lib/hold-send";

/**
 * A Send button that sends on tap and, with `followUp`, sends a follow-up when held 0.8 s (see
 * lib/hold-send.ts). Returns the fill state and the props to spread on the button.
 */
export function useHoldSend({ disabled, followUp, onSend }: { disabled: boolean; followUp: boolean; onSend: (followUp: boolean) => void }) {
  const [visual, setVisual] = useState<HoldSendVisual>({ holding: false, filled: false });
  // One controller per button. Its callbacks read the props of the latest render, at the time of the event.
  const [{ hold, props: latest }] = useState(() => {
    const props = { disabled, followUp, onSend };
    const hold: HoldSend = createHoldSend({
      send: value => props.onSend(value),
      visual: next => setVisual(current => current.holding === next.holding && current.filled === next.filled ? current : next),
      disabled: () => props.disabled,
      followUp: () => props.followUp,
    });
    return { hold, props };
  });
  useLayoutEffect(() => { Object.assign(latest, { disabled, followUp, onSend }); });
  useEffect(() => {
    const cancel = () => hold.cancel();
    const visibility = () => { if (document.visibilityState === "hidden") cancel(); };
    window.addEventListener("blur", cancel);
    window.addEventListener("pagehide", cancel);
    document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("blur", cancel); window.removeEventListener("pagehide", cancel); document.removeEventListener("visibilitychange", visibility); hold.dispose(); };
  }, [hold]);
  useEffect(() => { if (disabled || !followUp) hold.cancel(); }, [disabled, followUp, hold]);
  const props: ButtonHTMLAttributes<HTMLButtonElement> = {
    onPointerDown: event => {
      if (!event.isPrimary || event.button !== 0 || hold.pressed) return;
      event.preventDefault(); // Keep focus where it is; suppress iOS selection/callout.
      if (hold.down(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: event => {
      const rect = event.currentTarget.getBoundingClientRect();
      hold.move(event.pointerId, event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom);
    },
    onPointerUp: event => hold.up(event.pointerId),
    onPointerCancel: () => hold.cancel(),
    onLostPointerCapture: () => hold.cancel(),
    onBlur: () => hold.cancel(),
    onContextMenu: event => event.preventDefault(),
    onKeyDown: event => { if (hold.key(event.key, event.altKey, event.repeat)) event.preventDefault(); },
    onClick: () => hold.click(),
  };
  return { ...visual, props };
}

/** The ring that fills while a Send is held. */
export function HoldSendRing({ filled, className }: { filled: boolean; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="2"/><circle cx="12" cy="12" r="9" pathLength="100" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="100" strokeDashoffset={filled ? 0 : 100} style={{ transition: filled ? "stroke-dashoffset 800ms linear" : "none" }}/></svg>;
}
