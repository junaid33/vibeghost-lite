/**
 * Hold-to-follow-up on a Send button, without React: a tap sends, and when follow-ups are on, holding
 * for HOLD_SEND_MS fills the button and sends as a follow-up the moment the fill completes. Leaving the
 * button, losing the pointer, blur, pagehide or a hidden page cancel a hold without sending. Shared by
 * the session composer's Send and the recording pill's Send (use-hold-send.ts wires it to a button).
 */
export const HOLD_SEND_MS = 800;
export type HoldSendVisual = { holding: boolean; filled: boolean };
export type HoldSendEnv = {
  send: (followUp: boolean) => void;
  visual: (visual: HoldSendVisual) => void;
  /** Read at each press: the button is disabled. */
  disabled: () => boolean;
  /** Read at each press: a hold sends a follow-up. */
  followUp: () => boolean;
  setTimeout?: (run: () => void, ms: number) => unknown;
  clearTimeout?: (timer: unknown) => void;
  /** The fill starts two frames after the press so its transition runs from empty. */
  frame?: (run: () => void) => unknown;
  cancelFrame?: (frame: unknown) => void;
};

export function createHoldSend(env: HoldSendEnv) {
  const later = env.setTimeout ?? ((run, ms) => globalThis.setTimeout(run, ms));
  const stopLater = env.clearTimeout ?? (timer => globalThis.clearTimeout(timer as ReturnType<typeof setTimeout>));
  const frame = env.frame ?? (run => requestAnimationFrame(run));
  const stopFrame = env.cancelFrame ?? (id => cancelAnimationFrame(id as number));
  let timer: unknown = null;
  let frameId: unknown = null;
  let pointer: number | null = null;
  let suppressClick = false;
  const clear = () => {
    if (timer !== null) stopLater(timer);
    if (frameId !== null) stopFrame(frameId);
    timer = null; frameId = null;
    env.visual({ holding: false, filled: false });
  };
  const cancel = () => {
    if (pointer === null) return;
    pointer = null; suppressClick = true; clear();
  };
  return {
    get pressed() { return pointer !== null; },
    /** A primary press. False when it is ignored (another pointer is down, or the button is disabled). */
    down(pointerId: number): boolean {
      if (pointer !== null || env.disabled()) return false;
      suppressClick = false; pointer = pointerId;
      if (!env.followUp()) return true;
      env.visual({ holding: true, filled: false });
      frameId = frame(() => { frameId = frame(() => { frameId = null; env.visual({ holding: true, filled: true }); }); });
      timer = later(() => { timer = null; suppressClick = true; clear(); env.send(true); }, HOLD_SEND_MS);
      return true;
    },
    /** The pointer moved; `inside` is whether it is still over the button. */
    move(pointerId: number, inside: boolean) { if (pointer === pointerId && !inside) cancel(); },
    /** Release: a press that did not become a follow-up is a tap, and sends. */
    up(pointerId: number) {
      if (pointer !== pointerId) return;
      pointer = null;
      const shortPress = !suppressClick && !env.disabled();
      suppressClick = true; clear();
      // WebKit may omit click after pointerdown.preventDefault(). Own release.
      if (shortPress) env.send(false);
    },
    cancel,
    /** Keyboard: Escape cancels, Alt+Enter sends a follow-up; Enter/Space fall through to click. True when handled. */
    key(key: string, altKey: boolean, repeat: boolean): boolean {
      if (key === "Escape") { cancel(); return false; }
      if (key !== "Enter" && key !== " ") return false;
      cancel(); suppressClick = false;
      if (repeat) return true;
      if (key === "Enter" && altKey && env.followUp()) { if (!env.disabled()) env.send(true); return true; }
      return false;
    },
    click() {
      if (suppressClick) { suppressClick = false; return; }
      if (!env.disabled()) env.send(false);
    },
    dispose() {
      if (timer !== null) stopLater(timer);
      if (frameId !== null) stopFrame(frameId);
      timer = null; frameId = null;
    },
  };
}
export type HoldSend = ReturnType<typeof createHoldSend>;
