/** Electron preload API 类型声明 */

interface ElectronAPI {
  ipcRenderer: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
    on(channel: string, listener: (...args: unknown[]) => void): void;
    off(channel: string, listener: (...args: unknown[]) => void): void;
    removeAllListeners(channel: string): void;
    send(channel: string, ...args: unknown[]): void;
  };
}

interface OnboardingAPI {
  check(): Promise<{ currentPath: string }>;
  pickDirectory(): Promise<string | null>;
  setDirectory(path: string): Promise<void>;
  finish(): Promise<void>;
  onReady(callback: () => void): () => void;
}

interface WindowAPI {
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
}

interface DiaryAPI {
  create(input: unknown): Promise<unknown>;
  update(id: number, input: unknown): Promise<unknown>;
  delete(id: number): Promise<void>;
  findById(id: number): Promise<unknown>;
  findByDate(dateStr: string): Promise<unknown>;
  listAll(options?: { limit?: number; offset?: number }): Promise<unknown>;
  search(query: string, options?: { limit?: number; offset?: number }): Promise<unknown>;
  count(): Promise<number>;
  onSyncEvent(callback: (event: unknown) => void): () => void;
}

interface SummaryAPI {
  save(input: unknown): Promise<unknown>;
  update(id: number, type: string, startDate: Date, endDate: Date, update: unknown): Promise<unknown>;
  delete(type: string, startDate: Date, endDate: Date): Promise<void>;
  readDetail(type: string, startDate: Date, endDate: Date): Promise<unknown>;
  list(options?: unknown): Promise<unknown>;
}

interface ZoomAPI {
  setFactor(factor: number): void;
  getFactor(): number;
}

interface UpdaterAPI {
  check(): Promise<{ hasUpdate: boolean; currentVersion: string; updateInfo: any }>;
  download(): Promise<{ success: boolean }>;
  install(): void;
  getVersion(): Promise<string>;
  setAutoCheck(enabled: boolean): Promise<{ success: boolean }>;
  getAutoCheck(): Promise<boolean>;
  onStatusChange(callback: (state: any) => void): () => void;
  onDownloadProgress(callback: (progress: number) => void): () => void;
}

interface AppAPI {
  onboarding: OnboardingAPI;
  window: WindowAPI;
  diary: DiaryAPI;
  summary: SummaryAPI;
  zoom: ZoomAPI;
  git: GitAPI;
  incrementalSync: IncrementalSyncAPI;
  updater: UpdaterAPI;
  [key: string]: unknown;
}

interface GitAPI {
  init(): Promise<{ success: boolean; message?: string }>;
  isInitialized(): Promise<boolean>;
  getConfig(): Promise<unknown>;
  updateConfig(config: unknown): Promise<{ success: boolean }>;
  testRemote(): Promise<boolean>;
  autoCommit(): Promise<{ success: boolean; data: unknown }>;
  commit(files: string[], message: string): Promise<unknown>;
  getHistory(filePath?: string, limit?: number): Promise<unknown[]>;
  getCommitChanges(commitHash: string): Promise<unknown[]>;
  getFileDiff(filePath: string, commitHash?: string): Promise<unknown>;
  rollbackFile(filePath: string, commitHash: string): Promise<{ success: boolean }>;
  rollbackAll(commitHash: string): Promise<{ success: boolean }>;
  push(): Promise<{ success: boolean; message?: string }>;
  pull(): Promise<{ success: boolean; message?: string; conflicts?: string[] }>;
  hasConflicts(): Promise<boolean>;
  getConflicts(): Promise<string[]>;
  resolveConflict(filePath: string, resolution: 'ours' | 'theirs'): Promise<{ success: boolean }>;
}

interface IncrementalSyncAPI {
  getConfig(): Promise<unknown>;
  updateConfig(config: unknown): Promise<{ success: boolean }>;
  testConnection(): Promise<boolean>;
  sync(): Promise<unknown>;
  uploadOnly(): Promise<unknown>;
  downloadOnly(): Promise<unknown>;
  getLocalManifest(): Promise<unknown>;
  getRemoteManifest(): Promise<unknown>;
  refreshLocalManifest(): Promise<unknown>;
  getLastSyncConflicts(): Promise<string[]>;
}

declare interface Window {
  electron: ElectronAPI;
  api: AppAPI;
}
