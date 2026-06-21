import type { IFileSystem, IStoragePathService } from '@baishou/core-mobile'
import type { VaultService } from '@baishou/core'

function joinPath(...parts: string[]): string {
  return parts
    .map((p, i) => {
      if (i === 0) return p.replace(/\/$/, '')
      return p.replace(/^\//, '').replace(/\/$/, '')
    })
    .filter(Boolean)
    .join('/')
}

async function listDiskVaultFolderNames(
  fileSystem: IFileSystem,
  syncRoot: string
): Promise<string[]> {
  try {
    const names = await fileSystem.readdir(syncRoot)
    const folders: string[] = []
    for (const name of names) {
      if (name.startsWith('.')) continue
      const full = joinPath(syncRoot, name)
      const info = await fileSystem.stat(full).catch(() => null)
      if (info?.isDirectory) folders.push(name)
    }
    return folders
  } catch {
    return []
  }
}

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
