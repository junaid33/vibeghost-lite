"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useSyncExternalStore,
} from "react"
import { Terminal, FitAddon, type ITheme } from "ghostty-web"
import mobileSelectionStyles from "./mobile-terminal-selection.module.css"
import { useTheme } from "next-themes"
import { OathkeeperMark } from "@/components/OathkeeperLogo"
import { ensureGhostty } from "@/features/oathkeeper/lib/ghostty-loader"
import type { SharedWorkspaceClient } from "@/features/oathkeeper/lib/shared-workspace-client"
import { drainPendingTerminalOutputOnce } from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-restore"
import { getWorkspaceTerminalSocketClient, type IrohTerminalSocketClient } from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-socket-client"
import { isBrowserShortcut, isCopyPasteShortcut } from "@/features/oathkeeper/lib/vibeghost-terminal/browser-shortcuts"
import { consumeEvent } from "@/features/oathkeeper/lib/vibeghost-terminal/event-utils"
import {
  TERMINAL_CLIENT_SCROLLBACK_BYTES,
  TERMINAL_RESTORE_OUTPUT_MAX_BYTES,
  TERMINAL_WRITE_FRAME_BUDGET_BYTES,
  trimUtf8ToMaxBytes,
} from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-output-limits"
import {
  findTerminalOutputOverlap,
  TerminalOutputFramer,
} from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-output-framer"
import { SafeTerminalWriteQueue } from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-write-queue"
import { TerminalRepaintHold } from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-repaint-hold"
import {
  shouldSendTerminalResize,
  type TerminalDimensions,
} from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-resize-policy"
import { shouldAutoFocusTerminal } from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-focus-policy"
import {
  TerminalBootstrapCoordinator,
  TerminalReplayContinuityError,
  enqueueTerminalReplayChunks,
} from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-bootstrap-coordinator"
import { PacedTerminalInputQueue } from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-input-queue"
import { KITTY_ALT_ENTER_SEQUENCE } from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-key-sequences"
import { openTerminalLink } from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-link-opener"
import { mountMobileTerminalSelection, type MobileTerminalSelection } from "@/features/oathkeeper/lib/vibeghost-terminal/mobile-terminal-selection"
import { focusMobileTerminalInput } from "@/features/oathkeeper/lib/vibeghost-terminal/mobile-terminal-focus"
import {
  beginMobileTerminalTap,
  finishMobileTerminalTap,
  updateMobileTerminalTap,
  type MobileTerminalTapState,
} from "@/features/oathkeeper/lib/vibeghost-terminal/mobile-terminal-tap"
import { getTerminalLinkAtClientPoint } from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-link-hit-test"
import { TerminalTouchWheel, terminalTouchWheelSequence } from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-wheel"
import {
  sameTerminalSize,
  splitTerminalSizeMarkers,
  TerminalPtySizeTracker,
  type TerminalSize,
} from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-size-markers"
import { createTerminalVisualGuard } from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-visual-guard"
import { reconcileTerminalCheckpoint } from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-checkpoint-reconcile"
import {
  captureTerminalViewportAnchor,
  resolveTerminalViewportY,
} from "@/features/oathkeeper/lib/vibeghost-terminal/terminal-viewport-restore"

const TERMINAL_DEBUG_KEY = "vibeghost:debug-terminal"

function isTerminalDebugEnabled() {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(TERMINAL_DEBUG_KEY) === "true"
  } catch {
    // Diagnostics must never prevent recovery when browser storage is blocked.
    return false
  }
}

function logTerminalDebug(
  sessionId: string,
  event: string,
  details?: Record<string, unknown>
) {
  if (!isTerminalDebugEnabled()) return
  console.debug(`[GhosttyTerminal:${sessionId}] ${event}`, details ?? {})
}

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false
  // Keep this in lock-step with the CSS breakpoint that reveals AgentInput's
  // mobile toolbar (`md:hidden`). A narrow desktop browser still shows that toolbar,
  // so the terminal must also expose the mobile capture textarea/scroll overlay path.
  return window.matchMedia("(max-width: 767px), (pointer: coarse)").matches
}

function subscribeMobileDevice(callback: () => void) {
  const mobileLayoutQuery = window.matchMedia(
    "(max-width: 767px), (pointer: coarse)"
  )
  mobileLayoutQuery.addEventListener("change", callback)
  window.addEventListener("resize", callback)
  return () => {
    mobileLayoutQuery.removeEventListener("change", callback)
    window.removeEventListener("resize", callback)
  }
}

function getMobileDeviceSnapshot() {
  return isMobileDevice()
}

function getServerMobileDeviceSnapshot() {
  return false
}

function useMobileDevice() {
  return useSyncExternalStore(
    subscribeMobileDevice,
    getMobileDeviceSnapshot,
    getServerMobileDeviceSnapshot
  )
}

type RgbColor = { r: number; g: number; b: number }
type LabColor = { l: number; a: number; b: number }
type ReportableThemeColors = {
  foreground?: string
  background?: string
  cursor?: string
  palette: string[]
}

type TerminalColorCompatState = {
  activeBackground: RgbColor | null
  foregroundIsDefault: boolean
  injectedForegroundActive: boolean
}

function parseThemeColor(color?: string): RgbColor | null {
  if (!color) return null
  const normalized = color.trim()

  if (normalized.startsWith("#")) {
    const hex = normalized.slice(1)
    if (hex.length === 3) {
      return {
        r: Number.parseInt(hex[0].repeat(2), 16),
        g: Number.parseInt(hex[1].repeat(2), 16),
        b: Number.parseInt(hex[2].repeat(2), 16),
      }
    }
    if (hex.length === 6) {
      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16),
      }
    }
  }

  const rgbMatch = normalized.match(
    /^rgb\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)$/i
  )
  if (!rgbMatch) return null

  const clamp = (value: string) =>
    Math.max(0, Math.min(255, Math.round(Number.parseFloat(value))))
  return {
    r: clamp(rgbMatch[1] ?? "0"),
    g: clamp(rgbMatch[2] ?? "0"),
    b: clamp(rgbMatch[3] ?? "0"),
  }
}

function rgbToHex(color: RgbColor): string {
  const toHex2 = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0")
  return `#${toHex2(color.r)}${toHex2(color.g)}${toHex2(color.b)}`
}

function formatOscColor(color: string): string {
  const parsed = parseThemeColor(color)
  if (!parsed) return color.trim()

  const toHex2 = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0")
  const r = toHex2(parsed.r)
  const g = toHex2(parsed.g)
  const b = toHex2(parsed.b)
  return `rgb:${r}${r}/${g}${g}/${b}${b}`
}

function labFromRgb(rgb: RgbColor): LabColor {
  let r = rgb.r / 255
  let g = rgb.g / 255
  let b = rgb.b / 255

  r = r > 0.04045 ? ((r + 0.055) / 1.055) ** 2.4 : r / 12.92
  g = g > 0.04045 ? ((g + 0.055) / 1.055) ** 2.4 : g / 12.92
  b = b > 0.04045 ? ((b + 0.055) / 1.055) ** 2.4 : b / 12.92

  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047
  let y = r * 0.2126729 + g * 0.7151522 + b * 0.072175
  let z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883

  x = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116
  y = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116
  z = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116

  return {
    l: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  }
}

function rgbFromLab(lab: LabColor): RgbColor {
  const y = (lab.l + 16) / 116
  const x = lab.a / 500 + y
  const z = y - lab.b / 200

  const x3 = x * x * x
  const y3 = y * y * y
  const z3 = z * z * z

  const xf = (x3 > 0.008856 ? x3 : (x - 16 / 116) / 7.787) * 0.95047
  const yf = y3 > 0.008856 ? y3 : (y - 16 / 116) / 7.787
  const zf = (z3 > 0.008856 ? z3 : (z - 16 / 116) / 7.787) * 1.08883

  let r = xf * 3.2404542 - yf * 1.5371385 - zf * 0.4985314
  let g = -xf * 0.969266 + yf * 1.8760108 + zf * 0.041556
  let b = xf * 0.0556434 - yf * 0.2040259 + zf * 1.0572252

  r = r > 0.0031308 ? 1.055 * r ** (1 / 2.4) - 0.055 : 12.92 * r
  g = g > 0.0031308 ? 1.055 * g ** (1 / 2.4) - 0.055 : 12.92 * g
  b = b > 0.0031308 ? 1.055 * b ** (1 / 2.4) - 0.055 : 12.92 * b

  const clamp = (value: number) =>
    Math.max(
      0,
      Math.min(255, Math.round(Math.max(0, Math.min(1, value)) * 255))
    )
  return { r: clamp(r), g: clamp(g), b: clamp(b) }
}

function lerpLab(t: number, start: LabColor, end: LabColor): LabColor {
  return {
    l: start.l + t * (end.l - start.l),
    a: start.a + t * (end.a - start.a),
    b: start.b + t * (end.b - start.b),
  }
}

