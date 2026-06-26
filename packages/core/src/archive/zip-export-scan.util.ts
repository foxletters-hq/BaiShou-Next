import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as path from 'path'
import {
  FULL_BACKUP_EXCLUDED_ROOT_NAMES,
  comparableStoragePath,
  isPathInsideStorageRoot
} from '@baishou/shared'
import { isStorageWriteProbePath } from '../sync/git-sync.helpers'

/** 任意深度都应跳过的目录（Git 仓库、应用元数据等） */
export const ARCHIVE_RECURSIVE_SKIP_DIR_NAMES = new Set([
  'snapshots',
  'temp',
  '.snapshots',
  '.git',
  '.git.vault-legacy',
  '.baishou',
  'node_modules',
  '.baishou_migrate_staging',
  ...FULL_BACKUP_EXCLUDED_ROOT_NAMES
])

const SQLITE_SIDEcar_SUFFIXES = ['-wal', '-shm', '-journal'] as const

const IN_PROGRESS_BACKUP_ZIP_RE = /^BaiShou_(Vault_Backup|Full_Archive)_.+\.zip$/i

export function isArchiveRootSkipEntry(name: string): boolean {
  return (
    name === 'snapshots' ||
    name === 'temp' ||
    name === '.snapshots' ||
    FULL_BACKUP_EXCLUDED_ROOT_NAMES.has(name)
  )
}

export function isArchiveRecursiveSkipDir(dirName: string): boolean {
  return ARCHIVE_RECURSIVE_SKIP_DIR_NAMES.has(dirName)
}

export function isArchiveSkipSqliteSidecar(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return SQLITE_SIDEcar_SUFFIXES.some((suffix) => lower.endsWith(suffix))
}

export function isInProgressBaishouBackupZip(fileName: string): boolean {
  return IN_PROGRESS_BACKUP_ZIP_RE.test(fileName)
}

export function isArchiveSkipFileName(fileName: string): boolean {
  if (isStorageWriteProbePath(fileName)) return true
  if (isArchiveSkipSqliteSidecar(fileName)) return true
  return false
}

export interface ArchiveExportScanContext {
  rootRealPath: string
  /** 正在写入的导出 ZIP（可比路径） */
  excludedOutputComparablePath: string | null
  /** 导出进行中：跳过存储目录内所有白守备份 ZIP 文件名 */
  skipInProgressBackupZips: boolean
}

export function shouldSkipArchiveFile(fileName: string, ctx: ArchiveExportScanContext): boolean {
  if (isArchiveSkipFileName(fileName)) return true
  if (ctx.skipInProgressBackupZips && isInProgressBaishouBackupZip(fileName)) return true
  return false
}

export function isExcludedArchiveOutputPath(
  absolutePath: string,
  ctx: ArchiveExportScanContext
): boolean {
  if (!ctx.excludedOutputComparablePath) return false
  return comparableStoragePath(absolutePath) === ctx.excludedOutputComparablePath
}

export function assertArchiveExportOutputPathSafe(
  outputPath: string,
  storageRoot: string
): void {
  if (isPathInsideStorageRoot(outputPath, storageRoot)) {
    throw new Error('ARCHIVE_EXPORT_OUTPUT_INSIDE_STORAGE')
  }
}

export async function isWithinArchiveExportRoot(
  rootRealPath: string,
  absolutePath: string
): Promise<boolean> {
  let realTarget: string
  try {
    realTarget = await fsp.realpath(absolutePath)
  } catch {
    return false
  }
  const rel = path.relative(rootRealPath, realTarget)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

export async function shouldIncludeArchivePath(
  absolutePath: string,
  ctx: ArchiveExportScanContext
): Promise<boolean> {
  if (isExcludedArchiveOutputPath(absolutePath, ctx)) return false
  try {
    const lst = await fsp.lstat(absolutePath)
    if (lst.isSymbolicLink()) return false
  } catch {
    return false
  }
  return isWithinArchiveExportRoot(ctx.rootRealPath, absolutePath)
}

export interface ArchiveExportEstimate {
  rootDir: string
  rootRealPath: string
  fileCount: number
  totalBytes: number
}

export async function createArchiveExportScanContext(
  rootDir: string,
  excludedOutputPath?: string | null
): Promise<ArchiveExportScanContext> {
  const rootRealPath = await fsp.realpath(rootDir)
  return {
    rootRealPath,
    excludedOutputComparablePath: excludedOutputPath
      ? comparableStoragePath(excludedOutputPath)
      : null,
    skipInProgressBackupZips: Boolean(excludedOutputPath)
  }
}

export async function estimateArchiveExportSize(
  rootDir: string,
  excludedOutputPath?: string | null
): Promise<ArchiveExportEstimate> {
  const ctx = await createArchiveExportScanContext(rootDir, excludedOutputPath)
  let fileCount = 0
  let totalBytes = 0

  const walkDirectory = async (dirPath: string): Promise<void> => {
    if (!(await shouldIncludeArchivePath(dirPath, ctx))) return

    let entries: fs.Dirent[]
    try {
      entries = await fsp.readdir(dirPath, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        if (isArchiveRecursiveSkipDir(entry.name)) continue
        await walkDirectory(fullPath)
        continue
      }
      if (!entry.isFile()) continue
      if (shouldSkipArchiveFile(entry.name, ctx)) continue
      if (!(await shouldIncludeArchivePath(fullPath, ctx))) continue
      try {
        const stat = await fsp.lstat(fullPath)
        if (stat.isSymbolicLink()) continue
        totalBytes += stat.size
        fileCount += 1
      } catch {
        // skip unreadable files
      }
    }
  }

  if (fs.existsSync(rootDir)) {
    const topEntries = await fsp.readdir(rootDir, { withFileTypes: true })
    for (const entry of topEntries) {
      if (isArchiveRootSkipEntry(entry.name)) continue
      const fullPath = path.join(rootDir, entry.name)
      if (entry.isDirectory()) {
        if (isArchiveRecursiveSkipDir(entry.name)) continue
        await walkDirectory(fullPath)
      } else if (entry.isFile()) {
        if (shouldSkipArchiveFile(entry.name, ctx)) continue
        if (!(await shouldIncludeArchivePath(fullPath, ctx))) continue
        try {
          const stat = await fsp.lstat(fullPath)
          if (stat.isSymbolicLink()) continue
          totalBytes += stat.size
          fileCount += 1
        } catch {
          // skip
        }
      }
    }
  }

  return {
    rootDir,
    rootRealPath: ctx.rootRealPath,
    fileCount,
    totalBytes
  }
}
