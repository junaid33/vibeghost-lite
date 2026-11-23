import type { Terminal } from "ghostty-web"

type TerminalRow = { runs: { text: string; columns: number; wide: boolean }[] }

/** A bounded, plain-text view of the *rendered* viewport, never raw VT/HTML. */
export function mobileTerminalRows(terminal: Pick<Terminal, "buffer" | "rows" | "cols" | "getScrollbackLength" | "getViewportY">): TerminalRow[] {
  const first = Math.max(0, terminal.getScrollbackLength() - Math.floor(terminal.getViewportY()))
  return Array.from({ length: terminal.rows }, (_, row) => {
    const line = terminal.buffer.active.getLine(first + row)
    const runs: TerminalRow["runs"] = []
    for (let col = 0; col < Math.min(terminal.cols, line?.length ?? 0);) {
      const cell = line?.getCell(col)
      const width = Math.max(1, cell?.getWidth() ?? 1)
      col += width // skip wide continuations, but keep uninitialized blank cells
      const text = cell?.isInvisible() ? " ".repeat(width) : cell?.getChars() || " "
      const previous = runs.at(-1)
      if (width === 1 && previous && !previous.wide) {
        previous.text += text
        previous.columns++
      } else runs.push({ text, columns: width, wide: width > 1 })
    }
    // Keep interior blank cells (column alignment), but not copy-padding at EOL.
    const last = runs.at(-1)
    if (last && !last.wide) {
      const trimmed = last.text.trimEnd()
      last.columns -= last.text.length - trimmed.length
      last.text = trimmed
    }
    return { runs }
  })
}

export type MobileTerminalSelection = ReturnType<typeof mountMobileTerminalSelection>

/**
 * Canvas pixels cannot participate in Safari's native word selection. Give the
 * existing momentum scroller a transparent, non-editable DOM text plane. Only
 * the visible rows are mirrored; scrollback remains owned by Ghostty.
 *
 * A touch holds the plane still until it becomes a scroll/tap or a selection.
 * During selection only rendering is paused: VT ingestion continues normally.
 * Never replace selected nodes under the OS handles or copy menu.
 */
