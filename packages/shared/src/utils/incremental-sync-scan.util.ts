/** 增量同步在 `.baishou/settings/` 下纳入扫描的文件前缀（相对同步根路径） */
export const INCREMENTAL_SYNC_BAISHOU_SETTINGS_PREFIX = '.baishou/settings/' as const

/** @deprecated 使用 INCREMENTAL_SYNC_BAISHOU_SETTINGS_PREFIX */
export const INCREMENTAL_SYNC_BAISHOU_ALLOWLIST = [
  INCREMENTAL_SYNC_BAISHOU_SETTINGS_PREFIX
] as const

const SYNC_SKIP_DIR_NAMES = new Set(['node_modules', 'snapshots', 'temp', '.snapshots'])

function normalizeRel(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\//, '')
}

function basenameFromRel(relativePath: string): string {
  const rel = normalizeRel(relativePath)
  return rel.split('/').pop() ?? rel
}

/** SQLite 运行时附属文件与主库文件，禁止参与增量同步（会被进程锁定，且不应跨设备复制） */
export function isSqliteRuntimeSyncPath(relativePath: string): boolean {
  const base = basenameFromRel(relativePath).toLowerCase()
  return (
    base.endsWith('.db') ||
    base.endsWith('.db-shm') ||
    base.endsWith('.db-wal') ||
    base.endsWith('.db-journal') ||
    base.endsWith('.probe')
  )
}

function isBaishouSettingsTree(rel: string): boolean {
  return (
    rel === '.baishou/settings' ||
    rel.endsWith('/.baishou/settings') ||
    rel.includes('/.baishou/settings/') ||
    rel.startsWith(INCREMENTAL_SYNC_BAISHOU_SETTINGS_PREFIX)
  )
}

/** 存储根下的 `.baishou/`（manifest、sync-log），不参与文件扫描 */
function isRootSyncMetaDirectory(rel: string, entryName: string): boolean {
  return entryName === '.baishou' && (rel === '.baishou' || rel === '')
}

/** 聊天背景图目录（设备本地偏好，不参与增量同步） */
export function isIncrementalSyncChatBackgroundPath(relativePath: string): boolean {
  const rel = normalizeRel(relativePath)
  return (
    rel === 'Attachments/backgrounds' ||
    rel.endsWith('/Attachments/backgrounds') ||
    rel.startsWith('Attachments/backgrounds/') ||
    rel.includes('/Attachments/backgrounds/')
  )
}

export function shouldScanIncrementalSyncDirectory(
  entryName: string,
  relativePath: string
): boolean {
  if (SYNC_SKIP_DIR_NAMES.has(entryName)) return false
  const rel = normalizeRel(relativePath)

  if (isIncrementalSyncChatBackgroundPath(rel)) {
    return false
  }

  if (isRootSyncMetaDirectory(rel, entryName)) {
    return false
  }

  if (isBaishouSettingsTree(rel)) {
    return !SYNC_SKIP_DIR_NAMES.has(entryName)
  }

  if (entryName === '.baishou' && rel.endsWith('/.baishou')) {
    return true
  }

  if (rel.includes('/.baishou/') && !isBaishouSettingsTree(rel)) {
    return false
  }

  if (rel.startsWith('.baishou/') && !isBaishouSettingsTree(rel)) {
    return false
  }

  if (entryName.startsWith('.')) {
    return false
  }

  return true
}

export function shouldIncludeIncrementalSyncFile(entryName: string, relativePath: string): boolean {
  const rel = normalizeRel(relativePath)
  if (isIncrementalSyncChatBackgroundPath(rel) || isIncrementalSyncChatBackgroundPath(entryName)) {
    return false
  }
  if (isSqliteRuntimeSyncPath(rel) || isSqliteRuntimeSyncPath(entryName)) {
    return false
  }
  if (isBaishouSettingsTree(rel)) {
    return rel.includes('/.baishou/settings/') ||
      rel.startsWith(INCREMENTAL_SYNC_BAISHOU_SETTINGS_PREFIX)
      ? rel.endsWith('.json') && !entryName.endsWith('.tmp')
      : false
  }
  // external_paths.json 为设备本地配置（日记/总结绝对路径），不参与跨设备增量同步
  if (rel.includes('/.baishou/') || rel.startsWith('.baishou/')) return false
  if (entryName.startsWith('.')) return false
  return true
}
