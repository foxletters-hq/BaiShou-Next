/** Electron preload API 类型声明 */

interface ElectronAPI {
  ipcRenderer: {
    invoke(channel: string, ...args: unknown[]): Promise<any>
    on(channel: string, listener: (...args: any[]) => void): () => void
    removeAllListeners(channel: string): void
    send(channel: string, ...args: unknown[]): void
  }
  process?: any
}

interface FlutterLegacyMigrationPending {
  sourceRoot: string
  targetRoot: string
  sourceDisplayPath: string
  targetDisplayPath: string
  inPlace: boolean
  confidenceScore: number
  detectionReason: string
}

interface OnboardingAPI {
  check(): Promise<{
    needsOnboarding: boolean
    currentPath: string
    pendingFlutterLegacyMigration: FlutterLegacyMigrationPending | null
  }>
  pickDirectory(): Promise<string | null>
  setDirectory(path: string): Promise<void>
  finish(): Promise<void>
  detectLegacyMigrationPending(): Promise<{
    pendingFlutterLegacyMigration: FlutterLegacyMigrationPending | null
  }>
  dismissLegacyMigrationPrompt(): Promise<boolean>
  runFlutterLegacyMigration(payload: {
    sourceRoot: string
    targetRoot: string
  }): Promise<{ success: boolean }>
  onReady(callback: () => void): () => void
}

interface WindowAPI {
  minimize(): void
  toggleMaximize(): void
  close(): void
}

interface ShellAPI {
  openExternal(url: string): Promise<boolean>
  showItemInFolder(filePath: string): Promise<boolean>
}

interface DiaryAPI {
  create(input: unknown): Promise<unknown>
  update(id: number, input: unknown): Promise<unknown>
  delete(id: number): Promise<void>
  findById(id: number): Promise<unknown>
  findByDate(dateStr: string): Promise<unknown>
  listAll(options?: { limit?: number; offset?: number }): Promise<unknown>
  search(query: string, options?: { limit?: number; offset?: number }): Promise<unknown>
  count(): Promise<number>
  onSyncEvent(callback: (event: unknown) => void): () => void
  getAttachmentDir?(dateStr: string): Promise<string>
}

interface SummaryAPI {
  save(input: any): Promise<any>
  update(id: number, type: string, startDate: Date, endDate: Date, update: any): Promise<any>
  delete(type: string, startDate: Date, endDate: Date): Promise<void>
  readDetail(type: string, startDate: Date, endDate: Date): Promise<any>
  list(options?: any): Promise<any>
}

interface ZoomAPI {
  setFactor(factor: number): void
  getFactor(): number
  onSetLevel(callback: (level: number) => void): () => void
}

interface UpdaterAPI {
  check(): Promise<{
    hasUpdate: boolean
    currentVersion: string
    updateInfo: any
    skipped?: boolean
    skipReason?: 'development' | 'unconfigured'
  }>
  download(): Promise<{ success: boolean }>
  install(): void
  getVersion(): Promise<string>
  setAutoCheck(enabled: boolean): Promise<{ success: boolean }>
  getAutoCheck(): Promise<boolean>
  onStatusChange(callback: (state: any) => void): () => void
  onDownloadProgress(callback: (progress: number) => void): () => void
}

