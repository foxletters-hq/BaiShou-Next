import i18n from 'i18next'
import { ipcMain, BrowserWindow } from 'electron'
import {
  VaultService,
  VaultNameExistsError,
  VaultInvalidNameError,
  VaultNotFoundError,
  VaultRenameFilesystemError
} from '@baishou/core-desktop'
import {
  ShadowIndexRepository,
  shadowConnectionManager,
  connectionManager,
  knowledgeConnectionManager
} from '@baishou/database-desktop'
import { deriveLegacyVaultId, logger } from '@baishou/shared'
import { DesktopStoragePathService } from '../services/path.service'
import { traceStartupStep } from '../startup-trace.util'
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

/**
 * 活跃工作空间 { id, name }。有 registry 时禁止对已知随机 id 仓库仅用 name 派生。
 */
export function resolveActiveVault(): { id: string; name: string } {
  const vault = vaultService.getActiveVault()
  if (vault?.id) {
    return { id: vault.id, name: vault.name || 'Personal' }
  }
  const name = vault?.name?.trim() || 'Personal'
  return { id: deriveLegacyVaultId(name), name }
}

/** 活跃工作空间稳定 ID；优先 registry.id */
export function resolveActiveVaultId(): string {
  return resolveActiveVault().id
}

/** 按显示名解析 vault id；能拿到 registry 时用真实 id，禁止盲目 derive */
export function resolveVaultIdByName(vaultName: string): string {
  const trimmed = vaultName.trim()
  if (!trimmed) return deriveLegacyVaultId('Personal')
  const fromRegistry = vaultService.getAllVaults().find((v) => v.name === trimmed)
  if (fromRegistry?.id) return fromRegistry.id
  return deriveLegacyVaultId(trimmed)
}

/** 将 vault id 还原为显示名（prompt / 路径 / UI） */
export function resolveVaultNameById(vaultId: string): string {
  const trimmed = vaultId.trim()
  if (!trimmed) return 'Personal'
  return vaultService.getAllVaults().find((v) => v.id === trimmed)?.name ?? trimmed
}

export function notifyVaultRegistryUpdated(): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('vault:registryUpdated')
  })
}

/** 连接全局影子索引库（单库多 Vault，Vault 切换无需重连） */
export async function connectGlobalShadowDb(): Promise<void> {
  await traceStartupStep('shadowDb.connect', async () => {
    const sysDir = await pathService.getGlobalShadowIndexDirectory()
    await shadowConnectionManager.connect(sysDir)
    logger.info(`[VaultIPC] 全局 Shadow DB 已连接: ${sysDir}`)
  })
}

/** 连接知识库（存储根下 knowledge.db；切换存储根时需 disconnect/reconnect） */
export async function connectKnowledgeDb(): Promise<void> {
  await traceStartupStep('knowledgeDb.connect', async () => {
    const root = await pathService.getRootDirectory()
    await knowledgeConnectionManager.connect(root)
    const vec = knowledgeConnectionManager.getVecVersion()
    logger.info(`[VaultIPC] 知识库已连接: ${root}/knowledge.db vec_version=${vec ?? 'unavailable'}`)
  })
}

/** 基于当前活跃 Vault 创建 ShadowIndexRepository */
export function getActiveVaultShadowRepo(): ShadowIndexRepository {
  const activeVault = vaultService.getActiveVault()
  if (!activeVault) {
    throw new Error(
      i18n.t(
        'auto.apps.desktop.src.main.ipc.vault.ipc.L40',
        '[VaultIPC] 无活跃 Vault，无法创建 ShadowIndexRepository'
      )
    )
  }
  return new ShadowIndexRepository(shadowConnectionManager.getDb(), activeVault.id)
}

/** 全局单库模式下 per-vault preload 已无意义，保留 IPC 兼容为 no-op */
export async function preloadVaultShadowDb(_vaultName: string): Promise<void> {
  if (!shadowConnectionManager.isConnected()) {
    await connectGlobalShadowDb()
  }
}

