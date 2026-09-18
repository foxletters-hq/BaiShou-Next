/** 桌面工作区与工作区 Git preload 类型，从全局 IPC 声明按域拆出。 */
interface AgentWorkspaceAPI {
  pickFolder(): Promise<string | null>
  listWorkspaces(): Promise<import('@baishou/shared').AgentWorkspaceEntry[]>
  ensureScratchWorkspace(): Promise<import('@baishou/shared').AgentWorkspaceEntry>
  addWorkspace(folderRoot: string): Promise<import('@baishou/shared').AgentWorkspaceEntry | null>
  updateWorkspace(
    workspaceId: string,
    patch: import('@baishou/shared').AgentWorkspaceEntryUpdate
  ): Promise<import('@baishou/shared').AgentWorkspaceEntry | null>
  removeWorkspace(workspaceId: string): Promise<boolean>
  getLastActiveWorkspaceId(): Promise<string | undefined>
  setLastActiveWorkspaceId(workspaceId: string | null): Promise<boolean>
  pickAvatar(): Promise<string | null>
  listDir(
    rootPath: string,
    relativePath?: string
  ): Promise<import('@baishou/shared').AgentWorkspaceDirEntry[]>
  readFile(
    rootPath: string,
    relativePath: string
  ): Promise<import('@baishou/shared').AgentWorkspaceReadFileResult>
  writeFile(rootPath: string, relativePath: string, content: string): Promise<boolean>
  createFile(
    rootPath: string,
    relativePath: string,
    content?: string
  ): Promise<{ relativePath: string }>
  createDirectory(rootPath: string, relativePath: string): Promise<{ relativePath: string }>
  deleteEntry(rootPath: string, relativePath: string): Promise<boolean>
  renameEntry(
    rootPath: string,
    relativePath: string,
    nextName: string
  ): Promise<{ relativePath: string }>
  moveEntry(
    rootPath: string,
    fromRelative: string,
    toParentRelative: string
  ): Promise<{ relativePath: string }>
  copyEntry(
    rootPath: string,
    fromRelative: string,
    toParentRelative: string
  ): Promise<{ relativePath: string }>
  importExternalPaths(
    rootPath: string,
    toParentRelative: string,
    absolutePaths: string[]
  ): Promise<{ imported: string[] }>
  getPathForFile(file: File): string
  searchFiles(
    rootPath: string,
    options: import('@baishou/shared').WorkspaceSearchOptions
  ): Promise<import('@baishou/shared').WorkspaceSearchResult>
  replaceInFiles(
    rootPath: string,
    options: import('@baishou/shared').WorkspaceReplaceOptions
  ): Promise<import('@baishou/shared').WorkspaceReplaceResult>
  createSession(params: {
    id?: string
    folderRoot: string
    assistantId?: string
    title?: string
    providerId?: string
    modelId?: string
  }): Promise<string>
  getBinding(sessionId: string): Promise<{
    sessionId: string
    folderRoot: string
    notebookId?: string
  } | null>
  attachNotebook(params: {
    sessionId: string
    notebookId?: string | null
    notebookIds?: string[]
  }): Promise<{
    sessionId: string
    folderRoot: string
    notebookId?: string
  } | null>
  listSessions(): Promise<import('@baishou/shared').AgentWorkspaceSessionListItem[]>
  pinSession(sessionId: string, isPinned: boolean): Promise<{ success: boolean }>
  deleteSession(sessionId: string): Promise<{ success: boolean }>
  watchFolder(folderRoot: string): Promise<boolean>
  unwatchFolder(folderRoot: string): Promise<boolean>
  onFsChanged(
    callback: (payload: {
      folderRoot?: string
      sessionId?: string
      path: string
      kind: 'create' | 'modify' | 'delete' | 'rename'
      previousPath?: string
    }) => void
  ): () => void
  chat(params: {
    sessionId: string
    text: string
    userMessageId?: string
    providerId?: string
    modelId?: string
    reasoningEffort?: string
    searchMode?: boolean
  }): Promise<boolean>
  admit(params: {
    sessionId: string
    text: string
    delivery?: 'steer' | 'queue'
    userMessageId?: string
    providerId?: string
    modelId?: string
    reasoningEffort?: string
    searchMode?: boolean
    forceStart?: boolean
  }): Promise<{
    input: import('@baishou/shared').SessionInputRecord
    started: boolean
    queued: boolean
  }>
  listPendingInputs(sessionId: string): Promise<import('@baishou/shared').SessionInputRecord[]>
  cancelPendingInput(inputId: string): Promise<import('@baishou/shared').SessionInputRecord | null>
  previewRollback(params: {
    sessionId: string
    userMessageId: string
  }): Promise<import('@baishou/shared').WorkspaceRollbackPreview>
  rollbackRound(params: {
    sessionId: string
    userMessageId: string
    scope?: import('@baishou/shared').WorkspaceRollbackScope
  }): Promise<{ restored: string[]; deleted: string[]; skipped: string[] }>
  getAutoAccept(workspaceId: string): Promise<boolean>
  setAutoAccept(workspaceId: string, enabled: boolean): Promise<boolean>
  git: AgentWorkspaceGitAPI
}

