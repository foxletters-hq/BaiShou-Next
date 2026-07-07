import type { IFileSystem } from '@baishou/core-mobile'
import type { SyncManifest, MergeDecision, ManifestEntry } from '@baishou/shared'
import {
  applySyncDecisionRemovedSideEffects,
  limitExecute,
  SYNC_MANIFEST_VERSION
} from '@baishou/shared'
import { md5HexForSyncFile } from './mobile-sync-file-md5.util'
import { scanIncrementalSyncFilesForManifest } from './mobile-incremental-sync-scan.util'
import { shouldTrustRemoteHashAfterDownload } from './mobile-incremental-sync-progress.util'
import type { MobileIncrementalProgress } from './mobile-incremental-engine.types'

const MANIFEST_HASH_CONCURRENCY = 16

type IncrementalProgressCallback = (progress: MobileIncrementalProgress) => void

export type ManifestOpsDelegate = {
  readonly host: {
    fileSystem: IFileSystem
    deviceId: string
    pendingSyncLocalManifest: SyncManifest | null
    planManifestCache: { local: SyncManifest; remote: SyncManifest } | null
  }
  syncRoot(): Promise<string>
  readLocalManifestFile(): Promise<SyncManifest>
  emptyManifest(): SyncManifest
  mergeManifestFileCaches(...sources: Array<SyncManifest | null | undefined>): SyncManifest
  resolveSyncFullPath(syncRoot: string, relPath: string): Promise<string>
}

export async function buildLocalManifest(
  delegate: ManifestOpsDelegate,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<SyncManifest> {
  const syncRoot = await delegate.syncRoot()
  const diskCached = await delegate.readLocalManifestFile().catch(() => delegate.emptyManifest())
  const cachedManifest = delegate.mergeManifestFileCaches(
    diskCached,
    delegate.host.pendingSyncLocalManifest,
    delegate.host.planManifestCache?.local
  )

  const files = await scanIncrementalSyncFilesForManifest(
    delegate.host.fileSystem,
    syncRoot,
    (discovered, fileName) => {
      onProgress?.(0, discovered, fileName)
    }
  )

  const manifest: SyncManifest = {
    version: SYNC_MANIFEST_VERSION,
    updatedAt: Date.now(),
    deviceId: delegate.host.deviceId,
    files: {}
  }

  const total = Math.max(files.length, 1)
  let hashedCount = 0
  await limitExecute(files, MANIFEST_HASH_CONCURRENCY, async (scanned) => {
    try {
      const cached = cachedManifest.files[scanned.relPath]
      if (cached?.hash && cached.size === scanned.size && cached.lastModified === scanned.mtimeMs) {
        manifest.files[scanned.relPath] = cached
      } else {
        const hash = await md5HexForSyncFile(delegate.host.fileSystem, scanned.fullPath)
        manifest.files[scanned.relPath] = {
          hash,
          size: scanned.size,
          lastModified: scanned.mtimeMs
        }
      }
    } catch {
      // skip unreadable
    }
    hashedCount++
    if (hashedCount % 4 === 0 || hashedCount === files.length) {
      onProgress?.(hashedCount, total, scanned.relPath)
    }
  })
  if (files.length > 0) {
    onProgress?.(files.length, total, files[files.length - 1]!.relPath)
  }
  return manifest
}

/** 同步结束后增量刷新 manifest，避免全量重扫 + 重哈希 */
export async function finalizeManifestAfterSync(
  delegate: ManifestOpsDelegate,
  baseManifest: SyncManifest,
  decisions: MergeDecision[],
  syncRoot: string,
  onProgress?: IncrementalProgressCallback
): Promise<SyncManifest> {
  const manifest: SyncManifest = {
    ...baseManifest,
    updatedAt: Date.now(),
    files: { ...baseManifest.files }
  }

  const pathsToRehash: string[] = []
  for (const d of decisions) {
    if (d.type === 'delete-local') {
      delete manifest.files[d.filePath]
      continue
    }
    if (d.type === 'download') {
      pathsToRehash.push(d.filePath)
      continue
    }
    if (d.type === 'conflict-resolved' && d.direction === 'download') {
      pathsToRehash.push(d.filePath)
    }
  }

  if (pathsToRehash.length === 0) {
    return manifest
  }

  const total = pathsToRehash.length
  let done = 0
  await limitExecute(pathsToRehash, MANIFEST_HASH_CONCURRENCY, async (relPath) => {
    const fullPath = await delegate.resolveSyncFullPath(syncRoot, relPath)
    const stat = await delegate.host.fileSystem.stat(fullPath).catch(() => null)
    if (!stat?.isFile) {
      delete manifest.files[relPath]
      return
    }
    const hash = await md5HexForSyncFile(delegate.host.fileSystem, fullPath)
    manifest.files[relPath] = {
      hash,
      size: stat.size ?? 0,
      lastModified: stat.mtimeMs ?? Date.now()
    }
    done++
    if (done % 4 === 0 || done === total) {
      onProgress?.({
        phase: 'finalizing',
        current: done,
        total,
        fileName: relPath
      })
    }
  })

  return manifest
}

/** 将单文件同步结果合并进 manifest（用于断点续传 checkpoint） */
export async function applyDecisionToManifest(
  delegate: ManifestOpsDelegate,
  manifest: SyncManifest,
  decision: MergeDecision,
  syncRoot: string
): Promise<SyncManifest> {
  const next: SyncManifest = {
    ...manifest,
    updatedAt: Date.now(),
    deviceId: manifest.deviceId || delegate.host.deviceId,
    files: { ...manifest.files }
  }

  const applyDownloadedEntry = async (relPath: string, remoteEntry: ManifestEntry | null) => {
    const fullPath = await delegate.resolveSyncFullPath(syncRoot, relPath)
    const stat = await delegate.host.fileSystem.stat(fullPath).catch(() => null)
    if (!stat?.isFile) {
      delete next.files[relPath]
      return
    }
    if (remoteEntry && shouldTrustRemoteHashAfterDownload(stat.size ?? 0, remoteEntry)) {
      next.files[relPath] = {
        hash: remoteEntry.hash,
        size: stat.size ?? remoteEntry.size,
        lastModified: stat.mtimeMs ?? remoteEntry.lastModified
      }
      return
    }
    const hash = await md5HexForSyncFile(delegate.host.fileSystem, fullPath)
    next.files[relPath] = {
      hash,
      size: stat.size ?? 0,
      lastModified: stat.mtimeMs ?? Date.now()
    }
  }

  switch (decision.type) {
    case 'upload':
      if (decision.localEntry) next.files[decision.filePath] = decision.localEntry
      break
    case 'download':
      await applyDownloadedEntry(decision.filePath, decision.remoteEntry)
      break
    case 'delete-local':
    case 'delete-remote':
      delete next.files[decision.filePath]
      break
    case 'conflict-resolved':
      if (decision.direction === 'upload' && decision.localEntry) {
        next.files[decision.filePath] = decision.localEntry
      } else if (decision.direction === 'download') {
        await applyDownloadedEntry(decision.filePath, decision.remoteEntry)
      }
      break
    default:
      break
  }

  return applySyncDecisionRemovedSideEffects(next, decision, delegate.host.deviceId)
}
