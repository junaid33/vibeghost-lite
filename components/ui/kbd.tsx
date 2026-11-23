import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import styles from './kbd.module.css';

type KeyItem = string | { display: string; key: string };
const symbols: Record<string, string> = {
  command: '⌘', cmd: '⌘', control: '⌃', ctrl: '⌃', alt: '⌥', option: '⌥',
  space: '␣', arrowleft: '←', left: '←', arrowdown: '↓', down: '↓',
  arrowup: '↑', up: '↑', arrowright: '→', right: '→',
};

/** Presentation only: menus retain ownership of keyboard handling and command dispatch.
 * Use children for literal command text; keys renders symbolic keyboard chords. */
export function Kbd({ keys, active = false, className, children, ...props }: ComponentProps<'kbd'> & { keys?: KeyItem[]; active?: boolean }) {
  return <kbd data-kbd data-active={active || undefined} className={cn(styles.key, className)} {...props}>
    {keys ? keys.map((item, index) => <span key={index} className={index ? styles.next : undefined}>{typeof item === 'string' ? symbols[item.toLowerCase()] ?? item.toUpperCase() : item.display}</span>) : children}
  </kbd>;
}
