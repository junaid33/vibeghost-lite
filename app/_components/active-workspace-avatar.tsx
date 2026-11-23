'use client';

import { VibeGhostWorkspaceGradient } from '@/components/VibeGhostWorkspaceGradient';
import styles from './active-workspace-avatar.module.css';

// Same identities, gradient model, stacking and geometry as VibeGhost's
// components/oathkeeper/active-workspace-avatar.tsx (not flat placeholder dots).
const marks = ['docs', 'ee87ede89bfe44f9', 'openfront-restaurant'] as const;
export function ActiveWorkspaceAvatar() {
  return <span aria-hidden="true" className={styles.avatar}>
    {marks.map((seed, index) => <span key={seed} className={styles.mark} style={{ zIndex: marks.length - index }}>
      <VibeGhostWorkspaceGradient seed={seed} shape="circle" className={styles.artwork}/>
    </span>)}
  </span>;
}
