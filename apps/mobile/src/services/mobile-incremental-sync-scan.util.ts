import type { IFileSystem } from '@baishou/core-mobile'
import { limitExecute } from '@baishou/shared'
import {
  shouldIncludeIncrementalSyncFile,
  shouldScanIncrementalSyncDirectory
} from '@baishou/shared'
import { Platform } from 'react-native'
import { logger } from '@baishou/shared'
import { isExternalStoragePath } from './android-external-fs'
import { externalScanIncrementalSyncFiles } from 'expo-baishou-server'

/** 目录扫描并发度（同级多目录并行展开） */
const SCAN_DIR_CONCURRENCY = 8
/** 单目录内 stat 并发度 */
const SCAN_STAT_CONCURRENCY = 32

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

async function scanIncrementalSyncFilesJs(
  fileSystem: IFileSystem,
  syncRoot: string,
  onProgress?: (discovered: number, fileName: string) => void
): Promise<ScannedSyncFile[]> {
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
            if (shouldScanIncrementalSyncDirectory(entry.name, entry.relPath)) {
              queue.push({ dir: entry.full, rel: entry.relPath })
            }
            continue
          }
          if (!entry.info.isFile || !shouldIncludeIncrementalSyncFile(entry.name, entry.relPath)) {
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

  if (files.length > 0) {
    onProgress?.(files.length, files[files.length - 1]!.relPath)
  }
  return files
}

/** 外部存储优先原生递归扫描，失败时回退 JS readdir+stat */
export async function scanIncrementalSyncFilesForManifest(
  fileSystem: IFileSystem,
  syncRoot: string,
  onProgress?: (discovered: number, fileName: string) => void
): Promise<ScannedSyncFile[]> {
  if (Platform.OS === 'android' && isExternalStoragePath(syncRoot)) {
    try {
      const entries = externalScanIncrementalSyncFiles(syncRoot)
      if (entries.length === 0) {
        logger.warn('[IncrementalSyncScan] native scan returned 0 files, falling back to JS scan')
        return scanIncrementalSyncFilesJs(fileSystem, syncRoot, onProgress)
      }
      const files = entries.map((entry) => ({
        relPath: entry.relPath,
        fullPath: joinPath(syncRoot, entry.relPath),
        size: entry.size,
        mtimeMs: entry.mtimeMs
      }))
      if (files.length > 0) {
        onProgress?.(files.length, files[files.length - 1]!.relPath)
      }
      return files
    } catch (error) {
      logger.warn(
        '[IncrementalSyncScan] native scan failed, falling back to JS scan',
        error instanceof Error ? error : String(error)
      )
    }
  }
  return scanIncrementalSyncFilesJs(fileSystem, syncRoot, onProgress)
}
