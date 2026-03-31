import { ipcMain } from 'electron';
import { DesktopArchiveService } from '../services/archive.service';
import { vaultService, pathService } from './vault.ipc';

export const archiveService = new DesktopArchiveService(pathService, vaultService);

export function registerArchiveIPC() {
  ipcMain.handle('archive:export', async () => {
    return await archiveService.exportToUserDevice();
  });

  ipcMain.handle('archive:import', async (_, zipFilePath: string, createSnapshotBefore: boolean = true) => {
    return await archiveService.importFromZip(zipFilePath, createSnapshotBefore);
  });

  ipcMain.handle('archive:pick-zip', async (event) => {
    const { dialog, BrowserWindow } = require('electron');
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      title: '选择白守容灾备份文件 (ZIP)',
      filters: [{ name: 'ZIP Archives', extensions: ['zip'] }],
      properties: ['openFile']
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });
}