export async function switchVaultFast(vaultName: string) {
  const active = vaultService.getActiveVault()
  if (active?.name === vaultName) {
    return active
  }

  diaryWatcher.stop()
  summaryWatcher.stop()
  sessionWatcher.stop()

  // 单例 SessionManager 的防抖落盘必须在切换前完成，否则会写到新 vault 目录
  try {
    const { getAgentManagers, invalidateAgentManagers } = await import('./agent-helpers')
    await getAgentManagers().sessionManager.flushPendingDiskWrites()
    invalidateAgentManagers()
  } catch (e) {
    logger.warn('[Vault] flush/invalidate agent managers before switch failed:', e as Error)
    try {
      const { invalidateAgentManagers } = await import('./agent-helpers')
      invalidateAgentManagers()
    } catch {
      // ignore
    }
  }

  await vaultService.switchVault(vaultName)

  try {
    const { resetAgentGateRuntimes } = await import('../services/agent-gate.service')
    resetAgentGateRuntimes(`vault-switch:${vaultName}`)
  } catch (e) {
    logger.warn('[Vault] reset agent gate runtimes failed:', e as Error)
  }

  const { resetRawDataRuntime } = await import('../services/raw-data-source.runtime')
  resetRawDataRuntime()

  const { emitVaultSwitchMutation } = await import('../cache/desktop-main-cache-coordinator')
  emitVaultSwitchMutation(resolveActiveVaultId(), 'vault-switch')

  const { rebindSummaryCacheForActiveVault } = await import('./summary.ipc')
  await rebindSummaryCacheForActiveVault()

  const { resetSharedShadowSync } = await import('../services/shadow-sync.registry')
  resetSharedShadowSync()

  const { globalBootstrapper } = await import('../services/bootstrapper.service')
  await globalBootstrapper.activateVaultRuntime()
  const { resetAttachmentAllowedRootsCache, refreshDesktopAttachmentPathRemapper } =
    await import('./attachment-path-cache')
  resetAttachmentAllowedRootsCache()
  const { DesktopStoragePathService } = await import('../services/path.service')
  await refreshDesktopAttachmentPathRemapper(new DesktopStoragePathService())
  resetSyncService()
  resetGitService()
  const { scheduleVaultEcosystemResync } = await import('../services/vault-resync.service')
  scheduleVaultEcosystemResync(`vault-switch:${vaultName}`)
  return vaultService.getActiveVault()
}

export async function initVaultSystem() {
  await traceStartupStep('vault.initRegistry', () => vaultService.initRegistry())
  await connectGlobalShadowDb()
  await connectKnowledgeDb()

  const { rebindSummaryCacheForActiveVault } = await import('./summary.ipc')
  await traceStartupStep('summary.rebindCache', () => rebindSummaryCacheForActiveVault())

  const { globalBootstrapper } = await import('../services/bootstrapper.service')
  await traceStartupStep('vault.activateRuntime', () => globalBootstrapper.activateVaultRuntime())

  // 全量扫盘延后到渲染进程首屏，避免与 Vite 模块图抢主线程/磁盘
  const { armDeferredColdStartResync } = await import('../services/vault-resync.service')
  armDeferredColdStartResync()

  // 冷启动挂知识库摄入消费者
  try {
    const { scheduleConsumeKnowledgeIngestJobs } =
      await import('../services/knowledge-ingest-jobs.consumer')
    scheduleConsumeKnowledgeIngestJobs('cold-start')
  } catch (e) {
    logger.warn('[VaultIPC] schedule knowledge ingest consumer failed:', e as Error)
  }
}