function getRelativeLuminance(color: RgbColor): number {
  const channel = (value: number) => {
    const normalized = value / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }

  const r = channel(color.r)
  const g = channel(color.g)
  const b = channel(color.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function getContrastRatio(a: RgbColor, b: RgbColor): number {
  const l1 = getRelativeLuminance(a)
  const l2 = getRelativeLuminance(b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function shouldUseFallbackForeground(
  background: RgbColor | null,
  foreground: RgbColor
): boolean {
  return !!background && getContrastRatio(background, foreground) < 4.5
}

function getReportableThemeColors(theme: ITheme): ReportableThemeColors {
  const basePalette = [
    theme.black ?? "#000000",
    theme.red ?? "#cd3131",
    theme.green ?? "#0dbc79",
    theme.yellow ?? "#e5e510",
    theme.blue ?? "#2472c8",
    theme.magenta ?? "#bc3fbc",
    theme.cyan ?? "#11a8cd",
    theme.white ?? "#e5e5e5",
    theme.brightBlack ?? "#666666",
    theme.brightRed ?? "#f14c4c",
    theme.brightGreen ?? "#23d18b",
    theme.brightYellow ?? "#f5f543",
    theme.brightBlue ?? "#3b8eea",
    theme.brightMagenta ?? "#d670d6",
    theme.brightCyan ?? "#29b8db",
    theme.brightWhite ?? "#ffffff",
  ]

  const bg = parseThemeColor(theme.background)
  const fg = parseThemeColor(theme.foreground)
  const baseRgb = basePalette.map(parseThemeColor)

  if (!bg || !fg || baseRgb.some((color) => color === null)) {
    return {
      foreground: theme.foreground,
      background: theme.background,
      cursor: theme.cursor,
      palette: basePalette,
    }
  }

  const resolvedBase = baseRgb as RgbColor[]
  const palette256 = new Array<string>(256)

  for (let index = 0; index < 16; index += 1) {
    palette256[index] = basePalette[index]
  }

  let base8Lab: [
    LabColor,
    LabColor,
    LabColor,
    LabColor,
    LabColor,
    LabColor,
    LabColor,
    LabColor,
  ] = [
    labFromRgb(bg),
    labFromRgb(resolvedBase[1]),
    labFromRgb(resolvedBase[2]),
    labFromRgb(resolvedBase[3]),
    labFromRgb(resolvedBase[4]),
    labFromRgb(resolvedBase[5]),
    labFromRgb(resolvedBase[6]),
    labFromRgb(fg),
  ]

  const isLightTheme = base8Lab[7].l < base8Lab[0].l
  if (isLightTheme) {
    base8Lab = [
      base8Lab[7],
      base8Lab[1],
      base8Lab[2],
      base8Lab[3],
      base8Lab[4],
      base8Lab[5],
      base8Lab[6],
      base8Lab[0],
    ]
  }

  let paletteIndex = 16
  for (let ri = 0; ri < 6; ri += 1) {
    const tr = ri / 5
    const c0 = lerpLab(tr, base8Lab[0], base8Lab[1])
    const c1 = lerpLab(tr, base8Lab[2], base8Lab[3])
    const c2 = lerpLab(tr, base8Lab[4], base8Lab[5])
    const c3 = lerpLab(tr, base8Lab[6], base8Lab[7])

    for (let gi = 0; gi < 6; gi += 1) {
      const tg = gi / 5
      const c4 = lerpLab(tg, c0, c1)
      const c5 = lerpLab(tg, c2, c3)

      for (let bi = 0; bi < 6; bi += 1) {
        const c6 = lerpLab(bi / 5, c4, c5)
        palette256[paletteIndex] = rgbToHex(rgbFromLab(c6))
        paletteIndex += 1
      }
    }
  }

  const bgLab = base8Lab[0]
  const fgLab = base8Lab[7]
  for (let index = 0; index < 24; index += 1) {
    const t = (index + 1) / 25
    palette256[paletteIndex] = rgbToHex(rgbFromLab(lerpLab(t, bgLab, fgLab)))
    paletteIndex += 1
  }

  return {
    foreground: theme.foreground,
    background: theme.background,
    cursor: theme.cursor,
    palette: palette256,
  }
}

function stripAndRespondToThemeQueries(
  sessionId: string,
  bytes: Uint8Array,
  colors: ReportableThemeColors,
  respond: boolean,
  terminalSocketClient: IrohTerminalSocketClient
): Uint8Array {
  if (!bytes.includes(0x1b)) return bytes

  let handled = false
  let changed = false
  let text = new TextDecoder().decode(bytes)

  text = text.replace(
    /\x1b\](10|11|12);\?(?:\x07|\x1b\\)/g,
    (_match, code: string) => {
      const color =
        code === "10"
          ? colors.foreground
          : code === "11"
            ? colors.background
            : colors.cursor
      if (!color) return _match

      if (respond) {
        terminalSocketClient.sendInputText(
          sessionId,
          `\x1b]${code};${formatOscColor(color)}\x07`
        )
        handled = true
      }
      changed = true
      return ""
    }
  )

  text = text.replace(
    /\x1b\]4;([^\x07\x1b]*)(?:\x07|\x1b\\)/g,
    (match, body: string) => {
      const parts = body.split(";")
      let queryHandled = false

      for (let index = 0; index + 1 < parts.length; index += 2) {
        const paletteIndex = Number.parseInt(parts[index] ?? "", 10)
        const command = parts[index + 1]
        if (
          command !== "?" ||
          !Number.isInteger(paletteIndex) ||
          paletteIndex < 0 ||
          paletteIndex >= colors.palette.length
        ) {
          continue
        }

        const color = colors.palette[paletteIndex]
        if (!color) continue

        if (respond) {
          terminalSocketClient.sendInputText(
            sessionId,
            `\x1b]4;${paletteIndex};${formatOscColor(color)}\x07`
          )
          handled = true
        }
        changed = true
        queryHandled = true
      }

      return queryHandled ? "" : match
    }
  )

  return handled || changed ? new TextEncoder().encode(text) : bytes
}

function applyTerminalColorCompatibility(
  bytes: Uint8Array,
  state: TerminalColorCompatState,
  options: {
    enabled: boolean
    defaultForeground: string
    fallbackForeground: string
    palette: string[]
  }
): Uint8Array {
  if (!options.enabled || (!bytes.includes(0x1b) && !state.activeBackground))
    return bytes

  const defaultForeground = parseThemeColor(options.defaultForeground)
  const fallbackForeground = parseThemeColor(options.fallbackForeground)
  if (!defaultForeground || !fallbackForeground) return bytes

  const text = new TextDecoder().decode(bytes)
  const sgrPattern = /\x1b\[([0-9;]*)m/g
  let rewritten = ""
  let lastIndex = 0
  let changed = false
  let activeBackground = state.activeBackground
  let foregroundIsDefault = state.foregroundIsDefault
  let injectedForegroundActive = state.injectedForegroundActive

  const fallbackSequence = `\x1b[38;2;${fallbackForeground.r};${fallbackForeground.g};${fallbackForeground.b}m`
  const shouldInjectFallback = () =>
    foregroundIsDefault &&
    shouldUseFallbackForeground(activeBackground, defaultForeground)

  const setBackgroundFromPaletteIndex = (paletteIndex: number) => {
    activeBackground = parseThemeColor(options.palette[paletteIndex])
  }

  const appendFallbackIfNeeded = () => {
    if (shouldInjectFallback() && !injectedForegroundActive) {
      rewritten += fallbackSequence
      injectedForegroundActive = true
      changed = true
    } else if (
      (!shouldInjectFallback() || !foregroundIsDefault) &&
      injectedForegroundActive
    ) {
      rewritten += "\x1b[39m"
      injectedForegroundActive = false
      changed = true
    }
  }

  appendFallbackIfNeeded()

  for (const match of text.matchAll(sgrPattern)) {
    const fullMatch = match[0]
    const paramsText = match[1] ?? ""
    const matchIndex = match.index ?? 0

    rewritten += text.slice(lastIndex, matchIndex)

    const rawParams = paramsText.length > 0 ? paramsText.split(";") : ["0"]
    const outputParams: string[] = []
    let sawExplicitForeground = false
    let backgroundTouched = false

    for (let index = 0; index < rawParams.length; index += 1) {
      const raw = rawParams[index] === "" ? "0" : rawParams[index]!
      const value = Number.parseInt(raw, 10)
      if (!Number.isFinite(value)) {
        outputParams.push(raw)
        continue
      }

      if (value === 0) {
        activeBackground = null
        foregroundIsDefault = true
        injectedForegroundActive = false
        outputParams.push("0")
        continue
      }

      if (value === 39) {
        foregroundIsDefault = true
        if (shouldUseFallbackForeground(activeBackground, defaultForeground)) {
          outputParams.push(
            "38",
            "2",
            String(fallbackForeground.r),
            String(fallbackForeground.g),
            String(fallbackForeground.b)
          )
          injectedForegroundActive = true
          changed = true
        } else {
          outputParams.push("39")
          injectedForegroundActive = false
        }
        continue
      }

      if (value === 49) {
        activeBackground = null
        backgroundTouched = true
        outputParams.push("49")
        continue
      }

      if (value === 48) {
        const mode = Number.parseInt(rawParams[index + 1] ?? "", 10)
        if (mode === 2 && index + 4 < rawParams.length) {
          const r = Number.parseInt(rawParams[index + 2] ?? "0", 10)
          const g = Number.parseInt(rawParams[index + 3] ?? "0", 10)
          const b = Number.parseInt(rawParams[index + 4] ?? "0", 10)
          activeBackground = { r, g, b }
          backgroundTouched = true
          outputParams.push("48", "2", String(r), String(g), String(b))
          index += 4
          continue
        }

        if (mode === 5 && index + 2 < rawParams.length) {
          const paletteIndex = Number.parseInt(rawParams[index + 2] ?? "-1", 10)
          if (paletteIndex >= 0 && paletteIndex < options.palette.length) {
            setBackgroundFromPaletteIndex(paletteIndex)
          } else {
            activeBackground = null
          }
          backgroundTouched = true
          outputParams.push("48", "5", String(paletteIndex))
          index += 2
          continue
        }

        outputParams.push(raw)
        continue
      }

      if (value === 38) {
        const mode = Number.parseInt(rawParams[index + 1] ?? "", 10)
        foregroundIsDefault = false
        sawExplicitForeground = true
        injectedForegroundActive = false
        if (mode === 2 && index + 4 < rawParams.length) {
          outputParams.push(
            "38",
            "2",
            rawParams[index + 2] ?? "0",
            rawParams[index + 3] ?? "0",
            rawParams[index + 4] ?? "0"
          )
          index += 4
          continue
        }

        if (mode === 5 && index + 2 < rawParams.length) {
          outputParams.push("38", "5", rawParams[index + 2] ?? "0")
          index += 2
          continue
        }

        outputParams.push(raw)
        continue
      }

      if (value >= 30 && value <= 37) {
        foregroundIsDefault = false
        sawExplicitForeground = true
        injectedForegroundActive = false
        outputParams.push(String(value))
        continue
      }

      if (value >= 90 && value <= 97) {
        foregroundIsDefault = false
        sawExplicitForeground = true
        injectedForegroundActive = false
        outputParams.push(String(value))
        continue
      }

      if (value >= 40 && value <= 47) {
        setBackgroundFromPaletteIndex(value - 40)
        backgroundTouched = true
        outputParams.push(String(value))
        continue
      }

      if (value >= 100 && value <= 107) {
        setBackgroundFromPaletteIndex(value - 92)
        backgroundTouched = true
        outputParams.push(String(value))
        continue
      }

      outputParams.push(String(value))
    }

    let rebuilt = `\x1b[${outputParams.join(";")}m`
    if (
      backgroundTouched &&
      shouldInjectFallback() &&
      !sawExplicitForeground &&
      !injectedForegroundActive
    ) {
      rebuilt += fallbackSequence
      injectedForegroundActive = true
      changed = true
    } else if (
      backgroundTouched &&
      (!shouldInjectFallback() || !foregroundIsDefault) &&
      injectedForegroundActive
    ) {
      rebuilt += "\x1b[39m"
      injectedForegroundActive = false
      changed = true
    }

    rewritten += rebuilt
    if (rebuilt !== fullMatch) {
      changed = true
    }
    lastIndex = matchIndex + fullMatch.length
  }

  rewritten += text.slice(lastIndex)

  state.activeBackground = activeBackground
  state.foregroundIsDefault = foregroundIsDefault
  state.injectedForegroundActive = injectedForegroundActive

  return changed ? new TextEncoder().encode(rewritten) : bytes
}

type TerminalAppearance = {
  theme: ITheme
  overlay: string
  surfaceBackground: string
}

function createLightTerminalAppearance(theme: ITheme): TerminalAppearance {
  return {
    theme,
    overlay: theme.background ?? "#fafaff",
    surfaceBackground: theme.background ?? "#f7f8fa",
  }
}

const LIGHT_TERMINAL_THEME = createLightTerminalAppearance({
  // Cool slate paper theme aligned with the app's neutral light UI.
  background: "#f7f8fa",
  foreground: "#242832",
  cursor: "#242832",
  cursorAccent: "#f7f8fa",
  selectionBackground: "#dbe4ef",
  selectionForeground: "#1f2937",
  black: "#242832",
  red: "#b84b55",
  green: "#557a45",
  yellow: "#7a661f",
  blue: "#426a9f",
  magenta: "#8b5c91",
  cyan: "#4f7f86",
  white: "#5f6673",
  brightBlack: "#7a808a",
  brightRed: "#c65a61",
  brightGreen: "#658a54",
  brightYellow: "#8a742a",
  brightBlue: "#5c83b6",
  brightMagenta: "#765b93",
  brightCyan: "#5c8b91",
  brightWhite: "#3f4652",
})

const MOBILE_SCROLLBAR_RIGHT_INSET = 0
const MOBILE_GHOSTTY_SCROLLBAR_RESERVATION = 15
// Bootstrap replay can be multi-MB for long agent transcripts. Live output keeps
// the smaller frame budget, but restore needs a larger per-frame budget or it
// spends hundreds of animation frames replaying history.
const TERMINAL_BOOTSTRAP_WRITE_FRAME_BUDGET_BYTES = 256 * 1024
const TERMINAL_REPAINT_FRAME_TIME_BUDGET_MS = 8
const RESTORE_SETTLE_WINDOW_MS = 120
const RESTORE_SETTLE_MAX_MS = 500
const HYDRATION_INDICATOR_DELAY_MS = 180

function getResponsiveTerminalFontSize(): number {
  if (typeof window === "undefined") return 12
  const width = window.innerWidth
  if (width < 640) return 10
  if (width < 1024) return 11
  return 12
}

function subscribeResponsiveTerminalFontSize(onStoreChange: () => void) {
  window.addEventListener("resize", onStoreChange)
  return () => window.removeEventListener("resize", onStoreChange)
}

function getServerTerminalFontSize() {
  return 12
}

// Adaptive paste configuration to prevent shell/server crashes
const PASTE_CONFIG = {
  BRACKETED: {
    CHUNK_SIZE: 1024,
    DELAY: 15, // ms
  },
  SAFE: {
    CHUNK_SIZE: 128,
    DELAY: 30, // ms
  },
  THRESHOLD: 128, // Text longer than this is throttled
}

interface GhosttyTerminalProps {
  client: SharedWorkspaceClient
  sessionId: string
  className?: string
  active?: boolean
  onConnectionStatusChange?: (
    status: "connecting" | "connected" | "disconnected"
  ) => void
  onUploadFiles?: (files: FileList) => void
  onUrlDetected?: (url: string) => void
  autoFocus?: boolean
  mobileInputId?: string
  onScroll?: (viewportY: number) => void
}

export interface GhosttyTerminalHandle {
  sendInput: (text: string, isExplicitPaste?: boolean) => void
  scrollToBottom: () => void
  scrollLines: (direction: "up" | "down") => void
  fitTerminal: () => void
  focus: () => void
}

export const GhosttyTerminal = forwardRef<
  GhosttyTerminalHandle,
  GhosttyTerminalProps
>(function GhosttyTerminal(
  {
    client,
    sessionId,
    className,
    active = true,
    onConnectionStatusChange,
    onUploadFiles,
    onUrlDetected,
    autoFocus = true,
    mobileInputId,
    onScroll,
  },
  ref
) {
  const hostRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const mobileSelectionRef = useRef<MobileTerminalSelection | null>(null)
  const mobileSelectionSyncRef = useRef<() => void>(() => {})
  const termRef = useRef<Terminal | null>(null)
  const followOutputRef = useRef(true)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const { resolvedTheme } = useTheme()
  const terminalSocketClient = useMemo(() => getWorkspaceTerminalSocketClient(client), [client])
  const terminalColorScheme = resolvedTheme === "light" ? "light" : "dark"
  const encoder = useMemo(() => new TextEncoder(), [])
  const terminalTheme = useMemo(() => {
    if (terminalColorScheme === "light") {
      return LIGHT_TERMINAL_THEME
    }

    return {
      theme: {
        background: "#08090a",
        foreground: "#e8eaee",
        cursor: "#e8eaee",
        cursorAccent: "#08090a",
        selectionBackground: "rgba(96, 165, 250, 0.28)",
        selectionForeground: "#f8fafc",
        black: "#1d2028",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#fbbf24",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#e4e4e7",
        brightBlack: "#71717a",
        brightRed: "#fca5a5",
        brightGreen: "#86efac",
        brightYellow: "#fcd34d",
        brightBlue: "#93c5fd",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#fafafa",
      },
      overlay: "#08090a",
      surfaceBackground: "#08090a",
    }
  }, [terminalColorScheme])
  const terminalReportColors = useMemo(
    () => getReportableThemeColors(terminalTheme.theme),
    [terminalTheme]
  )
  const colorCompatStateRef = useRef<TerminalColorCompatState>({
    activeBackground: null,
    foregroundIsDefault: true,
    injectedForegroundActive: false,
  })
  const sessionEpochRef = useRef(0)
  const lastEscapeTimeRef = useRef(0)
  const currentSessionIdRef = useRef(sessionId)
  const isMobile = useMobileDevice()
  const autoFocusRef = useRef(autoFocus)
  const activeRef = useRef(active)
  const resizeActiveRef = useRef<(() => void) | null>(null)
  const isMobileRef = useRef(isMobile)
  const onUrlDetectedRef = useRef(onUrlDetected)
  const onUploadFilesRef = useRef(onUploadFiles)
  const onScrollRef = useRef(onScroll)
  const resolvedThemeRef = useRef(resolvedTheme)
  const terminalThemeRef = useRef(terminalTheme)
  const terminalReportColorsRef = useRef(terminalReportColors)
  const lastReplayedThemeRef = useRef(resolvedTheme)
  const themeReplayRef = useRef<(() => void) | null>(null)
  const pacedInputQueueRef = useRef<PacedTerminalInputQueue | null>(null)
  const lastPasteRef = useRef<{ text: string; ts: number } | null>(null)
  const hydrationIndicatorTimerRef = useRef<number | null>(null)

  const [showHydrationIndicator, setShowHydrationIndicator] = useState(false)
  const terminalFontSize = useSyncExternalStore(
    subscribeResponsiveTerminalFontSize,
    getResponsiveTerminalFontSize,
    getServerTerminalFontSize
  )
  const terminalFontSizeRef = useRef(terminalFontSize)
  const mobileScrollRowHeight = useMemo(
    () => Math.max(16, Math.round(terminalFontSize * 1.45)),
    [terminalFontSize]
  )

  const hideHydrationIndicator = useCallback(() => {
    if (hydrationIndicatorTimerRef.current !== null) {
      window.clearTimeout(hydrationIndicatorTimerRef.current)
      hydrationIndicatorTimerRef.current = null
    }
    setShowHydrationIndicator(false)
  }, [])

  useLayoutEffect(() => {
    autoFocusRef.current = autoFocus
    activeRef.current = active
    isMobileRef.current = isMobile
    onUrlDetectedRef.current = onUrlDetected
    onUploadFilesRef.current = onUploadFiles
    onScrollRef.current = onScroll
    terminalFontSizeRef.current = terminalFontSize
  }, [
    active,
    autoFocus,
    isMobile,
    onScroll,
    onUploadFiles,
    onUrlDetected,
    terminalFontSize,
  ])

  useLayoutEffect(() => {
    currentSessionIdRef.current = sessionId
    colorCompatStateRef.current.activeBackground = null
    colorCompatStateRef.current.foregroundIsDefault = true
    colorCompatStateRef.current.injectedForegroundActive = false
  }, [sessionId])

  useLayoutEffect(() => {
    resolvedThemeRef.current = resolvedTheme
    terminalThemeRef.current = terminalTheme
    terminalReportColorsRef.current = terminalReportColors
    colorCompatStateRef.current.activeBackground = null
    colorCompatStateRef.current.foregroundIsDefault = true
    colorCompatStateRef.current.injectedForegroundActive = false

    const terminal = termRef.current as {
      options?: { theme?: ITheme }
      renderer?: {
        setTheme?: (theme: ITheme) => void
        render?: (
          wasmTerm: unknown,
          fullRefresh?: boolean,
          viewportY?: number,
          terminal?: unknown,
          scrollbarOpacity?: number
        ) => void
      }
      wasmTerm?: unknown
      scrollbarOpacity?: number
      getViewportY: () => number
    } | null

    if (!terminal) return

    if (terminal.options) {
      terminal.options.theme = terminalTheme.theme
    }

    terminal.renderer?.setTheme?.(terminalTheme.theme)
    if (!terminal.wasmTerm || !activeRef.current) return

    requestAnimationFrame(() => {
      terminal.renderer?.render?.(
        terminal.wasmTerm,
        true,
        terminal.getViewportY(),
        terminal,
        terminal.scrollbarOpacity
      )
    })
  }, [resolvedTheme, terminalTheme, terminalReportColors])

  useEffect(() => {
    if (lastReplayedThemeRef.current === resolvedTheme) return
    lastReplayedThemeRef.current = resolvedTheme
    // Use the same serialized restore path as reconnect/navigation. Resetting and
    // writing the WASM terminal directly here can interleave with its live queue.
    themeReplayRef.current?.()
  }, [resolvedTheme])

  const mobileScrollSyncRef = useRef(false)
  const mobileTapStateRef = useRef<MobileTerminalTapState | null>(null)
  const mobileTouchWheelRef = useRef(new TerminalTouchWheel())
  const suppressMobileClickUntilRef = useRef(0)
  const mobileOverlayInteractionRef = useRef<{
    active: boolean
    timeoutId: number | null
  }>({ active: false, timeoutId: null })
  const mobileMetricsRef = useRef({
    rowHeight: mobileScrollRowHeight,
    totalRows: 0,
    viewportRows: 0,
    maxViewportY: 0,
  })

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)

  const markMobileOverlayInteraction = useCallback(() => {
    if (!isMobile) return
    const state = mobileOverlayInteractionRef.current
    state.active = true
    if (state.timeoutId !== null) {
      window.clearTimeout(state.timeoutId)
    }
    state.timeoutId = window.setTimeout(() => {
      state.active = false
      state.timeoutId = null
    }, 160)
  }, [isMobile])

  const syncMobileOverlayFromTerminal = useCallback(() => {
    if (!isMobile || !activeRef.current || mobileSelectionRef.current?.frozen()) return
    const overlay = overlayRef.current
    const terminal = termRef.current
    if (!overlay || !terminal) return
    mobileSelectionRef.current ??= mountMobileTerminalSelection(terminal, overlay, {
      isActive: () => activeRef.current,
      onRelease: () => mobileSelectionSyncRef.current(),
    })

    const scrollback = terminal.getScrollbackLength()
    const viewportRows = terminal.rows || 0
    const totalRows = scrollback + viewportRows
    const maxViewportY = scrollback
    const rowHeight = mobileScrollRowHeight
    const contentHeight = Math.max(
      overlay.clientHeight + 1,
      totalRows * rowHeight
    )
    const clampedViewportY = Math.max(
      0,
      Math.min(maxViewportY, terminal.getViewportY())
    )
    // Overlay uses normal DOM scroll semantics: top = oldest content, bottom = newest content.
    // Ghostty uses the inverse viewport model: 0 = bottom, maxViewportY = top.
    const targetScrollTop = (maxViewportY - clampedViewportY) * rowHeight

    mobileMetricsRef.current = {
      rowHeight,
      totalRows,
      viewportRows,
      maxViewportY,
    }

    const spacer = overlay.firstElementChild as HTMLDivElement | null
    if (spacer) {
      spacer.style.height = `${contentHeight}px`
    }

    // Do not fight native iOS momentum / scrollbar dragging while the user is actively
    // interacting with the overlay. Let the overlay lead, and the terminal follow.
    if (mobileOverlayInteractionRef.current.active) {
      mobileSelectionRef.current?.sync()
      return
    }

    if (Math.abs(overlay.scrollTop - targetScrollTop) > 1) {
      mobileScrollSyncRef.current = true
      overlay.scrollTop = targetScrollTop
      requestAnimationFrame(() => {
        mobileScrollSyncRef.current = false
      })
    }
    mobileSelectionRef.current?.sync()
  }, [isMobile, mobileScrollRowHeight])

  useLayoutEffect(() => {
    mobileSelectionSyncRef.current = syncMobileOverlayFromTerminal
    if (isMobile) syncMobileOverlayFromTerminal()
    else if (mobileSelectionRef.current) {
      mobileSelectionRef.current.dispose()
      mobileSelectionRef.current = null
      if (activeRef.current) termRef.current?.resume()
    }
  }, [isMobile, syncMobileOverlayFromTerminal])

  // Chat overlays keep this component mounted so terminal state and transport stay
  // warm. Suspend only ghostty's renderer while covered; live VT writes still update
  // the WASM buffer and one full render is requested by resume().
  useLayoutEffect(() => {
    const terminal = termRef.current
    activeRef.current = active
    if (!terminal) return

    if (active) {
      terminal.resume()
      requestAnimationFrame(() => {
        if (!activeRef.current) return
        fitAddonRef.current?.fit()
        resizeActiveRef.current?.()
        syncMobileOverlayFromTerminal()
      })
    } else {
      mobileSelectionRef.current?.clear()
      terminal.blur()
      terminal.suspend()
    }
  }, [active, syncMobileOverlayFromTerminal])

  useEffect(() => {
    const terminal = termRef.current as {
      options?: { fontSize?: number; smoothScrollDuration?: number }
    } | null

    if (!terminal?.options) return
    if (terminal.options.fontSize === terminalFontSize) return

    terminal.options.fontSize = terminalFontSize
    requestAnimationFrame(() => {
      fitAddonRef.current?.fit()
      syncMobileOverlayFromTerminal()
    })
  }, [terminalFontSize, syncMobileOverlayFromTerminal])

  const handleOverlayScroll = useCallback(() => {
    if (!isMobile || mobileScrollSyncRef.current) return
    const overlay = overlayRef.current
    const terminal = termRef.current
    if (!overlay || !terminal) return

    if (mobileTapStateRef.current) {
      mobileTapStateRef.current = {
        ...mobileTapStateRef.current,
        moved: true,
      }
    }
    markMobileOverlayInteraction()

    const { rowHeight, maxViewportY } = mobileMetricsRef.current
    const distanceFromBottom = Math.max(
      0,
      Math.min(maxViewportY, Math.round(overlay.scrollTop / rowHeight))
    )
    const viewportY = Math.max(
      0,
      Math.min(maxViewportY, maxViewportY - distanceFromBottom)
    )
    terminal.options.smoothScrollDuration = 0
    terminal.scrollToLine(viewportY)
    followOutputRef.current = viewportY === 0
  }, [isMobile, markMobileOverlayInteraction])

  useEffect(() => {
    const queue = new PacedTerminalInputQueue({
      sendText: (targetSessionId, value) =>
        terminalSocketClient.sendInputText(targetSessionId, value),
      isConnected: () => terminalSocketClient.getConnectionStatus(),
      generation: () => terminalSocketClient.getTransportGeneration(),
    })
    pacedInputQueueRef.current = queue
    return () => {
      if (pacedInputQueueRef.current === queue)
        pacedInputQueueRef.current = null
      queue.dispose()
    }
  }, [sessionId, terminalSocketClient])

  const sendInput = useCallback(
    (text: string, isExplicitPaste = false) => {
      if (!text) return

      const now = Date.now()
      const prev = lastPasteRef.current
      if (
        isExplicitPaste &&
        text.length > 50 &&
        prev &&
        prev.text === text &&
        now - prev.ts < 750
      ) {
        return
      }
      if (isExplicitPaste) lastPasteRef.current = { text, ts: now }

      if (text.length <= PASTE_CONFIG.THRESHOLD && !isExplicitPaste) {
        terminalSocketClient.sendInputText(sessionId, text)
        return
      }

      const config = isExplicitPaste
        ? PASTE_CONFIG.BRACKETED
        : PASTE_CONFIG.SAFE
      void pacedInputQueueRef.current
        ?.enqueue(sessionId, text, {
          bracketed: isExplicitPaste,
          chunkBytes: config.CHUNK_SIZE,
          delayMs: config.DELAY,
        })
        .catch((err) => {
          console.warn("[GhosttyTerminal] sendInput queue error", err)
        })
    },
    [sessionId, terminalSocketClient]
  )

  const sendInputKey = useCallback(
    (key: string) => {
      terminalSocketClient.sendInputKey(sessionId, key)
    },
    [sessionId, terminalSocketClient]
  )

  const scrollLines = useCallback(
    (direction: "up" | "down") => {
      const terminal = termRef.current
      if (!terminal) return
      terminal.options.smoothScrollDuration = 0
      const lines = direction === "up" ? -5 : 5
      terminal.scrollLines(lines)
      followOutputRef.current = terminal.getViewportY() === 0
      syncMobileOverlayFromTerminal()
    },
    [syncMobileOverlayFromTerminal]
  )

  // Focus terminal for keyboard input
  const focusTerminal = useCallback(() => {
    // User explicitly wants to type directly in the terminal (via the mobile "terminal input" button
    // or desktop click-to-focus). Dismiss any pending hydration/restore overlay immediately so the
    // canvas and cursor are visible, and native keyboard can target the capture field.
    hideHydrationIndicator()
    mobileSelectionRef.current?.clear()

    if (isMobile && mobileInputId) {
      focusMobileTerminalInput(document.getElementById(mobileInputId))
      return
    }
    termRef.current?.focus()
  }, [hideHydrationIndicator, isMobile, mobileInputId])

  useImperativeHandle(
    ref,
    () => ({
      sendInput,
      scrollToBottom: () => {
        const terminal = termRef.current
        if (!terminal) return
        terminal.options.smoothScrollDuration = 0
        terminal.scrollToBottom()
        followOutputRef.current = true
        syncMobileOverlayFromTerminal()
      },
      scrollLines,
      fitTerminal: () => fitAddonRef.current?.fit(),
      focus: focusTerminal,
    }),
    [sendInput, scrollLines, focusTerminal, syncMobileOverlayFromTerminal]
  )

  const handleCopy = useCallback((e: React.ClipboardEvent | ClipboardEvent) => {
    if (mobileSelectionRef.current?.hasSelection()) return // native DOM copy owns mobile ranges
    const terminal = termRef.current
    if (!terminal) return

    const target = e.target as HTMLElement | null
    const nativeEvent = "nativeEvent" in e ? e.nativeEvent : e
    const isInTerminal =
      containerRef.current && typeof nativeEvent.composedPath === "function"
        ? nativeEvent.composedPath().includes(containerRef.current)
        : containerRef.current?.contains(target)

    const active = document.activeElement as HTMLElement | null
    const focusedInThisTerminal =
      !!active && !!containerRef.current?.contains(active)
    if (!isInTerminal && !focusedInThisTerminal) {
      return
    }

    try {
      const selection = terminal.getSelection()

      if (typeof selection === "string" && selection.length > 0) {
        e.preventDefault()
        e.clipboardData?.setData("text/plain", selection)
      }
    } catch (err) {
      console.warn("Error handling copy:", err)
    }
  }, [])

  const handlePaste = useCallback(
    (e: React.ClipboardEvent | ClipboardEvent) => {
      // Check if paste is happening in this terminal instance.
      const target = e.target as HTMLElement | null
      const nativeEvent = "nativeEvent" in e ? e.nativeEvent : e
      const isInTerminal =
        containerRef.current && typeof nativeEvent.composedPath === "function"
          ? nativeEvent.composedPath().includes(containerRef.current)
          : containerRef.current?.contains(target)

      // Handle paste only if this terminal owns focus OR the event originated inside it.
      const active = document.activeElement as HTMLElement | null
      const focusedInThisTerminal =
        !!active && !!containerRef.current?.contains(active)
      if (!isInTerminal && !focusedInThisTerminal) {
        return
      }

      // If target is an editable element outside this terminal, let native paste happen.
      if (target && !isInTerminal) {
        const tag = target.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return
        }
      }

      const files = e.clipboardData?.files
      if (files && files.length > 0) {
        const uploadFiles = onUploadFilesRef.current
        if (uploadFiles) {
          e.preventDefault()
          e.stopPropagation()
          if ("stopImmediatePropagation" in e) e.stopImmediatePropagation()
          uploadFiles(files)
        }
        return
      }

      e.preventDefault()
      e.stopPropagation()
      if ("stopImmediatePropagation" in e) e.stopImmediatePropagation()

      const directText =
        e.clipboardData?.getData("text/plain") ||
        e.clipboardData?.getData("text") ||
        ""
      const normalizedDirect = directText.replace(/\r\n/g, "\n")

      if (normalizedDirect.length > 0) {
        sendInput(normalizedDirect, true)
        return
      }

      if (navigator.clipboard?.readText) {
        void navigator.clipboard
          .readText()
          .then((text) => {
            if (!text) return
            sendInput(text.replace(/\r\n/g, "\n"), true)
          })
          .catch(() => {
            if (normalizedDirect) sendInput(normalizedDirect, true)
          })
        return
      }

      if (normalizedDirect) sendInput(normalizedDirect, true)
    },
    [sendInput]
  )

  useEffect(() => {
    const terminalContainer = containerRef.current
    if (!terminalContainer) return
    const mobileOverlayInteractionState = mobileOverlayInteractionRef.current

    const sessionEpoch = ++sessionEpochRef.current
    let terminal: Terminal | null = null
    let fitAddon: FitAddon | null = null
    let resizeObserver: ResizeObserver | null = null
    let unsubscribe: (() => void) | null = null
    let unsubscribeConnection: (() => void) | null = null
    let unsubscribeTransportReconnect: (() => void) | null = null
    let cancelled = false
    let cleanupDocumentKeydown: (() => void) | null = null
    let cleanupScrollListener: (() => void) | null = null
    let cleanupTerminalDataListener: (() => void) | null = null
    let cleanupResizeListener: (() => void) | null = null
    let requestThemeReplay: (() => void) | null = null
    let secondaryFitTimer: number | null = null
    let mobileFocusRestoreTimer: number | null = null
    let releaseStartupFocusGuard = () => {}
    let bootstrapAbortController: AbortController | null = null
    let disposeBootstrapRecovery: (() => void) | null = null
    let disposeRepaintHold: (() => void) | null = null
    let lastSentDimensions: TerminalDimensions | null = null
    // Replay draws each byte at the PTY size it was recorded for, then fits back
    // to this view (lib terminal-size-markers). replayFitSize is the size to fit
    // back to while the terminal holds a recorded size; replayQueuedSize is the
    // size queued writes will land at while a replay is still being enqueued.
    let replayFitSize: TerminalSize | null = null
    let replayQueuedSize: TerminalSize | null = null
    let resizeDeferred = false
    let requestResize: ((reclaim: boolean) => void) | null = null
    const ptySize = new TerminalPtySizeTracker()
    let resizeOuterRaf: number | null = null
    let resizeInnerRaf: number | null = null
    let releaseVisualGuard: (() => void) | null = null

    const setup = async () => {
      try {
        const ghostty = await ensureGhostty()
        if (cancelled) return
        // Double check session match before proceeding with heavy init
        if (currentSessionIdRef.current !== sessionId) return

        const { Terminal, FitAddon: FitAddonClass } =
          await import("ghostty-web")
        if (
          cancelled ||
          currentSessionIdRef.current !== sessionId ||
          !terminalContainer.isConnected
        )
          return

        terminal = new Terminal({
          ghostty,
          fontSize: terminalFontSizeRef.current,
          fontFamily:
            "JetBrains Mono, SFMono-Regular, Menlo, Monaco, monospace",
          cursorBlink: true,
          // ghostty-web 0.4.0 forwards this value as bytes, despite exposing an
          // xterm-compatible option whose public contract describes lines.
          scrollback: TERMINAL_CLIENT_SCROLLBACK_BYTES,
          smoothScrollDuration: isMobileRef.current ? 0 : 120,
          disableStdin: true,
          // Preserve selection until the user explicitly copies it. Cmd+C
          // remains handled by ghostty-web's public copy path.
          copyOnSelect: false,
          // Match Coder 0.4: let the browser emit a synchronous copy event,
          // which handleCopy serializes from the canvas selection.
          copyMode: "native",
          // ghostty-web defaults to Cmd/Ctrl+click. VibeGhost treats the
          // rendered pointer affordance as a normal web link instead.
          onLinkClick: (url, event) => {
            const ownerWindow =
              event.view ?? terminalContainer.ownerDocument.defaultView
            return openTerminalLink(url, ownerWindow)
          },
          theme: terminalThemeRef.current.theme,
        })

        fitAddon = new FitAddonClass()
        const fitToContainer = fitAddon.fit.bind(fitAddon)
        // Fitting mid-replay would draw the rest of it at the wrong size; the
        // replay fits once it ends.
        fitAddon.fit = () => {
          if (replayFitSize || replayQueuedSize) {
            resizeDeferred = true
            return
          }
          fitToContainer()
        }
        terminal.loadAddon(fitAddon)

        const sharedMobileInput = mobileInputId
          ? document.getElementById(mobileInputId)
          : null
        const restoreSharedMobileFocus =
          isMobileRef.current && document.activeElement === sharedMobileInput
        // ghostty-web's open() may focus internally even with our autoFocus off.
        // Preserve a composer the user already started typing in during startup.
        const priorFocus = document.activeElement
        const restoreComposerFocus = () => {
          if (!autoFocusRef.current && priorFocus instanceof HTMLElement &&
              priorFocus.isConnected && priorFocus.matches('input,textarea,[contenteditable="true"]') &&
              !terminalContainer.contains(priorFocus) &&
              (document.activeElement === document.body || terminalContainer.contains(document.activeElement))) {
            priorFocus.focus({ preventScroll: true })
          }
        }

        if (terminalContainer.isConnected) {
          if (!shouldAutoFocusTerminal(autoFocusRef.current, isMobileRef.current)) {
            // ghostty-web open() calls focus() synchronously AND in a zero-delay
            // task. Restoring a captured element afterward leaves a window where
            // a composer's Enter can hit the terminal instead. Block both focus
            // attempts; the existing next-task callback releases this guard.
            const wasInert = terminalContainer.inert
            terminalContainer.inert = true
            releaseStartupFocusGuard = () => { terminalContainer.inert = wasInert }
          }
          terminalContainer.innerHTML = ""
          terminal.open(terminalContainer)
          if (!activeRef.current) {
            terminal.blur()
            terminal.suspend()
          }

          fitAddon.fit()
          syncMobileOverlayFromTerminal()
          // Secondary fit after a short delay to ensure container layout is stable
          secondaryFitTimer = window.setTimeout(() => {
            secondaryFitTimer = null
            if (!cancelled && fitAddon) {
              fitAddon.fit()
              syncMobileOverlayFromTerminal()
            }
          }, 50)
        }

        if (
          !shouldAutoFocusTerminal(autoFocusRef.current, isMobileRef.current)
        ) {
          terminal.blur()
          restoreComposerFocus()
          mobileFocusRestoreTimer = window.setTimeout(() => {
            mobileFocusRestoreTimer = null
            releaseStartupFocusGuard()
            terminal?.blur()
            if (restoreSharedMobileFocus && sharedMobileInput?.isConnected) {
              sharedMobileInput.focus({ preventScroll: true })
            } else {
              restoreComposerFocus()
            }
          }, 0)
        }

        followOutputRef.current = true
        termRef.current = terminal
        fitAddonRef.current = fitAddon
        syncMobileOverlayFromTerminal()

        if (onScrollRef.current) {
          const scrollSubscription = terminal.onScroll((viewportY) => {
            followOutputRef.current = viewportY === 0
            onScrollRef.current?.(viewportY)
            if (!suppressMobileOverlaySync) {
              syncMobileOverlayFromTerminal()
            }
          })
          cleanupScrollListener = () => scrollSubscription.dispose()
        } else {
          const scrollSubscription = terminal.onScroll((viewportY) => {
            followOutputRef.current = viewportY === 0
            if (!suppressMobileOverlaySync) {
              syncMobileOverlayFromTerminal()
            }
          })
          cleanupScrollListener = () => scrollSubscription.dispose()
        }

        // Create write queue for safe terminal writes
        const writeQueue = new SafeTerminalWriteQueue()
        writeQueue.setTerminal(terminal)
        writeQueue.setViewportStateProvider(() => ({
          preserveViewport: !followOutputRef.current,
          viewportY: terminal?.getViewportY() ?? 0,
          scrollbackLength: terminal?.getScrollbackLength() ?? 0,
        }))
        writeQueue.setAfterWrite(() => {
          if (!suppressMobileOverlaySync) {
            syncMobileOverlayFromTerminal()
          }
        })

        // Pi repaints its whole transcript (clear scrollback, then megabytes of
        // history) whenever a row above the window changes. Keep the last
        // painted frame until that repaint is complete, so the view does not
        // jump to the oldest history and scroll through all of it again.
        let releaseRepaintGuard: (() => void) | null = null
        let repaintViewportAnchor: ReturnType<typeof captureTerminalViewportAnchor> = null
        const repaintHold = new TerminalRepaintHold({
          begin: () => {
            if (!terminal || cancelled || !hostRef.current) return
            repaintViewportAnchor = captureTerminalViewportAnchor({
              viewportY: terminal.getViewportY(),
              scrollbackLength: terminal.getScrollbackLength(),
            })
            if (!releaseVisualGuard && !releaseRepaintGuard) {
              releaseRepaintGuard = createTerminalVisualGuard({
                host: hostRef.current,
                container: terminalContainer,
                background: terminalThemeRef.current.surfaceBackground,
              })
            }
            // Nothing is shown until the repaint is complete, so do not draw the
            // frames in between, and write for a fixed slice of each frame
            // instead of the live 16 KiB a frame (6.1s for a 4 MB repaint).
            // The page still yields every frame: a larger fixed byte budget
            // blocked it long enough for the server to close the socket as
            // fallen behind.
            terminal.suspend()
            writeQueue.setFrameTimeBudgetMs(TERMINAL_REPAINT_FRAME_TIME_BUDGET_MS)
            logTerminalDebug(sessionId, "repaint:hold-start", {
              guarded: releaseRepaintGuard !== null,
            })
          },
          end: (reason) => {
            const anchor = repaintViewportAnchor
            repaintViewportAnchor = null
            const releaseGuard = releaseRepaintGuard
            releaseRepaintGuard = null
            logTerminalDebug(sessionId, "repaint:hold-end", { reason })
            writeQueue.setFrameTimeBudgetMs(0)
            const resumeRenderer = () => {
              // A covered terminal and a held mobile selection stay suspended.
              if (terminal && activeRef.current && !mobileSelectionRef.current?.frozen()) terminal.resume()
            }
            if (!terminal || cancelled) {
              releaseGuard?.()
              return
            }
            if (reason === "cancelled") resumeRenderer()
            else {
              // The repaint cleared scrollback, which drops a scrolled-up view
              // to the bottom. Put it back where the user was reading.
              const priorSmoothScrollDuration = terminal.options.smoothScrollDuration
              terminal.options.smoothScrollDuration = 0
              if (anchor) {
                const viewportY = resolveTerminalViewportY(anchor, terminal.getScrollbackLength())
                terminal.scrollToLine(viewportY)
                followOutputRef.current = viewportY === 0
              } else {
                terminal.scrollToBottom()
                followOutputRef.current = true
              }
              terminal.options.smoothScrollDuration = priorSmoothScrollDuration
              resumeRenderer()
            }
            if (!releaseGuard) return
            // Reveal only after the finished state has been painted.
            void nextPaint().then(releaseGuard)
          },
        })
        disposeRepaintHold = () => repaintHold.cancel()

        const outputFramer = new TerminalOutputFramer()
        let urlDecoder = new TextDecoder()
        const pendingStdoutDuringBootstrap: Uint8Array[] = []
        let pendingStdoutBytes = 0
        let pendingStdoutTruncated = false
        let bufferedFlushFailed = false
        // Buffer from subscription attachment onward, including failed-restore
        // backoff. A later authoritative snapshot supersedes pre-attempt bytes.
        let isBootstrappingTerminal = true
        let isReplayingBootstrapOutput = false
        let suppressMobileOverlaySync = false
        let hasBootstrapped = false
        const bootstrapCoordinator = new TerminalBootstrapCoordinator({
          onRetry: () => { void bootstrapTerminal({ forceFresh: true }) },
        })
        disposeBootstrapRecovery = () => bootstrapCoordinator.dispose()
        let bootstrapPromise: Promise<void> | null = null
        let resolveSubscriptionReady: (() => void) | null = null
        let subscriptionReadyPromise: Promise<void>
        let subscriptionReady = false
        let refreshWhenSubscriptionReady = false

        const resetSubscriptionReady = () => {
          subscriptionReady = false
          refreshWhenSubscriptionReady = false
          subscriptionReadyPromise = new Promise<void>((resolve) => {
            resolveSubscriptionReady = resolve
          })
        }

        const markSubscriptionReady = () => {
          subscriptionReady = true
          resolveSubscriptionReady?.()
          resolveSubscriptionReady = null
          if (refreshWhenSubscriptionReady) {
            refreshWhenSubscriptionReady = false
            void bootstrapTerminal({ forceFresh: true })
          }
        }

        const waitForSubscriptionReady = async (): Promise<boolean> => {
          if (subscriptionReady && terminalSocketClient.isSessionSubscriptionReady(sessionId)) return true

          let timeoutId: number | null = null
          try {
            const ready = await Promise.race([
              subscriptionReadyPromise.then(() => true),
              new Promise<false>((resolve) => {
                timeoutId = window.setTimeout(() => resolve(false), 1_500)
              }),
            ])
            return ready || subscriptionReady
          } finally {
            if (timeoutId !== null) window.clearTimeout(timeoutId)
          }
        }

        resetSubscriptionReady()

        const queueStdoutForBootstrap = (bytes: Uint8Array) => {
          const copy = new Uint8Array(bytes.byteLength)
          copy.set(bytes)
          pendingStdoutDuringBootstrap.push(copy)
          pendingStdoutBytes += copy.byteLength
          while (
            pendingStdoutBytes > TERMINAL_RESTORE_OUTPUT_MAX_BYTES &&
            pendingStdoutDuringBootstrap.length > 1
          ) {
            pendingStdoutBytes -=
              pendingStdoutDuringBootstrap.shift()?.byteLength ?? 0
            pendingStdoutTruncated = true
          }
          if (pendingStdoutBytes > TERMINAL_RESTORE_OUTPUT_MAX_BYTES) {
            const onlyChunk = pendingStdoutDuringBootstrap[0]
            const start =
              onlyChunk.byteLength - TERMINAL_RESTORE_OUTPUT_MAX_BYTES
            const bounded = new Uint8Array(onlyChunk.subarray(start))
            pendingStdoutDuringBootstrap[0] = bounded
            pendingStdoutBytes = bounded.byteLength
            pendingStdoutTruncated = true
          }
          logTerminalDebug(sessionId, "stdout:buffered-during-bootstrap", {
            bytes: bytes.byteLength,
            bufferedChunks: pendingStdoutDuringBootstrap.length,
          })
        }

        const setHydrationState = (value: boolean) => {
          if (cancelled) return
          if (sessionEpochRef.current !== sessionEpoch) return
          if (currentSessionIdRef.current !== sessionId) return
          logTerminalDebug(
            sessionId,
            value ? "hydration:start" : "hydration:end"
          )
          hideHydrationIndicator()
          if (!value) return

          // A reconnect can rebuild the WASM terminal behind a frozen copy of
          // its last painted canvas. Keep that stable frame visible instead of
          // replacing an already useful terminal with the restore logo.
          if (hasBootstrapped || releaseVisualGuard) return

          hydrationIndicatorTimerRef.current = window.setTimeout(() => {
            hydrationIndicatorTimerRef.current = null
            if (cancelled) return
            if (sessionEpochRef.current !== sessionEpoch) return
            if (currentSessionIdRef.current !== sessionId) return
            if (hasBootstrapped || releaseVisualGuard) return
            setShowHydrationIndicator(true)
          }, HYDRATION_INDICATOR_DELAY_MS)
        }

        const handleUrlDetection = (bytes: Uint8Array) => {
          const onDetected = onUrlDetectedRef.current
          if (!onDetected) return
          const text = urlDecoder.decode(bytes, { stream: true })
          const match = text.match(/http:\/\/localhost:(\d+)/)
          if (match) {
            onDetected(match[0])
          }
        }

        const sanitizeTerminalOutput = (
          bytes: Uint8Array,
          respondToQueries = true
        ) => {
          const completeBytes = outputFramer.push(bytes)
          if (completeBytes.byteLength === 0) return completeBytes

          const reportColors = terminalReportColorsRef.current
          const activeTerminalTheme = terminalThemeRef.current
          const withoutThemeQueries = stripAndRespondToThemeQueries(
            sessionId,
            completeBytes,
            reportColors,
            respondToQueries,
            terminalSocketClient
          )
          return applyTerminalColorCompatibility(
            withoutThemeQueries,
            colorCompatStateRef.current,
            {
              enabled: true,
              defaultForeground:
                activeTerminalTheme.theme.foreground ?? "#e4e4e7",
              fallbackForeground:
                activeTerminalTheme.theme.background ??
                (resolvedThemeRef.current === "light" ? "#fafaff" : "#08090a"),
              palette: reportColors.palette,
            }
          )
        }

        // Runs from the write queue, in order with the replayed bytes.
        const resizeForReplay = (size: TerminalSize) => {
          if (!terminal || cancelled) return
          if (!replayFitSize) replayFitSize = { cols: terminal.cols, rows: terminal.rows }
          if (terminal.cols !== size.cols || terminal.rows !== size.rows) {
            terminal.resize(size.cols, size.rows)
          }
        }

        const finishReplaySizing = () => {
          const fitSize = replayFitSize
          replayFitSize = null
          replayQueuedSize = null
          if (!terminal || cancelled) return
          if (fitSize) {
            const proposed = fitAddon?.proposeDimensions()
            const target = proposed ? { cols: proposed.cols, rows: proposed.rows } : fitSize
            if (terminal.cols !== target.cols || terminal.rows !== target.rows) {
              terminal.resize(target.cols, target.rows)
            }
          }
          const deferred = resizeDeferred
          resizeDeferred = false
          // The device being looked at owns the PTY size; a background window does not.
          const reclaim =
            !sameTerminalSize(ptySize.size, { cols: terminal.cols, rows: terminal.rows }) &&
            document.visibilityState === "visible" &&
            document.hasFocus()
          if (deferred || reclaim) requestResize?.(reclaim)
        }

        const enqueueReplayFinish = () => {
          replayQueuedSize = null
          if (!writeQueue.enqueueAction(finishReplaySizing)) finishReplaySizing()
        }

        const liveWriteSize = (): TerminalSize | null =>
          replayQueuedSize ?? replayFitSize ?? (terminal ? { cols: terminal.cols, rows: terminal.rows } : null)

        const writeLiveStdout = (bytes: Uint8Array): boolean => {
          if (!writeQueue.getMetrics().continuityValid) return false
          const writeSize = liveWriteSize()
          const live = writeSize ? ptySize.live(bytes, writeSize) : { output: bytes, resync: false }
          // Another device owns the PTY size: re-send ours on the next focus.
          if (ptySize.size && lastSentDimensions && !sameTerminalSize(ptySize.size, lastSentDimensions)) {
            lastSentDimensions = null
          }
          if (live.resync) {
            // Output drawn for a larger PTY garbled this buffer while another
            // device owned the size. The PTY is back at ours: replay a snapshot.
            window.setTimeout(() => {
              if (
                cancelled ||
                sessionEpochRef.current !== sessionEpoch ||
                currentSessionIdRef.current !== sessionId
              ) return
              logTerminalDebug(sessionId, "bootstrap:size-resync")
              terminalSocketClient.invalidateReconnectStdoutCheckpoint(sessionId)
              void bootstrapTerminal({ forceFresh: true })
            }, 0)
          }
          const sanitizedBytes = sanitizeTerminalOutput(live.output)
          if (sanitizedBytes.byteLength === 0) return true
          logTerminalDebug(sessionId, "stdout:live", {
            bytes: sanitizedBytes.byteLength,
          })
          const repaintEnded = repaintHold.observe(sanitizedBytes)
          const accepted = writeQueue.enqueue(sanitizedBytes)
          if (accepted) handleUrlDetection(sanitizedBytes)
          if (repaintHold.active && (repaintEnded || !accepted)) {
            // Release in order, once the terminal holds the finished repaint.
            if (!accepted || !writeQueue.enqueueAction(() => repaintHold.release())) {
              repaintHold.cancel()
            }
          }
          return accepted
        }

        const combineChunks = (chunks: Uint8Array[]) => {
          if (chunks.length === 0) return new Uint8Array()
          if (chunks.length === 1) return chunks[0]

          const totalLength = chunks.reduce(
            (sum, chunk) => sum + chunk.byteLength,
            0
          )
          const combined = new Uint8Array(totalLength)
          let offset = 0
          for (const chunk of chunks) {
            combined.set(chunk, offset)
            offset += chunk.byteLength
          }
          return combined
        }

        const flushBufferedStdout = (bootstrapBytes?: Uint8Array) => {
          const buffered = pendingStdoutDuringBootstrap.splice(0)
          pendingStdoutBytes = 0
          if (buffered.length === 0) return new Uint8Array()

          const bufferedBytes = combineChunks(buffered)
          const overlap = bootstrapBytes
            ? findTerminalOutputOverlap(bootstrapBytes, bufferedBytes)
            : 0
          const nextBytes =
            overlap > 0 ? bufferedBytes.subarray(overlap) : bufferedBytes
          if (nextBytes.byteLength > 0 && !writeLiveStdout(nextBytes)) {
            bufferedFlushFailed = true
          }
          const flushed = new Uint8Array(nextBytes.byteLength)
          flushed.set(nextBytes)
          return flushed
        }

        const nextPaint = () =>
          new Promise<void>((resolve) => {
            let settled = false
            let outerRaf: number | null = null
            let innerRaf: number | null = null
            const finish = () => {
              if (settled) return
              settled = true
              window.clearTimeout(fallbackTimer)
              if (outerRaf !== null) cancelAnimationFrame(outerRaf)
              if (innerRaf !== null) cancelAnimationFrame(innerRaf)
              resolve()
            }
            const fallbackTimer = window.setTimeout(finish, 100)
            outerRaf = requestAnimationFrame(() => {
              outerRaf = null
              innerRaf = requestAnimationFrame(() => {
                innerRaf = null
                finish()
              })
            })
          })

        const drainBufferedStdout = (bootstrapBytes?: Uint8Array) =>
          drainPendingTerminalOutputOnce({
            hasPending: () => pendingStdoutDuringBootstrap.length > 0,
            flush: () => flushBufferedStdout(bootstrapBytes),
            nextPaint,
          })

        const settleBufferedStdout = async (bootstrapBytes?: Uint8Array) => {
          const flushedChunks: Uint8Array[] = []
          if (pendingStdoutDuringBootstrap.length === 0) {
            return new Uint8Array()
          }

          let overlapBase = bootstrapBytes
          const deadline = Date.now() + RESTORE_SETTLE_MAX_MS

          while (Date.now() < deadline) {
            const flushed = await drainBufferedStdout(overlapBase)
            overlapBase = undefined
            if (flushed.byteLength > 0) {
              flushedChunks.push(flushed)
            }

            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, RESTORE_SETTLE_WINDOW_MS)
            })

            if (pendingStdoutDuringBootstrap.length === 0) {
              break
            }
          }

          const tail = await drainBufferedStdout()
          if (tail.byteLength > 0) {
            flushedChunks.push(tail)
          }

          return combineChunks(flushedChunks)
        }

        const writeBootstrapOutput = async (
          outputBytes: Uint8Array,
          startSize: TerminalSize | null = null
        ): Promise<boolean> => {
          let size = startSize
          const queueReplaySize = (next: TerminalSize) => {
            size = next
            replayQueuedSize = next
            return writeQueue.enqueueAction(() => resizeForReplay(next))
          }
          if (outputBytes.byteLength && startSize && !queueReplaySize(startSize)) return false
          // Each part was drawn at the size of the mark before it.
          for (const part of splitTerminalSizeMarkers(outputBytes)) {
            if (part.kind === "size") {
              if (!queueReplaySize(part.size)) return false
              continue
            }
            // Sanitize before byte chunking. Decoding arbitrary 256 KiB slices can
            // split UTF-8 and ANSI controls, turning valid output into replacement
            // characters or leaking half an OSC sequence into Ghostty.
            const terminalOutputBytes = sanitizeTerminalOutput(part.bytes, false)
            if (!terminalOutputBytes.byteLength) continue

            const complete = await enqueueTerminalReplayChunks({
              bytes: terminalOutputBytes,
              chunkBytes: TERMINAL_BOOTSTRAP_WRITE_FRAME_BUDGET_BYTES,
              enqueue: (chunk) =>
                writeQueue.enqueue(chunk, { terminalResponses: "discard" }),
              yieldAfterChunk: nextPaint,
              isCurrent: () =>
                !cancelled &&
                sessionEpochRef.current === sessionEpoch &&
                currentSessionIdRef.current === sessionId,
            })
            if (!complete) return false
          }
          // Live output continues at the size this replay ended at.
          ptySize.reset(size)
          return true
        }

        const reconcileMountedTerminalOutput = async (
          checkpoint: Uint8Array | null,
          snapshotBytes: Uint8Array,
          options: {
            snapshotTruncated: boolean
            onCutover: (liveDelta: Uint8Array, complete: boolean) => void
          }
        ): Promise<boolean> => {
          if (!terminal || cancelled) return false

          const reconciliation = reconcileTerminalCheckpoint({
            checkpoint,
            snapshot: snapshotBytes,
            snapshotTruncated: options.snapshotTruncated,
          })
          if (reconciliation.kind === "reset") {
            logTerminalDebug(sessionId, "reconcile:fallback-reset", {
              reason: reconciliation.reason,
            })
            return false
          }

          // cacheStdout runs before subscriber callbacks. Waiting here proves the
          // captured raw checkpoint and the mounted WASM terminal have reached
          // the same boundary before missing bytes are appended.
          await writeQueue.waitForPendingWrites()
          if (!writeQueue.getMetrics().continuityValid) return false
          if (
            cancelled ||
            sessionEpochRef.current !== sessionEpoch ||
            currentSessionIdRef.current !== sessionId
          ) {
            return false
          }

          logTerminalDebug(sessionId, "reconcile:append", {
            checkpointBytes: checkpoint?.byteLength ?? 0,
            snapshotBytes: snapshotBytes.byteLength,
            deltaBytes: reconciliation.delta.byteLength,
          })

          isReplayingBootstrapOutput = true
          writeQueue.setBatchBudgetBytes(
            TERMINAL_BOOTSTRAP_WRITE_FRAME_BUDGET_BYTES
          )
          try {
            const replayComplete = await writeBootstrapOutput(
              reconciliation.delta,
              ptySize.size
            )
            if (!replayComplete) throw new TerminalReplayContinuityError()

            const settledLiveDelta = await settleBufferedStdout(snapshotBytes)
            const cutoffLiveDelta = flushBufferedStdout()
            const liveDelta =
              cutoffLiveDelta.byteLength > 0
                ? combineChunks([settledLiveDelta, cutoffLiveDelta])
                : settledLiveDelta
            if (bufferedFlushFailed) throw new TerminalReplayContinuityError()

            const completeCutover = !pendingStdoutTruncated
            options.onCutover(liveDelta, completeCutover)
            enqueueReplayFinish()
            const writesFlushed = writeQueue.waitForPendingWrites()

            isBootstrappingTerminal = false
            isReplayingBootstrapOutput = false
            await writesFlushed
            if (!cancelled && !writeQueue.getMetrics().continuityValid) {
              throw new TerminalReplayContinuityError()
            }

            if (
              cancelled ||
              sessionEpochRef.current !== sessionEpoch ||
              currentSessionIdRef.current !== sessionId
            ) {
              return false
            }

            syncMobileOverlayFromTerminal()
            hasBootstrapped = true
            return true
          } finally {
            writeQueue.setBatchBudgetBytes(TERMINAL_WRITE_FRAME_BUDGET_BYTES)
            isReplayingBootstrapOutput = false
            if (replayFitSize || replayQueuedSize) finishReplaySizing()
          }
        }

        const restoreTerminalOutput = async (
          outputBytes: Uint8Array,
          options: {
            onCutover: (liveDelta: Uint8Array, complete: boolean) => void
          }
        ) => {
          if (!terminal || cancelled) return new Uint8Array()

          if (releaseRepaintGuard && !releaseVisualGuard) {
            // Keep the frame frozen for the repaint; this replay now owns it.
            releaseVisualGuard = releaseRepaintGuard
            releaseRepaintGuard = null
          }
          repaintHold.cancel()
          if (hasBootstrapped && !releaseVisualGuard && hostRef.current) {
            releaseVisualGuard = createTerminalVisualGuard({
              host: hostRef.current,
              container: terminalContainer,
              background: terminalThemeRef.current.surfaceBackground,
            })
            if (releaseVisualGuard) {
              logTerminalDebug(sessionId, "hydration:preserve-visible-frame")
              hideHydrationIndicator()
            }
          }

          // A fallback reset rebuilds the entire WASM terminal. Capture the user's
          // content position before reset so a scrolled-back viewport does not
          // jump to current output when the preserved visual frame is removed.
          const viewportAnchor = captureTerminalViewportAnchor({
            viewportY: terminal.getViewportY(),
            scrollbackLength: terminal.getScrollbackLength(),
          })
          const priorSmoothScrollDuration =
            terminal.options.smoothScrollDuration
          followOutputRef.current = true
          suppressMobileOverlaySync = true
          terminal.options.smoothScrollDuration = 0
          outputFramer.reset()
          urlDecoder = new TextDecoder()
          colorCompatStateRef.current.activeBackground = null
          colorCompatStateRef.current.foregroundIsDefault = true
          colorCompatStateRef.current.injectedForegroundActive = false
          // Any queued pre-bootstrap live bytes are already represented by the
          // authoritative snapshot/buffered delta. Letting them survive reset would
          // replay stale output before the new history.
          writeQueue.discardPendingWrites()
          terminal.reset()
          // ghostty-web reset() rebuilds WASM state but retains viewportY from
          // the old buffer. Normalize replay at the bottom, then restore the
          // captured content position after the write barrier has drained.
          terminal.scrollToBottom()
          await nextPaint()

          isReplayingBootstrapOutput = true
          writeQueue.setBatchBudgetBytes(
            TERMINAL_BOOTSTRAP_WRITE_FRAME_BUDGET_BYTES
          )
          try {
            // Both HTTP snapshots and cached checkpoints can reach the full
            // restore cap. Pace either source so buffered live bytes never have
            // to coexist with one monolithic restore allocation in the queue.
            const replayComplete = await writeBootstrapOutput(outputBytes)
            if (!replayComplete) throw new TerminalReplayContinuityError()

            const settledLiveDelta = await settleBufferedStdout(outputBytes)
            const cutoffLiveDelta = flushBufferedStdout()
            const liveDelta =
              cutoffLiveDelta.byteLength > 0
                ? combineChunks([settledLiveDelta, cutoffLiveDelta])
                : settledLiveDelta
            if (bufferedFlushFailed) throw new TerminalReplayContinuityError()

            // Replace the raw stdout cache at the exact synchronous cutover. Frames
            // delivered after this callback append to that new checkpoint instead of
            // being overwritten after a long renderer drain.
            const completeCutover = !pendingStdoutTruncated
            options.onCutover(liveDelta, completeCutover)
            enqueueReplayFinish()
            const restoreWritesFlushed = writeQueue.waitForPendingWrites()

            // New live output now queues behind the captured restore barrier. It must
            // not keep hydration pending forever for a continuously noisy session.
            isBootstrappingTerminal = false
            isReplayingBootstrapOutput = false
            await restoreWritesFlushed
            if (!cancelled && !writeQueue.getMetrics().continuityValid) {
              throw new TerminalReplayContinuityError()
            }

            if (
              cancelled ||
              sessionEpochRef.current !== sessionEpoch ||
              currentSessionIdRef.current !== sessionId
            ) {
              return liveDelta
            }

            if (viewportAnchor) {
              const restoredViewportY = resolveTerminalViewportY(
                viewportAnchor,
                terminal.getScrollbackLength()
              )
              terminal.scrollToLine(restoredViewportY)
              followOutputRef.current = restoredViewportY === 0
              logTerminalDebug(sessionId, "viewport:restored", {
                linesFromTop: viewportAnchor.linesFromTop,
                viewportY: restoredViewportY,
              })
            } else {
              terminal.scrollToBottom()
              followOutputRef.current = true
            }
            suppressMobileOverlaySync = false
            syncMobileOverlayFromTerminal()
            hasBootstrapped = true
            return liveDelta
          } finally {
            suppressMobileOverlaySync = false
            terminal.options.smoothScrollDuration =
              priorSmoothScrollDuration
            writeQueue.setBatchBudgetBytes(TERMINAL_WRITE_FRAME_BUDGET_BYTES)
            isReplayingBootstrapOutput = false
            if (replayFitSize || replayQueuedSize) finishReplaySizing()
          }
        }

        const bootstrapTerminal = async (
          options: { forceFresh?: boolean } = {}
        ) => {
          if (!terminal || cancelled) return
          logTerminalDebug(sessionId, "bootstrap:requested", {
            forceFresh: options.forceFresh === true,
          })
          const forceFresh = options.forceFresh === true
          if (bootstrapPromise) {
            bootstrapCoordinator.begin(forceFresh)
            await bootstrapPromise
            return
          }

          if (!bootstrapCoordinator.begin(forceFresh)) return
          // Capture before any reconnected stdout can enter the cache. The write
          // barrier below proves all bytes in this checkpoint reached WASM.
          const reconnectCheckpoint =
            forceFresh && hasBootstrapped
              ? terminalSocketClient.getReconnectStdoutCheckpoint(sessionId)
              : null
          bootstrapPromise = (async () => {
            isBootstrappingTerminal = true
            // Previous failed replay/buffer bytes are included in the new
            // snapshot. Retaining them across attempts can duplicate old VT data.
            pendingStdoutDuringBootstrap.length = 0
            pendingStdoutBytes = 0
            pendingStdoutTruncated = false
            bufferedFlushFailed = false
            let bootstrapSucceeded = false
            let bootstrapTransportGeneration: number | null = null

            try {
              logTerminalDebug(sessionId, "bootstrap:start", { forceFresh })
              // status-sync is sent only after the server has attached this session's
              // stdout watcher. Waiting for it closes the HTTP-bootstrap/WS-subscribe gap.
              const ready = await waitForSubscriptionReady()
              if (!ready || !terminalSocketClient.isSessionSubscriptionReady(sessionId)) {
                refreshWhenSubscriptionReady = true
                throw new Error("Waiting for the terminal stream subscription")
              }
              if (
                cancelled ||
                sessionEpochRef.current !== sessionEpoch ||
                currentSessionIdRef.current !== sessionId
              ) {
                return
              }

              bootstrapTransportGeneration =
                terminalSocketClient.getTransportGeneration()
              const cachedOutput = !forceFresh
                ? terminalSocketClient.getCachedStdout(sessionId)
                : null
              if (cachedOutput && cachedOutput.byteLength > 0) {
                logTerminalDebug(sessionId, "bootstrap:cache-hit", {
                  bytes: cachedOutput.byteLength,
                })
                // This is a local repaint from an authoritative warm checkpoint,
                // not a network/session restore. Keep the canvas visible and replay
                // directly instead of flashing the recovery indicator on navigation.
                await restoreTerminalOutput(cachedOutput, {
                  onCutover: (liveDelta, complete) => {
                    terminalSocketClient.replaceStdoutCache(
                      sessionId,
                      liveDelta.byteLength > 0
                        ? combineChunks([cachedOutput, liveDelta])
                        : cachedOutput,
                      {
                        trusted:
                          complete &&
                          terminalSocketClient.getTransportGeneration() ===
                            bootstrapTransportGeneration,
                      }
                    )
                  },
                })
                bootstrapSucceeded = true
                return
              }

              setHydrationState(true)

              bootstrapAbortController = new AbortController()
              const response = await client.request(
                "GET",
                `/api/sessions/${encodeURIComponent(sessionId)}/bootstrap`,
                undefined,
                undefined,
                bootstrapAbortController.signal,
              )
              if (response.status >= 400) {
                throw new Error(`Terminal bootstrap failed (${response.status})`)
              }
              logTerminalDebug(sessionId, "bootstrap:response", {
                status: response.status,
              })

              const responseOutput = new TextDecoder().decode(response.body)
              const output = trimUtf8ToMaxBytes(
                responseOutput,
                TERMINAL_RESTORE_OUTPUT_MAX_BYTES
              )
              const bootstrapTruncated =
                response.restoreTruncated || output !== responseOutput

              if (
                cancelled ||
                sessionEpochRef.current !== sessionEpoch ||
                currentSessionIdRef.current !== sessionId ||
                !terminal
              ) {
                return
              }

              const bootstrapBytes = encoder.encode(output)
              const cutOverAuthoritativeSnapshot = (
                liveDelta: Uint8Array,
                complete: boolean
              ) => {
                terminalSocketClient.replaceStdoutCache(
                  sessionId,
                  liveDelta.byteLength > 0
                    ? combineChunks([bootstrapBytes, liveDelta])
                    : bootstrapBytes,
                  {
                    trusted:
                      !bootstrapTruncated &&
                      complete &&
                      terminalSocketClient.getTransportGeneration() ===
                        bootstrapTransportGeneration,
                  }
                )
              }

              const reconciled =
                forceFresh && reconnectCheckpoint
                  ? await reconcileMountedTerminalOutput(
                      reconnectCheckpoint,
                      bootstrapBytes,
                      {
                        snapshotTruncated: bootstrapTruncated,
                        onCutover: cutOverAuthoritativeSnapshot,
                      }
                    )
                  : false

              if (!reconciled) {
                await restoreTerminalOutput(bootstrapBytes, {
                  onCutover: cutOverAuthoritativeSnapshot,
                })
              }
              bootstrapSucceeded = true
            } catch (error) {
              if (!(
                error instanceof DOMException && error.name === "AbortError"
              )) {
                const isContinuityRecovery =
                  error instanceof TerminalReplayContinuityError
                logTerminalDebug(
                  sessionId,
                  isContinuityRecovery
                    ? "bootstrap:continuity-recovery"
                    : "bootstrap:error",
                  {
                    error:
                      error instanceof Error ? error.message : String(error),
                  }
                )

                // Queue rejection is a bounded recovery signal, not an uncaught
                // application failure. Logging its Error object through console.error
                // makes Next's development client mount a full-screen issue overlay,
                // which then intercepts every terminal touch. The coordinator
                // retries failed restores with backoff.
                if (!isContinuityRecovery) {
                  // A recoverable network failure must not open Next's blocking
                  // development error overlay or expose raw gateway errors.
                  console.warn("[GhosttyTerminal] bootstrap interrupted; waiting for terminal recovery")
                  // Do not send buffered live VT bytes into a partially restored
                  // or invalid queue. Keep them bounded until a fresh snapshot.
                }
              }
            } finally {
              bootstrapAbortController = null
              logTerminalDebug(sessionId, "bootstrap:finish", {
                bufferedChunks: pendingStdoutDuringBootstrap.length,
              })
              setHydrationState(false)
              // Keep the run owned through visual finalization. Clearing the
              // promise here used to allow a reconnect to overlap this finally.
              if (releaseVisualGuard) {
                // The write barrier only guarantees WASM state. Keep the frozen
                // frame through the next paint so the first rebuilt render is
                // ready before it is revealed.
                const releaseGuard = releaseVisualGuard
                await nextPaint()
                // Cleanup may already have removed this guard while paint was
                // pending. Never call a nulled callback or release a new owner.
                if (releaseVisualGuard === releaseGuard) {
                  releaseVisualGuard = null
                  releaseGuard()
                }
              }

              bootstrapSucceeded = bootstrapSucceeded &&
                !cancelled &&
                !pendingStdoutTruncated &&
                !bufferedFlushFailed &&
                writeQueue.getMetrics().continuityValid &&
                bootstrapTransportGeneration === terminalSocketClient.getTransportGeneration() &&
                terminalSocketClient.isSessionSubscriptionReady(sessionId)
              if (!bootstrapSucceeded && !cancelled &&
                  sessionEpochRef.current === sessionEpoch &&
                  currentSessionIdRef.current === sessionId) {
                terminalSocketClient.invalidateReconnectStdoutCheckpoint(sessionId)
              }
              const retryFresh = bootstrapCoordinator.finish(bootstrapSucceeded)
              isBootstrappingTerminal = !bootstrapSucceeded || retryFresh
              bootstrapPromise = null
              if (retryFresh && !cancelled) {
                void bootstrapTerminal({ forceFresh: true })
              }
            }
          })()

          await bootstrapPromise
        }

        writeQueue.setOnContinuityLost((event) => {
          terminalSocketClient.invalidateReconnectStdoutCheckpoint(sessionId)
          logTerminalDebug(sessionId, "stdout:continuity-invalidated", {
            reason: event.reason,
            queuedBytes: event.metrics.queuedBytes,
            queuedChunks: event.metrics.queuedChunks,
          })
          // Stateful VT bytes cannot be dropped safely. The coordinator owns
          // one recovery at a time, with backoff if replay or the request fails.
          isBootstrappingTerminal = true
          if (bootstrapCoordinator.requestContinuityRecovery()) {
            void bootstrapTerminal({ forceFresh: true })
          }
        })

        requestThemeReplay = () => {
          void bootstrapTerminal()
        }
        themeReplayRef.current = requestThemeReplay

        unsubscribe = terminalSocketClient.subscribe(sessionId, {
          stdout: true,
          events: true,
          skipHistory: true,
          onStdout: (bytes) => {
            logTerminalDebug(sessionId, "socket:stdout", {
              bytes: bytes.byteLength,
            })
            if (
              cancelled ||
              sessionEpochRef.current !== sessionEpoch ||
              currentSessionIdRef.current !== sessionId
            )
              return
            if (isBootstrappingTerminal || isReplayingBootstrapOutput) {
              queueStdoutForBootstrap(bytes)
              return
            }
            writeLiveStdout(bytes)
          },
          onEvent: (event) => {
            if (
              terminalSocketClient.isSubscriptionReadyEvent(sessionId, event)
            ) {
              markSubscriptionReady()
            }
            if (
              event &&
              typeof event === "object" &&
              (event as { type?: unknown }).type === "remote-transport-state"
            ) {
              const remoteState = event as {
                state?: unknown
                continuityInvalidated?: unknown
              }
              if (remoteState.state === "reconnecting") {
                isBootstrappingTerminal = true
              } else if (
                remoteState.state === "restored" &&
                remoteState.continuityInvalidated === true
              ) {
                resetSubscriptionReady()
                void bootstrapTerminal({ forceFresh: true })
              }
            }
          },
        })
        if (terminalSocketClient.isSessionSubscriptionReady(sessionId)) {
          markSubscriptionReady()
        }

        const originalUnsubscribe = unsubscribe
        unsubscribe = () => {
          originalUnsubscribe()
          writeQueue.dispose()
        }

        const terminalDataSubscription = terminal.onData((data) =>
          sendInput(data)
        )
        cleanupTerminalDataListener = () => terminalDataSubscription.dispose()

        // Keyboard event handling
        const isTerminalEvent = (event: KeyboardEvent | ClipboardEvent) => {
          const root = containerRef.current
          if (!root || typeof event.composedPath !== "function") return false
          return event.composedPath().includes(root)
        }

        const handleDocumentKeydown = (event: KeyboardEvent) => {
          if (event.isComposing || event.key === "Process") return

          const shortcutEvent = {
            key: event.key,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            altKey: event.altKey,
            shiftKey: event.shiftKey,
          }

          // Allow Native OS shortcuts to pass through
          if (isBrowserShortcut(shortcutEvent)) return

          const inTerminal = isTerminalEvent(event)
          if (!inTerminal) return

          // Allow copy/paste shortcuts to trigger native events (which we handle in handlePaste)
          if (isCopyPasteShortcut(shortcutEvent)) return

          const { key, ctrlKey, altKey, metaKey, shiftKey } = event

          if (
            key === "Escape" &&
            !ctrlKey &&
            !metaKey &&
            !shiftKey &&
            !altKey
          ) {
            const now = Date.now()
            if (now - lastEscapeTimeRef.current < 500) {
              lastEscapeTimeRef.current = 0
              consumeEvent(event)
              return
            }
            lastEscapeTimeRef.current = now
            sendInputKey("escape")
            consumeEvent(event)
            return
          }

          if (altKey && !ctrlKey && !metaKey && !shiftKey) {
            // Word navigation
            if (key === "ArrowLeft") {
              consumeEvent(event)
              sendInput("\x1bb")
              return
            }
            if (key === "ArrowRight") {
              consumeEvent(event)
              sendInput("\x1bf")
              return
            }
            if (key === "Backspace") {
              consumeEvent(event)
              sendInput("\x17")
              return
            }
          }

          let inputKey: string | null = null
          switch (key) {
            case "Enter":
              if (altKey && !ctrlKey && !metaKey && !shiftKey) {
                consumeEvent(event)
                sendInput(KITTY_ALT_ENTER_SEQUENCE)
                return
              }
              inputKey = ctrlKey
                ? "ctrl_enter"
                : shiftKey
                  ? "shift_enter"
                  : "enter"
              break
            case "ArrowUp":
              inputKey = "arrow_up"
              break
            case "ArrowDown":
              inputKey = "arrow_down"
              break
            case "ArrowLeft":
              inputKey = "arrow_left"
              break
            case "ArrowRight":
              inputKey = "arrow_right"
              break
            case "Tab":
              if (shiftKey) {
                consumeEvent(event)
                sendInput("\x1b[Z")
                return
              }
              inputKey = "tab"
              break
            case "Backspace":
              inputKey = "backspace"
              break
            case "Delete":
              inputKey = "delete"
              break
            case "PageUp":
              inputKey = "page_up"
              break
            case "PageDown":
              inputKey = "page_down"
              break
            case "Home":
              inputKey = "home"
              break
            case "End":
              inputKey = "end"
              break
            case "F1":
            case "F2":
            case "F3":
            case "F4":
            case "F5":
            case "F6":
            case "F7":
            case "F8":
            case "F9":
            case "F10":
            case "F11":
            case "F12":
              inputKey = key.toLowerCase()
              break
            default:
              break
          }

          if (inputKey) {
            consumeEvent(event)
            sendInputKey(inputKey)
            return
          }

          if (ctrlKey && key.length === 1 && key !== "Enter") {
            const charCode = key.toLowerCase().charCodeAt(0)
            if (charCode >= 97 && charCode <= 122) {
              consumeEvent(event)
              sendInput(String.fromCharCode(charCode - 96))
              return
            }
          }

          if (key.length === 1 && !ctrlKey && !metaKey && !altKey) {
            consumeEvent(event)
            sendInput(key)
          }
        }

        document.addEventListener("keydown", handleDocumentKeydown, true)
        document.addEventListener("copy", handleCopy, true)
        document.addEventListener("paste", handlePaste, true)
        cleanupDocumentKeydown = () => {
          document.removeEventListener("keydown", handleDocumentKeydown, true)
          document.removeEventListener("copy", handleCopy, true)
          document.removeEventListener("paste", handlePaste, true)
        }

        // Connection status
        onConnectionStatusChange?.(
          terminalSocketClient.getConnectionStatus()
            ? "connected"
            : "disconnected"
        )
        unsubscribeConnection = terminalSocketClient.onConnectionStateChange(
          (connected) => {
            if (cancelled) return

            onConnectionStatusChange?.(connected ? "connected" : "disconnected")
            logTerminalDebug(
              sessionId,
              connected ? "socket:connected" : "socket:disconnected",
              { hasBootstrapped }
            )
            if (!connected) {
              pacedInputQueueRef.current?.cancel(
                "terminal transport disconnected"
              )
              return
            }
            if (!terminal) return

            fitAddon?.fit()
            syncMobileOverlayFromTerminal()
            if (
              activeRef.current &&
              shouldAutoFocusTerminal(autoFocusRef.current, isMobileRef.current)
            ) {
              terminal.focus()
            }
            if (!hasBootstrapped) {
              void bootstrapTerminal()
            }
          }
        )

        // UI connection state is intentionally debounced, so a fast close/reopen can
        // produce no `disconnected` notification. The transport signal is lossless and
        // always forces a cast bootstrap after a WebSocket discontinuity.
        unsubscribeTransportReconnect =
          terminalSocketClient.onTransportReconnect(() => {
            if (cancelled || !terminal) return
            resetSubscriptionReady()
            fitAddon?.fit()
            syncMobileOverlayFromTerminal()
            void bootstrapTerminal({ forceFresh: true })
          })

        // Resize handling
        let resizeTimeout: ReturnType<typeof setTimeout> | null = null
        const cancelResizeRafs = () => {
          if (resizeOuterRaf !== null) {
            cancelAnimationFrame(resizeOuterRaf)
            resizeOuterRaf = null
          }
          if (resizeInnerRaf !== null) {
            cancelAnimationFrame(resizeInnerRaf)
            resizeInnerRaf = null
          }
        }
        const handleResize = () => {
          if (!fitAddon || !terminal || !activeRef.current) return
          if (replayFitSize || replayQueuedSize) {
            resizeDeferred = true
            return
          }
          fitAddon.fit()
          syncMobileOverlayFromTerminal()
          if (resizeTimeout !== null) clearTimeout(resizeTimeout)
          cancelResizeRafs()
          resizeTimeout = setTimeout(() => {
            resizeTimeout = null
            resizeOuterRaf = requestAnimationFrame(() => {
              resizeOuterRaf = null
              resizeInnerRaf = requestAnimationFrame(() => {
                resizeInnerRaf = null
                if (
                  cancelled ||
                  sessionEpochRef.current !== sessionEpoch ||
                  currentSessionIdRef.current !== sessionId ||
                  !activeRef.current ||
                  !terminal
                )
                  return
                const next = { cols: terminal.cols, rows: terminal.rows }
                if (replayFitSize || replayQueuedSize) {
                  resizeDeferred = true
                  return
                }
                if (shouldSendTerminalResize(lastSentDimensions, next)) {
                  terminalSocketClient.resize(sessionId, next.cols, next.rows)
                  lastSentDimensions = next
                }
                syncMobileOverlayFromTerminal()
              })
            })
          }, lastSentDimensions ? 300 : 0)
        }

        // The device being looked at owns the PTY size: re-send ours whenever this
        // view comes back, in case another device resized the session meanwhile.
        requestResize = (reclaim) => {
          if (reclaim) lastSentDimensions = null
          handleResize()
        }
        const reclaimSize = () => {
          if (document.visibilityState === "visible") requestResize?.(true)
        }
        resizeActiveRef.current = reclaimSize
        resizeObserver = new ResizeObserver(handleResize)
        resizeObserver.observe(terminalContainer)
        window.addEventListener("resize", handleResize)
        window.addEventListener("focus", reclaimSize)
        document.addEventListener("visibilitychange", reclaimSize)
        cleanupResizeListener = () => {
          requestResize = null
          if (resizeActiveRef.current === reclaimSize) resizeActiveRef.current = null
          window.removeEventListener("resize", handleResize)
          window.removeEventListener("focus", reclaimSize)
          document.removeEventListener("visibilitychange", reclaimSize)
          if (resizeTimeout !== null) {
            clearTimeout(resizeTimeout)
            resizeTimeout = null
          }
          cancelResizeRafs()
        }
      } catch (err) {
        releaseStartupFocusGuard()
        console.error("Ghostty Init Error:", err)
        if (
          !cancelled &&
          sessionEpochRef.current === sessionEpoch &&
          currentSessionIdRef.current === sessionId
        ) {
          hideHydrationIndicator()
        }
      }
    }

    setup()

    return () => {
      cancelled = true
      pacedInputQueueRef.current?.cancel(
        "terminal unmounted or session changed"
      )
      disposeBootstrapRecovery?.()
      disposeRepaintHold?.()
      bootstrapAbortController?.abort()
      bootstrapAbortController = null
      sessionEpochRef.current += 1
      if (unsubscribe) {
        // The unsubscribe function now also disposes the writeQueue
        unsubscribe()
      }
      unsubscribeConnection?.()
      unsubscribeTransportReconnect?.()
      cleanupDocumentKeydown?.()
      cleanupScrollListener?.()
      mobileSelectionRef.current?.dispose()
      mobileSelectionRef.current = null
      cleanupTerminalDataListener?.()
      cleanupResizeListener?.()
      if (secondaryFitTimer !== null) window.clearTimeout(secondaryFitTimer)
      if (hydrationIndicatorTimerRef.current !== null) {
        window.clearTimeout(hydrationIndicatorTimerRef.current)
        hydrationIndicatorTimerRef.current = null
      }
      if (mobileFocusRestoreTimer !== null)
        window.clearTimeout(mobileFocusRestoreTimer)
      releaseStartupFocusGuard()
      if (mobileOverlayInteractionState.timeoutId !== null) {
        window.clearTimeout(mobileOverlayInteractionState.timeoutId)
        mobileOverlayInteractionState.timeoutId = null
      }
      if (themeReplayRef.current === requestThemeReplay) {
        themeReplayRef.current = null
      }
      releaseVisualGuard?.()
      releaseVisualGuard = null

      resizeObserver?.disconnect()
      termRef.current = null
      fitAddonRef.current = null

      // ghostty-web owns a perpetual requestAnimationFrame loop plus element and
      // document listeners. Removing its canvas without dispose leaves every old
      // terminal rendering forever after session navigation. Version 0.4.0 sets
      // isOpen=false before cleanup checks it, so remove its document mouseup
      // listener explicitly as well.
      if (terminal) {
        const handleMouseUp = (
          terminal as unknown as {
            handleMouseUp?: (event: MouseEvent) => void
          }
        ).handleMouseUp
        if (handleMouseUp)
          document.removeEventListener("mouseup", handleMouseUp)
        try {
          terminal.dispose()
        } catch (error) {
          console.warn("[GhosttyTerminal] dispose failed", error)
        }
      }

      terminalContainer.innerHTML = ""

      // Note: existing code used an inline removeEventListener noop here, which was already ineffective.
    }
  }, [
    client,
    terminalSocketClient,
    sessionId,
    sendInput,
    sendInputKey,
    onConnectionStatusChange,
    handleCopy,
    handlePaste,
    hideHydrationIndicator,
    syncMobileOverlayFromTerminal,
    encoder,
    mobileInputId,
  ])

  // Drag and drop handlers
  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!onUploadFiles) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"
    },
    [onUploadFiles]
  )

  const handleDragEnter = useCallback(() => {
    if (!onUploadFiles) return
    dragCounterRef.current += 1
    setIsDragOver(true)
  }, [onUploadFiles])

  const handleDragLeave = useCallback(() => {
    if (!onUploadFiles) return
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
    if (dragCounterRef.current === 0) setIsDragOver(false)
  }, [onUploadFiles])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!onUploadFiles) return
      e.preventDefault()
      dragCounterRef.current = 0
      setIsDragOver(false)
      const files = e.dataTransfer?.files
      if (files && files.length > 0) onUploadFiles(files)
    },
    [onUploadFiles]
  )

  // Desktop click handler for focus
  const handleClick = useCallback(() => {
    // On mobile, the overlay handles touch, so clicks on the container are fine
    if (!isMobile) {
      const selection = document.getSelection()
      if (selection && selection.toString().length > 0) return
      focusTerminal()
    }
  }, [focusTerminal, isMobile])

  const dispatchMobileTerminalClick = useCallback(
    (clientX: number, clientY: number, source?: MouseEvent) => {
      const terminalContainer = containerRef.current
      const ownerWindow = terminalContainer?.ownerDocument.defaultView
      if (!terminalContainer || !ownerWindow) return

      terminalContainer.dispatchEvent(
        new ownerWindow.MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: ownerWindow,
          detail: source?.detail ?? 1,
          screenX: source?.screenX ?? clientX,
          screenY: source?.screenY ?? clientY,
          clientX,
          clientY,
          ctrlKey: source?.ctrlKey ?? false,
          altKey: source?.altKey ?? false,
          shiftKey: source?.shiftKey ?? false,
          metaKey: source?.metaKey ?? false,
          button: source?.button ?? 0,
          buttons: source?.buttons ?? 0,
        })
      )
    },
    []
  )

  const activateMobileTerminalLinkAtPoint = useCallback(
    (clientX: number, clientY: number) => {
      const ownerWindow = containerRef.current?.ownerDocument.defaultView
      const url = getTerminalLinkAtClientPoint(
        termRef.current,
        clientX,
        clientY
      )
      if (!url || !ownerWindow) return false
      return openTerminalLink(url, ownerWindow)
    },
    []
  )

  const handleMobileOverlayTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      markMobileOverlayInteraction()
      const overlay = overlayRef.current
      if (!isMobile || !overlay || event.touches.length !== 1 || mobileSelectionRef.current?.hasSelection()) {
        suppressMobileClickUntilRef.current = Date.now() + 750
        mobileTapStateRef.current = null
        return
      }
      const touch = event.touches.item(0)
      if (!touch) return
      mobileTouchWheelRef.current.begin(touch)
      mobileTapStateRef.current = beginMobileTerminalTap(
        touch,
        overlay.scrollTop,
        Date.now()
      )
    },
    [isMobile, markMobileOverlayInteraction]
  )

  const handleMobileOverlayTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      markMobileOverlayInteraction()
      // A fullscreen app with mouse tracking (Claude Code) has no scrollback
      // for the overlay to move; translate the drag into its wheel reports.
      const terminal = termRef.current
      if (terminal && activeRef.current && !mobileSelectionRef.current?.hasSelection()) {
        const sequence = terminalTouchWheelSequence(mobileTouchWheelRef.current, event.touches, terminal,
          containerRef.current?.querySelector("canvas")?.getBoundingClientRect())
        if (sequence) sendInput(sequence)
      }
      const state = mobileTapStateRef.current
      if (!state) return
      const touch = Array.from(event.touches).find(
        (candidate) => candidate.identifier === state.identifier
      )
      if (touch) {
        mobileTapStateRef.current = updateMobileTerminalTap(state, touch)
      }
    },
    [markMobileOverlayInteraction, sendInput]
  )

  const handleMobileOverlayTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      mobileTouchWheelRef.current.end()
      const state = mobileTapStateRef.current
      mobileTapStateRef.current = null
      suppressMobileClickUntilRef.current = Date.now() + 750
      if (mobileSelectionRef.current?.hasSelection()) return
      const overlay = overlayRef.current
      if (!isMobile || !state || !overlay) return
      const touch = Array.from(event.changedTouches).find(
        (candidate) => candidate.identifier === state.identifier
      )
      if (!touch) return
      if (
        !finishMobileTerminalTap(state, touch, overlay.scrollTop, Date.now())
      ) {
        return
      }

      // iOS does not reliably synthesize a click for a transparent momentum-
      // scrolling element. Resolve a confirmed stationary touch ourselves. Do
      // not preventDefault: native scrolling, long-press selection/callouts, and
      // the shared mobile keyboard keep their existing event paths.
      suppressMobileClickUntilRef.current = Date.now() + 750
      if (activateMobileTerminalLinkAtPoint(touch.clientX, touch.clientY)) return
      dispatchMobileTerminalClick(touch.clientX, touch.clientY)
    },
    [activateMobileTerminalLinkAtPoint, dispatchMobileTerminalClick, isMobile]
  )

  const handleMobileOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isMobile || mobileSelectionRef.current?.hasSelection() || Date.now() < suppressMobileClickUntilRef.current) return
      const source = event.nativeEvent
      if (activateMobileTerminalLinkAtPoint(source.clientX, source.clientY)) {
        return
      }
      dispatchMobileTerminalClick(source.clientX, source.clientY, source)
    },
    [activateMobileTerminalLinkAtPoint, dispatchMobileTerminalClick, isMobile]
  )

  return (
    <div
      ref={hostRef}
      data-terminal-host="true"
      aria-hidden={!active}
      className={className}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: terminalTheme.surfaceBackground,
        position: "relative",
        visibility: active ? "visible" : "hidden",
        pointerEvents: active ? "auto" : "none",
      }}
    >
      {/* Terminal container */}
      <div
        ref={containerRef}
        onClick={handleClick}
        style={{
          width: isMobile
            ? `calc(100% + ${MOBILE_GHOSTTY_SCROLLBAR_RESERVATION}px)`
            : "100%",
          marginRight: isMobile
            ? `-${MOBILE_GHOSTTY_SCROLLBAR_RESERVATION}px`
            : 0,
          height: "100%",
          overflow: "hidden",
          userSelect: isMobile ? "none" : "text",
          WebkitUserSelect: isMobile ? "none" : "text",
          // Hide the browser caret from ghostty-web's contenteditable wrapper.
          // On newer iOS/WebKit that caret can render as a full-height vertical bar
          // over the canvas. Ghostty draws its own cursor, so the DOM caret is noise.
          caretColor: "transparent",
          opacity: showHydrationIndicator ? 0 : 1,
          transition: "opacity 120ms ease",
        }}
      />

      {showHydrationIndicator && (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          style={{ backgroundColor: terminalTheme.overlay }}
        >
          <span role="status" aria-live="polite">
            {/* Share the transparent sidebar mark; no stale external icon cache. */}
            <OathkeeperMark gradient className="size-6 animate-pulse motion-reduce:animate-none" />
            <span className="sr-only">Restoring session</span>
          </span>
        </div>
      )}

      {/* Mobile native scroll overlay */}
      {isMobile && (
        <div
          ref={overlayRef}
          data-terminal-scroll-overlay="true"
          className={mobileSelectionStyles.overlay}
          onScroll={handleOverlayScroll}
          onClick={handleMobileOverlayClick}
          onTouchStart={handleMobileOverlayTouchStart}
          onTouchMove={handleMobileOverlayTouchMove}
          onTouchEnd={handleMobileOverlayTouchEnd}
          onTouchCancel={() => {
            mobileTouchWheelRef.current.end()
            mobileTapStateRef.current = null
            suppressMobileClickUntilRef.current = Date.now() + 750
          }}
          onPointerDown={markMobileOverlayInteraction}
          style={{
            position: "absolute",
            top: 0,
            right: MOBILE_SCROLLBAR_RIGHT_INSET,
            bottom: 0,
            left: 0,
            zIndex: 5,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            background: "transparent",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 1,
              opacity: 0,
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="rounded-xl border border-border bg-card/90 px-6 py-4 text-center text-sm text-foreground backdrop-blur">
            <div className="text-base font-semibold">Drop files here</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Files will be uploaded and the path sent to terminal
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
