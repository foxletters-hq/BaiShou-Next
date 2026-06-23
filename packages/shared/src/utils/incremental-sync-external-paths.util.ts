import {
  shouldIncludeIncrementalSyncFile,
  shouldScanIncrementalSyncDirectory
} from './incremental-sync-scan.util'

export const VAULT_EXTERNAL_PATHS_SYNC_FILENAME = 'external_paths.json'

export type VaultExternalSyncKind = 'journals' | 'summaries'

export interface VaultExternalSyncMount {
  vaultName: string
  kind: VaultExternalSyncKind
  /** 磁盘上的绝对根目录 */
  absBase: string
  /** 增量同步 manifest 中的虚拟前缀，如 Personal/Journals */
  syncPrefix: string
}

export function normalizeIncrementalSyncRelPath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\//, '')
}

export function normalizeIncrementalSyncAbsPath(absPath: string): string {
  return absPath.replace(/\\/g, '/').replace(/\/$/, '')
}

export function buildVaultJournalsSyncPrefix(vaultName: string): string {
  return `${vaultName}/Journals`
}

export function buildVaultArchivesSyncPrefix(vaultName: string): string {
  return `${vaultName}/Archives`
}

export function isVaultExternalPathsConfigRelPath(relativePath: string): boolean {
  const rel = normalizeIncrementalSyncRelPath(relativePath)
  return rel.endsWith(`/.baishou/${VAULT_EXTERNAL_PATHS_SYNC_FILENAME}`)
}

export function shouldIncludeIncrementalSyncFileWithExternalConfig(
  entryName: string,
  relativePath: string
): boolean {
  if (isVaultExternalPathsConfigRelPath(relativePath) && entryName === VAULT_EXTERNAL_PATHS_SYNC_FILENAME) {
    return true
  }
  return shouldIncludeIncrementalSyncFile(entryName, relativePath)
}

export function shouldScanIncrementalSyncDirectoryWithExternalMounts(
  entryName: string,
  relativePath: string,
  mounts: readonly VaultExternalSyncMount[]
): boolean {
  if (!shouldScanIncrementalSyncDirectory(entryName, relativePath)) return false

  const rel = normalizeIncrementalSyncRelPath(relativePath)
  const parts = rel.split('/')
  if (parts.length === 2) {
    const vaultName = parts[0]!
    const dirName = parts[1]!
    if (
      dirName === 'Journals' &&
      mounts.some((m) => m.vaultName === vaultName && m.kind === 'journals')
    ) {
      return false
    }
    if (
      dirName === 'Archives' &&
      mounts.some((m) => m.vaultName === vaultName && m.kind === 'summaries')
    ) {
      return false
    }
  }

  return true
}

export function externalAbsPathToSyncRelPath(
  mount: VaultExternalSyncMount,
  absPath: string
): string | null {
  const normalizedAbs = normalizeIncrementalSyncAbsPath(absPath)
  const normalizedBase = normalizeIncrementalSyncAbsPath(mount.absBase)
  if (normalizedAbs === normalizedBase) {
    return mount.syncPrefix
  }
  const baseWithSlash = `${normalizedBase}/`
  if (!normalizedAbs.startsWith(baseWithSlash)) return null
  const suffix = normalizedAbs.slice(baseWithSlash.length)
  return suffix ? `${mount.syncPrefix}/${suffix}` : mount.syncPrefix
}

/** 将 manifest 相对路径解析为磁盘绝对路径（支持外部日记/总结挂载） */
export function resolveIncrementalSyncRelPath(
  syncRoot: string,
  relPath: string,
  mounts: readonly VaultExternalSyncMount[],
  joinPath: (...parts: string[]) => string
): string {
  const rel = normalizeIncrementalSyncRelPath(relPath)
  for (const mount of mounts) {
    const prefix = mount.syncPrefix
    if (rel === prefix || rel.startsWith(`${prefix}/`)) {
      const suffix = rel === prefix ? '' : rel.slice(prefix.length + 1)
      return suffix ? joinPath(mount.absBase, suffix) : mount.absBase
    }
  }
  return joinPath(syncRoot, relPath)
}

export function isInternalDefaultJournalsOrArchivesRelPath(
  relPath: string,
  mounts: readonly VaultExternalSyncMount[]
): boolean {
  const rel = normalizeIncrementalSyncRelPath(relPath)
  const parts = rel.split('/')
  if (parts.length < 2) return false
  const vaultName = parts[0]!
  const dirName = parts[1]!
  if (dirName === 'Journals') {
    return mounts.some((m) => m.vaultName === vaultName && m.kind === 'journals')
  }
  if (dirName === 'Archives') {
    return mounts.some((m) => m.vaultName === vaultName && m.kind === 'summaries')
  }
  return false
}
