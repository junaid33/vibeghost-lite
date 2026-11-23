export type TerminalViewportAnchor = {
  /** Absolute top row of the old viewport within the reconstructed scrollback. */
  linesFromTop: number
}

/** Capture a scrolled viewport before an authoritative terminal reset. */
export function captureTerminalViewportAnchor(options: {
  viewportY: number
  scrollbackLength: number
}): TerminalViewportAnchor | null {
  const scrollbackLength = Math.max(0, Math.floor(options.scrollbackLength))
  const viewportY = Math.max(
    0,
    Math.min(scrollbackLength, Math.floor(options.viewportY))
  )
  if (viewportY === 0) return null

  return {
    linesFromTop: Math.max(0, scrollbackLength - viewportY),
  }
}

/** Resolve the old content position against a newly reconstructed buffer. */
export function resolveTerminalViewportY(
  anchor: TerminalViewportAnchor,
  scrollbackLength: number
): number {
  const nextScrollbackLength = Math.max(0, Math.floor(scrollbackLength))
  return Math.max(
    0,
    Math.min(
      nextScrollbackLength,
      nextScrollbackLength - Math.max(0, Math.floor(anchor.linesFromTop))
    )
  )
}
