import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import {
  buildVaultArchivesSyncPrefix,
  buildVaultJournalsSyncPrefix,
  externalAbsPathToSyncRelPath,
  shouldIncludeIncrementalSyncFileWithExternalConfig,
  type VaultExternalSyncMount
} from '@baishou/shared'
import { JOURNAL_TREE_SKIP_DIR_NAMES } from '../journal/journal-files.util'
import {
  readVaultExternalPaths,
  resolveJournalsBaseDirectory,
  resolveSummariesBaseDirectory
} from '../vault/vault-external-paths.service'
import { listDiskVaultFolderNames } from '../vault/vault-disk.util'

function isSameNormalizedPath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b)
}

export async function loadVaultExternalSyncMounts(
  fileSystem: IFileSystem,
  syncRoot: string
): Promise<VaultExternalSyncMount[]> {
  const mounts: VaultExternalSyncMount[] = []
  const vaultNames = await listDiskVaultFolderNames(fileSystem, syncRoot)

  for (const vaultName of vaultNames) {
    const vaultDir = path.join(syncRoot, vaultName)
    const sysDir = path.join(vaultDir, '.baishou')
    const external = await readVaultExternalPaths(fileSystem, sysDir)

    const internalJournals = path.join(vaultDir, 'Journals')
    const journalsBase = resolveJournalsBaseDirectory(vaultDir, external)
    if (
      external.journalsDirectory?.trim() &&
      !isSameNormalizedPath(journalsBase, internalJournals) &&
      (await fileSystem.exists(journalsBase))
    ) {
      mounts.push({
        vaultName,
        kind: 'journals',
        absBase: journalsBase,
        syncPrefix: buildVaultJournalsSyncPrefix(vaultName)
      })
    }

    const internalArchives = path.join(vaultDir, 'Archives')
    const summariesBase = resolveSummariesBaseDirectory(vaultDir, external)
    if (
      external.summariesDirectory?.trim() &&
      !isSameNormalizedPath(summariesBase, internalArchives) &&
      (await fileSystem.exists(summariesBase))
    ) {
      mounts.push({
        vaultName,
        kind: 'summaries',
        absBase: summariesBase,
        syncPrefix: buildVaultArchivesSyncPrefix(vaultName)
      })
    }
  }

  return mounts
}

export type ExternalMountScannedFile = {
  relPath: string
  fullPath: string
}

export async function scanVaultExternalSyncMountFiles(
  fileSystem: IFileSystem,
  mount: VaultExternalSyncMount
): Promise<ExternalMountScannedFile[]> {
  const files: ExternalMountScannedFile[] = []

  async function walk(dir: string): Promise<void> {
    let names: string[] = []
    try {
      names = await fileSystem.readdir(dir)
    } catch {
      return
    }

    for (const name of names) {
      const fullPath = path.join(dir, name)
      let stat: { isFile?: boolean; isDirectory?: boolean } | null = null
      try {
        stat = await fileSystem.stat(fullPath)
      } catch {
        continue
      }

      if (stat.isDirectory) {
        if (mount.kind === 'journals' && JOURNAL_TREE_SKIP_DIR_NAMES.has(name)) continue
        await walk(fullPath)
        continue
      }

      if (!stat.isFile) continue
      const relPath = externalAbsPathToSyncRelPath(mount, fullPath)
      if (!relPath) continue
      if (!shouldIncludeIncrementalSyncFileWithExternalConfig(name, relPath)) continue
      files.push({ relPath, fullPath })
    }
  }

  if (await fileSystem.exists(mount.absBase)) {
    await walk(mount.absBase)
  }

  return files
}

export async function scanAllVaultExternalSyncMountFiles(
  fileSystem: IFileSystem,
  syncRoot: string
): Promise<ExternalMountScannedFile[]> {
  const mounts = await loadVaultExternalSyncMounts(fileSystem, syncRoot)
  const byRel = new Map<string, ExternalMountScannedFile>()
  for (const mount of mounts) {
    const scanned = await scanVaultExternalSyncMountFiles(fileSystem, mount)
    for (const file of scanned) {
      byRel.set(file.relPath, file)
    }
  }
  return Array.from(byRel.values())
}
