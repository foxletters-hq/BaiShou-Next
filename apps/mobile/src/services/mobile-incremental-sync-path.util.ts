import type { IFileSystem } from '@baishou/core-mobile'
import {
  loadVaultExternalSyncMounts,
  type VaultExternalSyncMount
} from '@baishou/core-mobile'
import { resolveIncrementalSyncRelPath } from '@baishou/shared'
import { joinStoragePath } from './mobile-storage-path.util'

function joinPath(...parts: string[]): string {
  return parts
    .map((p, i) => {
      if (i === 0) return p.replace(/\/$/, '')
      return p.replace(/^\//, '').replace(/\/$/, '')
    })
    .filter(Boolean)
    .join('/')
}

export async function resolveMobileIncrementalSyncFullPath(
  fileSystem: IFileSystem,
  syncRoot: string,
  relPath: string,
  mounts?: VaultExternalSyncMount[] | null
): Promise<string> {
  const resolvedMounts = mounts ?? (await loadVaultExternalSyncMounts(fileSystem, syncRoot))
  return resolveIncrementalSyncRelPath(syncRoot, relPath, resolvedMounts, joinStoragePath)
}

export { joinPath as joinIncrementalSyncPath }
