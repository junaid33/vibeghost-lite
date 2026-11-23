export const MOBILE_TERMINAL_TAP_MAX_DISTANCE_PX = 10
// Stay below iOS's long-press/callout threshold, even before a DOM range exists.
export const MOBILE_TERMINAL_TAP_MAX_DURATION_MS = 350
export const MOBILE_TERMINAL_TAP_MAX_SCROLL_PX = 1

export type MobileTerminalTouchPoint = {
  identifier: number
  clientX: number
  clientY: number
}

export type MobileTerminalTapState = MobileTerminalTouchPoint & {
  startedAt: number
  scrollTop: number
  moved: boolean
}

export function beginMobileTerminalTap(
  point: MobileTerminalTouchPoint,
  scrollTop: number,
  startedAt: number
): MobileTerminalTapState {
  return { ...point, scrollTop, startedAt, moved: false }
}

export function updateMobileTerminalTap(
  state: MobileTerminalTapState,
  point: MobileTerminalTouchPoint
): MobileTerminalTapState {
  if (point.identifier !== state.identifier || state.moved) return state
  const distance = Math.hypot(
    point.clientX - state.clientX,
    point.clientY - state.clientY
  )
  return distance > MOBILE_TERMINAL_TAP_MAX_DISTANCE_PX
    ? { ...state, moved: true }
    : state
}

export function finishMobileTerminalTap(
  state: MobileTerminalTapState | null,
  point: MobileTerminalTouchPoint,
  scrollTop: number,
  finishedAt: number
): boolean {
  if (!state || point.identifier !== state.identifier || state.moved) return false
  if (finishedAt - state.startedAt > MOBILE_TERMINAL_TAP_MAX_DURATION_MS)
    return false
  if (Math.abs(scrollTop - state.scrollTop) > MOBILE_TERMINAL_TAP_MAX_SCROLL_PX)
    return false

  return (
    Math.hypot(point.clientX - state.clientX, point.clientY - state.clientY) <=
    MOBILE_TERMINAL_TAP_MAX_DISTANCE_PX
  )
}
