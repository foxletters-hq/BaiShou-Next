import { ipcMain, dialog, BrowserWindow } from 'electron';
import { VaultService } from '@baishou/core';
import { shadowConnectionManager } from '@baishou/database';
import { logger } from '@baishou/shared';
import { DesktopStoragePathService } from '../services/path.service';

export const pathService = new DesktopStoragePathService();

/**
 * VaultService 不再需要 connectionManager（Agent DB 全局共用，不随 Vault 切换）
 * Shadow DB 连接由此文件中的 initShadowForActiveVault() 驱动
 */
export const vaultService = new VaultService(pathService);

/**
 * 连接活跃 Vault 对应的影子索引库
 * 路径：`<vault>/.baishou/shadow_index.db`（对标原版设计）
 */
export async function connectShadowForActiveVault(): Promise<void> {
  const activeVault = vaultService.getActiveVault();
  if (!activeVault) {
    logger.warn('[VaultIPC] 无活跃 Vault，跳过 Shadow DB 连接');
    return;
  }
  const sysDir = await pathService.getVaultSystemDirectory(activeVault.name);
  await shadowConnectionManager.connect(sysDir);
  logger.info(`[VaultIPC] Shadow DB 已连接: ${activeVault.name}`);
}

export async function initVaultSystem() {
  // Agent DB 的 schema 在 index.ts 中一次性安装，此处无需重复
  // Shadow DB 在 initRegistry() 后 connect

  await vaultService.initRegistry();

  // 连接当前活跃 Vault 的影子索引库
  await connectShadowForActiveVault();

  // App Boot: 全量 SSOT 同步
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
    // 重新初始化注册表（路径变更）
    await vaultService.initRegistry();
    // 重新连接 Shadow DB（新路径下的 Vault）
    await connectShadowForActiveVault();
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

    // Vault 切换后重新连接对应的 Shadow DB
    await connectShadowForActiveVault();

    // Vault Switch: 全量 SSOT 同步
    const { globalBootstrapper } = await import('../services/bootstrapper.service');
    await globalBootstrapper.fullyResyncAllEcosystems();

    return vaultService.getActiveVault();
  });

  ipcMain.handle('vault:delete', async (_, vaultName: string) => {
    await vaultService.deleteVault(vaultName);
    return true;
  });

  ipcMain.handle('vault:createDialog', async () => {
    const newName = 'Workspace_' + Math.floor(Math.random() * 10000);
    await vaultService.switchVault(newName);

    // 新 Vault 切换后连接新的 Shadow DB
    await connectShadowForActiveVault();

    // Vault Switch: 全量 SSOT 同步
    const { globalBootstrapper } = await import('../services/bootstrapper.service');
    await globalBootstrapper.fullyResyncAllEcosystems();

    return vaultService.getActiveVault();
  });
}
