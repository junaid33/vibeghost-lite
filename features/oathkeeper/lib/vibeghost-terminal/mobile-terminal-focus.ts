/** Call synchronously from a trusted tap/click, never from a timer or RAF. */
export function focusMobileTerminalInput(input: HTMLElement | null | undefined) {
  if (!input) return
  // iOS can leave the field focused after the user dismisses its keyboard.
  // A fresh focus transition in this same gesture brings it back.
  if (input.ownerDocument.activeElement === input) input.blur()
  input.focus({ preventScroll: true })
}
