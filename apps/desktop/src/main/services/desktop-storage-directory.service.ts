import { BrowserWindow, dialog } from 'electron'
import {
  copyStorageRootContents,
  targetDirectoryHasData,
  validateStorageDirectoryWritable
} from '@baishou/core'
import { isPathInsideStorageRoot, isSameStorageRoot, logger } from '@baishou/shared'
import { shadowConnectionManager } from '@baishou/database-desktop'
import { pathService, vaultService, connectShadowForActiveVault } from '../ipc/vault.ipc'
import { fileSystem } from './node-file-system'
import { settingsManager } from '../ipc/settings.ipc'
import { diaryWatcher } from './diary-watcher.service'
import { summaryWatcher } from './summary-watcher.service'
import { sessionWatcher } from './session-watcher.service'
import { resetSyncService } from '../ipc/incremental-sync.ipc'
import { resetGitService } from '../ipc/git-sync.ipc'
import { getMcpService, bootstrapMcpServer } from './mcp-runtime'

export type StorageTargetValidationCode =
  | 'SAME_PATH'
  | 'INSIDE_SOURCE'
  | 'NOT_WRITABLE'
  | 'SOURCE_NOT_FOUND'

export type StorageTargetValidation =
  | { valid: true; sourceRoot: string; hasData: boolean }
  | { valid: false; code: StorageTargetValidationCode }

let quiesceDepth = 0
let mcpWasRunningBeforeQuiesce = false

export async function pickStorageDirectory(window: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(window, {
    title: 'Select Data Root Directory',
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]!
}

export async function validateStorageTarget(targetPath: string): Promise<StorageTargetValidation> {
  let sourceRoot: string
  try {
    sourceRoot = await pathService.getRootDirectory()
  } catch {
    return { valid: false, code: 'SOURCE_NOT_FOUND' }
  }

  if (isSameStorageRoot(sourceRoot, targetPath)) {
    return { valid: false, code: 'SAME_PATH' }
  }
  if (isPathInsideStorageRoot(targetPath, sourceRoot)) {
    return { valid: false, code: 'INSIDE_SOURCE' }
  }

  const writable = await validateStorageDirectoryWritable(fileSystem, targetPath)
  if (!writable) {
    return { valid: false, code: 'NOT_WRITABLE' }
  }

  const hasData = await targetDirectoryHasData(fileSystem, targetPath)
  return { valid: true, sourceRoot, hasData }
}

export async function quiesceStorageForFileCopy(): Promise<void> {
  quiesceDepth += 1
  if (quiesceDepth > 1) return

  diaryWatcher.stop()
  summaryWatcher.stop()
  sessionWatcher.stop()

  try {
    await settingsManager.flushToDisk()
  } catch (e) {
    logger.warn('[StorageDirectory] flushToDisk failed before quiesce:', e as Error)
  }

  mcpWasRunningBeforeQuiesce = Boolean(getMcpService()?.running)
  if (mcpWasRunningBeforeQuiesce) {
    try {
      await getMcpService()?.stop()
    } catch (e) {
      logger.warn('[StorageDirectory] MCP stop failed:', e as Error)
    }
  }

  try {
    await shadowConnectionManager.disconnect()
  } catch (e) {
    logger.warn('[StorageDirectory] shadow disconnect failed:', e as Error)
  }

  await new Promise((resolve) => setTimeout(resolve, 200))
}

export async function resumeStorageAfterFileCopy(): Promise<void> {
  if (quiesceDepth === 0) return
  quiesceDepth -= 1
  if (quiesceDepth > 0) return

  await vaultService.initRegistry()
  await connectShadowForActiveVault()

  const { globalBootstrapper } = await import('./bootstrapper.service')
  await globalBootstrapper.activateVaultRuntime()

  const { resetAttachmentAllowedRootsCache } = await import('../ipc/attachment-path-cache')
  resetAttachmentAllowedRootsCache()
  resetSyncService()
  resetGitService()

  const { scheduleVaultEcosystemResync } = await import('./vault-resync.service')
  scheduleVaultEcosystemResync('storage-root-changed')

  if (mcpWasRunningBeforeQuiesce) {
    try {
      await bootstrapMcpServer()
    } catch (e) {
      logger.warn('[StorageDirectory] MCP restart failed:', e as Error)
    }
  }
  mcpWasRunningBeforeQuiesce = false

  BrowserWindow.getAllWindows().forEach((w) => {
    w.webContents.send('storage:root-changed')
    w.webContents.send('diary:sync-event', { type: 'vault-resync-complete' })
  })
}

export async function runWithStorageQuiesced<T>(fn: () => Promise<T>): Promise<T> {
  await quiesceStorageForFileCopy()
  try {
    return await fn()
  } finally {
    await resumeStorageAfterFileCopy()
  }
}

export async function changeStorageRootDirectory(targetPath: string): Promise<void> {
  const validation = await validateStorageTarget(targetPath)
  if (!validation.valid) {
    throw new Error(validation.code)
  }

  await runWithStorageQuiesced(async () => {
    await pathService.updateRootDirectory(targetPath)
  })
}

export async function migrateStorageRootDirectory(
  targetPath: string,
  onProgress?: (itemName: string) => void
): Promise<void> {
  const validation = await validateStorageTarget(targetPath)
  if (!validation.valid) {
    throw new Error(validation.code)
  }

  await runWithStorageQuiesced(async () => {
    await copyStorageRootContents(fileSystem, validation.sourceRoot, targetPath, onProgress)
  })
}
