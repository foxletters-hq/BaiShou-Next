import type { IFileSystem } from '@baishou/core-mobile'
import {
  countJournalMarkdownInTree,
  countSummaryMarkdownInArchivesTreeByType,
  type SummaryArchivesMarkdownCounts
} from '@baishou/core-mobile'
import { normalizeExternalStoragePath } from './android-external-fs'
import { joinStoragePath } from './mobile-storage-path.util'
import { validateStorageDirectoryWritable } from './storage-migration.service'

export type MobileExternalPathService = {
  getActiveVaultNameForContext(): Promise<string>
  getVaultDirectory(vaultName: string): Promise<string>
  getExternalJournalsDirectory(vaultName?: string): Promise<string | null>
  setExternalJournalsDirectory(journalsDirectory: string | null, vaultName?: string): Promise<void>
  getExternalSummariesDirectory(vaultName?: string): Promise<string | null>
  setExternalSummariesDirectory(
    summariesDirectory: string | null,
    vaultName?: string
  ): Promise<void>
}

export type ExternalDirectoryValidation =
  | { valid: true; path: string }
  | { valid: false; code: 'NOT_DIRECTORY' | 'NOT_ACCESSIBLE' | 'NOT_WRITABLE' }

export type ExternalJournalsValidation =
  | ({ valid: true; path: string } & { journalFileCount: number })
  | { valid: false; code: 'NOT_DIRECTORY' | 'NOT_ACCESSIBLE' | 'NOT_WRITABLE' }

export type ExternalSummariesValidation =
  | ({ valid: true; path: string } & {
      summaryFileCount: number
      summaryFileCounts: SummaryArchivesMarkdownCounts
    })
  | { valid: false; code: 'NOT_DIRECTORY' | 'NOT_ACCESSIBLE' | 'NOT_WRITABLE' }

async function validateExternalDirectory(
  fileSystem: IFileSystem,
  targetPath: string
): Promise<ExternalDirectoryValidation> {
  const normalized = normalizeExternalStoragePath(targetPath.trim())
  if (!normalized) {
    return { valid: false, code: 'NOT_DIRECTORY' }
  }

  try {
    const stat = await fileSystem.stat(normalized)
    if (!stat.isDirectory) {
      return { valid: false, code: 'NOT_DIRECTORY' }
    }
  } catch {
    return { valid: false, code: 'NOT_ACCESSIBLE' }
  }

  const writable = await validateStorageDirectoryWritable(fileSystem, normalized)
  if (!writable) {
    return { valid: false, code: 'NOT_WRITABLE' }
  }

  return { valid: true, path: normalized }
}

export async function validateExternalJournalsDirectory(
  fileSystem: IFileSystem,
  targetPath: string
): Promise<ExternalJournalsValidation> {
  const base = await validateExternalDirectory(fileSystem, targetPath)
  if (!base.valid) return base
  const journalFileCount = await countJournalMarkdownInTree(fileSystem, base.path)
  return { valid: true, path: base.path, journalFileCount }
}

export async function validateExternalSummariesDirectory(
  fileSystem: IFileSystem,
  targetPath: string
): Promise<ExternalSummariesValidation> {
  const base = await validateExternalDirectory(fileSystem, targetPath)
  if (!base.valid) return base
  const summaryFileCounts = await countSummaryMarkdownInArchivesTreeByType(fileSystem, base.path)
  return {
    valid: true,
    path: base.path,
    summaryFileCount: summaryFileCounts.total,
    summaryFileCounts
  }
}

async function isExternalPathAvailableOnDevice(
  fileSystem: IFileSystem,
  externalPath: string | null
): Promise<boolean> {
  if (!externalPath?.trim()) return true
  const normalized = normalizeExternalStoragePath(externalPath)
  try {
    return await fileSystem.exists(normalized)
  } catch {
    return false
  }
}

export class ExternalPathResyncFailedError extends Error {
  readonly rolledBack: boolean

  constructor(message: string, rolledBack: boolean) {
    super(message)
    this.name = 'ExternalPathResyncFailedError'
    this.rolledBack = rolledBack
  }
}

async function restoreExternalPathConfig(
  pathService: MobileExternalPathService,
  target: 'journals' | 'summaries',
  vaultName: string,
  previousPath: string | null
): Promise<boolean> {
  try {
    if (target === 'journals') {
      await pathService.setExternalJournalsDirectory(previousPath, vaultName)
    } else {
      await pathService.setExternalSummariesDirectory(previousPath, vaultName)
    }
    return true
  } catch {
    return false
  }
}