export function registerVaultIPC() {
  ipcMain.handle('vault:pickCustomRootPath', async (event) => {
    const { pickStorageDirectory, changeStorageRootDirectory } =
      await import('../services/desktop-storage-directory.service')
    const window = BrowserWindow.fromWebContents(event.sender)

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

  ipcMain.handle('vault:releaseColdStartResync', async (_event, trigger?: string) => {
    const { releaseDeferredColdStartResync } = await import('../services/vault-resync.service')
    return releaseDeferredColdStartResync(
      typeof trigger === 'string' && trigger.trim() ? trigger.trim() : 'renderer'
    )
  })

  ipcMain.handle('vault:delete', async (_, vaultName: string) => {
    const vaultId = resolveVaultIdByName(vaultName)
    // 先清 agent.db 派生数据，再清 knowledge / shadow / 删目录（中途失败可重试，避免幽灵索引）
    if (connectionManager.isConnected()) {
      const { createSqlExecutorFromDrizzleDb, purgeVaultDerivedData } =
        await import('@baishou/database-desktop')
      const counts = await purgeVaultDerivedData(
        createSqlExecutorFromDrizzleDb(connectionManager.getDb()),
        vaultId
      )
      logger.info('[vault:delete] purged agent.db derived data', { vaultName, vaultId, ...counts })
    }
    if (knowledgeConnectionManager.isConnected()) {
      const { KnowledgeRepository } = await import('@baishou/database-desktop')
      const repo = new KnowledgeRepository(knowledgeConnectionManager.getDb())
      const kbCounts = await repo.deleteAllForVault(vaultId)
      logger.info('[vault:delete] purged knowledge.db', { vaultName, vaultId, ...kbCounts })
    }
    if (shadowConnectionManager.isConnected()) {
      const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultId)
      await shadowRepo.deleteAllForVault(vaultId)
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

  ipcMain.handle('vault:estimateRenameBytes', async (_, vaultNameOrId: string) => {
    return vaultService.estimateVaultLocalSyncBytes(vaultNameOrId)
  })

  ipcMain.handle('vault:rename', async (_, oldNameOrId: string, newName: string) => {
    const before = vaultService
      .getAllVaults()
      .find((v) => v.id === oldNameOrId || v.name === oldNameOrId)
    const wasActive = Boolean(before && vaultService.getActiveVault()?.id === before.id)

    if (wasActive) {
      try {
        const { getAgentManagers, invalidateAgentManagers } = await import('./agent-helpers')
        await getAgentManagers().sessionManager.flushPendingDiskWrites()
        invalidateAgentManagers()
      } catch (e) {
        logger.warn('[Vault] flush/invalidate agent managers before rename failed:', e as Error)
      }
    }

    let result
    try {
      result = await vaultService.renameVault(oldNameOrId, newName)
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
      if (e instanceof VaultNotFoundError) {
        const err = new Error('VAULT_NOT_FOUND')
        ;(err as Error & { code: string }).code = 'VAULT_NOT_FOUND'
        throw err
      }
      if (e instanceof VaultRenameFilesystemError) {
        const err = new Error('VAULT_RENAME_FAILED')
        ;(err as Error & { code: string }).code = 'VAULT_RENAME_FAILED'
        throw err
      }
      throw e
    }

    resetSyncService()
    notifyVaultRegistryUpdated()

    if (wasActive) {
      try {
        const { resetAgentGateRuntimes } = await import('../services/agent-gate.service')
        resetAgentGateRuntimes(`vault-rename:${result.newName}`)
      } catch (e) {
        logger.warn('[Vault] reset agent gate runtimes after rename failed:', e as Error)
      }
      try {
        const { resetRawDataRuntime } = await import('../services/raw-data-source.runtime')
        resetRawDataRuntime()
      } catch (e) {
        logger.warn('[Vault] reset raw data runtime after rename failed:', e as Error)
      }
      try {
        const { emitVaultSwitchMutation } = await import('../cache/desktop-main-cache-coordinator')
        emitVaultSwitchMutation(result.id, 'vault-rename')
      } catch {
        // ignore
      }
      try {
        const { rebindSummaryCacheForActiveVault } = await import('./summary.ipc')
        await rebindSummaryCacheForActiveVault()
      } catch (e) {
        logger.warn('[Vault] rebind summary cache after rename failed:', e as Error)
      }
      try {
        const { resetSharedShadowSync } = await import('../services/shadow-sync.registry')
        resetSharedShadowSync()
      } catch {
        // ignore
      }
      try {
        const { globalBootstrapper } = await import('../services/bootstrapper.service')
        await globalBootstrapper.activateVaultRuntime()
      } catch (e) {
        logger.warn('[Vault] activate vault runtime after rename failed:', e as Error)
      }
      try {
        const { resetAttachmentAllowedRootsCache, refreshDesktopAttachmentPathRemapper } =
          await import('./attachment-path-cache')
        resetAttachmentAllowedRootsCache()
        const { DesktopStoragePathService } = await import('../services/path.service')
        await refreshDesktopAttachmentPathRemapper(new DesktopStoragePathService())
      } catch (e) {
        logger.warn('[Vault] refresh attachment remapper after rename failed:', e as Error)
      }
      resetGitService()
      try {
        const { scheduleVaultEcosystemResync } = await import('../services/vault-resync.service')
        scheduleVaultEcosystemResync(`vault-rename:${result.newName}`)
      } catch {
        // ignore
      }
    }

    return result
  })
}
