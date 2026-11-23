"use client";

import { Fragment, useCallback, useRef, type ComponentProps, type ComponentType, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ListFilter, SearchDuo, X } from "@/components/icons/duo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import menu from "./workspace-filter-menu.module.css";
import styles from "./app-search-toolbar.module.css";

/** Every page's search row, after Studio's: one card holding the filter dropdown, the
 *  search field and any actions (either side). `inset` sizes it for the first row of a
 *  records table shell and keeps the host's controls there. */
export function AppSearchToolbar({ label, inset = false, className, children, ...props }: HTMLAttributes<HTMLDivElement> & { label: string; inset?: boolean; children: ReactNode }) {
  return <div role="group" aria-label={label} data-inset={inset || undefined} {...props} className={cn(styles.toolbar, className)}>{children}</div>;
}

export type ToolbarFilterOption = { value: string; label: string; count?: number; disabled?: boolean };
export type ToolbarFilterGroup = { label?: string; value: string; options: ToolbarFilterOption[]; onChange: (value: string) => void };
export type ToolbarFilterToggle = { label: string; checked: boolean; onChange: (checked: boolean) => void };

/** The filter trigger on its own, for pages that keep their own menu (wrap it in a
 *  DropdownMenuTrigger asChild). The current choice's label (and count) show from 640px. */
export function ToolbarFilterButton({ label, current, active = false, icon, count, className, ...props }: Omit<ComponentProps<"button">, "children"> & {
  /** What is being filtered, for the accessible name ("Filter companies"). */
  label: string;
  /** The visible label: the current choice ("All statuses", "2 filters"). */
  current: string;
  /** A non-default filter is applied. */
  active?: boolean;
  icon?: ReactNode;
  /** How many records the current choice holds. */
  count?: number;
}) {
  return <button type="button" aria-label={`${label}: ${current}${count !== undefined ? `, ${count.toLocaleString()}` : ""}`} title={label} data-active={active || undefined} {...props} className={cn("oathkeeper-raised-control", styles.filter, className)}>
    {icon ?? <ListFilter aria-hidden="true"/>}<span className={styles.filterLabel} aria-hidden="true">{current}</span>
    {count !== undefined ? <span className={cn(styles.count, styles.filterCount)} aria-hidden="true">{count.toLocaleString()}</span> : null}
  </button>;
}

/** One radio choice per group (and optional on/off toggles), with the current choice
 *  raised and checked. The trigger shows the current label from 640px. */
export function ToolbarFilter({ label, current, active = false, icon, groups = [], toggles = [], onClear, children }: {
  /** What is being filtered, for the accessible name ("Filter companies"). */
  label: string;
  /** The trigger's visible label: the current choice ("All statuses", "2 filters"). */
  current: string;
  /** A non-default filter is applied. */
  active?: boolean;
  icon?: ReactNode;
  groups?: ToolbarFilterGroup[];
  toggles?: ToolbarFilterToggle[];
  /** Shown as a final "Clear filters" row while `active`. */
  onClear?: () => void;
  /** Extra rows (e.g. submenus) after the groups. */
  children?: ReactNode;
}) {
  return <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <ToolbarFilterButton label={label} current={current} active={active} icon={icon}/>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" sideOffset={6} collisionPadding={12} className={menu.menu}>
      {groups.map((group, index) => <Fragment key={group.label ?? index}>
        {index ? <DropdownMenuSeparator/> : null}
        {group.label ? <div role="presentation" className={menu.label}>{group.label}</div> : null}
        <DropdownMenuPrimitive.RadioGroup value={group.value} onValueChange={group.onChange}>
          {group.options.map(option => <DropdownMenuPrimitive.RadioItem key={option.value} value={option.value} disabled={option.disabled} className={menu.item}>
            <span className={menu.name}>{option.label}</span>
            {option.count !== undefined ? <span className={styles.count}>{option.count.toLocaleString()}</span> : null}
            <DropdownMenuPrimitive.ItemIndicator><Check className={menu.check} aria-hidden="true"/></DropdownMenuPrimitive.ItemIndicator>
          </DropdownMenuPrimitive.RadioItem>)}
        </DropdownMenuPrimitive.RadioGroup>
      </Fragment>)}
      {toggles.length ? <>
        {groups.length ? <DropdownMenuSeparator/> : null}
        {toggles.map(toggle => <DropdownMenuPrimitive.CheckboxItem key={toggle.label} checked={toggle.checked} onCheckedChange={value => toggle.onChange(value === true)} className={menu.item}>
          <span className={menu.name}>{toggle.label}</span>
          <DropdownMenuPrimitive.ItemIndicator><Check className={menu.check} aria-hidden="true"/></DropdownMenuPrimitive.ItemIndicator>
        </DropdownMenuPrimitive.CheckboxItem>)}
      </> : null}
      {children}
      {active && onClear ? <><DropdownMenuSeparator/><DropdownMenuPrimitive.Item onSelect={onClear} className={styles.clearRow}><span className={menu.name}>Clear filters</span></DropdownMenuPrimitive.Item></> : null}
    </DropdownMenuContent>
  </DropdownMenu>;
}