export async function applyExternalJournalsDirectoryWithResync(
  pathService: MobileExternalPathService,
  fileSystem: IFileSystem,
  targetPath: string | null,
  resync: () => Promise<void>
): Promise<number> {
  const name = await pathService.getActiveVaultNameForContext()
  const previousPath = await pathService.getExternalJournalsDirectory(name)
  const count = await applyExternalJournalsDirectory(pathService, fileSystem, targetPath)
  try {
    await resync()
  } catch (error) {
    const rolledBack = await restoreExternalPathConfig(pathService, 'journals', name, previousPath)
    const message = error instanceof Error ? error.message : String(error)
    throw new ExternalPathResyncFailedError(message, rolledBack)
  }
  return count
}

export async function applyExternalSummariesDirectoryWithResync(
  pathService: MobileExternalPathService,
  fileSystem: IFileSystem,
  targetPath: string | null,
  resync: () => Promise<void>
): Promise<number> {
  const name = await pathService.getActiveVaultNameForContext()
  const previousPath = await pathService.getExternalSummariesDirectory(name)
  const count = await applyExternalSummariesDirectory(pathService, fileSystem, targetPath)
  try {
    await resync()
  } catch (error) {
    const rolledBack = await restoreExternalPathConfig(pathService, 'summaries', name, previousPath)
    const message = error instanceof Error ? error.message : String(error)
    throw new ExternalPathResyncFailedError(message, rolledBack)
  }
  return count
}

export async function getExternalJournalsDirectoryInfo(
  pathService: MobileExternalPathService,
  fileSystem: IFileSystem
): Promise<{
  path: string | null
  defaultPath: string
  journalFileCount: number
  pathAvailableOnDevice: boolean
}> {
  const name = await pathService.getActiveVaultNameForContext()
  const vaultDir = await pathService.getVaultDirectory(name)
  const defaultPath = joinStoragePath(vaultDir, 'Journals')
  const external = await pathService.getExternalJournalsDirectory(name)
  const scanDir = external ?? defaultPath
  const journalFileCount = scanDir
    ? await countJournalMarkdownInTree(fileSystem, scanDir).catch(() => 0)
    : 0
  const pathAvailableOnDevice = await isExternalPathAvailableOnDevice(fileSystem, external)
  return { path: external, defaultPath, journalFileCount, pathAvailableOnDevice }
}

export async function getExternalSummariesDirectoryInfo(
  pathService: MobileExternalPathService,
  fileSystem: IFileSystem
): Promise<{
  path: string | null
  defaultPath: string
  summaryFileCount: number
  summaryFileCounts: SummaryArchivesMarkdownCounts
  pathAvailableOnDevice: boolean
}> {
  const name = await pathService.getActiveVaultNameForContext()
  const vaultDir = await pathService.getVaultDirectory(name)
  const defaultPath = joinStoragePath(vaultDir, 'Archives')
  const external = await pathService.getExternalSummariesDirectory(name)
  const scanDir = external ?? defaultPath
  const summaryFileCounts = scanDir
    ? await countSummaryMarkdownInArchivesTreeByType(fileSystem, scanDir).catch(() => ({
        total: 0,
        weekly: 0,
        monthly: 0,
        quarterly: 0,
        yearly: 0
      }))
    : { total: 0, weekly: 0, monthly: 0, quarterly: 0, yearly: 0 }
  const pathAvailableOnDevice = await isExternalPathAvailableOnDevice(fileSystem, external)
  return {
    path: external,
    defaultPath,
    summaryFileCount: summaryFileCounts.total,
    summaryFileCounts,
    pathAvailableOnDevice
  }
}

export async function applyExternalJournalsDirectory(
  pathService: MobileExternalPathService,
  fileSystem: IFileSystem,
  targetPath: string | null
): Promise<number> {
  const name = await pathService.getActiveVaultNameForContext()
  if (targetPath?.trim()) {
    const validation = await validateExternalJournalsDirectory(fileSystem, targetPath)
    if (!validation.valid) {
      throw new Error(validation.code)
    }
    await pathService.setExternalJournalsDirectory(validation.path, name)
    return validation.journalFileCount
  }
  await pathService.setExternalJournalsDirectory(null, name)
  return 0
}

export async function applyExternalSummariesDirectory(
  pathService: MobileExternalPathService,
  fileSystem: IFileSystem,
  targetPath: string | null
): Promise<number> {
  const name = await pathService.getActiveVaultNameForContext()
  if (targetPath?.trim()) {
    const validation = await validateExternalSummariesDirectory(fileSystem, targetPath)
    if (!validation.valid) {
      throw new Error(validation.code)
    }
    await pathService.setExternalSummariesDirectory(validation.path, name)
    return validation.summaryFileCount
  }
  await pathService.setExternalSummariesDirectory(null, name)
  return 0
}
