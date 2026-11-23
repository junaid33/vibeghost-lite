export function shouldAutoFocusTerminal(autoFocus: boolean, isMobile: boolean) {
  return autoFocus && !isMobile
}
