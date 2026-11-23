"use client";

import { useEffect, type RefObject } from "react";

/** Measure real overflow, including Safari where scroll timelines are unavailable. */
export function useHorizontalScrollFade(ref: RefObject<HTMLElement | null>) {
  useScrollFade(ref, "horizontal");
}

export function useScrollFade(ref: RefObject<HTMLElement | null>, axis: "horizontal" | "vertical") {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const horizontal = axis === "horizontal";
    const startProperty = horizontal ? "--oathkeeper-fade-left" : "--oathkeeper-fade-top";
    const endProperty = horizontal ? "--oathkeeper-fade-right" : "--oathkeeper-fade-bottom";
    const update = () => {
      const maximum = Math.max(0, horizontal ? element.scrollWidth - element.clientWidth : element.scrollHeight - element.clientHeight);
      const position = Math.max(0, Math.min(maximum, horizontal ? element.scrollLeft : element.scrollTop));
      const distance = 2 * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
      const left = maximum > 1 ? Math.min(1, position / distance) : 0;
      const right = maximum > 1 ? Math.min(1, (maximum - position) / distance) : 0;
      element.style.setProperty(startProperty, String(left));
      element.style.setProperty(endProperty, String(right));
    };
    const resize = new ResizeObserver(update);
    const observeSizes = () => {
      resize.disconnect();
      resize.observe(element);
      for (const child of element.children) resize.observe(child);
      update();
    };
    const children = new MutationObserver(observeSizes);
    children.observe(element, { childList: true });
    element.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    observeSizes();
    return () => {
      resize.disconnect();
      children.disconnect();
      element.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      element.style.removeProperty(startProperty);
      element.style.removeProperty(endProperty);
    };
  }, [ref, axis]);
}
