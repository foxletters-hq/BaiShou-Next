import type { IFileSystem, IStoragePathService } from '@baishou/core-mobile'
import type { VaultService } from '@baishou/core-mobile'
import { listDiskVaultFolderNames } from '@baishou/core-mobile'

export async function resolveMobileSyncPlanContext(
  pathService: IStoragePathService,
  fileSystem: IFileSystem,
  vaultService: VaultService
): Promise<{
  registeredVaults: string[]
  diskVaultNames: string[]
  activeVaultName: string | null
}> {
  const syncRoot = await pathService.getRootDirectory()
  const registeredVaults = vaultService.getAllVaults().map((vault) => vault.name)
  const diskVaultNames = await listDiskVaultFolderNames(fileSystem, syncRoot)
  const activeVault = vaultService.getActiveVault()
  return {
    registeredVaults,
    diskVaultNames,
    activeVaultName: activeVault?.name ?? null
  }
}
