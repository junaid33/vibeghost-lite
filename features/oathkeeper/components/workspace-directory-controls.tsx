"use client";
import { Fragment } from "react";
import { Check, IconMagnifierOutlineDuo18 as Search, Plus, Settings2, X } from "@/components/icons/duo";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { WorkspaceRefreshControl } from "./workspace-refresh-control";
import filterStyles from "./workspace-filter-menu.module.css";
import bar from "./directory-toolbar.module.css";

type Option = { id: string; name: string };

/** One filter row: the current choice is raised and checked (no radio dot). */
function FilterItem({ value, name }: { value: string; name: string }) {
  return <DropdownMenuPrimitive.RadioItem value={value} className={filterStyles.item}>
    <span className={filterStyles.name}>{name}</span>
    <DropdownMenuPrimitive.ItemIndicator><Check className={filterStyles.check} aria-hidden="true"/></DropdownMenuPrimitive.ItemIndicator>
  </DropdownMenuPrimitive.RadioItem>;
}
export function WorkspaceDirectoryControls({ label, query, onQueryChange, searchLabel, placeholder, filter, onFilterChange, groups, refreshing, error, refreshLabel, onRefresh, onConnect }: {
  label: string; query: string; onQueryChange: (value: string) => void; searchLabel: string; placeholder: string;
  filter: string; onFilterChange: (value: string) => void; groups: { label: string; items: Option[] }[];
  refreshing: boolean; error: string; refreshLabel: string; onRefresh: () => void; onConnect?: () => void;
}) {
  const filterLabel = groups.flatMap(group => group.items).find(item => item.id === filter)?.name || "All workspaces";
  // The CRM table toolbar (Outreach, Companies…) verbatim: same card, same 32px
  // list controls, so these pages read as the same family as the table pages.
  return <div className={cn("crm-records", bar.records)}><div role="group" aria-label={label} className={cn("records-toolbar", bar.toolbar)}>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button type="button" aria-label="Filter workspaces" title={filterLabel} className={cn("records-select-button shrink-0 justify-center max-sm:!w-8 max-sm:!px-0", bar.filter)}><Settings2 className="size-3.5 shrink-0"/><span className={bar.filterLabel}>{filterLabel}</span></button></DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={filterStyles.menu}>
        <DropdownMenuPrimitive.RadioGroup value={filter} onValueChange={onFilterChange}>
          <FilterItem value="all" name="All workspaces"/>
          {groups.map(group => group.items.length ? <Fragment key={group.label}><div role="presentation" className={filterStyles.label}>{group.label}</div>{group.items.map(item => <FilterItem key={item.id} value={item.id} name={item.name}/>)}</Fragment> : null)}
        </DropdownMenuPrimitive.RadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
    <label data-workspace-search className="records-select-button min-w-0 flex-1 !justify-start !px-2.5">
      <Search className="size-3.5 shrink-0"/>
      <input aria-label={searchLabel} placeholder={placeholder} value={query} onChange={event => onQueryChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none"/>
      {query ? <button type="button" aria-label={`Clear ${searchLabel.toLowerCase().replace(/^search /, "").replace(/s$/, "")} search`} onClick={() => onQueryChange("")} className={bar.clear}><X className="size-3.5"/></button> : null}
    </label>
    <WorkspaceRefreshControl label={refreshLabel} error={error} refreshing={refreshing} onRefresh={onRefresh} className="records-select-button records-icon-button !size-8 !p-0"/>
    {onConnect ? <button type="button" aria-label="Add workspace" title="Connect a workspace" onClick={onConnect} className="records-select-button records-icon-button !size-8 !p-0"><Plus className="size-3.5"/></button> : null}
  </div></div>;
}
