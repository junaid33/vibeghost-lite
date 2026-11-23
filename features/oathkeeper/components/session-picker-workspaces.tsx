import { Circle } from "@/components/icons/duo";
import { WorkspaceMark } from "./vibeghost-workspace-icon";
import { instancePlatformLabel } from "@/features/oathkeeper/lib/shared-workspace-model";
import { SessionCardMetadata } from "./session-card-metadata";
import type { PickerAction, PickerSession, PickerWorkspace } from "./session-picker-menu";
import type { VibeGhostSession, VibeGhostWorkspace } from "./vibeghost-view";

export function workspaceMachineLabel(workspace: VibeGhostWorkspace) {
  return workspace.instance?.name || (workspace.instance ? instancePlatformLabel(workspace.instance.platform) : "Unknown computer");
}

export const pickerSessions = (items: VibeGhostSession[]): PickerSession[] => items.map(item => ({id:item.id,title:item.title,path:item.gitRepoPath || item.cwd || '',exited:item.status === 'exited',activity:item,metadata:<SessionCardMetadata session={item} separated/>}));

/** Workspace/session rows shared by the session dropdown and the Tabs add menu,
 *  so both surfaces always list the same sessions in the same order. */
export function sessionPickerWorkspaces({ sessions, workspaces, isPinned, workspaceActions = () => [], localSessionActions = () => [] }: {
  sessions: VibeGhostSession[];
  workspaces: VibeGhostWorkspace[];
  isPinned: (workspaceId: string) => boolean;
  workspaceActions?: (workspace: VibeGhostWorkspace) => PickerAction[];
  localSessionActions?: (session: VibeGhostSession) => PickerAction[];
}): PickerWorkspace[] {
  const result: PickerWorkspace[] = workspaces.map(workspace => ({
    id:workspace.id,name:workspace.name,pinned:isPinned(workspace.id),detail:workspaceMachineLabel(workspace),
    avatar:<WorkspaceMark workspace={workspace} className="size-5"/>,
    sessions:pickerSessions(sessions.filter(item => item.workspaceId === workspace.id)),
    actions:workspaceActions(workspace),
  }));
  const localSessions = sessions.filter(item => !item.workspaceId);
  if (localSessions.length) result.push({id:'local-sessions',name:'Local sessions',avatar:<Circle className="size-5"/>,actions:[],sessions:pickerSessions(localSessions).map((item, index) => ({...item,actions:localSessionActions(localSessions[index])}))});
  return result;
}
