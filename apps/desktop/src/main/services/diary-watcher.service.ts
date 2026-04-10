import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getShadowSync } from '../ipc/diary.ipc';
import { parseDateStr } from '@baishou/shared';
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
  /** 防止高频触发多次 performSync */
  private debounceMap = new Map<string, NodeJS.Timeout>();

  public start(vaultPath: string) {
    this.stop();
    this.journalsPath = path.join(vaultPath, 'Journals');
    
    console.log(`[DiaryWatcher] 🚀 journalsPath = ${this.journalsPath}`);

    // 确保 Journals 目录存在（第一次打开可能未创建）
    if (!fs.existsSync(this.journalsPath)) {
      try {
        fs.mkdirSync(this.journalsPath, { recursive: true });
        console.log(`[DiaryWatcher] 📁 Journals 目录已创建`);
      } catch (e) {
        console.error(`[DiaryWatcher] ❌ 无法创建 Journals 目录:`, e);
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

    console.log(`[DiaryWatcher] ✅ Chokidar 监听已启动（最高速响应模式）`);
  }

  public stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.debounceMap.forEach((t) => clearTimeout(t));
    this.debounceMap.clear();
    this.journalsPath = null;
    console.log(`[DiaryWatcher] 🛑 监听已停止`);
  }

  // ── 内部方法 ──────────────────────────────────────

  private scheduleSync(changedPath: string) {
    if (this.debounceMap.has(changedPath)) {
      clearTimeout(this.debounceMap.get(changedPath)!);
    }
    const timer = setTimeout(async () => {
      this.debounceMap.delete(changedPath);
      await this.performSync(changedPath);
    }, 300);
    this.debounceMap.set(changedPath, timer);
  }

  private async performSync(changedPath: string) {
    const fileName = path.basename(changedPath);
    const dateFileRegex = /^(\d{4}-\d{2}-\d{2})\.md$/;
    const match = dateFileRegex.exec(fileName);

    if (!match || !match[1]) {
      return;
    }

    const dateStr = match[1];
    const date = parseDateStr(dateStr);

    try {
      const shadowSync = getShadowSync();
      const result = await shadowSync.syncJournal(date);

      const wins = BrowserWindow.getAllWindows();

      wins.forEach(w => {
        w.webContents.send('diary:sync-event', {
          path: changedPath,
          date: dateStr,
          result,
          forced: true,
        });
      });
    } catch (e) {
      console.error('[DiaryWatcher] ❌ 同步失败:', e);
    }
  }
}

export const diaryWatcher = new DiaryWatcherService();