interface SettingsAPI {
  getFeatures(): Promise<Record<string, unknown>>
  setFeatures(config: Record<string, unknown>): Promise<void>
  getProviders(): Promise<import('@baishou/shared').AIProviderConfig[]>
  getGlobalModels(): Promise<import('@baishou/shared').GlobalModelsConfig | null>
  getLegacyUpgradeNoticeState(): Promise<{ pending: boolean; shownCount: number }>
  markLegacyUpgradeNoticeShown(): Promise<number>
  getBaishouAgentGateConfig(
    scope?: import('@baishou/shared').AgentGateConfigScope
  ): Promise<import('@baishou/shared').BaishouAgentGateConfig>
  setBaishouAgentGateConfig(
    config: import('@baishou/shared').BaishouAgentGateConfig,
    scope?: import('@baishou/shared').AgentGateConfigScope
  ): Promise<import('@baishou/shared').BaishouAgentGateConfig>
  getGraphSelfNameConfigured(): Promise<boolean>
  setGraphSelfNameConfigured(configured: boolean): Promise<boolean>
  getWorkspaceToolManagement(
    workspaceId: string
  ): Promise<import('@baishou/shared').WorkspaceToolManagementConfig>
  setWorkspaceToolManagement(
    workspaceId: string,
    config: import('@baishou/shared').WorkspaceToolManagementConfig
  ): Promise<import('@baishou/shared').WorkspaceToolManagementConfig>
  getWorkspacePersonalMemoryRead(workspaceId: string): Promise<boolean>
  setWorkspacePersonalMemoryRead(workspaceId: string, enabled: boolean): Promise<boolean>
  testTts(
    config: unknown,
    text: string
  ): Promise<import('@baishou/shared').TtsSynthesizeFromSettingsResult>
  pickTtsRefAudio(): Promise<string | null>
  [key: string]: (...args: unknown[]) => Promise<unknown>
}

interface AgentGateAPI {
  reply(input: {
    requestId: string
    reply: import('@baishou/shared').AgentGateReply
    message?: string
    selectedOptionIds?: string[]
  }): Promise<{ success: boolean }>
  listPending(sessionId?: string): Promise<import('@baishou/shared').AgentGateRequest[]>
  getNotificationPrefs(): Promise<import('@baishou/shared').AgentGateNotificationPrefs>
  setNotificationPrefs(
    prefs: Partial<import('@baishou/shared').AgentGateNotificationPrefs>
  ): Promise<import('@baishou/shared').AgentGateNotificationPrefs>
  notifyAsked(request: import('@baishou/shared').AgentGateRequest): Promise<{ success: boolean }>
  getConfig(
    scope?: import('@baishou/shared').AgentGateConfigScope
  ): Promise<import('@baishou/shared').BaishouAgentGateConfig>
  removeAllowlistEntry(
    entryId: string,
    scope?: import('@baishou/shared').AgentGateConfigScope
  ): Promise<{ success: boolean }>
  onAsked(callback: (request: import('@baishou/shared').AgentGateRequest) => void): () => void
  onReplied(
    callback: (payload: {
      sessionId: string
      requestId: string
      reply: import('@baishou/shared').AgentGateReply
    }) => void
  ): () => void
  onAllowlistChanged(
    callback: (
      allowlist: import('@baishou/shared').AgentGateAllowlistEntry[],
      scope?: import('@baishou/shared').AgentGateConfigScope
    ) => void
  ): () => void
  onFocusCheck(callback: (request: import('@baishou/shared').AgentGateRequest) => void): () => void
  onNavigate(
    callback: (payload: {
      sessionId: string
      requestId: string
      scope?: import('@baishou/shared').AgentGateConfigScope
    }) => void
  ): () => void
}

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
  cancelPendingInput(
    inputId: string
  ): Promise<import('@baishou/shared').SessionInputRecord | null>
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

interface PickFilesOptions {
  title?: string
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles'>
  filters?: Array<{ name: string; extensions: string[] }>
}

interface PickedFile {
  id: string
  fileName: string
  filePath: string
  isImage: boolean
  isPdf: boolean
  isText: boolean
  fileSize: number
}

interface TtsSpeechSegmentPayload {
  text: string
  audioBase64: string
  format: string
  fromCache: boolean
}

type TtsSynthesizeSpeechResult =
  | { success: true; segmentCount: number }
  | { success: false; errorCode: string; error?: string; statusCode?: number }

interface TtsAPI {
  synthesize(text: string, providerId?: string, modelId?: string): Promise<unknown>
  synthesizeSpeech(
    content: string,
    options?: {
      sessionId?: string
      providerId?: string
      modelId?: string
      onSegment?: (segment: TtsSpeechSegmentPayload, index: number) => void | Promise<void>
    }
  ): Promise<TtsSynthesizeSpeechResult>
  cancelSpeech(sessionId: string): Promise<void>
}

