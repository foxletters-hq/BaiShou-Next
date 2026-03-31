import { ipcMain, BrowserWindow } from 'electron';
import { DesktopLanSyncService } from '../services/lan-sync.service';
import { archiveService } from './archive.ipc';

export const lanSyncService = new DesktopLanSyncService(archiveService);

export function registerLanIPC() {
  ipcMain.handle('lan:startBroadcasting', async () => {
    return await lanSyncService.startBroadcasting();
  });

  ipcMain.handle('lan:stopBroadcasting', async () => {
    await lanSyncService.stopBroadcasting();
    return true;
  });

  ipcMain.handle('lan:startDiscovery', async () => {
    await lanSyncService.startDiscovery(
      (device) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          windows[0].webContents.send('lan:device-found', device);
        }
      },
      (deviceId) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          windows[0].webContents.send('lan:device-lost', deviceId);
        }
      }
    );
    return true;
  });

  ipcMain.handle('lan:stopDiscovery', async () => {
    await lanSyncService.stopDiscovery();
    return true;
  });

  ipcMain.handle('lan:sendFile', async (_, ip: string, port: number) => {
    return await lanSyncService.sendFile(ip, port, (progress) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].webContents.send('lan:send-progress', progress);
      }
    });
  });

  // Start receiving files backend logic. Trigger a global event to frontend modal when received
  lanSyncService.onFileReceived((zipFilePath) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('lan:file-received', zipFilePath);
    }
  });
}
