import type { IFileSystem } from '@baishou/core-mobile'
import type { SyncManifest } from '@baishou/shared'
import {
  hasLocalSyncTreeDrift,
  summarizeScannedSyncFiles,
  summarizeSyncManifestFiles
} from '@baishou/shared'
import { scanIncrementalSyncFilesForManifest } from './mobile-incremental-sync-scan.util'

/** 对比规划时本地 manifest 摘要与当前扫描结果，检测弹窗期间是否发生本地变更 */
export async function detectLocalSyncTreeDrift(
  fileSystem: IFileSystem,
  syncRoot: string,
  baselineManifest: SyncManifest
): Promise<boolean> {
  const baseline = summarizeSyncManifestFiles(baselineManifest)
  const scanned = await scanIncrementalSyncFilesForManifest(fileSystem, syncRoot)
  const current = summarizeScannedSyncFiles(
    scanned.map((file) => ({
      relPath: file.relPath,
      size: file.size,
      mtimeMs: file.mtimeMs
    }))
  )
  return hasLocalSyncTreeDrift(baseline, current)
}