interface VaultAPI {
  getIndexingStatus(): Promise<{
    indexing: boolean
    resyncing: boolean
    shadowScanning: boolean
  }>
  releaseColdStartResync?(trigger?: string): Promise<boolean>
  [key: string]: ((...args: unknown[]) => Promise<unknown>) | undefined
}

interface StorageAPI {
  onRootChanged(callback: () => void): () => void
  [key: string]: (...args: unknown[]) => Promise<unknown>
}

interface GraphAPI {
  listPendingReextract(): Promise<
    Array<{
      filePath: string
      contentHash: string
      lastExtractedHash: string | null
      date?: string
    }>
  >
  listPendingIndex(): Promise<unknown[]>
  estimateExtraction(): Promise<{
    entryCount: number
    estimatedTokens: number
    estimatedMinutesLow: number
    estimatedMinutesHigh: number
  }>
  extract(opts?: { filePaths?: string[] }): Promise<{
    done: number
    failed: number
    queued?: number
    cancelled?: boolean
    errors: Array<{ filePath: string; message: string }>
  }>
  queueExtract(opts?: { filePaths?: string[]; concurrency?: number }): Promise<{
    queued: number
    totalPending: number
    skippedNotEmbedded: string[]
  }>
  setExtractConcurrency(opts: { concurrency: number }): Promise<{ concurrency: number }>
  getQueueState(): Promise<{
    items: Array<{
      id: string
      filePath: string
      date?: string
      progress: number
      status: 'pending' | 'running' | 'aligning' | 'completed' | 'error'
      phase?:
        | 'queued'
        | 'reading'
        | 'model'
        | 'waiting_model'
        | 'thinking'
        | 'streaming'
        | 'parsing'
        | 'waiting_pool'
        | 'recalling'
        | 'waiting_align'
        | 'aligning'
        | 'writing'
      phaseDetail?: string
      error?: string
    }>
    activeCount: number
    pendingCount: number
    runningCount: number
    aligningCount?: number
    completedCount: number
    errorCount: number
    overallProgress?: number
    alignPoolSize?: number
    alignPoolCount?: number
  }>
  stopExtract(): Promise<{ ok: boolean }>
  cancelExtract(): Promise<{ ok: boolean }>
  cancelQueueItem(opts: { filePath: string }): Promise<{ ok: boolean }>
  onQueueProgress(
    callback: (state: {
      items: Array<{
        id: string
        filePath: string
        date?: string
        progress: number
        status: 'pending' | 'running' | 'aligning' | 'completed' | 'error'
        phase?:
          | 'queued'
          | 'reading'
          | 'model'
          | 'waiting_model'
          | 'thinking'
          | 'streaming'
          | 'parsing'
          | 'waiting_pool'
          | 'recalling'
          | 'waiting_align'
          | 'aligning'
          | 'writing'
        phaseDetail?: string
        error?: string
      }>
      activeCount: number
      pendingCount: number
      runningCount: number
      aligningCount?: number
      completedCount: number
      errorCount: number
      overallProgress?: number
      alignPoolSize?: number
      alignPoolCount?: number
    }) => void
  ): () => void
  onExtractProgress(
    callback: (progress: { current: number; total: number; filePath: string }) => void
  ): () => void
  getGlobalGraph(opts?: {
    maxNodes?: number
    minMentionCount?: number
    nodeTypes?: string[]
    monthRange?: { startMonth: string; endMonth: string }
  }): Promise<{ nodes: any[]; edges: any[] }>
  getView(opts: { centerNodeId: string; depth?: 1 | 2 | 3 }): Promise<{ nodes: any[]; edges: any[] }>
  findPaths(opts: {
    fromId: string
    toId: string
    maxHops?: 2 | 3
  }): Promise<{ nodeIds: string[]; edges: any[] } | null>
  search(opts: { query: string; nodeTypes?: string[]; limit?: number }): Promise<any[]>
  findByName(opts: {
    query: string
    nodeType?: string
  }): Promise<{
    id: string
    name: string
    nodeType: string
    summary: string
    aliases: string[]
  } | null>
  listPendingEdges(): Promise<any[]>
  listPending(): Promise<{ nodes: any[]; edges: any[] }>
  setEdgeReview(opts: {
    edgeId: string
    reviewStatus: 'approved' | 'rejected'
  }): Promise<{ ok: boolean }>
  setNodeReview(opts: {
    nodeId: string
    reviewStatus: 'approved' | 'rejected'
  }): Promise<{ ok: boolean }>
  setReviewsBatch(opts: {
    reviewStatus: 'approved' | 'rejected'
    nodeIds?: string[]
    edgeIds?: string[]
    allPending?: boolean
  }): Promise<{ ok: boolean; nodeCount: number; edgeCount: number }>
  upsertNode(input: {
    id?: string
    name: string
    nodeType: string
    aliases?: string[]
    summary?: string
  }): Promise<
    | { id: string }
    | {
        conflict: 'same-name'
        existing: { id: string; name: string; nodeType: string; summary: string }
      }
  >
  upsertEdge(input: {
    id?: string
    fromId: string
    toId: string
    edgeType: string
    sourceRef?: string
    sourceExcerpt?: string
  }): Promise<{ id: string }>
  softDelete(opts: { kind: 'node' | 'edge'; id: string }): Promise<{ ok: boolean }>
  mergeNodes(opts: {
    survivorId: string
    loserId: string
    reason?: string
  }): Promise<{ ok: boolean; survivorId: string; loserId: string }>
  mergeNodesBatch(opts: {
    survivorId: string
    loserIds: string[]
    reason?: string
  }): Promise<{ ok: boolean; survivorId: string; loserIds: string[] }>
  getNode(id: string): Promise<any>
  meta(): Promise<{ nodeTypes: string[]; edgeTypes: string[] }>
}

