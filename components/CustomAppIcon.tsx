import type { CSSProperties } from 'react';
import styles from './custom-app-icon.module.css';

export const DEFAULT_APP_ICON_COLOR = '#b2e071';

/** Lab01 Experiment #6's settled mark; original geometry, slightly softer cast shadows. */
export function CustomAppIcon({ color = DEFAULT_APP_ICON_COLOR, centered = false }: { color?: string; centered?: boolean }) {
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_APP_ICON_COLOR;
  const rgb = [1, 3, 5].map(start => parseInt(safeColor.slice(start, start + 2), 16));
  const shade = (offsets: number[]) => rgb.map((value, i) => Math.max(0, Math.min(255, value + offsets[i]))).join(' ');
  const style = {
    '--app-dot-fill': safeColor,
    '--app-dot-rim-top': `rgb(${shade([-25, -10, -46])})`,
    '--app-dot-rim-bottom': `rgb(${shade([-57, -44, -73])})`,
    '--app-dot-shadow': shade([-47, -36, -55]),
  } as CSSProperties;
  return <span aria-hidden="true" data-custom-app-icon data-centered={centered || undefined} className={styles.slot} style={style}>
    <span className={styles.figure}><span className={styles.dot}><span className={styles.rim}/></span></span>
  </span>;
}
