/** 版本迁移全局板块 ID */
export type LegacyVersionMigrationGlobalSectionId = 'avatar' | 'personas' | 'config'

export const WORKSPACE_SECTION_PREFIX = 'workspace:' as const

/** 版本迁移板块 ID（全局或 workspace:工作区名） */
export type LegacyVersionMigrationSectionId =
  | LegacyVersionMigrationGlobalSectionId
  | `${typeof WORKSPACE_SECTION_PREFIX}${string}`

export function isWorkspaceSectionId(
  sectionId: string
): sectionId is `${typeof WORKSPACE_SECTION_PREFIX}${string}` {
  return sectionId.startsWith(WORKSPACE_SECTION_PREFIX)
}

export function workspaceSectionId(legacyVaultName: string): LegacyVersionMigrationSectionId {
  return `${WORKSPACE_SECTION_PREFIX}${legacyVaultName}`
}

export function parseWorkspaceSectionId(sectionId: LegacyVersionMigrationSectionId): string | null {
  if (!isWorkspaceSectionId(sectionId)) return null
  return sectionId.slice(WORKSPACE_SECTION_PREFIX.length)
}

export type LegacyVersionMigrationImportStatus =
  | 'idle'
  | 'importing'
  | 'success'
  | 'failed'
  | 'unavailable'

export interface LegacyVersionMigrationPreviewItem {
  label: string
  detail?: string
}

export interface LegacyVersionMigrationSectionPreview {
  sectionId: LegacyVersionMigrationSectionId
  titleKey: string
  bytes: number
  count: number
  available: boolean
  warnings: string[]
  previewItems?: LegacyVersionMigrationPreviewItem[]
}

export interface LegacyVersionMigrationWorkspacePreview {
  legacyVaultName: string
  sectionId: LegacyVersionMigrationSectionId
  diaryCount: number
  diaryBytes: number
  archiveCount: number
  archiveBytes: number
  assistantCount: number
  sessionCount: number
  agentBytes: number
  available: boolean
  warnings: string[]
  previewItems?: LegacyVersionMigrationPreviewItem[]
}

export interface LegacyVersionMigrationScanResult {
  sourceRoot: string
  sourceDisplayPath: string
  globalSections: LegacyVersionMigrationSectionPreview[]
  workspaces: LegacyVersionMigrationWorkspacePreview[]
}

export interface LegacyVersionMigrationImportResult {
  sectionId: LegacyVersionMigrationSectionId
  imported: number
  skipped: number
  failed: number
  warnings: string[]
  errors?: string[]
  /** 失败条目样例（日记日期、伙伴名、会话标题等），便于 UI 展示 */
  failureSamples?: string[]
  assistantIdMap?: Record<string, string>
  vaultNameMap?: Record<string, string>
}

/** 批量导入多个工作空间时的汇总结果 */
export interface LegacyVersionMigrationBatchImportResult extends LegacyVersionMigrationImportResult {
  sectionResults: LegacyVersionMigrationImportResult[]
}

export interface LegacyVersionMigrationState {
  assistantIdMap: Record<string, string>
  vaultNameMap: Record<string, string>
  importedSections: LegacyVersionMigrationSectionId[]
  updatedAt: string
}

const LEGACY_PART_TYPE_MAP: Record<string, string> = {
  contextSnapshot: 'context_snapshot',
  context_snapshot: 'context_snapshot',
  stepFinish: 'stepFinish',
  compaction: 'compaction',
  text: 'text',
  tool: 'tool',
  image: 'image',
  attachment: 'attachment'
}

const ALLOWED_LEGACY_PART_TYPES = new Set([
  'text',
  'tool',
  'stepFinish',
  'compaction',
  'image',
  'attachment',
  'context_snapshot'
])

/** 将旧版 agent_parts.type 规范为新版 schema 枚举值 */
export function normalizeLegacyPartType(type: unknown): string {
  const raw = String(type ?? 'text')
  const mapped = LEGACY_PART_TYPE_MAP[raw] ?? raw
  return ALLOWED_LEGACY_PART_TYPES.has(mapped) ? mapped : 'text'
}

/** 将字节格式化为兆（MB）展示文案 */
export function formatMigrationMegabytes(bytes: number): string {
  if (bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb < 0.01) return '<0.01 MB'
  return `${mb.toFixed(mb < 10 ? 2 : 1)} MB`
}

/**
 * 名称冲突时在末尾追加两位随机数字（10–99），最多重试 50 次。
 */
export function resolveUniqueNameWithTwoDigitSuffix(
  baseName: string,
  existingNames: Set<string>
): string {
  const trimmed = baseName.trim()
  if (!trimmed) return baseName
  if (!existingNames.has(trimmed)) return trimmed

  for (let attempt = 0; attempt < 50; attempt++) {
    const suffix = String(Math.floor(Math.random() * 90) + 10)
    const candidate = `${trimmed}${suffix}`
    if (!existingNames.has(candidate)) return candidate
  }

  return `${trimmed}${String(Date.now() % 100).padStart(2, '0')}`
}

