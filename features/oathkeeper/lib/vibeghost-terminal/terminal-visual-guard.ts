type TerminalVisualGuardOptions = {
  host: HTMLElement
  container: HTMLElement
  background: string
}

/**
 * Freeze the terminal's last painted canvases above the live renderer while an
 * authoritative reconnect replay rebuilds the WASM terminal underneath.
 */
export function createTerminalVisualGuard({
  host,
  container,
  background,
}: TerminalVisualGuardOptions): (() => void) | null {
  const sourceCanvases = Array.from(container.querySelectorAll("canvas"))
  if (sourceCanvases.length === 0) return null

  const hostRect = host.getBoundingClientRect()
  if (hostRect.width <= 0 || hostRect.height <= 0) return null

  const guard = host.ownerDocument.createElement("div")
  guard.dataset.terminalVisualGuard = "true"
  Object.assign(guard.style, {
    position: "absolute",
    inset: "0",
    zIndex: "15",
    overflow: "hidden",
    pointerEvents: "none",
    background,
  })

  let copiedCanvasCount = 0
  for (const source of sourceCanvases) {
    const sourceRect = source.getBoundingClientRect()
    if (
      source.width <= 0 ||
      source.height <= 0 ||
      sourceRect.width <= 0 ||
      sourceRect.height <= 0
    ) {
      continue
    }

    const snapshot = host.ownerDocument.createElement("canvas")
    snapshot.width = source.width
    snapshot.height = source.height
    const context = snapshot.getContext("2d")
    if (!context) continue

    try {
      context.drawImage(source, 0, 0)
    } catch {
      continue
    }

    Object.assign(snapshot.style, {
      position: "absolute",
      left: `${sourceRect.left - hostRect.left}px`,
      top: `${sourceRect.top - hostRect.top}px`,
      width: `${sourceRect.width}px`,
      height: `${sourceRect.height}px`,
    })
    guard.appendChild(snapshot)
    copiedCanvasCount += 1
  }

  if (copiedCanvasCount === 0) return null

  host.appendChild(guard)
  return () => guard.remove()
}
