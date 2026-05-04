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

interface AppAPI {
  onboarding: OnboardingAPI;
  window: WindowAPI;
  diary: DiaryAPI;
  summary: SummaryAPI;
  [key: string]: unknown;
}

declare interface Window {
  electron: ElectronAPI;
  api: AppAPI;
}
