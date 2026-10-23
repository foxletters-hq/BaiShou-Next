import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { discoverVaultNames } from '../migration/legacy-migration.shared'
import { listDiskVaultFolderNames } from './vault-disk.util'

export function parseRegistryTimestamp(value: unknown, fallback: Date): Date {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return fallback
}

export function normalizeRegistryPath(p: string): string {
  return p
    .replace(/^file:\/\//, '')
    .replace(/\\/g, '/')
    .replace(/\/$/, '')
}

export async function vaultDirectoryHasLegacyContent(
  fileSystem: IFileSystem,
  rootDir: string,
  vaultName: string
): Promise<boolean> {
  const vaultDir = path.join(rootDir, vaultName)
  return (
    (await fileSystem.exists(path.join(vaultDir, 'Journals'))) ||
    (await fileSystem.exists(path.join(vaultDir, 'Archives'))) ||
    (await fileSystem.exists(path.join(vaultDir, '.baishou', 'agent.sqlite')))
  )
}

export async function discoverLegacyVaultNamesOnDisk(
  fileSystem: IFileSystem,
  rootDir: string
): Promise<string[]> {
  const names = await discoverVaultNames(fileSystem, rootDir)
  const withContent: string[] = []
  for (const name of names) {
    if (await vaultDirectoryHasLegacyContent(fileSystem, rootDir, name)) {
      withContent.push(name)
    }
  }
  return withContent
}

export async function discoverAllVaultNamesOnDisk(
  fileSystem: IFileSystem,
  rootDir: string
): Promise<string[]> {
  const [fromFolders, fromLegacy] = await Promise.all([
    listDiskVaultFolderNames(fileSystem, rootDir),
    discoverLegacyVaultNamesOnDisk(fileSystem, rootDir)
  ])
  return [...new Set([...fromFolders, ...fromLegacy])]
}
