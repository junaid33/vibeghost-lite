"use client";
import { createContext, useContext, type MouseEvent, type ReactNode } from "react";

/** Host-owned controls, available to any installed app using the shared shell. */
export const WorkspaceHeaderAccessory = createContext<ReactNode>(null);
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen, Plus } from "@/components/icons/duo";
import { cn } from "@/lib/utils";
import styles from "./workspace-view-shell.module.css";

export type WorkspaceViewChromeProps = {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  onSidebarToggle: () => void;
  onOpenSidebar: () => void;
};

export function WorkspaceViewShell({
  title,
  children,
  wide = false,
  scrollable = true,
  desktopSplit = false,
  actionLabel,
  onAction,
  toolbar,
  trailing,
  breadcrumbs,
  breadcrumbControl,
  sidebarCollapsed,
  mobileSidebarOpen,
  onSidebarToggle,
  onOpenSidebar,
}: WorkspaceViewChromeProps & {
  title: string;
  children: ReactNode;
  wide?: boolean;
  scrollable?: boolean;
  /** Retained for caller compatibility; horizontal gutters are shared by every page. */
  compactInset?: boolean;
  /** Keep mobile scrolling; let desktop children own their scroll panes. */
  desktopSplit?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  toolbar?: ReactNode;
  /** Controls after the header accessory (e.g. an app's refresh, right of its settings). */
  trailing?: ReactNode;
  breadcrumbControl?: ReactNode;
  /** @deprecated Host-owned settings always sit at the far right, after the toolbar. Kept so published apps still typecheck. */
  headerAccessoryPlacement?: "breadcrumb" | "trailing";
  breadcrumbs?: { label: string; href?: string; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void }[];
}) {
  const headerAccessory = useContext(WorkspaceHeaderAccessory);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header data-workspace-toolbar className="m-2 mb-0 flex h-[42px] shrink-0 items-center gap-[3px] rounded-xl bg-[var(--oathkeeper-canvas)] p-[3px] font-mono text-[12px] font-medium">
        <button type="button" aria-label="Open sidebar" aria-controls="oathkeeper-sidebar" aria-expanded={mobileSidebarOpen} onClick={onOpenSidebar} className="oathkeeper-raised-control flex size-9 shrink-0 items-center justify-center lg:hidden">
          <PanelLeftOpen className="size-4" strokeWidth={1.8}/>
        </button>
        <button type="button" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-controls="oathkeeper-sidebar" aria-expanded={!sidebarCollapsed} onClick={onSidebarToggle} className="oathkeeper-raised-control hidden size-9 shrink-0 items-center justify-center lg:flex">
          {sidebarCollapsed ? <PanelLeftOpen className="size-4" strokeWidth={1.8}/> : <PanelLeftClose className="size-4" strokeWidth={1.8}/>} 
        </button>
        {/* Long trails truncate and clip here instead of running under the controls on the right. */}
        <nav aria-label="Breadcrumb" className="flex h-9 min-w-0 items-center gap-1.5 overflow-hidden px-2 font-sans text-[12px]">
          {/* An empty trail means this is Home itself: show it as the current page, not a link to itself. */}
          {breadcrumbs?.length === 0 ? <span className="truncate text-[#f4f7f5]" aria-current="page">Home</span> : <Link href="/" className="shrink-0 text-[#919793] transition-colors hover:text-[#f4f7f5]">Home</Link>}
          {(breadcrumbs ?? [{ label: title }]).map((item, index, items) => <span key={`${item.label}-${index}`} className="contents"><span aria-hidden="true" className="shrink-0 text-[12px] leading-none text-[#686e6a]">›</span>{index === items.length - 1 && !(breadcrumbControl && item.href) ? <span className="truncate text-[#f4f7f5]" aria-current="page">{item.label}</span> : item.href ? <Link href={item.href} onClick={item.onClick} className="shrink-0 text-[#919793] transition-colors hover:text-[#f4f7f5]">{item.label}</Link> : <span className="shrink-0 text-[#919793]">{item.label}</span>}</span>)}
          {breadcrumbControl ? <><span aria-hidden="true" className="shrink-0 text-[12px] leading-none text-[#686e6a]">›</span><span className="flex min-w-0 items-center">{breadcrumbControl}</span></> : null}
        </nav>
        <div className="min-w-0 flex-1"/>
        {toolbar ?? (actionLabel && onAction ? <button type="button" onClick={onAction} className="oathkeeper-raised-control inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5"><Plus className="size-3.5"/>{actionLabel}</button> : null)}
        {headerAccessory}
        {trailing}
      </header>
      <div data-workspace-content className={cn(styles.content, "min-h-0 flex-1", scrollable ? "overflow-y-auto" : "overflow-hidden", desktopSplit && "lg:overflow-hidden")}>
        <div className={cn("mx-auto flex w-full", scrollable ? "min-h-full" : "h-full min-h-0", wide ? "max-w-none" : "max-w-[760px]", desktopSplit && "lg:h-full lg:min-h-0 lg:max-w-none")}>
          {children}
        </div>
        {scrollable ? <div data-dock-tail aria-hidden="true"/> : null}
      </div>
    </div>
  );
}