interface KnowledgeAPI {
  createNotebook(input: {
    name: string
    description?: string
    coverTone?: string
    coverIcon?: string
  }): Promise<{
    id: string
    name: string
    coverTone: string
    coverIcon: string
    sortOrder: number
    coverImageUrl?: string | null
  }>
  listNotebooks(): Promise<unknown[]>
  listMountSummaries(): Promise<
    Array<{
      id: string
      name: string
      sources: number
      chunks: number
      dimension: number | null
      dimensions: number[]
      modelIds: string[]
      mixedEmbeddings: boolean
    }>
  >
  getNotebook(notebookId: string): Promise<{
    id: string
    name: string
    description?: string
    updatedAt?: number
    createdAt?: number
    sortOrder?: number
    coverTone?: string
    coverIcon?: string
    coverImage?: string
    coverImageUrl?: string | null
  } | null>
  updateNotebook(input: {
    notebookId: string
    name?: string
    description?: string
    coverTone?: string | null
    coverIcon?: string | null
    coverImage?: string | null
  }): Promise<{
    id: string
    name: string
    description?: string
    sortOrder?: number
    coverTone?: string
    coverIcon?: string
    coverImage?: string
    coverImageUrl?: string | null
  }>
  setCoverImage(input: { notebookId: string; absolutePath: string }): Promise<{
    id: string
    coverImage?: string
    coverImageUrl?: string | null
  }>
  reorderNotebooks(orderedIds: string[]): Promise<unknown[]>
  listNotebookStats(): Promise<
    Array<{
      notebookId: string
      sources: number
      chunks: number
      pendingJobs: number
      originalBytes: number
      totalBytes: number
    }>
  >
  importSource(input: {
    notebookId: string
    title: string
    kind: 'file' | 'text' | 'url' | 'note'
    absolutePath?: string
    textContent?: string
    fileName?: string
    originUrl?: string
    extractEngine?: 'simple' | 'ocr' | 'vision'
    importProcessMode?: import('@baishou/shared').KnowledgeImportProcessMode
  }): Promise<{ sourceId: string }>
  probeExtractHint(input: {
    absolutePath?: string
    sourceId?: string
  }): Promise<import('@baishou/shared').KnowledgeExtractHint>
  retrySource(sourceId: string): Promise<{ ok: boolean }>
  reprocessSource(input: { sourceId: string; target: 'embed' | 'graph' }): Promise<{ ok: boolean }>
  deleteSource(sourceId: string): Promise<{ ok: boolean }>
  rebuildIndex(notebookId: string): Promise<{ ok: boolean }>
  getStats(notebookId?: string): Promise<{
    notebooks: number
    sources: number
    chunks: number
    pendingJobs: number
    originalBytes: number
    totalBytes: number
  }>
  hasModelMismatch(notebookIds?: string[]): Promise<boolean>
  listSources(notebookId: string): Promise<unknown[]>
  listChunks(input: {
    notebookId: string
    limit?: number
    offset?: number
    query?: string
  }): Promise<{
    items: Array<{
      chunkId: string
      sourceId: string
      notebookId: string
      chunkIndex: number
      chunkText: string
      metadataJson: string
      dimension: number
      modelId: string
      createdAt: number
      sourceTitle: string | null
    }>
    total: number
  }>
  search(input: { notebookId: string; query: string; topK?: number }): Promise<unknown[]>
  ocrMissingPages(input: {
    sourceId: string
    engine?: 'simple' | 'ocr' | 'vision'
    pageNumbers?: number[]
  }): Promise<{ queued: true }>
  cancelExtract(sourceId: string): Promise<{ cancelled: true; status: string }>
  recoverStale(): Promise<{
    resetSources: number
    reclaimedEmbedJobs: number
    droppedExtractJobs: number
  }>
  getCapabilities(): Promise<{
    simple: { available: boolean; reason?: string; detail?: string }
    ocr: { available: boolean; reason?: string; detail?: string }
    vision: { available: boolean; reason?: string; detail?: string }
    recommended: 'simple' | 'ocr' | 'vision'
  }>
  getConfig(): Promise<{
    defaultExtractEngine?: 'simple' | 'ocr' | 'vision'
    importProcessMode?: import('@baishou/shared').KnowledgeImportProcessMode
    ocrLanguage?: string
    ocrDpi?: number
    ocrConcurrency?: number
    multiQueryAsk?: boolean
    visionProviderId?: string | null
    visionModelId?: string | null
  }>
  setConfig(patch: {
    defaultExtractEngine?: 'simple' | 'ocr' | 'vision'
    importProcessMode?: import('@baishou/shared').KnowledgeImportProcessMode
    ocrLanguage?: string
    ocrDpi?: number
    ocrConcurrency?: number
    multiQueryAsk?: boolean
    visionProviderId?: string | null
    visionModelId?: string | null
  }): Promise<unknown>
  getExtractedPreview(input: {
    notebookId: string
    sourceId: string
    maxChars?: number
  }): Promise<{ text: string | null; truncated: boolean }>
  getSourceFile(input: { sourceId: string }): Promise<{
    kind: 'pdf' | 'text' | 'url' | 'unsupported'
    fileName: string
    localUrl: string | null
    fileBytes: Uint8Array | null
    textContent: string | null
    originUrl: string | null
  }>
  onOcrProgress(
    callback: (progress: {
      sourceId: string
      page: number
      total: number
      phase?: 'ocr' | 'vision' | 'render'
    }) => void
  ): () => void
  getGraphView(input: { notebookId: string; maxNodes?: number }): Promise<{
    nodes: Array<{
      id: string
      name: string
      nodeType: string
      mentionCount?: number
      reviewStatus?: string
      summary?: string
    }>
    edges: Array<{
      id: string
      fromId: string
      toId: string
      edgeType: string
      reviewStatus?: string
    }>
  }>
  graphSearch(input: {
    notebookId: string
    query: string
    limit?: number
  }): Promise<Array<{ id: string; name: string; nodeType: string; summary?: string }>>
  setGraphNodeReview(input: {
    notebookId: string
    nodeId: string
    reviewStatus: 'approved' | 'rejected'
  }): Promise<{ ok: boolean }>
  setGraphEdgeReview(input: {
    notebookId: string
    edgeId: string
    reviewStatus: 'approved' | 'rejected'
  }): Promise<{ ok: boolean }>
  setGraphReviewsBatch(input: {
    notebookId: string
    reviewStatus: 'approved' | 'rejected'
    nodeIds?: string[]
    edgeIds?: string[]
    allPending?: boolean
  }): Promise<{ ok: boolean; nodeCount: number; edgeCount: number }>
  rebuildGraph(notebookId: string): Promise<{ ok: boolean }>
  listGraphJobs(notebookId: string): Promise<{
    pending: number
    running: number
    failed: number
    currentSourceId: string | null
    currentSourceTitle: string | null
    items: Array<{
      sourceId: string
      title: string
      status: string
      lastError?: string | null
    }>
  }>
  onGraphProgress(
    callback: (progress: {
      at: number
      notebookId?: string
      sourceId?: string
      windowsDone?: number
      windowsTotal?: number
    }) => void
  ): () => void
}

