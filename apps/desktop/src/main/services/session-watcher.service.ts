import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@baishou/shared';
import * as chokidar from 'chokidar';
import { SessionSyncService, SessionFileService } from '@baishou/core';
import { SessionRepository, connectionManager } from '@baishou/database';
import { pathService } from '../ipc/vault.ipc';

/**
 * 会话文件变动监听服务
 *
 * 监听 Sessions/ 目录下所有 .json 文件的增删改，
 * 自动触发 SessionSyncService 将文件变更同步到 SQLite 缓存表。
 * 解决 git pull / rollback 后会话不立即显示的问题。
 */
export class SessionWatcherService {
  private watcher: chokidar.FSWatcher | null = null;
  private sessionsPath: string | null = null;
  private pendingPaths = new Set<string>();
  private isProcessing = false;
  private globalDebounceTimer: NodeJS.Timeout | null = null;
  private sessionSync: SessionSyncService | null = null;
  /** 写入抑制表：path → 过期时间戳。防止自身写入触发循环同步。 */
  private suppressedPaths = new Map<string, number>();

  public start(vaultPath: string) {
    this.stop();
    this.sessionsPath = path.join(vaultPath, 'Sessions');

    // 确保 Sessions 目录存在
    if (!fs.existsSync(this.sessionsPath)) {
      try {
        fs.mkdirSync(this.sessionsPath, { recursive: true });
      } catch (e) {
        logger.error(`[SessionWatcher] 无法创建 Sessions 目录:`, e as any);
      }
    }

    // 初始化依赖
    const db = connectionManager.getDb();
    const sessionRepo = new SessionRepository(db);
    const sessionFileService = new SessionFileService(pathService);
    this.sessionSync = new SessionSyncService(sessionRepo, sessionFileService);

    // 初始化 Chokidar 监听
    this.watcher = chokidar.watch(this.sessionsPath, {
      ignored: /(^|[\/\\])\../,
      ignoreInitial: true,
    });

    this.watcher.on('all', (eventName, fullPath) => {
      if (!fullPath.endsWith('.json')) return;
      if (eventName === 'add' || eventName === 'change' || eventName === 'unlink') {
        this.scheduleSync(fullPath);
      }
    });

    logger.info(`[SessionWatcher] 监听已启动: ${this.sessionsPath}`);
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
    this.sessionsPath = null;
    this.sessionSync = null;
    logger.info(`[SessionWatcher] 监听已停止`);
  }

  /**
   * 抑制指定路径的 Watcher 事件
   * 用于 SessionManagerService 自身写入时防止触发循环同步
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
    }, 500);
  }

  private async processQueue() {
    if (this.isProcessing || !this.sessionSync) return;
    this.isProcessing = true;

    try {
      while (this.pendingPaths.size > 0) {
        const pathsToProcess = Array.from(this.pendingPaths);
        this.pendingPaths.clear();

        for (const changedPath of pathsToProcess) {
          const sessionId = path.basename(changedPath, '.json');
          if (!sessionId) continue;

          try {
            await this.sessionSync.syncSessionFile(sessionId);
          } catch (e) {
            logger.error(`[SessionWatcher] 同步失败: ${changedPath}`, e as any);
          }
        }
      }

      // 通知前端刷新会话列表
      const wins = BrowserWindow.getAllWindows();
      wins.forEach(w => {
        w.webContents.send('session:file-changed');
      });

    } finally {
      this.isProcessing = false;
    }
  }
}

export const sessionWatcher = new SessionWatcherService();
