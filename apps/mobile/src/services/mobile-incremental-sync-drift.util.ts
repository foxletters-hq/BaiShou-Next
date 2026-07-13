import type { IFileSystem } from '@baishou/core-mobile'
import type { SyncManifest } from '@baishou/shared'
import {
  hasLocalSyncTreeDrift,
  summarizeScannedSyncFiles,
  summarizeSyncManifestFiles
} from '@baishou/shared'
import { scanIncrementalSyncFilesForManifest } from './mobile-incremental-sync-scan.util'

async function scanLocalSyncTreeSummary(fileSystem: IFileSystem, syncRoot: string) {
  const scanned = await scanIncrementalSyncFilesForManifest(fileSystem, syncRoot)
  return summarizeScannedSyncFiles(
    scanned.map((file) => ({
      relPath: file.relPath,
      size: file.size,
      mtimeMs: file.mtimeMs
    }))
  )
}

/**
 * 对比规划时的本地指纹与当前扫描结果。
 * 优先用 planReuseBaseline 指纹（与建表时扫描一致），避免拿「hash 失败被跳过」的 pending manifest 对全量扫描产生假漂移。
 */
export async function detectLocalSyncTreeDrift(
  fileSystem: IFileSystem,
  syncRoot: string,
  baselineManifest: SyncManifest,
  baselineFingerprint?: string | null
): Promise<boolean> {
  const current = await scanLocalSyncTreeSummary(fileSystem, syncRoot)
  if (baselineFingerprint != null && baselineFingerprint !== '') {
    return baselineFingerprint !== current.fingerprint
  }
  const baseline = summarizeSyncManifestFiles(baselineManifest)
  return hasLocalSyncTreeDrift(baseline, current)
}
