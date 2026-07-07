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
  writeFile: (rootPath: string, relativePath: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('agent-workspace:write-file', rootPath, relativePath, content),
  createFile: (
    rootPath: string,
    relativePath: string,
    content?: string
  ): Promise<{ relativePath: string }> =>
    ipcRenderer.invoke('agent-workspace:create-file', rootPath, relativePath, content),
  createDirectory: (
    rootPath: string,
    relativePath: string
  ): Promise<{ relativePath: string }> =>
    ipcRenderer.invoke('agent-workspace:create-directory', rootPath, relativePath),
  deleteEntry: (rootPath: string, relativePath: string): Promise<boolean> =>
    ipcRenderer.invoke('agent-workspace:delete-entry', rootPath, relativePath),
  renameEntry: (
    rootPath: string,
    relativePath: string,
    nextName: string
  ): Promise<{ relativePath: string }> =>
    ipcRenderer.invoke('agent-workspace:rename-entry', rootPath, relativePath, nextName),
  searchFiles: (
    rootPath: string,
    options: import('@baishou/shared').WorkspaceSearchOptions
  ): Promise<import('@baishou/shared').WorkspaceSearchResult> =>
    ipcRenderer.invoke('agent-workspace:search-files', rootPath, options),
  replaceInFiles: (
    rootPath: string,
    options: import('@baishou/shared').WorkspaceReplaceOptions
  ): Promise<import('@baishou/shared').WorkspaceReplaceResult> =>
    ipcRenderer.invoke('agent-workspace:replace-in-files', rootPath, options),
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
    ipcRenderer.invoke('agent-workspace:rollback-round', params),
  git: {
    isInitialized: (folderRoot: string): Promise<boolean> =>
      ipcRenderer.invoke('agent-workspace:git-is-initialized', folderRoot),
    init: (folderRoot: string): Promise<{ success: boolean; message?: string }> =>
      ipcRenderer.invoke('agent-workspace:git-init', folderRoot),
    getStatus: (folderRoot: string) => ipcRenderer.invoke('agent-workspace:git-get-status', folderRoot),
    stageFile: (folderRoot: string, filePath: string) =>
      ipcRenderer.invoke('agent-workspace:git-stage-file', folderRoot, filePath),
    stageAll: (folderRoot: string) => ipcRenderer.invoke('agent-workspace:git-stage-all', folderRoot),
    unstageFile: (folderRoot: string, filePath: string) =>
      ipcRenderer.invoke('agent-workspace:git-unstage-file', folderRoot, filePath),
    unstageAll: (folderRoot: string) => ipcRenderer.invoke('agent-workspace:git-unstage-all', folderRoot),
    discardFile: (folderRoot: string, filePath: string) =>
      ipcRenderer.invoke('agent-workspace:git-discard-file', folderRoot, filePath),
    discardAllChanges: (folderRoot: string) =>
      ipcRenderer.invoke('agent-workspace:git-discard-all', folderRoot),
    commitStaged: (folderRoot: string, message: string) =>
      ipcRenderer.invoke('agent-workspace:git-commit-staged', folderRoot, message),
    commitAll: (folderRoot: string, message: string) =>
      ipcRenderer.invoke('agent-workspace:git-commit-all', folderRoot, message),
    getHistory: (folderRoot: string, filePath?: string, limit?: number) =>
      ipcRenderer.invoke('agent-workspace:git-get-history', folderRoot, filePath, limit),
    getRecentPulls: (folderRoot: string, limit?: number) =>
      ipcRenderer.invoke('agent-workspace:git-get-recent-pulls', folderRoot, limit),
    getCommitChanges: (folderRoot: string, commitHash: string) =>
      ipcRenderer.invoke('agent-workspace:git-get-commit-changes', folderRoot, commitHash),
    getFileDiff: (folderRoot: string, filePath: string, commitHash?: string) =>
      ipcRenderer.invoke('agent-workspace:git-get-file-diff', folderRoot, filePath, commitHash),
    getWorkingDiff: (folderRoot: string, filePath: string, staged: boolean) =>
      ipcRenderer.invoke('agent-workspace:git-get-working-diff', folderRoot, filePath, staged),
    getHeadFileContent: (folderRoot: string, filePath: string) =>
      ipcRenderer.invoke('agent-workspace:git-get-head-file-content', folderRoot, filePath),
    hasConflicts: (folderRoot: string) =>
      ipcRenderer.invoke('agent-workspace:git-has-conflicts', folderRoot),
    getConflicts: (folderRoot: string) =>
      ipcRenderer.invoke('agent-workspace:git-get-conflicts', folderRoot),
    resolveConflict: (folderRoot: string, filePath: string, resolution: 'ours' | 'theirs') =>
      ipcRenderer.invoke('agent-workspace:git-resolve-conflict', folderRoot, filePath, resolution),
    rollbackFile: (folderRoot: string, filePath: string, commitHash: string) =>
      ipcRenderer.invoke('agent-workspace:git-rollback-file', folderRoot, filePath, commitHash),
    rollbackAll: (folderRoot: string, commitHash: string) =>
      ipcRenderer.invoke('agent-workspace:git-rollback-all', folderRoot, commitHash),
    getRollbackAllContext: (folderRoot: string, commitHash: string) =>
      ipcRenderer.invoke('agent-workspace:git-get-rollback-all-context', folderRoot, commitHash),
    push: (folderRoot: string) => ipcRenderer.invoke('agent-workspace:git-push', folderRoot),
    pull: (folderRoot: string) => ipcRenderer.invoke('agent-workspace:git-pull', folderRoot),
    getBranchInfo: (folderRoot: string) =>
      ipcRenderer.invoke('agent-workspace:git-get-branch-info', folderRoot),
    checkoutBranch: (folderRoot: string, branch: string) =>
      ipcRenderer.invoke('agent-workspace:git-checkout-branch', folderRoot, branch),
    createBranch: (folderRoot: string, branch: string) =>
      ipcRenderer.invoke('agent-workspace:git-create-branch', folderRoot, branch),
    setRemoteUrl: (folderRoot: string, url: string) =>
      ipcRenderer.invoke('agent-workspace:git-set-remote-url', folderRoot, url),
    getConfig: (folderRoot: string) => ipcRenderer.invoke('agent-workspace:git-get-config', folderRoot),
    saveConfig: (folderRoot: string, partial: unknown) =>
      ipcRenderer.invoke('agent-workspace:git-save-config', folderRoot, partial),
    testRemote: (folderRoot: string) => ipcRenderer.invoke('agent-workspace:git-test-remote', folderRoot),
    mergeBranch: (folderRoot: string, branch: string) =>
      ipcRenderer.invoke('agent-workspace:git-merge-branch', folderRoot, branch),
    deleteBranch: (folderRoot: string, branch: string, force?: boolean) =>
      ipcRenderer.invoke('agent-workspace:git-delete-branch', folderRoot, branch, force),
    publishBranch: (folderRoot: string, branch?: string) =>
      ipcRenderer.invoke('agent-workspace:git-publish-branch', folderRoot, branch),
    listStash: (folderRoot: string) => ipcRenderer.invoke('agent-workspace:git-list-stash', folderRoot),
    stashPush: (folderRoot: string, message?: string) =>
      ipcRenderer.invoke('agent-workspace:git-stash-push', folderRoot, message),
    stashApply: (folderRoot: string, index: number) =>
      ipcRenderer.invoke('agent-workspace:git-stash-apply', folderRoot, index),
    stashPop: (folderRoot: string, index: number) =>
      ipcRenderer.invoke('agent-workspace:git-stash-pop', folderRoot, index),
    stashDrop: (folderRoot: string, index: number) =>
      ipcRenderer.invoke('agent-workspace:git-stash-drop', folderRoot, index)
  }
}
