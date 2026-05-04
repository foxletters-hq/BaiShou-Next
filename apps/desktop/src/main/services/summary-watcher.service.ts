import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { SummaryType, formatLocalDate, logger } from '@baishou/shared';
import * as chokidar from 'chokidar';
import { SummarySyncService } from '@baishou/core';
import { SummaryFileService } from '@baishou/core';
import { SummaryRepositoryImpl, connectionManager } from '@baishou/database';
import { pathService } from '../ipc/vault.ipc';

/**
 * 总结文件变动监听服务
 *
 * 监听 Summaries/ 目录下所有 .md 文件的增删改，
 * 自动触发 SummarySyncService 将文件变更同步到 DB 缓存表。
 * 与 DiaryWatcherService 同级对称设计。
 */
export class SummaryWatcherService {
  private watcher: chokidar.FSWatcher | null = null;
  private summariesPath: string | null = null;
  private pendingPaths = new Set<string>();
  private isProcessing = false;
  private globalDebounceTimer: NodeJS.Timeout | null = null;
  private summarySync: SummarySyncService | null = null;
  private summaryFileService: SummaryFileService | null = null;
  /** 写入抑制表：path → 过期时间戳。防止 App 自身写入触发循环同步。 */
  private suppressedPaths = new Map<string, number>();

  public start(vaultPath: string) {
    this.stop();
    this.summariesPath = path.join(vaultPath, 'Summaries');

    // 确保 Summaries 目录存在
    if (!fs.existsSync(this.summariesPath)) {
      try {
        fs.mkdirSync(this.summariesPath, { recursive: true });
      } catch (e) {
        logger.error(`[SummaryWatcher] 无法创建 Summaries 目录:`, e);
      }
    }

    // 初始化依赖
    const db = connectionManager.getDb();
    const summaryRepo = new SummaryRepositoryImpl(db);
    this.summaryFileService = new SummaryFileService(pathService);
    this.summarySync = new SummarySyncService(null, null, summaryRepo, this.summaryFileService);

    // 初始化 Chokidar 监听（递归监听子目录 Weekly/Monthly/...）
    this.watcher = chokidar.watch(this.summariesPath, {
      ignored: /(^|[\/\\])\../,
      ignoreInitial: true,
      disableGlobbing: true,
      depth: 1, // 只需要一层子目录
    });

    this.watcher.on('all', (eventName, fullPath) => {
      if (!fullPath.endsWith('.md')) return;
      if (eventName === 'add' || eventName === 'change' || eventName === 'unlink') {
        this.scheduleSync(fullPath);
      }
    });

    logger.info(`[SummaryWatcher] 监听已启动: ${this.summariesPath}`);
  }

  public stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.globalDebounceTimer) clearTimeout(this.globalDebounceTimer);
    this.pendingPaths.clear();
    this.suppressedPaths.clear();
    this.isProcessing = false;
    this.summariesPath = null;
    this.summarySync = null;
    this.summaryFileService = null;
    logger.info(`[SummaryWatcher] 监听已停止`);
  }

  /**
   * 抑制指定路径的 Watcher 事件（防止 App 自身写入触发循环同步）
   * 对标原版 FileStateScheduler.suppressPath()
   */
  public suppressPath(filePath: string, durationMs: number = 2000) {
    this.suppressedPaths.set(filePath, Date.now() + durationMs);
  }

  private isSuppressed(filePath: string): boolean {
    const expiry = this.suppressedPaths.get(filePath);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.suppressedPaths.delete(filePath);
      return false;
    }
    return true;
  }

  private scheduleSync(changedPath: string) {
    if (this.isSuppressed(changedPath)) return;
    this.pendingPaths.add(changedPath);
    if (this.globalDebounceTimer) {
      clearTimeout(this.globalDebounceTimer);
    }
    this.globalDebounceTimer = setTimeout(async () => {
      await this.processQueue();
    }, 800); // 比日记更长的防抖，summary 文件写入可能更慢
  }

  private async processQueue() {
    if (this.isProcessing || !this.summarySync || !this.summaryFileService) return;
    this.isProcessing = true;

    try {
      while (this.pendingPaths.size > 0) {
        const pathsToProcess = Array.from(this.pendingPaths);
        this.pendingPaths.clear();

        for (const changedPath of pathsToProcess) {
          const parsed = this.parseSummaryPath(changedPath);
          if (!parsed) continue;

          try {
            await this.summarySync.syncSummaryFile(parsed.type, parsed.startDate, parsed.endDate);
          } catch (e) {
            logger.error(`[SummaryWatcher] 同步失败: ${changedPath}`, e);
          }
        }
      }

      // 通知 UI 刷新
      const wins = BrowserWindow.getAllWindows();
      wins.forEach(w => {
        w.webContents.send('summary:file-changed');
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 从文件绝对路径解析出 SummaryType 和日期范围
   * 路径格式: <vault>/Summaries/<Type>/<filename>.md
   * 文件名格式:
   *   Weekly:  2026-W18.md
   *   Monthly: 2026-05.md
   *   Quarterly: 2026-Q2.md
   *   Yearly:  2026.md
   */
  private parseSummaryPath(fullPath: string): { type: SummaryType; startDate: Date; endDate: Date } | null {
    const dirName = path.basename(path.dirname(fullPath));
    const fileName = path.basename(fullPath, '.md');

    // 从目录名推断 type
    const typeMap: Record<string, SummaryType> = {
      'Weekly': SummaryType.weekly,
      'Monthly': SummaryType.monthly,
      'Quarterly': SummaryType.quarterly,
      'Yearly': SummaryType.yearly,
    };
    const type = typeMap[dirName];
    if (!type) return null;

    return this.parseFileName(type, fileName);
  }

  private parseFileName(type: SummaryType, name: string): { type: SummaryType; startDate: Date; endDate: Date } | null {
    const parts = name.split('-');
    const year = parseInt(parts[0] ?? '', 10);
    if (isNaN(year)) return null;

    if (type === SummaryType.yearly) {
      return {
        type,
        startDate: new Date(year, 0, 1),
        endDate: new Date(year, 11, 31, 23, 59, 59),
      };
    }

    if (type === SummaryType.monthly && parts.length === 2) {
      const month = parseInt(parts[1] ?? '', 10) - 1;
      return {
        type,
        startDate: new Date(year, month, 1),
        endDate: new Date(year, month + 1, 0, 23, 59, 59),
      };
    }

    if (type === SummaryType.quarterly && parts.length === 2 && (parts[1] || '').startsWith('Q')) {
      const q = parseInt((parts[1] ?? '').substring(1), 10);
      const startMonth = (q - 1) * 3;
      return {
        type,
        startDate: new Date(year, startMonth, 1),
        endDate: new Date(year, startMonth + 3, 0, 23, 59, 59),
      };
    }

    if (type === SummaryType.weekly && parts.length === 2 && (parts[1] || '').startsWith('W')) {
      const week = parseInt((parts[1] ?? '').substring(1), 10);
      const simpleDate = new Date(year, 0, 4 + (week - 1) * 7);
      const dayOfWeek = simpleDate.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const start = new Date(simpleDate.getFullYear(), simpleDate.getMonth(), simpleDate.getDate() - diff, 0, 0, 0);
      const end = new Date(start.getTime() + 6 * 86400000 + 23 * 3600000 + 59 * 60000 + 59000);
      return { type, startDate: start, endDate: end };
    }

    return null;
  }
}

export const summaryWatcher = new SummaryWatcherService();
