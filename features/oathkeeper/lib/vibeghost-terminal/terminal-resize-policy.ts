export type TerminalDimensions = {
  cols: number
  rows: number
}

export type TerminalViewportDimensions = {
  width: number
  height: number
}

export function resolveTerminalViewportDimensions(
  previous: TerminalViewportDimensions | null,
  next: TerminalViewportDimensions,
  isMobile: boolean,
  keyboardActive: boolean,
  keyboardOcclusion = 0,
): TerminalViewportDimensions {
  if (!isMobile || !keyboardActive) return next
  if (!previous || previous.width !== next.width) {
    return {
      width: next.width,
      height: next.height + Math.max(0, keyboardOcclusion),
    }
  }
  return {
    width: next.width,
    height: previous.height,
  }
}

export function shouldSendTerminalResize(
  lastSent: TerminalDimensions | null,
  next: TerminalDimensions,
): boolean {
  if (!lastSent) return true
  return lastSent.cols !== next.cols || lastSent.rows !== next.rows
}
