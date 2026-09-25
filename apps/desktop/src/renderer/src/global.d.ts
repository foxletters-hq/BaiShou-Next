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
    questionAnswers?: import('@baishou/shared').AgentGateQuestionAnswer[]
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
      message?: string
      selectedOptionIds?: string[]
      questionAnswers?: import('@baishou/shared').AgentGateQuestionAnswer[]
    }) => void
  ): () => void
  onCancelled(
    callback: (payload: { sessionId: string; requestIds: string[]; reason?: string }) => void
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
