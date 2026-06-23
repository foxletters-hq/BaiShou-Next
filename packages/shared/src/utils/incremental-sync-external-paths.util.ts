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

/** 用于挂载子树比较：统一斜杠、Android 存储前缀、Windows 大小写 */
export function normalizeIncrementalSyncAbsPathForCompare(absPath: string): string {
  let normalized = normalizeIncrementalSyncAbsPath(absPath)
  if (normalized.startsWith('file://')) {
    try {
      normalized = normalizeIncrementalSyncAbsPath(decodeURIComponent(normalized.slice('file://'.length)))
    } catch {
      normalized = normalizeIncrementalSyncAbsPath(normalized.slice('file://'.length))
    }
  }
  if (normalized.startsWith('/emulated/0')) {
    normalized = `/storage/emulated/0${normalized.slice('/emulated/0'.length)}`
  }
  if (/^[A-Za-z]:/.test(normalized)) {
    normalized = normalized.toLowerCase()
  }
  return normalized
}

/** 是否实际使用外部目录（已配置且与 vault 内默认路径不同） */
export function isUsingExternalVaultDirectory(
  configuredExternalPath: string | null | undefined,
  resolvedDirectory: string,
  defaultDirectory: string
): boolean {
  if (!configuredExternalPath?.trim()) return false
  return (
    normalizeIncrementalSyncAbsPathForCompare(resolvedDirectory) !==
    normalizeIncrementalSyncAbsPathForCompare(defaultDirectory)
  )
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

/** 与 shouldIncludeIncrementalSyncFile 相同；保留命名以区分外部挂载扫描调用点 */
export function shouldIncludeIncrementalSyncFileWithExternalConfig(
  entryName: string,
  relativePath: string
): boolean {
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

/** 判断绝对路径是否落在外部挂载根目录或其子树内（用于根扫描时排除字面路径重复） */
export function isAbsPathUnderExternalSyncMount(
  absPath: string,
  mounts: readonly VaultExternalSyncMount[]
): boolean {
  const normalized = normalizeIncrementalSyncAbsPathForCompare(absPath)
  for (const mount of mounts) {
    const base = normalizeIncrementalSyncAbsPathForCompare(mount.absBase)
    if (normalized === base || normalized.startsWith(`${base}/`)) {
      return true
    }
  }
  return false
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

/** 根扫描结果是否应排除（物理子树重复或内部 Journals/Archives 字面路径） */
export function shouldExcludeIncrementalSyncRootScanEntry(
  fullPath: string,
  relPath: string,
  mounts: readonly VaultExternalSyncMount[]
): boolean {
  if (isAbsPathUnderExternalSyncMount(fullPath, mounts)) return true
  if (isInternalDefaultJournalsOrArchivesRelPath(relPath, mounts)) return true
  return false
}
