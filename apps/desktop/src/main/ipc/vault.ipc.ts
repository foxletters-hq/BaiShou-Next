import { ipcMain, dialog, BrowserWindow } from 'electron';
import { VaultService } from '@baishou/core';
import { connectionManager } from '@baishou/database';
import { DesktopStoragePathService } from '../services/path.service';

const pathService = new DesktopStoragePathService();
const vaultService = new VaultService(pathService, connectionManager);

export async function initVaultSystem() {
  await vaultService.initRegistry();
}

export function registerVaultIPC() {
  ipcMain.handle('vault:pickCustomRootPath', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;

    const result = await dialog.showOpenDialog(window, {
      title: 'Select Workspace Root Directory',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const newPath = result.filePaths[0];
    await pathService.updateRootDirectory(newPath);
    // Apply changes by re-initializing the registry which moves/rectifies paths
    await vaultService.initRegistry();
    return newPath;
  });

  ipcMain.handle('vault:getCustomRootPath', async () => {
    return await pathService.getCustomRootPath();
  });

  ipcMain.handle('vault:getAll', () => {
    return vaultService.getAllVaults();
  });

  ipcMain.handle('vault:getActive', () => {
    return vaultService.getActiveVault();
  });

  ipcMain.handle('vault:switch', async (_, vaultName: string) => {
    await vaultService.switchVault(vaultName);
    return vaultService.getActiveVault();
  });

  ipcMain.handle('vault:delete', async (_, vaultName: string) => {
    await vaultService.deleteVault(vaultName);
    return true;
  });
}
