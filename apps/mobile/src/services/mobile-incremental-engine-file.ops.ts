import type { IFileSystem } from '@baishou/core-mobile'
import { loadVaultExternalSyncMounts } from '@baishou/core-mobile'
import {
  isIncrementalSyncRemoteFileNotFoundError,
  isJsonlShardsManifestSyncPath,
  isSqliteRuntimeSyncPath,
  type VaultExternalSyncMount
} from '@baishou/shared'
import { MobileIncrementalCloudClient } from './mobile-incremental-cloud.client'
import { resolveMobileIncrementalSyncFullPath } from './mobile-incremental-sync-path.util'
import { joinIncrementalPath } from './mobile-incremental-engine-path.util'

export async function downloadIncrementalSyncFile(
  fileSystem: IFileSystem,
  client: MobileIncrementalCloudClient,
  relPath: string,
  fullPath: string,
  size: number
): Promise<boolean> {
  if (isSqliteRuntimeSyncPath(relPath) || isJsonlShardsManifestSyncPath(relPath)) {
    return false
  }
  try {
    await client.downloadFile(relPath, fullPath, size > 0 ? size : undefined)
    return await fileSystem.exists(fullPath)
  } catch (error) {
    if (isIncrementalSyncRemoteFileNotFoundError(error)) {
      console.warn(`[MobileIncremental] Remote file missing, skip download: ${relPath}`)
      return false
    }
    throw error
  }
}

export async function backupIncrementalLocalFile(
  fileSystem: IFileSystem,
  src: string,
  syncRoot: string,
  relPath: string
): Promise<void> {
  if (!(await fileSystem.exists(src))) return
  const backupFile = joinIncrementalPath(syncRoot, '.versions', relPath, `${Date.now()}.bak`)
  const bdir = backupFile.replace(/\/[^/]+$/, '')
  if (!(await fileSystem.exists(bdir))) {
    await fileSystem.mkdir(bdir, { recursive: true })
  }
  await fileSystem.copyFile(src, backupFile)
}

export async function resolveIncrementalSyncFullPath(
  fileSystem: IFileSystem,
  syncRoot: string,
  relPath: string,
  mounts: VaultExternalSyncMount[]
): Promise<string> {
  return resolveMobileIncrementalSyncFullPath(fileSystem, syncRoot, relPath, mounts)
}

export async function loadExternalSyncMounts(
  fileSystem: IFileSystem,
  syncRoot: string,
  cached: VaultExternalSyncMount[] | null,
  setCached: (v: VaultExternalSyncMount[]) => void
): Promise<VaultExternalSyncMount[]> {
  if (!cached) {
    const next = await loadVaultExternalSyncMounts(fileSystem, syncRoot)
    setCached(next)
    return next
  }
  return cached
}
