import { ipcMain, BrowserWindow } from 'electron';
import { SyncIpcChannels } from '@baishou/shared';
import { DesktopLanSyncService } from '../services/lan-sync.service';
import { archiveService } from './archive.ipc';

export const lanSyncService = new DesktopLanSyncService(archiveService);

export function registerLanIPC() {
  ipcMain.handle(SyncIpcChannels.LAN_START_BROADCASTING, async () => {
    return await lanSyncService.startBroadcasting();
  });

  ipcMain.handle(SyncIpcChannels.LAN_STOP_BROADCASTING, async () => {
    await lanSyncService.stopBroadcasting();
    return true;
  });

  ipcMain.handle(SyncIpcChannels.LAN_START_DISCOVERY, async () => {
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

  ipcMain.handle(SyncIpcChannels.LAN_STOP_DISCOVERY, async () => {
    await lanSyncService.stopDiscovery();
    return true;
  });

  ipcMain.handle(SyncIpcChannels.LAN_SEND_FILE, async (_, ip: string, port: number) => {
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
