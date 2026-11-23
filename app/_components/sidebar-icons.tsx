import { AddCircle } from '@/components/icons/duo';
import { NavigationIcon, type NavigationIconName } from "@/features/oathkeeper/components/navigation-icons";

export function SidebarGlyph({ name }: { name: NavigationIconName }) {
  return <NavigationIcon name={name}/>;
}

/** Shared Add Circle artwork in the existing 12px sidebar slot. */
export function SidebarPlusGlyph() {
  return <AddCircle size={12}/>;
}

export function SidebarChevron({ expanded = false, className }: { expanded?: boolean; className?: string }) {
  return <svg className={className} data-expanded={expanded} data-duo-icon="chevron-down" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10.75 7L8 9.75L5.25 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
