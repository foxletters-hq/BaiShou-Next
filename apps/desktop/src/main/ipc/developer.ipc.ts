import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getDiaryManager } from './diary.ipc';
import { INITIAL_DIARIES } from '../services/demo-data';
import { getAppDb } from '../db';
import { shadowConnectionManager } from '@baishou/database';
import { pathService } from './vault.ipc';
import { diaryWatcher } from '../services/diary-watcher.service';
import { summaryWatcher } from '../services/summary-watcher.service';
import { sessionWatcher } from '../services/session-watcher.service';

export function registerDeveloperIPC() {
  ipcMain.handle('developer:load-demo-data', async () => {
    const diaryManager = getDiaryManager();
    const now = new Date();
    
    for (const demo of INITIAL_DIARIES) {
      let entryDate: Date;
      if (demo.dateFixed) {
        entryDate = new Date(demo.dateFixed);
      } else {
        entryDate = new Date(now.getTime());
        if (demo.dateDaysOffset) {
          entryDate.setDate(entryDate.getDate() + demo.dateDaysOffset);
        }
        if (demo.dateMinutesOffset) {
          entryDate.setMinutes(entryDate.getMinutes() + demo.dateMinutesOffset);
        }
      }
      
      const existing = await diaryManager.findByDate(entryDate);
      if (existing) {
        // 追加模式
        await diaryManager.update(existing.id, {
          content: existing.content + '\n\n---\n\n' + demo.content,
          tags: Array.from(new Set([...(existing.tags || []), ...(demo.tags || [])])),
          mood: demo.mood || existing.mood,
        });
      } else {
        await diaryManager.create({
          date: entryDate,
          content: demo.content,
          tags: demo.tags || [],
          mood: demo.mood,
        });
      }
    }
    return true;
  });

  ipcMain.handle('app:relaunch', () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle('developer:clear-all-data', async () => {
    // 1. 关闭 Agent DB
    try {
      const appDb = getAppDb();
      const client = (appDb as any).session?.client;
      if (client && typeof client.close === 'function') {
        client.close();
      }
    } catch (e) {
      console.warn('Failed to close Agent DB:', e);
    }

    // 2. 关闭 Shadow DB
    try {
      shadowConnectionManager.disconnect();
    } catch(e) {
      console.warn('Failed to disconnect Shadow DB:', e);
    }

    // 关闭日记/总结观察者进程，释放由于 Chokidar 在后台持续索引形成的文件占用于锁（避免 Windows 触发 ENOTEMPTY）
    try {
      diaryWatcher.stop();
    } catch(e) {
      console.warn('Failed to stop Diary Watcher:', e);
    }
    try {
      summaryWatcher.stop();
    } catch(e) {
      console.warn('Failed to stop Summary Watcher:', e);
    }
    try {
      sessionWatcher.stop();
    } catch(e) {
      console.warn('Failed to stop Session Watcher:', e);
    }

    // 给操作系统句柄释放留出时间
    await new Promise(r => setTimeout(r, 1000));

    // 3. Clear Storage Root
    try {
      const rootPath = await pathService.getRootDirectory();
      if (fs.existsSync(rootPath)) {
        const files = fs.readdirSync(rootPath);
        for(const f of files) {
           fs.rmSync(path.join(rootPath, f), { recursive: true, force: true });
        }
      }
    } catch(e) {
      console.error('Failed to clear root path', e);
      throw e;
    }

    // 4. Delete app metadata and settings in userData
    try {
      const userDataPath = app.getPath('userData');
      const targets = [
        'baishou_agent.db',
        'baishou_agent.db-wal',
        'baishou_agent.db-shm',
        'snapshots',
        'avatars',
        'images',
        'config.json',
        'app-settings.json',
        'baishou_logs',
        'baishou_settings.json'
      ];
      
      for (const target of targets) {
        const p = path.join(userDataPath, target);
        if (fs.existsSync(p)) {
          fs.rmSync(p, { recursive: true, force: true });
        }
      }
    } catch(e) {
      console.error('Failed to clear internal metadata', e);
      throw e;
    }

    return true;
  });

  ipcMain.handle('developer:clear-agent-data', async () => {
    try {
      const appDb = getAppDb();
      const client = (appDb as any).session?.client;
      if (client && typeof client.close === 'function') {
        client.close();
      }
    } catch (e) {
      console.warn('Failed to close Agent DB:', e);
    }

    await new Promise(r => setTimeout(r, 500));
    
    try {
      const userDataPath = app.getPath('userData');
      const targets = [
        'baishou_agent.db',
        'baishou_agent.db-wal',
        'baishou_agent.db-shm'
      ];
      for (const target of targets) {
        const p = path.join(userDataPath, target);
        if (fs.existsSync(p)) {
          fs.rmSync(p, { recursive: true, force: true });
        }
      }
    } catch(e) {
       console.error('Failed to clear Agent DB files', e);
       throw e;
    }

    return true;
  });
}
