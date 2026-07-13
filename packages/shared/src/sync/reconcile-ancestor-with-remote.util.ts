import type { ManifestEntry, SyncManifest } from '../types/version-control.types'
import { getSyncManifestRemovedMap, normalizeSyncManifest } from './sync-manifest-removed.util'

/**
 * 用远端真相校正祖先快照：
 * - 祖先有、远端 files 也有 → 保留
 * - 祖先有、远端有 tombstone → 保留（真实删除传播仍需祖先）
 * - 祖先有、远端既无文件也无 tombstone → 剥离（多为未真正上云的假祖先）
 *
 * 注意：若远端 tombstone 已被条数上限裁掉，真实删除可能被误判为假祖先并倾向 upload；
 * 这是用「可恢复未上传会话」换取的已知权衡，依赖较大的 removed 上限降低概率。
 */
export function reconcileAncestorWithRemoteTruth(
  ancestor: SyncManifest,
  remote: SyncManifest
): SyncManifest {
  const remoteFiles = remote.files ?? {}
  const removed = getSyncManifestRemovedMap(remote)
  const nextFiles: Record<string, ManifestEntry> = {}
  let stripped = 0

  for (const [filePath, entry] of Object.entries(ancestor.files ?? {})) {
    if (remoteFiles[filePath] || removed[filePath]) {
      nextFiles[filePath] = entry
      continue
    }
    stripped++
  }

  if (stripped === 0) {
    return normalizeSyncManifest(ancestor)
  }

  return normalizeSyncManifest({
    ...ancestor,
    updatedAt: Date.now(),
    files: nextFiles
  })
}

/** 统计会被剥离的假祖先条目数（便于日志） */
export function countUnverifiedAncestorEntries(
  ancestor: SyncManifest,
  remote: SyncManifest
): number {
  const remoteFiles = remote.files ?? {}
  const removed = getSyncManifestRemovedMap(remote)
  let count = 0
  for (const filePath of Object.keys(ancestor.files ?? {})) {
    if (!remoteFiles[filePath] && !removed[filePath]) count++
  }
  return count
}
