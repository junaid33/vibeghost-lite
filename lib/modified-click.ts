/** A click the browser should handle itself: Cmd, Ctrl, Shift or Alt, a non-primary button,
 *  a link with its own target, or one a handler already took. In-app navigation runs only on
 *  plain primary clicks, so open-in-new-tab and new-window gestures always work. */
export type ClickLike = { defaultPrevented: boolean; button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; currentTarget: unknown };

export function isModifiedClick(event: ClickLike) {
  const element = event.currentTarget as { getAttribute?: (name: string) => string | null } | null;
  const target = typeof element?.getAttribute === "function" ? element.getAttribute("target") : null;
  return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || Boolean(target && target !== "_self");
}
