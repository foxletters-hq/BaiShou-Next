/** 增量同步在 `.baishou/settings/` 下纳入扫描的文件前缀（相对同步根路径） */
export const INCREMENTAL_SYNC_BAISHOU_SETTINGS_PREFIX = '.baishou/settings/' as const

/** 仓内身份元数据文件名（必须跨设备同步；勿与 external_paths 一并排除） */
export const VAULT_IDENTITY_META_SYNC_FILENAME = 'vault.json' as const

/** 存储根下用户技能目录（跨端共享；桌面端不再只写 home） */
export const INCREMENTAL_SYNC_ROOT_AGENTS_SKILLS_PREFIX = '.agents/skills/' as const

/** @deprecated 使用 INCREMENTAL_SYNC_BAISHOU_SETTINGS_PREFIX */
export const INCREMENTAL_SYNC_BAISHOU_ALLOWLIST = [
  INCREMENTAL_SYNC_BAISHOU_SETTINGS_PREFIX
] as const

const SYNC_SKIP_DIR_NAMES = new Set(['node_modules', 'snapshots', 'temp', '.snapshots'])

function normalizeRel(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\//, '')
}

/** `<vault>/.baishou/vault.json` — 仓库稳定 ID 锚点，须纳入增量同步 */
export function isVaultIdentityMetaRelPath(relativePath: string): boolean {
  const rel = normalizeRel(relativePath)
  return rel.endsWith(`/.baishou/${VAULT_IDENTITY_META_SYNC_FILENAME}`)
}

function basenameFromRel(relativePath: string): string {
  const rel = normalizeRel(relativePath)
  return rel.split('/').pop() ?? rel
}

/** 存储根 `.agents/skills/`（用户技能，允许点目录例外） */
export function isRootAgentsSkillsTree(relativePath: string): boolean {
  const rel = normalizeRel(relativePath)
  return rel === '.agents/skills' || rel.startsWith(INCREMENTAL_SYNC_ROOT_AGENTS_SKILLS_PREFIX)
}

/** 旧版仓内设置：`<Vault>/.baishou/settings/*.json`（V1.5 已迁到根 `.baishou/settings/`） */
export function isLegacyVaultSettingsSyncPath(relativePath: string): boolean {
  const rel = normalizeRel(relativePath)
  return rel.includes('/.baishou/settings/') && rel.endsWith('.json')
}

/**
 * 旧端扫描不到、但新端必须保护的路径。
 * 用于：远端 manifest 漏掉这些条目时从实际远端对象恢复；首次同步无祖先时让远端优先。
 */
export function isIncrementalSyncProtectedRemotePath(relativePath: string): boolean {
  const rel = normalizeRel(relativePath)
  if (rel === 'vault_registry.json') return true
  if (isVaultIdentityMetaRelPath(rel)) return true
  if (isLegacyVaultSettingsSyncPath(rel)) return true
  if (rel === '.baishou/settings' || rel.startsWith(INCREMENTAL_SYNC_BAISHOU_SETTINGS_PREFIX)) {
    const base = basenameFromRel(rel)
    return rel.endsWith('.json') && !base.endsWith('.tmp')
  }
  if (isRootAgentsSkillsTree(rel)) {
    const base = basenameFromRel(rel)
    if (base.startsWith('.')) return false
    if (
      isSqliteRuntimeSyncPath(rel) ||
      isJsonlShardsManifestSyncPath(rel) ||
      isIncrementalSyncConflictBackupPath(rel)
    ) {
      return false
    }
    return true
  }
  return false
}

/** 增量同步冲突备份（*.conflict-<timestamp>.*），仅作本地删除前快照，不参与扫描与上传 */
export function isIncrementalSyncConflictBackupPath(relativePath: string): boolean {
  const base = basenameFromRel(relativePath)
  return /\.conflict-\d+/.test(base)
}

/** JSONL 分片的本机 pending-index 清单，禁止参与增量同步（换机空库不能沿用其它设备的 indexedHash） */
export function isJsonlShardsManifestSyncPath(relativePath: string): boolean {
  return basenameFromRel(relativePath) === 'shards.manifest.json'
}

