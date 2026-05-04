import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getShadowSync } from '../ipc/diary.ipc';
import { parseDateStr, logger } from '@baishou/shared';
import * as chokidar from 'chokidar';

/**
 * 日记文件变动监听服务
 *
 * 现已使用 Chokidar 管理文件监听，替代了原来的高能耗轮询。
 * 使用 awaitWriteFinish 来避免 Windows/网络驱动下的原子写入冲突问题。
 */
export class DiaryWatcherService {
  private watcher: chokidar.FSWatcher | null = null;
  private journalsPath: string | null = null;
  /** 收集短期内发生变动的文件路径 */
  private pendingPaths = new Set<string>();
  private isProcessing = false;
  private globalDebounceTimer: NodeJS.Timeout | null = null;

  public start(vaultPath: string) {
    this.stop();
    this.journalsPath = path.join(vaultPath, 'Journals');
    
    logger.info(`[DiaryWatcher] 🚀 journalsPath = ${this.journalsPath}`);

    // 确保 Journals 目录存在（第一次打开可能未创建）
    if (!fs.existsSync(this.journalsPath)) {
      try {
        fs.mkdirSync(this.journalsPath, { recursive: true });
        logger.info(`[DiaryWatcher] 📁 Journals 目录已创建`);
      } catch (e) {
        logger.error(`[DiaryWatcher] ❌ 无法创建 Journals 目录:`, e);
      }
    }

    // 初始化 Chokidar 监听 (去除 awaitWriteFinish 防止因体积未变导致的响应延迟或者漏事件，去除 cwd 防止路径匹配失效)
    this.watcher = chokidar.watch(this.journalsPath, {
      ignored: /(^|[\/\\])\../, // 忽略隐藏文件
      ignoreInitial: true, // 初始加载时不触发 add 事件
      disableGlobbing: true, // 因为直接传绝对路径，关掉 glob 解析提升一点性能和健壮性
    });

    this.watcher.on('all', (eventName, fullPath) => {
      // 只要是 .md 文件的 增、改、删 就触发同步
      if (!fullPath.endsWith('.md')) return;
      if (eventName === 'add' || eventName === 'change' || eventName === 'unlink') {
        this.scheduleSync(fullPath);
      }
    });

    logger.info(`[DiaryWatcher] ✅ Chokidar 监听已启动（最高速响应模式）`);
  }

  public stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.globalDebounceTimer) clearTimeout(this.globalDebounceTimer);
    this.pendingPaths.clear();
    this.isProcessing = false;
    this.journalsPath = null;
    logger.info(`[DiaryWatcher] 🛑 监听已停止`);
  }

  // ── 内部方法 ──────────────────────────────────────

  private scheduleSync(changedPath: string) {
    this.pendingPaths.add(changedPath);
    if (this.globalDebounceTimer) {
      clearTimeout(this.globalDebounceTimer);
    }
    // 延迟更长一点，收集一波连续的文件变动
    this.globalDebounceTimer = setTimeout(async () => {
      await this.processQueue();
    }, 500);
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.pendingPaths.size > 0) {
        // 取出当前的子集
        const pathsToProcess = Array.from(this.pendingPaths);
        this.pendingPaths.clear();

        // 批量提取有效日期
        const datesToProcess: Date[] = [];
        const validPaths: string[] = [];
        const dateFileRegex = /^(\d{4}-\d{2}-\d{2})\.md$/;

        for (const changedPath of pathsToProcess) {
          const fileName = path.basename(changedPath);
          const match = dateFileRegex.exec(fileName);
          if (match && match[1]) {
            datesToProcess.push(parseDateStr(match[1]));
            validPaths.push(changedPath);
          }
        }

        if (datesToProcess.length > 0) {
          try {
             const shadowSync = getShadowSync();
             const results = await shadowSync.syncJournalsBatch(datesToProcess);

             const wins = BrowserWindow.getAllWindows();
             wins.forEach(w => {
               // 批量发送单独的变化事件给UI (为了兼容现有的 diary:sync-event 监听器)
               for (let i = 0; i < results.length; i++) {
                 w.webContents.send('diary:sync-event', {
                   path: validPaths[i],
                   date: datesToProcess[i]!.toISOString().split('T')[0],
                   result: results[i],
                   forced: true,
                 });
               }
             });
          } catch (e) {
             logger.error('[DiaryWatcher] ❌ 批量同步失败:', e);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export const diaryWatcher = new DiaryWatcherService();
