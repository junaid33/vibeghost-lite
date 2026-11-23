'use client';

import { useId, useState, type ReactNode } from 'react';
import { WorkspaceActionsMenu } from '@/features/oathkeeper/components/workspace-actions-menu';
import type { SessionManagementAction } from '@/features/oathkeeper/components/workspace-session-manager';
import { SidebarChevron } from './sidebar-icons';
import styles from './oathkeeper-sidebar.module.css';
import treeStyles from './sidebar-workspace-sessions.module.css';

export function SidebarWorkspaceSection({ label, divider, onManage, children }: {
  label: string;
  divider?: boolean;
  onManage: (action: SessionManagementAction) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return <li className={treeStyles.workspace} data-pin-divider={divider || undefined}>
    <div className={treeStyles.sectionHeading}>
      <h3 className={treeStyles.sectionLabel}>{label}</h3>
      <WorkspaceActionsMenu label={label} className={treeStyles.sectionMenu} onManage={onManage}/>
      <button type="button" className={styles.branchToggle} aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}><SidebarChevron expanded={open} className={styles.chevron}/></button>
    </div>
    <ul id={id} hidden={!open} className={treeStyles.sectionItems}>{children}</ul>
  </li>;
}
