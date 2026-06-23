import type { IFileSystem } from '@baishou/core-mobile'
import { limitExecute } from '@baishou/shared'
import {
  shouldIncludeIncrementalSyncFileWithExternalConfig,
  shouldScanIncrementalSyncDirectoryWithExternalMounts,
  shouldExcludeIncrementalSyncRootScanEntry
} from '@baishou/shared'
import { loadVaultExternalSyncMounts, scanVaultExternalSyncMountFiles } from '@baishou/core-mobile'
import { Platform } from 'react-native'
import { logger } from '@baishou/shared'
import {
  externalScanIncrementalSyncFiles,
  isLocalFsNativeAvailable,
  localScanIncrementalSyncFiles,
  type ExternalIncrementalSyncScanEntry
} from 'expo-baishou-server'
import { isAndroidAppSandboxPath, isExternalStoragePath, normalizeExternalStoragePath } from './android-external-fs'

/** 目录扫描并发度（同级多目录并行展开） */
const SCAN_DIR_CONCURRENCY = 12
/** 单目录内 stat 并发度 */
const SCAN_STAT_CONCURRENCY = 48

export type ScannedSyncFile = {
  relPath: string
  fullPath: string
  size: number
  mtimeMs: number
}

function joinPath(...parts: string[]): string {
  return parts
    .map((p, i) => {
      if (i === 0) return p.replace(/\/$/, '')
      return p.replace(/^\//, '').replace(/\/$/, '')
    })
    .filter(Boolean)
    .join('/')
}

function mapNativeScanEntries(
  syncRoot: string,
  entries: ExternalIncrementalSyncScanEntry[]
): ScannedSyncFile[] {
  const normalizedRoot = normalizeExternalStoragePath(syncRoot)
  return entries.map((entry) => ({
    relPath: entry.relPath,
    fullPath: normalizeExternalStoragePath(joinPath(normalizedRoot, entry.relPath)),
    size: entry.size,
    mtimeMs: entry.mtimeMs
  }))
}

function shouldExcludeMobileScannedSyncFile(
  file: ScannedSyncFile,
  syncRoot: string,
  mounts: Awaited<ReturnType<typeof loadVaultExternalSyncMounts>>
): boolean {
  const normalizedRoot = normalizeExternalStoragePath(syncRoot)
  const candidatePaths = [
    file.fullPath,
    normalizeExternalStoragePath(joinPath(normalizedRoot, file.relPath))
  ]
  for (const candidate of candidatePaths) {
    if (shouldExcludeIncrementalSyncRootScanEntry(candidate, file.relPath, mounts)) {
      return true
    }
  }
  return false
}

function tryNativeIncrementalSyncScan(syncRoot: string): ScannedSyncFile[] | null {
  if (Platform.OS !== 'android') return null

  if (isExternalStoragePath(syncRoot)) {
    try {
      const entries = externalScanIncrementalSyncFiles(syncRoot)
      if (entries.length === 0) return null
      return mapNativeScanEntries(syncRoot, entries)
    } catch (error) {
      logger.warn(
        '[IncrementalSyncScan] external native scan failed, falling back to JS scan',
        error instanceof Error ? error : String(error)
      )
      return null
    }
  }

  if (isLocalFsNativeAvailable() && isAndroidAppSandboxPath(syncRoot)) {
    try {
      const entries = localScanIncrementalSyncFiles(syncRoot)
      if (entries.length === 0) return null
      return mapNativeScanEntries(syncRoot, entries)
    } catch (error) {
      logger.warn(
        '[IncrementalSyncScan] local native scan failed, falling back to JS scan',
        error instanceof Error ? error : String(error)
      )
      return null
    }
  }

  return null
}

async function scanIncrementalSyncFilesJs(
  fileSystem: IFileSystem,
  syncRoot: string,
  onProgress?: (discovered: number, fileName: string) => void
): Promise<ScannedSyncFile[]> {
  const mounts = await loadVaultExternalSyncMounts(fileSystem, syncRoot)
  const files: ScannedSyncFile[] = []
  const queue: Array<{ dir: string; rel: string }> = [{ dir: syncRoot, rel: '' }]

  while (queue.length > 0) {
    const batch = queue.splice(0, SCAN_DIR_CONCURRENCY)
    await Promise.all(
      batch.map(async ({ dir, rel }) => {
        let names: string[]
        try {
          names = await fileSystem.readdir(dir)
        } catch {
          return
        }

        const entries = await limitExecute(names, SCAN_STAT_CONCURRENCY, async (name) => {
          const full = joinPath(dir, name)
          const relPath = rel ? joinPath(rel, name) : name
          const info = await fileSystem.stat(full).catch(() => null)
          return { name, full, relPath, info }
        })

        for (const entry of entries) {
          if (!entry?.info) continue
          if (entry.info.isDirectory) {
            if (
              shouldScanIncrementalSyncDirectoryWithExternalMounts(entry.name, entry.relPath, mounts) &&
              !shouldExcludeIncrementalSyncRootScanEntry(
                normalizeExternalStoragePath(entry.full),
                entry.relPath,
                mounts
              )
            ) {
              queue.push({ dir: entry.full, rel: entry.relPath })
            }
            continue
          }
          if (
            !entry.info.isFile ||
            !shouldIncludeIncrementalSyncFileWithExternalConfig(entry.name, entry.relPath) ||
            shouldExcludeIncrementalSyncRootScanEntry(
              normalizeExternalStoragePath(entry.full),
              entry.relPath,
              mounts
            )
          ) {
            continue
          }
          files.push({
            relPath: entry.relPath,
            fullPath: entry.full,
            size: entry.info.size ?? 0,
            mtimeMs: entry.info.mtimeMs ?? Date.now()
          })
          if (files.length % 10 === 0) {
            onProgress?.(files.length, entry.relPath)
          }
        }
      })
    )
  }

  const byRel = new Map(files.map((file) => [file.relPath, file]))
  for (const mount of mounts) {
    const externalFiles = await scanVaultExternalSyncMountFiles(fileSystem, mount)
    for (const file of externalFiles) {
      const stat = await fileSystem.stat(file.fullPath).catch(() => null)
      byRel.set(file.relPath, {
        relPath: file.relPath,
        fullPath: file.fullPath,
        size: stat?.size ?? 0,
        mtimeMs: stat?.mtimeMs ?? Date.now()
      })
    }
  }

  const merged = Array.from(byRel.values())
  if (merged.length > 0) {
    onProgress?.(merged.length, merged[merged.length - 1]!.relPath)
  }
  return merged
}

/** 外部存储 / 沙盒优先原生递归扫描，失败时回退 JS readdir+stat */
export async function scanIncrementalSyncFilesForManifest(
  fileSystem: IFileSystem,
  syncRoot: string,
  onProgress?: (discovered: number, fileName: string) => void
): Promise<ScannedSyncFile[]> {
  const nativeFiles = tryNativeIncrementalSyncScan(syncRoot)
  if (nativeFiles) {
    if (nativeFiles.length === 0) {
      logger.warn('[IncrementalSyncScan] native scan returned 0 files, falling back to JS scan')
      return scanIncrementalSyncFilesJs(fileSystem, syncRoot, onProgress)
    }
    const mounts = await loadVaultExternalSyncMounts(fileSystem, syncRoot)
    const dedupedNative = nativeFiles.filter(
      (file) => !shouldExcludeMobileScannedSyncFile(file, syncRoot, mounts)
    )
    const byRel = new Map(dedupedNative.map((file) => [file.relPath, file]))
    for (const mount of mounts) {
      const externalFiles = await scanVaultExternalSyncMountFiles(fileSystem, mount)
      for (const file of externalFiles) {
        const stat = await fileSystem.stat(file.fullPath).catch(() => null)
        byRel.set(file.relPath, {
          relPath: file.relPath,
          fullPath: file.fullPath,
          size: stat?.size ?? 0,
          mtimeMs: stat?.mtimeMs ?? Date.now()
        })
      }
    }
    const merged = Array.from(byRel.values())
    if (merged.length > 0) {
      onProgress?.(merged.length, merged[merged.length - 1]!.relPath)
    }
    return merged
  }

  return scanIncrementalSyncFilesJs(fileSystem, syncRoot, onProgress)
}
