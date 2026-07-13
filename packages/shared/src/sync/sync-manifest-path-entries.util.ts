import type { ManifestEntry, SyncManifest } from '../types/version-control.types'
import { normalizeSyncManifest } from './sync-manifest-removed.util'

/**
 * 按路径增量合并 manifest 条目（null = 删除该路径）。
 * 用于单文件同步成功后推进一致点，以及收尾写盘后的二次定稿。
 */
export function upsertManifestPathEntries(
  manifest: SyncManifest,
  updates: Readonly<Record<string, ManifestEntry | null>>
): SyncManifest {
  const files = { ...(manifest.files ?? {}) }
  let changed = false
  for (const [filePath, entry] of Object.entries(updates)) {
    if (entry == null) {
      if (filePath in files) {
        delete files[filePath]
        changed = true
      }
      continue
    }
    const prev = files[filePath]
    if (
      !prev ||
      prev.hash !== entry.hash ||
      prev.size !== entry.size ||
      prev.lastModified !== entry.lastModified
    ) {
      files[filePath] = entry
      changed = true
    }
  }
  if (!changed) return normalizeSyncManifest(manifest)
  return normalizeSyncManifest({
    ...manifest,
    updatedAt: Date.now(),
    files
  })
}
