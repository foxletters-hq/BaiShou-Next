import * as fs from 'fs';
import * as path from 'path';
import type { SyncSessionLog, SyncSummary } from '@baishou/shared';
import type { IOperationLogService } from './operation-log.interface';
import { SyncLogError } from './sync.errors';

const DEFAULT_KEEP_COUNT = 50;
const DEFAULT_LIMIT = 20;

/**
 * 同步操作日志服务
 *
 * 存储位置: <logDir>/<sessionId>.json
 * 自动清理: 保留最近 50 条
 */
export class OperationLogService implements IOperationLogService {
  constructor(private readonly logDir: string) {}

  private ensureDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogPath(sessionId: string): string {
    return path.join(this.logDir, `${sessionId}.json`);
  }

  private async readLogEntries(): Promise<{ filePath: string; log: SyncSessionLog }[]> {
    if (!fs.existsSync(this.logDir)) return [];

    const files = fs.readdirSync(this.logDir)
      .filter((f) => f.endsWith('.json'));

    const entries: { filePath: string; log: SyncSessionLog }[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(this.logDir, file);
        const raw = await fs.promises.readFile(filePath, 'utf8');
        const log = JSON.parse(raw) as SyncSessionLog;
        entries.push({ filePath, log });
      } catch {
        // 损坏的日志文件跳过
      }
    }

    return entries;
  }

  async writeLog(log: SyncSessionLog): Promise<void> {
    try {
      this.ensureDir();
      const filePath = this.getLogPath(log.sessionId);
      await fs.promises.writeFile(filePath, JSON.stringify(log, null, 2), 'utf8');
    } catch (e) {
      throw new SyncLogError(e instanceof Error ? e : undefined);
    }
  }

  async getRecentLogs(limit: number = DEFAULT_LIMIT): Promise<SyncSessionLog[]> {
    const entries = await this.readLogEntries();
    return entries
      .sort((a, b) => {
        const aTime = new Date(a.log.completedAt).getTime();
        const bTime = new Date(b.log.completedAt).getTime();
        return bTime - aTime;
      })
      .slice(0, limit)
      .map((e) => e.log);
  }

  async getLastSyncSummary(): Promise<SyncSummary | null> {
    const logs = await this.getRecentLogs(1);
    if (logs.length === 0 || !logs[0]!.success) return null;
    return logs[0]!.summary;
  }

  async getLogCount(): Promise<number> {
    if (!fs.existsSync(this.logDir)) return 0;
    const files = fs.readdirSync(this.logDir).filter((f) => f.endsWith('.json'));
    return files.length;
  }

  async cleanupOldLogs(keepCount: number = DEFAULT_KEEP_COUNT): Promise<void> {
    const entries = await this.readLogEntries();
    if (entries.length <= keepCount) return;

    const sorted = entries.sort((a, b) => {
      const aTime = new Date(a.log.completedAt).getTime();
      const bTime = new Date(b.log.completedAt).getTime();
      return bTime - aTime;
    });

    const toDelete = sorted.slice(keepCount);
    for (const entry of toDelete) {
      try {
        fs.unlinkSync(entry.filePath);
      } catch {
        // 删除失败不阻塞
      }
    }
  }
}
