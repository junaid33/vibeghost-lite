"use client";

// Dither field adapted from https://beui.dev/components/agents/image-generation
// Copyright (c) 2026 Saurabh Chauhan — MIT; see ./LICENSE.
// Loading-only adapter: no simulated progress, resolution, preview, or retry.
import { useEffect, useRef } from 'react';
import styles from './image-generation.module.css';

const DOT_GAP = 10;

export function ImageGeneration({ label = 'Generating image' }: { label?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !root) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0;
    let width = 208;
    let height = 208;
    let inView = true;
    let lastDraw = 0;
    let dotColor = getComputedStyle(canvas).color;
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, inside: false };

    const draw = (time: number) => {
      const reduce = reducedMotion.matches;
      context.clearRect(0, 0, width, height);
      if (!pointer.inside || reduce) {
        pointer.targetX = width / 2 + (reduce ? 0 : Math.sin(time / 1700) * width * 0.12);
        pointer.targetY = height / 2 + (reduce ? 0 : Math.cos(time / 2100) * height * 0.1);
      }
      const follow = reduce ? 1 : pointer.inside ? 0.3 : 0.09;
      pointer.x += (pointer.targetX - pointer.x) * follow;
      pointer.y += (pointer.targetY - pointer.y) * follow;
      const radius = Math.min(width, height) * 0.38;
      const columns = Math.ceil(width / DOT_GAP) + 1;
      const rows = Math.ceil(height / DOT_GAP) + 1;
      const offsetX = (width - (columns - 1) * DOT_GAP) / 2;
      const offsetY = (height - (rows - 1) * DOT_GAP) / 2;
      context.fillStyle = dotColor;
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const anchorX = offsetX + column * DOT_GAP;
          const anchorY = offsetY + row * DOT_GAP;
          const deltaX = anchorX - pointer.x;
          const deltaY = anchorY - pointer.y;
          const distance = Math.hypot(deltaX, deltaY);
          const proximity = Math.max(0, 1 - distance / radius);
          const influence = proximity * proximity * (3 - 2 * proximity);
          const displacement = influence * influence * 9;
          const x = anchorX + (distance > 0 ? deltaX / distance : 0) * displacement;
          const y = anchorY + (distance > 0 ? deltaY / distance : 0) * displacement;
          context.globalAlpha = 0.17 + influence * 0.72;
          context.beginPath();
          context.arc(x, y, 0.65 + influence * 0.85, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
    };

    const tick = (time: number) => {
      // This small decorative field doesn't need a 120 Hz phone's full refresh rate.
      if (time - lastDraw >= 1000 / 30) { draw(time); lastDraw = time; }
      frame = requestAnimationFrame(tick);
    };
    const syncMotion = () => {
      cancelAnimationFrame(frame);
      const animate = !reducedMotion.matches && inView && document.visibilityState !== 'hidden';
      root.dataset.motion = animate ? 'running' : 'paused';
      draw(reducedMotion.matches ? 0 : performance.now());
      if (animate) frame = requestAnimationFrame(tick);
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width || 208;
      height = rect.height || 208;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      dotColor = getComputedStyle(canvas).color;
      pointer.x = pointer.targetX = width / 2;
      pointer.y = pointer.targetY = height / 2;
      syncMotion(); // Redraw after resize even when reduced motion is enabled.
    };
    const move = (event: PointerEvent) => {
      if (reducedMotion.matches || !finePointer.matches || event.pointerType === 'touch') return;
      const rect = canvas.getBoundingClientRect();
      pointer.inside = true;
      pointer.targetX = event.clientX - rect.left;
      pointer.targetY = event.clientY - rect.top;
    };
    const leave = () => { pointer.inside = false; };
    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; syncMotion(); });
    resize();
    resizeObserver.observe(canvas);
    intersectionObserver.observe(canvas);
    reducedMotion.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncMotion);
    canvas.addEventListener('pointermove', move, { passive: true });
    canvas.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      reducedMotion.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', syncMotion);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerleave', leave);
    };
  }, []);

  return <div ref={rootRef} data-slot="image-generation" className={styles.root}>
    <div aria-hidden="true" className={styles.surface}><canvas ref={canvasRef} className={styles.canvas}/></div>
    <div role="status" className={styles.status}>
      <span aria-hidden="true" className={styles.mark}><span/><span/><span/><span/></span>
      <span>{label}</span>
    </div>
  </div>;
}
