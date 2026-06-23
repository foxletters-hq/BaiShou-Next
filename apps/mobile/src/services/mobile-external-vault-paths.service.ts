import type { IFileSystem } from '@baishou/core-mobile'
import {
  countJournalMarkdownInTree,
  countSummaryMarkdownInArchivesTree
} from '@baishou/core-mobile'
import { joinStoragePath } from './mobile-storage-path.util'
import { validateStorageDirectoryWritable } from './storage-migration.service'

export type MobileExternalPathService = {
  getActiveVaultNameForContext(): Promise<string>
  getVaultDirectory(vaultName: string): Promise<string>
  getExternalJournalsDirectory(vaultName?: string): Promise<string | null>
  setExternalJournalsDirectory(journalsDirectory: string | null, vaultName?: string): Promise<void>
  getExternalSummariesDirectory(vaultName?: string): Promise<string | null>
  setExternalSummariesDirectory(summariesDirectory: string | null, vaultName?: string): Promise<void>
}

export type ExternalDirectoryValidation =
  | { valid: true; path: string }
  | { valid: false; code: 'NOT_DIRECTORY' | 'NOT_ACCESSIBLE' | 'NOT_WRITABLE' }

export type ExternalJournalsValidation =
  | ({ valid: true; path: string } & { journalFileCount: number })
  | { valid: false; code: 'NOT_DIRECTORY' | 'NOT_ACCESSIBLE' | 'NOT_WRITABLE' }

export type ExternalSummariesValidation =
  | ({ valid: true; path: string } & { summaryFileCount: number })
  | { valid: false; code: 'NOT_DIRECTORY' | 'NOT_ACCESSIBLE' | 'NOT_WRITABLE' }

async function validateExternalDirectory(
  fileSystem: IFileSystem,
  targetPath: string
): Promise<ExternalDirectoryValidation> {
  const normalized = targetPath.trim()
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
  const summaryFileCount = await countSummaryMarkdownInArchivesTree(fileSystem, base.path)
  return { valid: true, path: base.path, summaryFileCount }
}

export async function getExternalJournalsDirectoryInfo(
  pathService: MobileExternalPathService,
  fileSystem: IFileSystem
): Promise<{
  path: string | null
  defaultPath: string
  journalFileCount: number
}> {
  const name = await pathService.getActiveVaultNameForContext()
  const vaultDir = await pathService.getVaultDirectory(name)
  const defaultPath = joinStoragePath(vaultDir, 'Journals')
  const external = await pathService.getExternalJournalsDirectory(name)
  const scanDir = external ?? defaultPath
  const journalFileCount = scanDir
    ? await countJournalMarkdownInTree(fileSystem, scanDir).catch(() => 0)
    : 0
  return { path: external, defaultPath, journalFileCount }
}

export async function getExternalSummariesDirectoryInfo(
  pathService: MobileExternalPathService,
  fileSystem: IFileSystem
): Promise<{
  path: string | null
  defaultPath: string
  summaryFileCount: number
}> {
  const name = await pathService.getActiveVaultNameForContext()
  const vaultDir = await pathService.getVaultDirectory(name)
  const defaultPath = joinStoragePath(vaultDir, 'Archives')
  const external = await pathService.getExternalSummariesDirectory(name)
  const scanDir = external ?? defaultPath
  const summaryFileCount = scanDir
    ? await countSummaryMarkdownInArchivesTree(fileSystem, scanDir).catch(() => 0)
    : 0
  return { path: external, defaultPath, summaryFileCount }
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