interface AppAPI {
  onboarding: OnboardingAPI
  window: WindowAPI
  shell: ShellAPI
  diary: DiaryAPI
  summary: SummaryAPI
  zoom: ZoomAPI
  git: GitAPI
  incrementalSync: IncrementalSyncAPI
  legacyMigration: LegacyMigrationAPI
  updater: UpdaterAPI
  settings: SettingsAPI
  vault: VaultAPI
  storage: StorageAPI
  tts: TtsAPI
  pickFiles(options?: PickFilesOptions): Promise<PickedFile[]>
  getMountedNotebooks(sessionId: string): Promise<string[]>
  setMountedNotebooks(sessionId: string, notebookIds: string[]): Promise<string[]>
  getAssistants(): Promise<unknown[]>
  updateAssistant(id: string, input: Record<string, unknown>): Promise<void>
  ensureDefaultLatteAssistant(locale?: string): Promise<void>
  ensureSystemLatteAssistant(locale?: string): Promise<{ created: boolean; assistantId: string }>
  syncDefaultLatteLocale(locale?: string): Promise<void>
  agentGate: AgentGateAPI
  agentWorkspace: AgentWorkspaceAPI
  graph: GraphAPI
  knowledge: KnowledgeAPI
  getMessages(sessionId: string): Promise<unknown>
  [key: string]: unknown
}