interface AgentWorkspaceGitAPI {
  isInitialized(folderRoot: string): Promise<boolean>
  init(folderRoot: string): Promise<{ success: boolean; message?: string }>
  getStatus(folderRoot: string): Promise<import('@baishou/shared').GitStatus>
  stageFile(folderRoot: string, filePath: string): Promise<{ success: boolean; message?: string }>
  stageAll(folderRoot: string): Promise<{ success: boolean; message?: string }>
  unstageFile(folderRoot: string, filePath: string): Promise<{ success: boolean }>
  unstageAll(folderRoot: string): Promise<{ success: boolean }>
  discardFile(folderRoot: string, filePath: string): Promise<{ success: boolean }>
  discardAllChanges(folderRoot: string): Promise<{ success: boolean }>
  commitStaged(
    folderRoot: string,
    message: string
  ): Promise<import('@baishou/shared').GitCommit | null>
  commitAll(
    folderRoot: string,
    message: string
  ): Promise<import('@baishou/shared').GitCommit | null>
  getHistory(
    folderRoot: string,
    filePath?: string | null,
    limit?: number,
    offset?: number
  ): Promise<import('@baishou/shared').VersionHistoryEntry[]>
  getHistoryCount(folderRoot: string, filePath?: string | null): Promise<number>
  getRecentPulls(
    folderRoot: string,
    limit?: number
  ): Promise<import('@baishou/shared').VersionHistoryEntry[]>
  getCommitChanges(
    folderRoot: string,
    commitHash: string
  ): Promise<import('@baishou/shared').FileChange[]>
  getFileDiff(
    folderRoot: string,
    filePath: string,
    commitHash?: string
  ): Promise<import('@baishou/shared').FileDiff>
  getWorkingDiff(
    folderRoot: string,
    filePath: string,
    staged: boolean
  ): Promise<import('@baishou/shared').FileDiff>
  getHeadFileContent(folderRoot: string, filePath: string): Promise<string | null>
  getFileContentAtRevision(
    folderRoot: string,
    filePath: string,
    revision: string
  ): Promise<string | null>
  hasConflicts(folderRoot: string): Promise<boolean>
  getConflicts(folderRoot: string): Promise<string[]>
  resolveConflict(
    folderRoot: string,
    filePath: string,
    resolution: 'ours' | 'theirs'
  ): Promise<{ success: boolean }>
  rollbackFile(
    folderRoot: string,
    filePath: string,
    commitHash: string
  ): Promise<{ success: boolean }>
  rollbackAll(folderRoot: string, commitHash: string): Promise<{ success: boolean }>
  getRollbackAllContext(
    folderRoot: string,
    commitHash: string
  ): Promise<import('@baishou/shared').GitRollbackAllContext>
  push(folderRoot: string): Promise<{ success: boolean; message?: string }>
  pull(folderRoot: string): Promise<{
    success: boolean
    message?: string
    conflicts?: string[]
  }>
  getBranchInfo(folderRoot: string): Promise<{
    current: string
    branches: string[]
    hasRemote: boolean
    ahead: number
    behind: number
    remoteUrl?: string
  }>
  checkoutBranch(
    folderRoot: string,
    branch: string
  ): Promise<{ success: boolean; message?: string }>
  createBranch(folderRoot: string, branch: string): Promise<{ success: boolean; message?: string }>
  setRemoteUrl(folderRoot: string, url: string): Promise<{ success: boolean; message?: string }>
  getConfig(folderRoot: string): Promise<import('@baishou/shared').GitSyncConfig>
  saveConfig(
    folderRoot: string,
    partial: Partial<import('@baishou/shared').GitSyncConfig>
  ): Promise<{ success: boolean; message?: string }>
  testRemote(folderRoot: string): Promise<boolean>
  mergeBranch(folderRoot: string, branch: string): Promise<{ success: boolean; message?: string }>
  deleteBranch(
    folderRoot: string,
    branch: string,
    force?: boolean
  ): Promise<{ success: boolean; message?: string }>
  publishBranch(
    folderRoot: string,
    branch?: string
  ): Promise<{ success: boolean; message?: string }>
  listStash(folderRoot: string): Promise<import('@baishou/shared').GitStashEntry[]>
  stashPush(folderRoot: string, message?: string): Promise<{ success: boolean; message?: string }>
  stashApply(folderRoot: string, index: number): Promise<{ success: boolean; message?: string }>
  stashPop(folderRoot: string, index: number): Promise<{ success: boolean; message?: string }>
  stashDrop(folderRoot: string, index: number): Promise<{ success: boolean; message?: string }>
}
