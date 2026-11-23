import type { HTMLAttributes, SyntheticEvent } from 'react';

const rows = '[role^=menuitem], [data-slot=select-item], [cmdk-item], .oathkeeper-popover-row, [data-lab-menu-row]';
function highlight(event: SyntheticEvent<HTMLDivElement>) {
  const surface = event.currentTarget;
  const row = event.target instanceof Element ? event.target.closest<HTMLElement>(rows) : null;
  if (!row || row.closest('[data-lab-menu]') !== surface || (row.hasAttribute('data-disabled') && row.getAttribute('data-disabled') !== 'false') || row.getAttribute('aria-disabled') === 'true') {
    delete surface.dataset.labHighlight; return;
  }
  const box = row.getBoundingClientRect(), parent = surface.getBoundingClientRect();
  surface.style.setProperty('--lab-marker-top', `${box.top - parent.top + surface.scrollTop}px`);
  surface.style.setProperty('--lab-marker-left', `${box.left - parent.left + surface.scrollLeft}px`);
  surface.style.setProperty('--lab-marker-width', `${box.width}px`);
  surface.style.setProperty('--lab-marker-height', `${box.height}px`);
  surface.dataset.labHighlight = 'true';
}
/** Event-driven only: no per-row effects, observers, timers or polling. */
export function labMenuInteractions<P extends HTMLAttributes<HTMLDivElement>>(props: P): P {
  return { ...props,
    onPointerMove(event) {
      // Touch movement is native scrolling, not a mouse-hover interaction.
      if (event.pointerType === 'touch') delete event.currentTarget.dataset.labHighlight;
      else highlight(event);
      props.onPointerMove?.(event);
    },
    onPointerLeave(event) { delete event.currentTarget.dataset.labHighlight; props.onPointerLeave?.(event); },
    onFocusCapture(event) { highlight(event); props.onFocusCapture?.(event); },
    onBlurCapture(event) { delete event.currentTarget.dataset.labHighlight; props.onBlurCapture?.(event); },
    onScroll(event) { delete event.currentTarget.dataset.labHighlight; props.onScroll?.(event); },
  };
}