/** The search field: a recessed band with the magnifier, the input and a clear button.
 *  Escape clears it unless the page's own onKeyDown handled the key first. Other input
 *  props (id, maxLength, combobox ARIA, onPaste…) pass through to the input. */
export function ToolbarSearch({ label, value, onChange, onClear, placeholder, shortcut, inputRef, onKeyDown, ...inputProps }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "className"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Empties the field for the clear button and Escape; defaults to onChange(""). */
  onClear?: () => void;
  /** The key that focuses the field from elsewhere on the page ("/"), shown while it is empty. */
  shortcut?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const field = useRef<HTMLInputElement | null>(null);
  const attach = useCallback((node: HTMLInputElement | null) => {
    field.current = node;
    if (typeof inputRef === "function") inputRef(node);
    else if (inputRef) inputRef.current = node;
  }, [inputRef]);
  const clear = () => { if (onClear) onClear(); else onChange(""); };
  return <div role="search" className={styles.searchBox}>
    <SearchDuo className={styles.searchIcon} aria-hidden="true"/>
    <input ref={attach} type="search" aria-label={label} value={value} placeholder={placeholder ?? `${label}…`} autoComplete="off" spellCheck={false} {...inputProps}
      onChange={event => onChange(event.target.value)}
      onKeyDown={event => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === "Escape" && value && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); clear(); }
      }}
      className={styles.searchInput}/>
    {value ? <button type="button" aria-label="Clear search" onClick={() => { clear(); field.current?.focus(); }} className={styles.searchClear}><X aria-hidden="true"/></button>
      : shortcut ? <kbd className={styles.searchKey} aria-hidden="true">{shortcut}</kbd> : null}
  </div>;
}

/** A raised action beside the search field. With `showLabel`, the label appears from 640px;
 *  an explicit aria-label overrides `label` for assistive tech. */
export function ToolbarAction({ label, showLabel = false, children, className, ...props }: ComponentProps<"button"> & { label: string; showLabel?: boolean }) {
  return <button type="button" aria-label={label} title={label} data-labelled={showLabel || undefined} {...props} className={cn("oathkeeper-raised-control", styles.action, className)}>
    {children}{showLabel ? <span className={styles.actionLabel} aria-hidden="true">{label}</span> : null}
  </button>;
}

type ToolbarLink = ComponentType<{ href: string; className?: string; title?: string; "aria-label"?: string; "data-labelled"?: true; children?: ReactNode }>;
/** The same action as a link. `link` is the page's link component (next/link, or the
 *  custom-app host's Link). */
export function ToolbarLinkAction({ link: LinkComponent, href, label, showLabel = false, children, className }: { link: ToolbarLink; href: string; label: string; showLabel?: boolean; className?: string; children?: ReactNode }) {
  return <LinkComponent href={href} aria-label={label} title={label} data-labelled={showLabel || undefined} className={cn("oathkeeper-raised-control", styles.action, className)}>
    {children}{showLabel ? <span className={styles.actionLabel} aria-hidden="true">{label}</span> : null}
  </LinkComponent>;
}
