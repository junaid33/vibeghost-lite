import type { Terminal } from "ghostty-web"

const TERMINAL_URL_REGEX =
  /(?:https?:\/\/|mailto:|ftp:\/\/|ssh:\/\/|git:\/\/|tel:|magnet:|gemini:\/\/|gopher:\/\/|news:)[\w\-.~:/?#@!$&*+,;=%]+/gi
const TRAILING_URL_PUNCTUATION = /[.,;!?)\]]+$/

type TerminalLine = NonNullable<
  ReturnType<Terminal["buffer"]["active"]["getLine"]>
>

function lineToCellAlignedText(line: TerminalLine) {
  let text = ""
  for (let column = 0; column < line.length; column += 1) {
    const codepoint = line.getCell(column)?.getCodepoint() ?? 0
    // Terminal URLs are ASCII. One output character per cell keeps regex
    // indices aligned with columns even when preceding cells contain emoji.
    text +=
      codepoint >= 32 && codepoint <= 126
        ? String.fromCodePoint(codepoint)
        : " "
  }
  return text
}

function getPlainUrlAtColumn(line: TerminalLine, column: number) {
  const text = lineToCellAlignedText(line)
  TERMINAL_URL_REGEX.lastIndex = 0
  for (
    let match = TERMINAL_URL_REGEX.exec(text);
    match;
    match = TERMINAL_URL_REGEX.exec(text)
  ) {
    const url = match[0].replace(TRAILING_URL_PUNCTUATION, "")
    if (url.length <= 8) continue
    const start = match.index
    const end = start + url.length - 1
    if (column >= start && column <= end) return url
  }
  return null
}

/**
 * Resolve ghostty-web's built-in links synchronously from its public renderer,
 * buffer, and WASM terminal APIs. Keeping this inside touchend preserves iOS's
 * transient user activation; ghostty-web's normal click detector is async.
 */
export function getTerminalLinkAtClientPoint(
  terminal: Terminal | null | undefined,
  clientX: number,
  clientY: number
): string | null {
  const renderer = terminal?.renderer
  const wasmTerm = terminal?.wasmTerm
  if (!terminal || !renderer || !wasmTerm) return null

  const canvas = renderer.getCanvas()
  const bounds = canvas.getBoundingClientRect()
  const metrics = renderer.getMetrics()
  if (metrics.width <= 0 || metrics.height <= 0) return null

  const column = Math.floor((clientX - bounds.left) / metrics.width)
  const viewportRow = Math.floor((clientY - bounds.top) / metrics.height)
  if (
    column < 0 ||
    viewportRow < 0 ||
    clientX >= bounds.right ||
    clientY >= bounds.bottom ||
    viewportRow >= terminal.rows
  ) {
    return null
  }

  const scrollbackLength = terminal.getScrollbackLength()
  const viewportY = Math.max(0, Math.floor(terminal.getViewportY()))
  const absoluteRow = scrollbackLength - viewportY + viewportRow
  const line = terminal.buffer.active.getLine(absoluteRow)
  if (!line || column >= line.length) return null

  const cell = line.getCell(column)
  if (!cell) return null
  if (cell.getHyperlinkId() > 0) {
    const uri =
      absoluteRow < scrollbackLength
        ? wasmTerm.getScrollbackHyperlinkUri(absoluteRow, column)
        : wasmTerm.getHyperlinkUri(absoluteRow - scrollbackLength, column)
    if (uri) return uri
  }

  return getPlainUrlAtColumn(line, column)
}
