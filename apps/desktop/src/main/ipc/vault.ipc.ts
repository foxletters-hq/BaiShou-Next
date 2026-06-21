import { ipcMain, BrowserWindow } from 'electron'
import { VaultService, VaultNameExistsError, VaultInvalidNameError } from '@baishou/core-desktop'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database-desktop'
import { logger } from '@baishou/shared'
import { DesktopStoragePathService } from '../services/path.service'
import { resetSyncService } from './incremental-sync.ipc'
import { resetGitService } from './git-sync.ipc'
import { diaryWatcher } from '../services/diary-watcher.service'
import { summaryWatcher } from '../services/summary-watcher.service'
import { sessionWatcher } from '../services/session-watcher.service'

import { fileSystem } from '../services/node-file-system'

export const pathService = new DesktopStoragePathService()
export { fileSystem }

/**
 * VaultService 不再需要 connectionManager（Agent DB 全局共用，不随 Vault 切换）
 * 全局 Shadow DB 由 connectGlobalShadowDb() 在启动时连接一次
 */
export const vaultService = new VaultService(pathService, fileSystem)

export function notifyVaultRegistryUpdated(): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('vault:registryUpdated')
  })
}

/** 连接全局影子索引库（单库多 Vault，Vault 切换无需重连） */
export async function connectGlobalShadowDb(): Promise<void> {
  const sysDir = await pathService.getGlobalShadowIndexDirectory()
  await shadowConnectionManager.connect(sysDir)
  logger.info(`[VaultIPC] 全局 Shadow DB 已连接: ${sysDir}`)
}

/** 基于当前活跃 Vault 创建 ShadowIndexRepository */
export function getActiveVaultShadowRepo(): ShadowIndexRepository {
  const activeVault = vaultService.getActiveVault()
  if (!activeVault) {
    throw new Error('[VaultIPC] 无活跃 Vault，无法创建 ShadowIndexRepository')
  }
  return new ShadowIndexRepository(shadowConnectionManager.getDb(), activeVault.name)
}

/** 全局单库模式下 per-vault preload 已无意义，保留 IPC 兼容为 no-op */
export async function preloadVaultShadowDb(_vaultName: string): Promise<void> {
  if (!shadowConnectionManager.isConnected()) {
    await connectGlobalShadowDb()
  }
}

async function switchVaultFast(vaultName: string) {
  const active = vaultService.getActiveVault()
  if (active?.name === vaultName) {
    return active
  }

  diaryWatcher.stop()
  summaryWatcher.stop()
  sessionWatcher.stop()

  await vaultService.switchVault(vaultName)

  const { emitVaultSwitchMutation } = await import('../cache/desktop-main-cache-coordinator')
  emitVaultSwitchMutation(vaultName, 'vault-switch')

  const { resetCachedManager } = await import('./summary.ipc')
  resetCachedManager()
  const { resetSharedShadowSync } = await import('../services/shadow-sync.registry')
  resetSharedShadowSync()

  const { globalBootstrapper } = await import('../services/bootstrapper.service')
  await globalBootstrapper.activateVaultRuntime()
  const { resetAttachmentAllowedRootsCache } = await import('./attachment-path-cache')
  resetAttachmentAllowedRootsCache()
  resetSyncService()
  resetGitService()
  const { scheduleVaultEcosystemResync } = await import('../services/vault-resync.service')
  scheduleVaultEcosystemResync(`vault-switch:${vaultName}`)
  return vaultService.getActiveVault()
}

export async function initVaultSystem() {
  await vaultService.initRegistry()
  await connectGlobalShadowDb()

  const { globalBootstrapper } = await import('../services/bootstrapper.service')
  await globalBootstrapper.activateVaultRuntime()

  const { scheduleVaultEcosystemResync } = await import('../services/vault-resync.service')
  scheduleVaultEcosystemResync('cold-start')
}

export function registerVaultIPC() {
  ipcMain.handle('vault:pickCustomRootPath', async (event) => {
    const { pickStorageDirectory, changeStorageRootDirectory } =
      await import('../services/desktop-storage-directory.service')
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null

    const newPath = await pickStorageDirectory(window)
    if (!newPath) return null

    await changeStorageRootDirectory(newPath)
    return newPath
  })

  ipcMain.handle('vault:getCustomRootPath', async () => {
    return await pathService.getCustomRootPath()
  })

  ipcMain.handle('vault:getAll', () => {
    return vaultService.getAllVaults()
  })

  ipcMain.handle('vault:getActive', () => {
    return vaultService.getActiveVault()
  })

  ipcMain.handle('vault:preload', async (_, vaultName: string) => {
    await preloadVaultShadowDb(vaultName)
    return true
  })

  ipcMain.handle('vault:switch', async (_, vaultName: string) => {
    return switchVaultFast(vaultName)
  })

  ipcMain.handle('vault:wait-for-resync', async () => {
    const { waitForVaultEcosystemResync } = await import('../services/vault-resync.service')
    await waitForVaultEcosystemResync()
    return true
  })

  ipcMain.handle('vault:getIndexingStatus', async () => {
    const { isVaultEcosystemResyncInFlight } = await import('../services/vault-resync.service')
    const { getSharedShadowSync } = await import('../services/shadow-sync.registry')
    const resyncing = isVaultEcosystemResyncInFlight()
    const shadowScanning = getSharedShadowSync().isScanning
    return { indexing: resyncing || shadowScanning, resyncing, shadowScanning }
  })

  ipcMain.handle('vault:delete', async (_, vaultName: string) => {
    if (shadowConnectionManager.isConnected()) {
      const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultName)
      await shadowRepo.deleteAllForVault(vaultName)
    }
    await vaultService.deleteVault(vaultName)
    return true
  })

  ipcMain.handle('vault:createDialog', async (_, customName?: string) => {
    const newName = customName?.trim() || 'Workspace_' + Math.floor(Math.random() * 10000)
    try {
      await vaultService.createVault(newName)
    } catch (e) {
      if (e instanceof VaultNameExistsError) {
        const err = new Error('VAULT_NAME_EXISTS')
        ;(err as Error & { code: string; vaultName: string }).code = 'VAULT_NAME_EXISTS'
        ;(err as Error & { vaultName: string }).vaultName = e.vaultName
        throw err
      }
      if (e instanceof VaultInvalidNameError) {
        const err = new Error('VAULT_INVALID_NAME')
        ;(err as Error & { code: string; reason: string }).code = 'VAULT_INVALID_NAME'
        ;(err as Error & { reason: string }).reason = e.reason
        throw err
      }
      throw e
    }
    return switchVaultFast(newName)
  })
}
