import { ipcMain, app } from 'electron';
import fs from 'fs';
import path from 'path';
import { vaultService, pathService } from './vault.ipc';

export function registerStorageIPC() {
  ipcMain.handle('storage:getStats', async () => {
    try {
      const activeVault = vaultService.getActiveVault();
      const storageRootPath = activeVault ? activeVault.path : await pathService.getRootDirectory();
      const sqlitePath = activeVault ? path.join(activeVault.path, 'data.db') : path.join(app.getPath('userData'), 'data.db');
      
      let sqliteSize = 0;
      if (fs.existsSync(sqlitePath)) {
        const stats = fs.statSync(sqlitePath);
        sqliteSize = stats.size;
      }
      
      // Vector DB might be another file or dir. Hardcoding dummy wrapper for now.
      const vectorDbSize = 0;
      const mediaCacheSize = 0;

      const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      return {
        storageRootPath,
        sqliteSizeStats: formatBytes(sqliteSize),
        vectorDbStats: formatBytes(vectorDbSize),
        mediaCacheStats: formatBytes(mediaCacheSize)
      };
    } catch (e) {
      console.error('[Storage IPC] Failed to get stats', e);
      return {
        storageRootPath: await pathService.getRootDirectory(),
        sqliteSizeStats: 'Unknown',
        vectorDbStats: 'Unknown',
        mediaCacheStats: 'Unknown'
      };
    }
  });

  ipcMain.handle('storage:clearCache', async () => {
    // Implement cache clearing logic if necessary
    return true;
  });

  ipcMain.handle('storage:vacuumDb', async () => {
    // Provide SQLite VACUUM hook later
    return true;
  });
}
