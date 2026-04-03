import { ipcMain, dialog, BrowserWindow } from 'electron';
import { VaultService } from '@baishou/core';
import { connectionManager, installDatabaseSchema } from '@baishou/database';
import { DesktopStoragePathService } from '../services/path.service';

export const pathService = new DesktopStoragePathService();
export const vaultService = new VaultService(pathService, connectionManager);

export async function initVaultSystem() {
  await vaultService.initRegistry();
  
  // Create schema on first boot automatically if using a blank database
  await installDatabaseSchema(connectionManager.getDb());
  
  // App Boot: Enforce SSOT consistency scan for potential offline cloud-disk changes
  const { globalBootstrapper } = await import('../services/bootstrapper.service');
  await globalBootstrapper.fullyResyncAllEcosystems();
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
    
    // Vault Switch: Enforce SSOT
    const { globalBootstrapper } = await import('../services/bootstrapper.service');
    await globalBootstrapper.fullyResyncAllEcosystems();
    
    return vaultService.getActiveVault();
  });

  ipcMain.handle('vault:delete', async (_, vaultName: string) => {
    await vaultService.deleteVault(vaultName);
    return true;
  });
}
