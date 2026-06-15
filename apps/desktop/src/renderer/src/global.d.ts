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

interface OnboardingAPI {
  check(): Promise<{ currentPath: string }>
  pickDirectory(): Promise<string | null>
  setDirectory(path: string): Promise<void>
  finish(): Promise<void>
  onReady(callback: () => void): () => void
}

interface WindowAPI {
  minimize(): void
  toggleMaximize(): void
  close(): void
}

interface ShellAPI {
  openExternal(url: string): Promise<boolean>
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
  updater: UpdaterAPI
  settings: SettingsAPI
  ensureDefaultLatteAssistant(locale?: string): Promise<void>
  syncDefaultLatteLocale(locale?: string): Promise<void>
  [key: string]: unknown
}

interface GitAPI {
  init(): Promise<{ success: boolean; message?: string }>
  isInitialized(): Promise<boolean>
  getStatus(): Promise<import('@baishou/shared').GitStatus>
  stageFile(filePath: string): Promise<{ success: boolean }>
  stageAll(): Promise<{ success: boolean }>
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
  getHistory(filePath?: string, limit?: number): Promise<unknown[]>
  getRecentPulls(limit?: number): Promise<unknown[]>
  getCommitChanges(commitHash: string): Promise<unknown[]>
  getFileDiff(filePath: string, commitHash?: string): Promise<unknown>
  getWorkingDiff(filePath: string, staged: boolean): Promise<unknown>
  rollbackFile(filePath: string, commitHash: string): Promise<{ success: boolean }>
  rollbackAll(commitHash: string): Promise<{ success: boolean }>
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
  sync(): Promise<unknown>
  uploadOnly(): Promise<unknown>
  downloadOnly(): Promise<unknown>
  getLocalManifest(): Promise<unknown>
  getRemoteManifest(): Promise<unknown>
  refreshLocalManifest(): Promise<unknown>
  getLastSyncConflicts(): Promise<string[]>
}

declare interface Window {
  electron: ElectronAPI
  api: AppAPI
}