/**
 * 将旧版工作区名解析为新版目标名（与「工作空间」板块导入规则一致）。
 * 已持久化的映射优先；与现有 vault 重名时追加两位后缀，避免与现有磁盘内容冲突。
 */
export function resolveLegacyVaultTargetName(
  legacyVaultName: string,
  existingNames: Set<string>,
  storedMap: Record<string, string> = {}
): string {
  const trimmed = legacyVaultName.trim()
  if (!trimmed) return legacyVaultName

  const mapped = storedMap[trimmed] ?? storedMap[legacyVaultName]
  if (mapped) {
    // 已明确映射到不同名称（如 Personal → Personal95）时沿用
    if (mapped !== trimmed) return mapped
    // 过期的「同名映射」：当前已有同名工作区时必须重新分配后缀，避免覆盖
    if (existingNames.has(trimmed)) {
      return resolveUniqueNameWithTwoDigitSuffix(trimmed, existingNames)
    }
    return mapped
  }

  if (!existingNames.has(trimmed)) return trimmed
  return resolveUniqueNameWithTwoDigitSuffix(trimmed, existingNames)
}

export function generateRemappedId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now()}_${rand}`
}

export function parseLegacyPersonasFromSp(
  sp: Record<string, unknown>
): Array<{ id: string; facts: Record<string, string> }> {
  const raw = sp['user_personas']
  if (typeof raw !== 'string') return []

  try {
    const parsed = JSON.parse(raw) as Record<string, Record<string, string>>
    return Object.entries(parsed).map(([id, facts]) => ({
      id,
      facts: facts ?? {}
    }))
  } catch {
    return []
  }
}

/** 旧版会话 vault_name 与目标工作区名对齐（空值视为 Personal） */
export function legacySessionBelongsToVault(
  sessionVaultName: unknown,
  legacyVaultName: string
): boolean {
  const normalized = sessionVaultName != null && String(sessionVaultName).trim() !== ''
    ? String(sessionVaultName)
    : 'Personal'
  return normalized === legacyVaultName
}

/** 旧版平铺板块 ID（日记/伙伴/会话/工作空间），导入状态需映射到 workspace: 前缀 */
const LEGACY_FLAT_WORKSPACE_SECTION_IDS = new Set([
  'diaries',
  'assistants',
  'chats',
  'workspaces'
])

/**
 * 将持久化的 importedSections 规范为当前 schema。
 * 若曾导入旧版平铺板块，则视为对应 legacy vault 的工作空间板块已全部导入。
 */
export function normalizeImportedSectionIds(
  ids: string[],
  legacyVaultNames: string[]
): LegacyVersionMigrationSectionId[] {
  const normalized = new Set<LegacyVersionMigrationSectionId>()
  let hadLegacyWorkspaceBundle = false

  for (const id of ids) {
    if (LEGACY_FLAT_WORKSPACE_SECTION_IDS.has(id)) {
      hadLegacyWorkspaceBundle = true
      continue
    }
    if (id === 'avatar' || id === 'personas' || id === 'config') {
      normalized.add(id)
      continue
    }
    if (isWorkspaceSectionId(id)) {
      normalized.add(id)
    }
  }

  if (hadLegacyWorkspaceBundle) {
    for (const name of legacyVaultNames) {
      normalized.add(workspaceSectionId(name))
    }
  }

  return [...normalized]
}

const ASSISTANT_ID_MAP_SCOPE_SEP = '::'

/** 按工作空间读取伙伴 ID 映射（避免多工作空间共用同一旧 ID） */
export function filterAssistantIdMapForVault(
  map: Record<string, string>,
  legacyVaultName: string
): Record<string, string> {
  const prefix = `${legacyVaultName}${ASSISTANT_ID_MAP_SCOPE_SEP}`
  const scoped: Record<string, string> = {}
  for (const [key, value] of Object.entries(map)) {
    if (key.startsWith(prefix)) {
      scoped[key.slice(prefix.length)] = value
    } else if (!key.includes(ASSISTANT_ID_MAP_SCOPE_SEP)) {
      scoped[key] = value
    }
  }
  return scoped
}

/** 将工作空间内伙伴 ID 映射写入全局存储键 */
export function scopeAssistantIdMapForVault(
  map: Record<string, string>,
  legacyVaultName: string
): Record<string, string> {
  const scoped: Record<string, string> = {}
  for (const [oldId, newId] of Object.entries(map)) {
    scoped[`${legacyVaultName}${ASSISTANT_ID_MAP_SCOPE_SEP}${oldId}`] = newId
  }
  return scoped
}
