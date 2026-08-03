import type { ManifestEntry, RemovedManifestEntry, SyncManifest } from '../types/version-control.types'

function normalizeRelPath(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

/** 路径是否属于某 vault 前缀（`Name` 或 `Name/...`，不误伤 `NameX/...`） */
export function isSyncManifestPathUnderVault(filePath: string, vaultName: string): boolean {
  const normalized = normalizeRelPath(filePath)
  const name = normalizeRelPath(vaultName)
  if (!name) return false
  return normalized === name || normalized.startsWith(`${name}/`)
}

/** 将路径键从旧 vault 前缀改写到新前缀；非该前缀则原样返回 */
export function rewriteSyncManifestVaultPath(
  filePath: string,
  oldVaultName: string,
  newVaultName: string
): string {
  const normalized = normalizeRelPath(filePath)
  const oldName = normalizeRelPath(oldVaultName)
  const newName = normalizeRelPath(newVaultName)
  if (!oldName || oldName === newName) return normalized
  if (normalized === oldName) return newName
  const prefix = `${oldName}/`
  if (normalized.startsWith(prefix)) {
    return `${newName}/${normalized.slice(prefix.length)}`
  }
  return normalized
}

function migrateRecordKeys<T>(
  record: Record<string, T> | undefined,
  oldVaultName: string,
  newVaultName: string
): { next: Record<string, T>; migrated: number } {
  if (!record) return { next: {}, migrated: 0 }
  const next: Record<string, T> = {}
  let migrated = 0
  for (const [key, value] of Object.entries(record)) {
    const rewritten = rewriteSyncManifestVaultPath(key, oldVaultName, newVaultName)
    if (rewritten !== normalizeRelPath(key)) migrated += 1
    // 后写覆盖：同目标键时保留最后一条（改名不应产生碰撞）
    next[rewritten] = value
  }
  return { next, migrated }
}

export type MigrateSyncManifestVaultPrefixResult = {
  manifest: SyncManifest
  /** `files` + `removed` 中发生前缀改写的键数量 */
  migratedKeyCount: number
  /** 改名前缀下 `files` 条目 size 合计（用于改名上传量提示） */
  vaultFileBytes: number
}

/**
 * 迁移本地 sync manifest 的 vault 路径前缀，保留 hash/size/mtime（及 removed 元数据）。
 * **不要**对祖先快照（last-remote-manifest）调用——否则三方合并会判成 delete-local。
 */
export function migrateSyncManifestVaultPrefix(
  manifest: SyncManifest,
  oldVaultName: string,
  newVaultName: string
): MigrateSyncManifestVaultPrefixResult {
  const oldName = normalizeRelPath(oldVaultName).trim()
  const newName = normalizeRelPath(newVaultName).trim()
  if (!oldName || !newName || oldName === newName) {
    const vaultFileBytes = sumVaultFileBytes(manifest.files, oldName || newName)
    return { manifest, migratedKeyCount: 0, vaultFileBytes }
  }

  const vaultFileBytes = sumVaultFileBytes(manifest.files, oldName)
  const files = migrateRecordKeys(manifest.files, oldName, newName)
  const removed = migrateRecordKeys(manifest.removed, oldName, newName)

  return {
    manifest: {
      ...manifest,
      files: files.next,
      ...(manifest.removed || removed.migrated > 0 ? { removed: removed.next } : {})
    },
    migratedKeyCount: files.migrated + removed.migrated,
    vaultFileBytes
  }
}

export function sumVaultFileBytes(
  files: Record<string, ManifestEntry> | undefined,
  vaultName: string
): number {
  if (!files || !vaultName) return 0
  let total = 0
  for (const [key, entry] of Object.entries(files)) {
    if (!isSyncManifestPathUnderVault(key, vaultName)) continue
    const size = entry?.size
    if (typeof size === 'number' && Number.isFinite(size) && size > 0) {
      total += size
    }
  }
  return total
}

/** 仅统计某 vault 前缀下 removed 条数（测试/诊断用） */
export function countVaultRemovedEntries(
  removed: Record<string, RemovedManifestEntry> | undefined,
  vaultName: string
): number {
  if (!removed || !vaultName) return 0
  return Object.keys(removed).filter((key) => isSyncManifestPathUnderVault(key, vaultName)).length
}
