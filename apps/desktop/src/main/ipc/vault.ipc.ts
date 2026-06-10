import { ipcMain, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { createClient } from '@libsql/client'
import { VaultService } from '@baishou/core-desktop'
import { shadowConnectionManager } from '@baishou/database-desktop'
import { logger } from '@baishou/shared'
import { DesktopStoragePathService } from '../services/path.service'
import { resetSyncService } from './incremental-sync.ipc'
import { resetGitService } from './git-sync.ipc'

import { fileSystem } from '../services/node-file-system'

export const pathService = new DesktopStoragePathService()
export { fileSystem }

/**
 * VaultService 不再需要 connectionManager（Agent DB 全局共用，不随 Vault 切换）
 * Shadow DB 连接由此文件中的 initShadowForActiveVault() 驱动
 */
export const vaultService = new VaultService(pathService, fileSystem)

/**
 * 连接活跃 Vault 对应的影子索引库
 * 路径：`<vault>/.baishou/shadow_index.db`（对标原版设计）
 */
export async function connectShadowForActiveVault(): Promise<void> {
  const activeVault = vaultService.getActiveVault()
  if (!activeVault) {
    logger.warn('[VaultIPC] 无活跃 Vault，跳过 Shadow DB 连接')
    return
  }
  const sysDir = await pathService.getShadowIndexDirectory(activeVault.name)
  await shadowConnectionManager.connect(sysDir)
  logger.info(`[VaultIPC] Shadow DB 已连接: ${activeVault.name}`)
}

/**
 * Warm shadow_index DB for a vault without switching the active connection.
 * Called on hover in the workspace menu so connect() is faster on switch.
 */
export async function preloadVaultShadowDb(vaultName: string): Promise<void> {
  const vault = vaultService.getAllVaults().find((v) => v.name === vaultName)
  if (!vault) return

  const active = vaultService.getActiveVault()
  if (active?.name === vaultName) return

  const sysDir = await pathService.getShadowIndexDirectory(vaultName)
  const dbPath = path.join(sysDir, 'shadow_index_v2.db')

  try {
    if (!fs.existsSync(sysDir)) {
      await fs.promises.mkdir(sysDir, { recursive: true })
    }
    const client = createClient({ url: `file:${dbPath}` })
    try {
      await client.execute('SELECT 1')
    } finally {
      client.close()
    }
    logger.info(`[VaultIPC] Preloaded shadow DB cache: ${vaultName}`)
  } catch (e) {
    logger.debug(`[VaultIPC] Shadow preload skipped for ${vaultName}:`, e as any)
  }
}

async function switchVaultFast(vaultName: string) {
  await vaultService.switchVault(vaultName)
  await connectShadowForActiveVault()
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
  // Agent DB 的 schema 在 index.ts 中一次性安装，此处无需重复
  // Shadow DB 在 initRegistry() 后 connect

  await vaultService.initRegistry()

  // 连接当前活跃 Vault 的影子索引库
  await connectShadowForActiveVault()

  // App Boot: 全量 SSOT 同步（首次启动仍需等待完成）
  const { globalBootstrapper } = await import('../services/bootstrapper.service')
  await globalBootstrapper.fullyResyncAllEcosystems()
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

  ipcMain.handle('vault:delete', async (_, vaultName: string) => {
    await vaultService.deleteVault(vaultName)
    return true
  })

  ipcMain.handle('vault:createDialog', async (_, customName?: string) => {
    const newName = customName?.trim() || 'Workspace_' + Math.floor(Math.random() * 10000)
    return switchVaultFast(newName)
  })
}