/** 已知运行时 SQLite 主库文件名（旧版 per-vault shadow 库也在此列） */
const KNOWN_RUNTIME_SQLITE_DB_NAMES = new Set([
  'baishou_agent.db',
  'knowledge.db',
  'shadow_index.db',
  'shadow_index_v2.db',
  'agent.db',
  'baishou.db'
])

/** 用户导入原文目录：这里的 `.db` 是用户资料，不是运行时库 */
const USER_CONTENT_SYNC_DIR_RE = /(?:^|\/)(Notebooks|Attachments)\//i

/**
 * SQLite 运行时附属文件与主库文件，禁止参与增量同步。
 * 主库只排除已知运行时库（含旧版 per-vault shadow 库）和 .baishou 内的库；
 * Notebooks/Attachments 里的用户 `.db` 源文件应正常同步。
 * WAL/SHM 等运行时附属文件仍全局排除。
 */
export function isSqliteRuntimeSyncPath(relativePath: string): boolean {
  const rel = normalizeRel(relativePath)
  const base = basenameFromRel(rel).toLowerCase()
  if (
    base.endsWith('.db-shm') ||
    base.endsWith('.db-wal') ||
    base.endsWith('.db-journal') ||
    base.endsWith('.probe')
  ) {
    return true
  }
  if (!base.endsWith('.db')) return false
  if (USER_CONTENT_SYNC_DIR_RE.test(rel)) return false
  if (rel.includes('/.baishou/') || rel.startsWith('.baishou/')) return true
  return KNOWN_RUNTIME_SQLITE_DB_NAMES.has(base)
}

function isBaishouSettingsTree(rel: string): boolean {
  return (
    rel === '.baishou/settings' ||
    rel.endsWith('/.baishou/settings') ||
    rel.includes('/.baishou/settings/') ||
    rel.startsWith(INCREMENTAL_SYNC_BAISHOU_SETTINGS_PREFIX)
  )
}

/**
 * 存储根下的 `.baishou/`：允许下降以扫描 `.baishou/settings/`（global scope），
 * 其它子树（manifest、sync-log）仍由后续规则排除。
 */
function isRootBaishouDirectory(rel: string, entryName: string): boolean {
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

  // 根级 `.agents/skills/` 是用户技能的跨端共享目录，仅放行这一棵子树
  if (isRootAgentsSkillsTree(rel)) {
    return !entryName.startsWith('.')
  }
  if (entryName === '.agents' && (rel === '.agents' || rel === '')) {
    return true
  }
  if (rel.startsWith('.agents/') && !isRootAgentsSkillsTree(rel)) {
    return false
  }

  // V1.5：根级 `.baishou` 需可扫，否则 `.baishou/settings/` 进不了 manifest
  if (isRootBaishouDirectory(rel, entryName)) {
    return true
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
  if (isSqliteRuntimeSyncPath(rel)) {
    return false
  }
  if (isJsonlShardsManifestSyncPath(rel) || isJsonlShardsManifestSyncPath(entryName)) {
    return false
  }
  if (isIncrementalSyncConflictBackupPath(rel) || isIncrementalSyncConflictBackupPath(entryName)) {
    return false
  }
  if (isRootAgentsSkillsTree(rel)) return !entryName.startsWith('.')
  if (rel.startsWith('.agents/') || rel.includes('/.agents/')) return false
  if (isBaishouSettingsTree(rel)) {
    return rel.includes('/.baishou/settings/') ||
      rel.startsWith(INCREMENTAL_SYNC_BAISHOU_SETTINGS_PREFIX)
      ? rel.endsWith('.json') && !entryName.endsWith('.tmp')
      : false
  }
  // 仓内 vault.json 必须同步（稳定 ID）；与设备本地的 external_paths.json 区分
  if (isVaultIdentityMetaRelPath(rel)) return true
  // external_paths.json 等其它 `.baishou/` 内容为设备本地或运行时数据，不参与跨设备增量同步
  if (rel.includes('/.baishou/') || rel.startsWith('.baishou/')) return false
  if (entryName.startsWith('.')) return false
  return true
}
