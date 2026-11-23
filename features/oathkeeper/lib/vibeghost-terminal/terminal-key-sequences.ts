/**
 * Kitty keyboard protocol encoding for Alt+Enter.
 *
 * ESC + carriage return is interpreted as Shift+Enter once the terminal enables
 * Kitty keyboard reporting. CSI 13;3u preserves Alt+Enter as Pi's follow-up key.
 */
export const KITTY_ALT_ENTER_SEQUENCE = "\x1b[13;3u"
