"use client";

import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import styles from './spinner.module.css';

interface SpinnerProps extends Omit<ComponentProps<'svg'>, 'size'> {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/** iOS-style activity indicator. The surrounding status supplies its label. */
export function Spinner({ className, size = 'md', ...props }: SpinnerProps) {
  const sizes = { sm: 'size-4', md: 'size-5', lg: 'size-6' };
  return <svg {...props} data-ios-spinner role={props["aria-label"] ? "status" : props.role} aria-hidden={props["aria-label"] ? undefined : true} focusable="false" viewBox="0 0 24 24" className={cn('shrink-0', sizes[size], className)}>
    {Array.from({ length: 12 }, (_, index) => <rect
      key={index}
      className={styles.spoke}
      x="11" y="1" width="2" height="5" rx="1"
      fill="currentColor" transform={`rotate(${index * 30} 12 12)`}
      style={{ animationDelay: `${index * 100 - 1200}ms` }}
    />)}
  </svg>;
}
