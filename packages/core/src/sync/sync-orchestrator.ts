import type { IncrementalSyncResult, SyncSessionLog, S3SyncConfig, SyncSummary, SyncProgressCallback } from '@baishou/shared';
import type { ISyncOrchestrator } from './sync-orchestrator.interface';
import type { IIncrementalSyncService } from './incremental-sync.interface';
import type { IOperationLogService } from './operation-log.interface';
import type { IGitSyncService } from './git-sync.interface';
import { SyncInProgressError } from './sync.errors';

/** 生成跨平台唯一 ID */
let _counter = 0;
function generateId(): string {
  _counter++;
  return `${Date.now().toString(36)}-${_counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 同步编排器实现
 *
 * 桌面端：git commit → 三向合并同步 → 操作日志
 * 移动端：三向合并同步 → 操作日志
 */
export class SyncOrchestrator implements ISyncOrchestrator {
  private isSyncing = false;

  constructor(
    private readonly syncService: IIncrementalSyncService,
    private readonly logService: IOperationLogService,
    private readonly gitService?: IGitSyncService,
    private readonly deviceId?: string,
  ) {}

  private acquireLock(): void {
    if (this.isSyncing) {
      throw new SyncInProgressError();
    }
    this.isSyncing = true;
  }

  private releaseLock(): void {
    this.isSyncing = false;
  }

  private async tryGitCommit(): Promise<void> {
    if (!this.gitService) return;

    try {
      const isInit = await this.gitService.isInitialized();
      if (isInit) {
        await this.gitService.commitAll('sync: 同步前自动保存');
      }
    } catch {
      // git 预提交失败不阻塞同步
    }
  }

  private async doSync(
    operation: (onProgress?: SyncProgressCallback) => Promise<IncrementalSyncResult>,
    direction: 'full-sync' | 'upload-only' | 'download-only',
    onProgress?: SyncProgressCallback,
  ): Promise<IncrementalSyncResult> {
    this.acquireLock();

    const sessionId = generateId();
    const startedAt = new Date().toISOString();

    try {
      await this.tryGitCommit();

      const result = await operation(onProgress);
      result.sessionId = sessionId;

      const completedAt = new Date().toISOString();

      const summary: SyncSummary = {
        uploaded: result.uploaded.length,
        downloaded: result.downloaded.length,
        deletedRemote: result.deletedRemote.length,
        deletedLocal: result.deletedLocal.length,
        conflicts: result.conflicted.length,
        skipped: result.skipped.length,
      };

      const log: SyncSessionLog = {
        sessionId,
        deviceId: this.deviceId ?? 'unknown',
        direction,
        startedAt,
        completedAt,
        success: true,
        operations: [],
        summary,
      };

      await this.logService.writeLog(log);
      void this.logService.cleanupOldLogs().catch(() => {});
      return result;
    } catch (e) {
      const completedAt = new Date().toISOString();

      const log: SyncSessionLog = {
        sessionId,
        deviceId: this.deviceId ?? 'unknown',
        direction,
        startedAt,
        completedAt,
        success: false,
        operations: [],
        summary: { uploaded: 0, downloaded: 0, deletedRemote: 0, deletedLocal: 0, conflicts: 0, skipped: 0 },
        error: e instanceof Error ? e.message : String(e),
      };

      try {
        await this.logService.writeLog(log);
        void this.logService.cleanupOldLogs().catch(() => {});
      } catch {
        // 日志写入失败不重新抛出
      }

      throw e;
    } finally {
      this.releaseLock();
    }
  }

  async sync(onProgress?: SyncProgressCallback): Promise<IncrementalSyncResult> {
    return this.doSync((p) => this.syncService.sync(p), 'full-sync', onProgress);
  }

  async uploadOnly(onProgress?: SyncProgressCallback): Promise<IncrementalSyncResult> {
    return this.doSync((p) => this.syncService.uploadOnly(p), 'upload-only', onProgress);
  }

  async downloadOnly(onProgress?: SyncProgressCallback): Promise<IncrementalSyncResult> {
    return this.doSync((p) => this.syncService.downloadOnly(p), 'download-only', onProgress);
  }

  async getSyncHistory(limit?: number): Promise<SyncSessionLog[]> {
    return this.logService.getRecentLogs(limit);
  }

  async testConnection(): Promise<boolean> {
    return this.syncService.testConnection();
  }

  async getConfig(): Promise<S3SyncConfig> {
    return this.syncService.getConfig();
  }

  async updateConfig(config: Partial<S3SyncConfig>): Promise<void> {
    await this.syncService.updateConfig(config);
  }
}
