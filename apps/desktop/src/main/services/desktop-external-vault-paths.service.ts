import * as fs from 'fs/promises'
import * as path from 'path'
import {
  countJournalMarkdownInTree,
  countSummaryMarkdownInArchivesTree
} from '@baishou/core/shared'
import { fileSystem } from './node-file-system'
import { pathService, vaultService } from '../ipc/vault.ipc'
import { diaryWatcher } from './diary-watcher.service'
import { summaryWatcher } from './summary-watcher.service'
import { globalBootstrapper } from './bootstrapper.service'

const vaultFileSystem = fileSystem

export type ExternalDirectoryValidation =
  | { valid: true; path: string }
  | { valid: false; code: 'NOT_DIRECTORY' | 'NOT_ACCESSIBLE' | 'NOT_WRITABLE' }

async function validateExternalDirectory(targetPath: string): Promise<ExternalDirectoryValidation> {
  const normalized = targetPath.trim()
  if (!normalized) {
    return { valid: false, code: 'NOT_DIRECTORY' }
  }

  try {
    const stat = await fs.stat(normalized)
    if (!stat.isDirectory()) {
      return { valid: false, code: 'NOT_DIRECTORY' }
    }
  } catch {
    return { valid: false, code: 'NOT_ACCESSIBLE' }
  }

  const testFile = `${normalized}/.baishou_write_test`
  try {
    await fs.writeFile(testFile, 'ok', 'utf8')
    await fs.unlink(testFile).catch(() => null)
  } catch {
    return { valid: false, code: 'NOT_WRITABLE' }
  }

  return { valid: true, path: normalized }
}

export type ExternalJournalsValidation =
  | ({ valid: true; path: string } & { journalFileCount: number })
  | { valid: false; code: 'NOT_DIRECTORY' | 'NOT_ACCESSIBLE' | 'NOT_WRITABLE' }

export type ExternalSummariesValidation =
  | ({ valid: true; path: string } & { summaryFileCount: number })
  | { valid: false; code: 'NOT_DIRECTORY' | 'NOT_ACCESSIBLE' | 'NOT_WRITABLE' }

export async function validateExternalJournalsDirectory(
  targetPath: string
): Promise<ExternalJournalsValidation> {
  const base = await validateExternalDirectory(targetPath)
  if (!base.valid) return base
  const journalFileCount = await countJournalMarkdownInTree(vaultFileSystem, base.path)
  return { valid: true, path: base.path, journalFileCount }
}

export async function validateExternalSummariesDirectory(
  targetPath: string
): Promise<ExternalSummariesValidation> {
  const base = await validateExternalDirectory(targetPath)
  if (!base.valid) return base
  const summaryFileCount = await countSummaryMarkdownInArchivesTree(vaultFileSystem, base.path)
  return { valid: true, path: base.path, summaryFileCount }
}

async function refreshVaultFileWatchersAndResync(reason: string): Promise<void> {
  diaryWatcher.stop()
  summaryWatcher.stop()
  const { resetAttachmentAllowedRootsCache } = await import('../ipc/attachment-path-cache')
  resetAttachmentAllowedRootsCache()
  const { resetSharedShadowSync } = await import('./shadow-sync.registry')
  resetSharedShadowSync()

  await globalBootstrapper.activateVaultRuntime()
  const { scheduleVaultEcosystemResync } = await import('./vault-resync.service')
  scheduleVaultEcosystemResync(reason)
}

export async function applyExternalJournalsDirectory(targetPath: string | null): Promise<void> {
  const active = vaultService.getActiveVault()
  if (!active) {
    throw new Error('无活动工作区，无法设置外部日记目录')
  }

  if (targetPath?.trim()) {
    const validation = await validateExternalJournalsDirectory(targetPath)
    if (!validation.valid) {
      throw new Error(validation.code)
    }
    await pathService.setExternalJournalsDirectory(validation.path, active.name)
  } else {
    await pathService.setExternalJournalsDirectory(null, active.name)
  }

  await refreshVaultFileWatchersAndResync(
    targetPath ? 'external-journals-path-set' : 'external-journals-path-cleared'
  )
}

export async function applyExternalSummariesDirectory(targetPath: string | null): Promise<void> {
  const active = vaultService.getActiveVault()
  if (!active) {
    throw new Error('无活动工作区，无法设置外部总结目录')
  }

  if (targetPath?.trim()) {
    const validation = await validateExternalSummariesDirectory(targetPath)
    if (!validation.valid) {
      throw new Error(validation.code)
    }
    await pathService.setExternalSummariesDirectory(validation.path, active.name)
  } else {
    await pathService.setExternalSummariesDirectory(null, active.name)
  }

  await refreshVaultFileWatchersAndResync(
    targetPath ? 'external-summaries-path-set' : 'external-summaries-path-cleared'
  )
}

export async function getExternalJournalsDirectoryInfo(): Promise<{
  path: string | null
  defaultPath: string
  journalFileCount: number
}> {
  const active = vaultService.getActiveVault()
  const vaultDir = active
    ? await pathService.getVaultDirectory(active.name)
    : await pathService.getActiveVaultPath()
  const defaultPath = vaultDir ? path.join(vaultDir, 'Journals') : ''
  const external = await pathService.getExternalJournalsDirectory(active?.name)
  const scanDir = external ?? defaultPath
  const journalFileCount = scanDir
    ? await countJournalMarkdownInTree(vaultFileSystem, scanDir).catch(() => 0)
    : 0
  return {
    path: external,
    defaultPath,
    journalFileCount
  }
}

export async function getExternalSummariesDirectoryInfo(): Promise<{
  path: string | null
  defaultPath: string
  summaryFileCount: number
}> {
  const active = vaultService.getActiveVault()
  const vaultDir = active
    ? await pathService.getVaultDirectory(active.name)
    : await pathService.getActiveVaultPath()
  const defaultPath = vaultDir ? path.join(vaultDir, 'Archives') : ''
  const external = await pathService.getExternalSummariesDirectory(active?.name)
  const scanDir = external ?? defaultPath
  const summaryFileCount = scanDir
    ? await countSummaryMarkdownInArchivesTree(vaultFileSystem, scanDir).catch(() => 0)
    : 0
  return {
    path: external,
    defaultPath,
    summaryFileCount
  }
}
