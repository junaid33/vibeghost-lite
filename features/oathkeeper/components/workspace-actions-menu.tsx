"use client";
import { AddCircle, MoreHorizontal, Pin, Plus, RefreshCw, StopCircle, CloseCircle, IconSquarePlusFillDuo18 } from "@/components/icons/duo";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { connectWorkspace } from "../lib/workspace-connect-request";
import type { SessionManagementAction } from "./workspace-session-manager";
/** A workspace's ⋯ menu: VibeGhost's Quick create and New session… first, then pin and bulk session actions. */
export function WorkspaceActionsMenu({ label, className, pinned, pinDisabled, onTogglePin, onCreate, onNewSession, createDisabled = false, onManage }: { label: string; className?: string; pinned?: boolean; pinDisabled?: boolean; onTogglePin?: () => void; onCreate?: () => void; onNewSession?: () => void; createDisabled?: boolean; onManage: (action: SessionManagementAction) => void }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className={className} aria-label={`Actions for ${label}`} title={`Actions for ${label}`}><MoreHorizontal className="size-3.5"/></button></DropdownMenuTrigger><DropdownMenuContent align="end">
    {onCreate ? <DropdownMenuItem disabled={createDisabled} onSelect={onCreate}><IconSquarePlusFillDuo18 className="size-4"/>{createDisabled ? "Creating session…" : "Quick create"}</DropdownMenuItem> : null}
    {onNewSession ? <DropdownMenuItem onSelect={onNewSession}><AddCircle className="size-4"/>New session…</DropdownMenuItem> : null}
    {onCreate || onNewSession ? <DropdownMenuSeparator/> : null}
    {onTogglePin ? <DropdownMenuItem disabled={pinDisabled} onSelect={onTogglePin}><Pin className="size-4"/>{pinned ? "Unpin workspace" : "Pin workspace"}</DropdownMenuItem> : null}
    <DropdownMenuItem onSelect={() => onManage("resume")}><RefreshCw className="size-4"/>Resume sessions…</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onManage("stop")}><StopCircle className="size-4"/>Stop sessions…</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => onManage("delete")}><CloseCircle className="size-4"/>Delete exited sessions…</DropdownMenuItem>
    <DropdownMenuSeparator/>
    <DropdownMenuItem onSelect={connectWorkspace}><Plus className="size-4"/>Add workspace…</DropdownMenuItem>
  </DropdownMenuContent></DropdownMenu>;
}
