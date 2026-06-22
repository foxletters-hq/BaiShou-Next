import type { VaultService } from '@baishou/core'
import type { IFileSystem, IStoragePathService } from '@baishou/core-mobile'
import type { IncrementalSyncPlanPreview, IncrementalSyncRunOptions } from '@baishou/shared'
import { resolveMobileSyncPlanContext } from './incremental-sync-plan-context'
import type {
  IncrementalSyncProgress,
  MobileIncrementalSyncService
} from './mobile-incremental-sync.service'

const REMOTE_VAULT_SCOPE_SKIP = new Set(['__root__', '__unknown__'])

function filterRemoteVaultScopes(paths: string[]): string[] {
  return paths.filter((name) => !REMOTE_VAULT_SCOPE_SKIP.has(name))
}

/** 启动或同步前：将磁盘与远端 manifest 中的工作区补登记进 vault_registry.json */
export async function reconcileVaultRegistryForIncrementalSync(
  vaultService: VaultService,
  unknownVaultPaths?: Iterable<string>
): Promise<string[]> {
  const autoRegistered = [...(await vaultService.syncRegistryWithDisk())]
  if (unknownVaultPaths) {
    const remoteOnly = filterRemoteVaultScopes([...unknownVaultPaths])
    if (remoteOnly.length > 0) {
      autoRegistered.push(...(await vaultService.ensureVaultsRegistered(remoteOnly)))
    }
  }
  return [...new Set(autoRegistered)]
}

export async function planIncrementalSyncWithVaultRegistry(
  deps: {
    pathService: IStoragePathService
    fileSystem: IFileSystem
    vaultService: VaultService
    incrementalSyncService: MobileIncrementalSyncService
  },
  options?: {
    onProgress?: (progress: IncrementalSyncProgress) => void
    runOptions?: IncrementalSyncRunOptions
  }
): Promise<IncrementalSyncPlanPreview> {
  deps.incrementalSyncService.beginPlanSession()
  try {
    await reconcileVaultRegistryForIncrementalSync(deps.vaultService)

    let context = await resolveMobileSyncPlanContext(
      deps.pathService,
      deps.fileSystem,
      deps.vaultService
    )

    const scopes = await deps.incrementalSyncService.collectManifestVaultScopes()
    const pruned = await deps.vaultService.pruneOrphanRegistryVaults(
      scopes,
      context.diskVaultNames
    )
    if (pruned.length > 0) {
      context = await resolveMobileSyncPlanContext(
        deps.pathService,
        deps.fileSystem,
        deps.vaultService
      )
    }

    let preview = await deps.incrementalSyncService.planSync(
      context,
      options?.onProgress,
      options?.runOptions
    )
    if (pruned.length > 0) {
      preview = {
        ...preview,
        prunedRegistryVaults: pruned
      }
    }

    const unknown = filterRemoteVaultScopes(preview.boundaryIssues.unknownVaultPaths)
    if (unknown.length > 0) {
      await reconcileVaultRegistryForIncrementalSync(deps.vaultService, unknown)
      context = await resolveMobileSyncPlanContext(
        deps.pathService,
        deps.fileSystem,
        deps.vaultService
      )
      preview = await deps.incrementalSyncService.planSync(
        context,
        options?.onProgress,
        options?.runOptions
      )
    }

    return preview
  } finally {
    deps.incrementalSyncService.finalizePlanSession()
  }
}
