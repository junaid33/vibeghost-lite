import { Workspaces, AppDashboard, Inbox, Layers3, Globe, Fire, AppGrid, Briefcase, Cpu, IconBookmarksFillDuo18, MessageCircle, Palette, ShoppingBag, Slideshow, Image, MessagesSquare, Network } from "@/components/icons/duo";
import type { SVGProps } from "react";
import styles from "./navigation-icons.module.css";
import { IconMsgsFillDuo18, IconUsersFillDuo18, IconRocketFillDuo18, IconEnvelopeFillDuo18, IconGear2FillDuo18, IconHalfDottedCirclePlayFillDuo18 } from "@/components/icons/duo";

// One registry for sidebar, dock, and More menu. Home and storefront use
// locally copied DuoIcons filled-duotone geometry.
function CursorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...props}>
      <path d="M15.554 5.748 3.724 1.367c-.679-.251-1.423-.09-1.935.423-.513.513-.674 1.253-.422 1.933l4.381 11.83c.27.728.944 1.197 1.72 1.197h.01c.778-.004 1.452-.48 1.716-1.213l1.626-4.517a.337.337 0 0 1 .201-.201l4.517-1.626c.733-.264 1.209-.938 1.213-1.717.004-.779-.466-1.458-1.197-1.728Z" fill="currentColor"/>
    </svg>
  );
}

function SelectionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...props}>
      <g fill="currentColor">
        <path d="M14.25 16.5h-.75a.75.75 0 0 1 0-1.5h.75a.75.75 0 0 0 .75-.75v-.75a.75.75 0 0 1 1.5 0v.75a2.253 2.253 0 0 1-2.25 2.25Z"/>
        <path d="M10.5 16.5h-.75a2.253 2.253 0 0 1-2.25-2.25v-.75a.75.75 0 0 1 1.5 0v.75c0 .414.337.75.75.75h.75a.75.75 0 0 1 0 1.5Z"/>
        <path d="M15.75 11.25a.75.75 0 0 1-.75-.75v-.75a.75.75 0 0 0-.75-.75h-.75a.75.75 0 0 1 0-1.5h.75a2.253 2.253 0 0 1 2.25 2.25v.75a.75.75 0 0 1-.75.75Z"/>
        <path d="M8.25 11.25a.75.75 0 0 1-.75-.75v-.75A2.253 2.253 0 0 1 9.75 7.5h.75a.75.75 0 0 1 0 1.5h-.75a.75.75 0 0 0-.75.75v.75a.75.75 0 0 1-.75.75Z"/>
        <path opacity=".45" d="M15.068 1.5h-1.636A1.432 1.432 0 0 0 12 2.932V3H6v-.068A1.432 1.432 0 0 0 4.568 1.5H2.932A1.432 1.432 0 0 0 1.5 2.932v1.636A1.432 1.432 0 0 0 2.932 6H3v6h-.068A1.432 1.432 0 0 0 1.5 13.432v1.636A1.432 1.432 0 0 0 2.932 16.5h1.636A1.432 1.432 0 0 0 6 15.068v-1.636A1.432 1.432 0 0 0 4.568 12H4V6h.568A1.432 1.432 0 0 0 6 4.568V4h6v.568A1.432 1.432 0 0 0 13.432 6h1.636A1.432 1.432 0 0 0 16.5 4.568V2.932A1.432 1.432 0 0 0 15.068 1.5Z"/>
      </g>
    </svg>
  );
}

function MagnifierIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" {...props}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor">
        <path d="m15.75 15.75-4.111-4.111"/>
        <path d="M7.75 13.25a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z"/>
      </g>
    </svg>
  );
}

const navigationIcons = {
  home: { Component: AppGrid, source: "duo-icons", icon: "app" },
  chat: { Component: MessageCircle, source: "duo-icons", icon: "message" },
  calendar: { Component: CursorIcon, source: "lab01-dock-svg", icon: "cursor" },
  kanban: { Component: SelectionIcon, source: "lab01-dock-svg", icon: "selection" },
  vibeghost: { Component: Cpu, source: "duo-icons", icon: "chip" },
  search: { Component: MagnifierIcon, source: "lab01-dock-svg", icon: "magnifier" },
  analytics: { Component: Globe, source: "duo-icons", icon: "world" },
  social: { Component: IconMsgsFillDuo18, source: "duo-icons", icon: "msgs" },
  gtm: { Component: Fire, source: "duo-icons", icon: "fire" },
  curator: { Component: IconBookmarksFillDuo18, source: "duo-icons", icon: "bookmarks" },
  studio: { Component: IconHalfDottedCirclePlayFillDuo18, source: "duo-icons", icon: "half-dotted-circle-play" },
  designer: { Component: Palette, source: "duo-icons", icon: "palette" },
  storefronts: { Component: Slideshow, source: "duo-icons", icon: "slideshow" },
  canvas: { Component: Layers3, source: "duo-icons", icon: "layers-3" },
  reports: { Component: Inbox, source: "duo-icons", icon: "inbox" },
  board: { Component: MessagesSquare, source: "duo-icons", icon: "messages-square" },
  rounds: { Component: Image, source: "duo-icons", icon: "camera-square" },
  railway: { Component: Network, source: "duo-icons", icon: "bridge" },
  apps: { Component: AppDashboard, source: "duo-icons", icon: "dashboard" },
  products: { Component: ShoppingBag, source: "duo-icons", icon: "shopping-bag" },
  crm: { Component: Briefcase, source: "duo-icons", icon: "briefcase" },
  people: { Component: IconUsersFillDuo18, source: "duo-icons", icon: "users" },
  demos: { Component: IconRocketFillDuo18, source: "duo-icons", icon: "rocket" },
  outreach: { Component: IconEnvelopeFillDuo18, source: "duo-icons", icon: "envelope" },
  orchestration: { Component: Workspaces, source: "duo-icons", icon: "stack" },
  settings: { Component: IconGear2FillDuo18, source: "duo-icons", icon: "gear-2" },
} as const;

export type NavigationIconName = keyof typeof navigationIcons;

export function NavigationIcon({ name }: { name: NavigationIconName }) {
  const { Component, source, icon } = navigationIcons[name];
  return <Component className={"size-[18px] shrink-0 "+styles.icon} aria-hidden="true" focusable="false" data-navigation-icon={name} data-duo-icon={icon} data-icon-source={source}/>;
}