export function mountMobileTerminalSelection(terminal: Terminal, overlay: HTMLElement, options: {
  isActive: () => boolean
  onRelease: () => void
}) {
  const doc = overlay.ownerDocument
  const layer = doc.createElement("div")
  layer.dataset.terminalTextLayer = "true"
  layer.setAttribute("aria-label", "Terminal text")
  layer.style.cssText = "position:absolute;left:0;z-index:1;color:transparent;white-space:pre;user-select:text;-webkit-user-select:text;cursor:text;overflow:hidden;font-kerning:none;font-variant-ligatures:none;"
  const surface = terminal.element
  const previousEditable = surface?.getAttribute("contenteditable")
  // The mobile keyboard uses its own capture textarea. The canvas must not be
  // an editable/selectable replaced object on iOS; desktop behavior is untouched.
  surface?.setAttribute("contenteditable", "false")
  overlay.appendChild(layer)
  let held = false
  let selected = false
  let suspended = false
  let disposed = false
  let start: { x: number; y: number } | undefined
  let signature = ""
  let font = ""
  let cellWidth = 0
  let letterSpacing = 0
  const measure = doc.createElement("canvas").getContext("2d")
  const originalOverflow = overlay.style.overflowY

  const hasSelection = () => {
    const selection = doc.getSelection()
    return Boolean(selection && !selection.isCollapsed &&
      layer.contains(selection.anchorNode) && layer.contains(selection.focusNode))
  }
  const frozen = () => held || selected || hasSelection()

  const sync = () => {
    if (disposed || frozen() || !options.isActive() || !terminal.renderer) return
    const metrics = terminal.renderer.getMetrics()
    if (metrics.width <= 0 || metrics.height <= 0) return
    const canvas = terminal.renderer.getCanvas().getBoundingClientRect()
    const bounds = overlay.getBoundingClientRect()
    layer.style.top = `${overlay.scrollTop + canvas.top - bounds.top}px`
    layer.style.left = `${canvas.left - bounds.left}px`
    layer.style.width = `${Math.min(canvas.width, overlay.clientWidth)}px`
    layer.style.height = `${terminal.rows * metrics.height}px`
    const nextFont = `${terminal.options.fontSize}px ${terminal.options.fontFamily}`
    if ((font !== nextFont || cellWidth !== metrics.width) && measure) {
      font = nextFont
      cellWidth = metrics.width
      measure.font = font
      letterSpacing = metrics.width - measure.measureText("M").width
    }
    layer.style.font = nextFont
    layer.style.lineHeight = `${metrics.height}px`
    layer.style.letterSpacing = `${letterSpacing}px`
    const rows = mobileTerminalRows(terminal)
    const nextSignature = JSON.stringify([metrics.width, metrics.height, rows])
    if (signature === nextSignature) return
    signature = nextSignature
    const fragment = doc.createDocumentFragment()
    for (const row of rows) {
      const line = doc.createElement("div")
      line.style.height = `${metrics.height}px`
      for (const run of row.runs) {
        if (!run.text) continue
        if (!run.wide) line.append(doc.createTextNode(run.text))
        else {
          const span = doc.createElement("span")
          span.style.cssText = `display:inline-block;width:${run.columns * metrics.width}px;letter-spacing:0;`
          span.textContent = run.text
          line.append(span)
        }
      }
      if (!line.childNodes.length) line.append(doc.createElement("br"))
      fragment.append(line)
    }
    layer.replaceChildren(fragment)
  }

  const reconcile = () => {
    selected = hasSelection()
    layer.dataset.selecting = String(selected)
    // Keep the fixed canvas and DOM plane aligned while OS handles are active.
    overlay.style.overflowY = selected ? "hidden" : originalOverflow
    if (frozen()) {
      if (!suspended) { suspended = true; terminal.suspend() }
    } else if (suspended) {
      suspended = false
      if (!disposed && options.isActive()) {
        terminal.resume()
        options.onRelease()
        sync()
      }
    }
  }
  const clear = () => {
    if (hasSelection()) doc.getSelection()?.removeAllRanges()
    held = false
    start = undefined
    reconcile()
  }
  const touchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) { held = false; start = undefined; reconcile(); return }
    sync()
    const point = event.touches[0]
    start = { x: point.clientX, y: point.clientY }
    held = true
    reconcile()
  }
  const touchMove = (event: TouchEvent) => {
    const point = event.touches[0]
    if (start && point && Math.hypot(point.clientX - start.x, point.clientY - start.y) > 10 && !hasSelection()) {
      held = false
      start = undefined
      reconcile()
    }
  }
  const touchEnd = () => { held = false; start = undefined; reconcile() }
  const onScroll = () => { if (!hasSelection()) { held = false; reconcile(); sync() } }
  overlay.addEventListener("touchstart", touchStart, { passive: true, capture: true })
  overlay.addEventListener("touchmove", touchMove, { passive: true, capture: true })
  overlay.addEventListener("touchend", touchEnd, { passive: true })
  overlay.addEventListener("touchcancel", touchEnd, { passive: true })
  overlay.addEventListener("scroll", onScroll, { passive: true })
  doc.addEventListener("selectionchange", reconcile)
  const resize = terminal.onResize(clear)
  sync()

  return {
    sync, frozen, hasSelection, clear,
    dispose() {
      disposed = true
      clear()
      resize.dispose()
      overlay.removeEventListener("touchstart", touchStart, true)
      overlay.removeEventListener("touchmove", touchMove, true)
      overlay.removeEventListener("touchend", touchEnd)
      overlay.removeEventListener("touchcancel", touchEnd)
      overlay.removeEventListener("scroll", onScroll)
      doc.removeEventListener("selectionchange", reconcile)
      overlay.style.overflowY = originalOverflow
      if (surface) {
        if (previousEditable == null) surface.removeAttribute("contenteditable")
        else surface.setAttribute("contenteditable", previousEditable)
      }
      layer.remove()
    },
  }
}