interface GitAPI {
  init(): Promise<{ success: boolean; message?: string }>
  isInitialized(): Promise<boolean>
  getStatus(): Promise<import('@baishou/shared').GitStatus>
  stageFile(filePath: string): Promise<{ success: boolean; message?: string }>
  stageAll(): Promise<{ success: boolean; message?: string }>
  unstageFile(filePath: string): Promise<{ success: boolean }>
  unstageAll(): Promise<{ success: boolean }>
  discardFile(filePath: string): Promise<{ success: boolean }>
  discardAllChanges(): Promise<{ success: boolean }>
  getConfig(): Promise<unknown>
  updateConfig(config: unknown): Promise<{ success: boolean }>
  testRemote(): Promise<boolean>
  commit(files: string[], message: string): Promise<unknown>
  commitAll(message: string): Promise<import('@baishou/shared').GitCommit | null>
  commitStaged(message: string): Promise<import('@baishou/shared').GitCommit | null>
  getHistory(filePath?: string, limit?: number, offset?: number): Promise<unknown[]>
  getHistoryCount(filePath?: string): Promise<number>
  getRecentPulls(limit?: number): Promise<unknown[]>
  getRemoteStatus(fetch?: boolean): Promise<import('@baishou/shared').GitRemoteStatus>
  syncRemote(): Promise<{ success: boolean; message?: string; conflicts?: string[] }>
  getCommitChanges(commitHash: string): Promise<unknown[]>
  getFileDiff(filePath: string, commitHash?: string): Promise<unknown>
  getWorkingDiff(filePath: string, staged: boolean): Promise<unknown>
  rollbackFile(filePath: string, commitHash: string): Promise<{ success: boolean }>
  rollbackAll(commitHash: string): Promise<{ success: boolean }>
  getRollbackAllContext(
    commitHash: string
  ): Promise<import('@baishou/shared').GitRollbackAllContext>
  push(): Promise<{ success: boolean; message?: string }>
  pull(): Promise<{ success: boolean; message?: string; conflicts?: string[] }>
  hasConflicts(): Promise<boolean>
  getConflicts(): Promise<string[]>
  resolveConflict(filePath: string, resolution: 'ours' | 'theirs'): Promise<{ success: boolean }>
}

