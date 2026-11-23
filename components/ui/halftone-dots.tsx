"use client"

import { useEffect, useRef } from "react"

/**
 * Animated halftone field for "AI is working" states (after aicss.dev's dot
 * textures). Dots sit on a fixed grid; a soft band sweeps across while slow
 * interference waves swell and brighten them. Fills its positioned parent.
 */
export function HalftoneDots({
  className,
  spacing = 6,
  color = "#f4f7f5",
  frozenAt,
  shape = "field",
}: {
  className?: string
  /** Grid pitch in CSS pixels. */
  spacing?: number
  color?: string
  /** Draw one still frame at this time (ms) instead of animating. */
  frozenAt?: number
  /** "ring": the same dots drawn as a doughnut, lit from the top left, centred in the box. */
  shape?: "field" | "ring"
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return
    const still = frozenAt != null || matchMedia("(prefers-reduced-motion: reduce)").matches
    let width = 0
    let height = 0
    let frame = 0
    const draw = (time: number) => {
      const t = time / 1000
      context.clearRect(0, 0, width, height)
      context.fillStyle = color
      // The sweep travels a little past both edges so it enters and leaves.
      const sweep = ((t * 0.32) % 1.5) - 0.25
      const ring = shape === "ring"
      const cx = width / 2
      const cy = height / 2
      // The doughnut: its tube runs round a circle of radius `middle`, `tube` thick either side.
      const outer = Math.min(width, height) * 0.38
      const inner = outer * 0.42
      const middle = (outer + inner) / 2
      const tube = (outer - inner) / 2
      // A ring's grid is centred on it, so the doughnut comes out symmetrical.
      const start = (centre: number) => (ring ? ((centre % spacing) + spacing) % spacing : spacing / 2)
      for (let y = start(cy); y < height; y += spacing) {
        for (let x = start(cx); x < width; x += spacing) {
          let level: number
          if (ring) {
            const dx = x - cx
            const dy = y - cy
            const distance = Math.hypot(dx, dy)
            // Across the tube, -1 at its inner edge to 1 at its outer edge; outside it, nothing.
            const across = (distance - middle) / tube
            if (Math.abs(across) > 1 || distance === 0) continue
            // The tube's surface normal, lit from the top left, with a floor so the shaded side still shows.
            const nx = (across * dx) / distance
            const ny = (across * dy) / distance
            const light = Math.max(0, -0.45 * nx - 0.55 * ny + 0.7 * Math.sqrt(1 - across * across))
            level = Math.min(1, 0.18 + 0.82 * light)
          } else {
            const u = x / Math.max(width, 1)
            const band = Math.exp(-((u - sweep) ** 2) / 0.035)
            const waves =
              (Math.sin(x * 0.05 - t * 1.7) +
                Math.sin(y * 0.13 + x * 0.021 + t * 1.15) +
                Math.sin((x + y) * 0.032 - t * 0.6)) /
              3
            level = Math.min(1, 0.6 * band + 0.55 * Math.max(0, waves))
          }
          if (level < 0.04) continue
          context.globalAlpha = 0.1 + level * 0.6
          context.beginPath()
          context.arc(x, y, 0.4 + level * spacing * 0.3, 0, Math.PI * 2)
          context.fill()
        }
      }
      if (!still) frame = requestAnimationFrame(draw)
    }
    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      if (still) draw(frozenAt ?? 1200)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    if (!still) frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [spacing, color, frozenAt, shape])
  return <canvas ref={ref} aria-hidden="true" className={className} />
}
