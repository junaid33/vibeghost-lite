/** Default bindings from https://herdr.dev/docs/keyboard/.
 * Explicit terminal input only; no pane discovery or agent lifecycle semantics.
 */
export const HERDR_CONTROL_GROUPS = [
  { label: "Tabs", actions: [
    { label: "New tab", key: "c" },
    { label: "Previous tab", key: "p" },
    { label: "Next tab", key: "n" },
    { label: "Rename tab", key: "T" },
    ...Array.from({ length: 9 }, (_, i) => ({ label: `Go to tab ${i + 1}`, key: String(i + 1) })),
  ] },
  { label: "Panes", actions: [
    { label: "Split right", key: "v" },
    { label: "Split down", key: "-" },
    { label: "Focus left", key: "h" },
    { label: "Focus down", key: "j" },
    { label: "Focus up", key: "k" },
    { label: "Focus right", key: "l" },
    { label: "Toggle zoom", key: "z" },
    { label: "Resize mode", key: "r" },
    { label: "Copy mode", key: "[" },
  ] },
  { label: "Workspace", actions: [
    { label: "Workspace navigation", key: "w" },
    { label: "New workspace", key: "N" },
    { label: "Rename workspace", key: "W" },
    { label: "Goto picker", key: "g" },
    { label: "Toggle sidebar", key: "b" },
    { label: "Show active keybindings", key: "?" },
    { label: "Detach (leave running)", key: "q" },
  ] },
] as const

export function encodeHerdrControl(key: string): string {
  if (!HERDR_CONTROL_GROUPS.some(group => group.actions.some(action => action.key === key))) {
    throw new Error("Unknown Herdr control")
  }
  return `\x02${key}`
}
