/** 增量同步在 .baishou/settings/ 下纳入扫描的文件前缀（相对 vault 根路径） */
export const INCREMENTAL_SYNC_BAISHOU_SETTINGS_PREFIX = '.baishou/settings/' as const

/** @deprecated 使用 INCREMENTAL_SYNC_BAISHOU_SETTINGS_PREFIX */
export const INCREMENTAL_SYNC_BAISHOU_ALLOWLIST = [
  INCREMENTAL_SYNC_BAISHOU_SETTINGS_PREFIX
] as const

function normalizeRel(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\//, '')
}

export function shouldScanIncrementalSyncDirectory(
  entryName: string,
  relativePath: string
): boolean {
  if (entryName === 'node_modules') return false
  const rel = normalizeRel(relativePath)

  if (rel.startsWith('.baishou/') && rel !== '.baishou') {
    if (rel === '.baishou/settings' || rel.startsWith(INCREMENTAL_SYNC_BAISHOU_SETTINGS_PREFIX)) {
      return entryName !== 'node_modules'
    }
    return false
  }

  if (entryName.startsWith('.')) {
    return entryName === '.baishou' && rel === '.baishou'
  }

  return true
}

export function shouldIncludeIncrementalSyncFile(entryName: string, relativePath: string): boolean {
  const rel = normalizeRel(relativePath)
  if (rel.startsWith('.baishou/')) {
    return rel.startsWith(INCREMENTAL_SYNC_BAISHOU_SETTINGS_PREFIX) && rel.endsWith('.json')
  }
  if (entryName.startsWith('.')) return false
  return true
}
