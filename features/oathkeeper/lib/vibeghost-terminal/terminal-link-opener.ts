export interface TerminalLinkWindow {
  open(
    url?: string | URL,
    target?: string,
    features?: string
  ): unknown | null
}

/**
 * Open a terminal link in a separate browser context.
 *
 * With `noopener`, WebKit may return null even when it successfully opened the
 * URL. Treating that value as popup failure and navigating the current page as
 * a fallback makes an installed iOS PWA open the link both in Safari and inside
 * the PWA. The return value is therefore deliberately ignored.
 */
export function openTerminalLink(
  url: string,
  ownerWindow: TerminalLinkWindow | null | undefined
): boolean {
  if (!ownerWindow) return false

  // Match the native app: OSC 8 URLs are terminal output, not trusted code.
  // Consume unsafe links so Ghostty cannot fall back to its default activator.
  try {
    if (!["http:", "https:", "mailto:", "tel:"].includes(new URL(url).protocol)) return true
  } catch {
    return true
  }

  ownerWindow.open(url, "_blank", "noopener,noreferrer")
  return true
}
