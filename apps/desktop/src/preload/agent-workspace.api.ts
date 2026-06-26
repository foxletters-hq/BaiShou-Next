import { ipcRenderer } from 'electron'
import type {
  AgentWorkspaceDirEntry,
  AgentWorkspaceEntry,
  AgentWorkspaceEntryUpdate,
  AgentWorkspaceReadFileResult,
  AgentWorkspaceSessionListItem
} from '@baishou/shared'

export const agentWorkspaceApi = {
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('agent-workspace:pick-folder'),
  listWorkspaces: (): Promise<AgentWorkspaceEntry[]> =>
    ipcRenderer.invoke('agent-workspace:list-workspaces'),
  addWorkspace: (folderRoot: string): Promise<AgentWorkspaceEntry | null> =>
    ipcRenderer.invoke('agent-workspace:add-workspace', folderRoot),
  updateWorkspace: (
    workspaceId: string,
    patch: AgentWorkspaceEntryUpdate
  ): Promise<AgentWorkspaceEntry | null> =>
    ipcRenderer.invoke('agent-workspace:update-workspace', { workspaceId, patch }),
  getLastActiveWorkspaceId: (): Promise<string | undefined> =>
    ipcRenderer.invoke('agent-workspace:get-last-active-workspace-id'),
  setLastActiveWorkspaceId: (workspaceId: string | null): Promise<boolean> =>
    ipcRenderer.invoke('agent-workspace:set-last-active-workspace-id', workspaceId),
  pickAvatar: (): Promise<string | null> => ipcRenderer.invoke('agent-workspace:pick-avatar'),
  listDir: (rootPath: string, relativePath?: string): Promise<AgentWorkspaceDirEntry[]> =>
    ipcRenderer.invoke('agent-workspace:list-dir', rootPath, relativePath),
  readFile: (rootPath: string, relativePath: string): Promise<AgentWorkspaceReadFileResult> =>
    ipcRenderer.invoke('agent-workspace:read-file', rootPath, relativePath),
  createSession: (params: {
    id?: string
    folderRoot: string
    assistantId?: string
    title?: string
  }): Promise<string> => ipcRenderer.invoke('agent-workspace:create-session', params),
  getBinding: (
    sessionId: string
  ): Promise<{ sessionId: string; folderRoot: string } | null> =>
    ipcRenderer.invoke('agent-workspace:get-binding', sessionId),
  listSessions: (): Promise<AgentWorkspaceSessionListItem[]> =>
    ipcRenderer.invoke('agent-workspace:list-sessions'),
  deleteSession: (sessionId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('agent-workspace:delete-session', sessionId),
  chat: (params: {
    sessionId: string
    text: string
    userMessageId?: string
    providerId?: string
    modelId?: string
  }): Promise<boolean> => ipcRenderer.invoke('agent-workspace:chat', params),
  rollbackRound: (params: {
    sessionId: string
    userMessageId: string
  }): Promise<{ restored: string[]; deleted: string[]; skipped: string[] }> =>
    ipcRenderer.invoke('agent-workspace:rollback-round', params)
}
