import {
  SYNC_MANIFEST_REMOVED_MAX_ENTRIES,
  SYNC_MANIFEST_VERSION
} from '../constants/incremental-sync.constants'
import type { ManifestEntry, RemovedManifestEntry, SyncManifest } from '../types/version-control.types'
import type { MergeDecision } from './three-way-merge'

/** 空清单（含空的已移除记录表） */
export function createEmptySyncManifest(deviceId: string = ''): SyncManifest {
  return {
    version: SYNC_MANIFEST_VERSION,
    updatedAt: 0,
    deviceId,
    files: {},
    removed: {}
  }
}

export function normalizeSyncManifest(manifest: SyncManifest): SyncManifest {
  return {
    ...manifest,
    files: manifest.files ?? {},
    removed: manifest.removed ?? {}
  }
}

export function getSyncManifestRemovedMap(
  manifest: SyncManifest
): Record<string, RemovedManifestEntry> {
  return manifest.removed ?? {}
}

export function getSyncManifestRemovedEntry(
  manifest: SyncManifest,
  filePath: string
): RemovedManifestEntry | null {
  return manifest.removed?.[filePath] ?? null
}

/** 远端清单是否记录了该路径的显式移除（同一路径只保留最新一条） */
export function isRemoteRemovalRecorded(
  remote: SyncManifest,
  filePath: string,
  localEntry: ManifestEntry | null
): boolean {
  const removed = getSyncManifestRemovedEntry(remote, filePath)
  if (!removed || !localEntry) return false
  return localEntry.hash === removed.hash
}

export function clearSyncManifestRemoved(manifest: SyncManifest, filePath: string): SyncManifest {
  if (!manifest.removed?.[filePath]) return manifest
  const removed = { ...manifest.removed }
  delete removed[filePath]
  return { ...manifest, removed }
}

export function recordSyncManifestRemoved(
  manifest: SyncManifest,
  filePath: string,
  source: ManifestEntry,
  deviceId: string,
  removedAtMs: number = Date.now()
): SyncManifest {
  const removed = { ...(manifest.removed ?? {}) }
  removed[filePath] = {
    hash: source.hash,
    size: source.size,
    removedAt: removedAtMs,
    deviceId
  }
  return { ...manifest, removed }
}

/**
 * 裁剪已移除记录：超出上限时保留最近移除的条目。
 * 同一路径在 Record 中天然只有一条（再次删除会覆盖）。
 */
export function pruneSyncManifestRemoved(manifest: SyncManifest): SyncManifest {
  const removed = manifest.removed ?? {}
  const entries = Object.entries(removed)

  if (entries.length <= SYNC_MANIFEST_REMOVED_MAX_ENTRIES) {
    return manifest
  }

  entries.sort((a, b) => b[1].removedAt - a[1].removedAt)
  return {
    ...manifest,
    removed: Object.fromEntries(entries.slice(0, SYNC_MANIFEST_REMOVED_MAX_ENTRIES))
  }
}

/** 远端存储上已重新出现的文件，清除对应已移除记录 */
export function reconcileSyncManifestRemovedWithRemoteFiles(
  manifest: SyncManifest,
  remoteFilePaths: ReadonlySet<string>
): SyncManifest {
  const removed = { ...(manifest.removed ?? {}) }
  let changed = false
  for (const filePath of Object.keys(removed)) {
    if (remoteFilePaths.has(filePath)) {
      delete removed[filePath]
      changed = true
    }
  }
  return changed ? { ...manifest, removed } : manifest
}

export function applySyncDecisionRemovedSideEffects(
  manifest: SyncManifest,
  decision: MergeDecision,
  deviceId: string
): SyncManifest {
  let next = normalizeSyncManifest(manifest)
  const filePath = decision.filePath

  switch (decision.type) {
    case 'delete-remote': {
      const source =
        decision.remoteEntry ?? decision.ancestorEntry ?? decision.localEntry ?? null
      if (source) {
        next = recordSyncManifestRemoved(next, filePath, source, deviceId)
      }
      delete next.files[filePath]
      break
    }
    case 'delete-local':
      delete next.files[filePath]
      break
    case 'upload':
    case 'download':
      next = clearSyncManifestRemoved(next, filePath)
      break
    case 'conflict-resolved':
      next = clearSyncManifestRemoved(next, filePath)
      break
    default:
      break
  }

  return next
}

/** 同步结束后：以磁盘扫描结果为准，合并远端已移除记录并应用本次决策 */
export function finalizeIncrementalSyncManifest(options: {
  scanned: SyncManifest
  baselineRemote: SyncManifest
  decisions: MergeDecision[]
  deviceId: string
  nowMs?: number
}): SyncManifest {
  const nowMs = options.nowMs ?? Date.now()
  let manifest = normalizeSyncManifest({
    ...options.scanned,
    removed: { ...getSyncManifestRemovedMap(options.baselineRemote) },
    deviceId: options.deviceId,
    updatedAt: nowMs
  })

  for (const decision of options.decisions) {
    manifest = applySyncDecisionRemovedSideEffects(manifest, decision, options.deviceId)
  }

  return pruneSyncManifestRemoved(manifest)
}