interface IncrementalSyncAPI {
  getConfig(): Promise<unknown>
  updateConfig(config: unknown): Promise<{ success: boolean }>
  testConnection(config?: unknown): Promise<boolean>
  sync(
    runOptions?: import('@baishou/shared').IncrementalSyncRunOptions
  ): Promise<import('@baishou/shared').IncrementalSyncResult>
  orchestratedSync(
    runOptions?: import('@baishou/shared').IncrementalSyncRunOptions
  ): Promise<import('@baishou/shared').IncrementalSyncResult>
  getLocalManifest(): Promise<unknown>
  getRemoteManifest(): Promise<unknown>
  refreshLocalManifest(): Promise<unknown>
  getLastSyncConflicts(): Promise<string[]>
  planSync(
    runOptions?: import('@baishou/shared').IncrementalSyncRunOptions
  ): Promise<import('@baishou/shared').IncrementalSyncPlanPreview>
  readVaultRegistryFingerprint(): Promise<string>
  evaluatePlanDrift(baseline: import('@baishou/shared').IncrementalSyncPlanReuseBaseline): Promise<{
    localTreeDrifted: boolean
    remoteManifestDrifted: boolean
    ttlExpired: boolean
  }>
  onSyncProgress(callback: (event: unknown) => void): () => void
}

interface LegacyMigrationAPI {
  scan(
    customSourceRoot?: string | null
  ): Promise<import('@baishou/shared').LegacyVersionMigrationScanPayload>
  pickSource(): Promise<string | null>
  clearCustomSource(): Promise<{ success: boolean }>
  importSection(
    sectionId: import('@baishou/shared').LegacyVersionMigrationSectionId,
    customSourceRoot?: string | null
  ): Promise<import('@baishou/shared').LegacyVersionMigrationImportResult>
  importAllWorkspaces(
    sectionIds: import('@baishou/shared').LegacyVersionMigrationSectionId[],
    customSourceRoot?: string | null
  ): Promise<import('@baishou/shared').LegacyVersionMigrationBatchImportResult>
  cancel(): Promise<{ success: boolean }>
  onProgress(
    callback: (event: import('@baishou/shared').LegacyMigrationProgressEvent) => void
  ): () => void
}

declare interface Window {
  electron: ElectronAPI
  api: AppAPI
  gc?: () => void
  __baiShouMemProbe?: {
    version: number
    run: (
      scenario?: import('./dev/memory-leak-probe').ProbeScenarioId,
      options?: { rounds?: number }
    ) => Promise<import('./dev/memory-leak-probe').ProbeReport>
    runAll: (options?: {
      rounds?: number
      scenarios?: import('./dev/memory-leak-probe').ProbeScenarioId[]
    }) => Promise<import('./dev/memory-leak-probe').ProbeSuiteReport>
    scenarios: import('./dev/memory-leak-probe').ProbeScenarioId[]
  }
}
