import { coerceDiaryCalendarDate, formatLocalDate } from './date.utils'

/** 日记向量分块前缀：只带日期，不带元数据标签 */
export function buildDiaryEmbeddingDatePrefix(date: Date | string): string {
  const d = coerceDiaryCalendarDate(date)
  if (!d) return ''
  return `[${formatLocalDate(d)} 日记:]\n`
}

/** 日记嵌入入参：正文原样作为 text，日期前缀单独放在 chunkPrefix。 */
export function buildDiaryEmbeddingTextArgs(
  content: string,
  date: Date | string
): { text: string; chunkPrefix: string } {
  const d = coerceDiaryCalendarDate(date)
  return {
    text: content,
    chunkPrefix: d ? buildDiaryEmbeddingDatePrefix(d) : ''
  }
}

/** 批量嵌入时优先处理最早日记（日期从旧到新） */
export function sortDiariesByDateAsc<T extends { date: Date }>(diaries: T[]): T[] {
  return [...diaries].sort((a, b) => a.date.getTime() - b.date.getTime())
}

/** 按日记日期从新到旧排序（展示等场景） */
export function sortDiariesByDateDesc<T extends { date: Date }>(diaries: T[]): T[] {
  return [...diaries].sort((a, b) => b.date.getTime() - a.date.getTime())
}

/** @deprecated V2.2 起新写入 group_id 仅为 'diary'；保留供存量解析 */
export const DIARY_EMBED_GROUP_PREFIX = 'diary:'

/** 新写入的日记向量 group_id（仓库隔离改靠 vault_id 列） */
export const DIARY_EMBED_GROUP_ID = 'diary'

/** 新写入的记忆向量 group_id */
export const MEMORY_EMBED_GROUP_ID = 'memory'

/** 旧版未按工作空间隔离的日记嵌入 groupId（迁移时需清理） */
export const LEGACY_DIARY_EMBED_GROUP_IDS = [
  'diary_batch',
  'diary_auto',
  'diary_post_sync'
] as const

const DIARY_EMBED_SOURCE_SEP = '#'

/**
 * 日记向量 sourceId：{vaultId}#{diaryId}，避免多工作空间 numeric id 冲突。
 * 调用方须传入稳定 vaultId（非显示名）。
 */
export function buildDiaryEmbeddingSourceId(vaultId: string, diaryId: number | string): string {
  const vault = vaultId.trim()
  if (!vault) throw new Error('buildDiaryEmbeddingSourceId: vaultId is required')
  return `${vault}${DIARY_EMBED_SOURCE_SEP}${String(diaryId)}`
}

/**
 * 日记向量 groupId。V2.2 起固定为 `'diary'`（仓库隔离靠 vault_id 列）。
 * 保留可选参数以兼容旧调用方签名。
 */
export function buildDiaryEmbeddingGroupId(_vaultIdOrName?: string): string {
  return DIARY_EMBED_GROUP_ID
}

export function isLegacyDiaryEmbeddingSourceId(sourceId: string): boolean {
  return !sourceId.includes(DIARY_EMBED_SOURCE_SEP)
}

export function parseDiaryEmbeddingSourceId(
  sourceId: string
): { vaultId: string; diaryId: string } | null {
  const idx = sourceId.indexOf(DIARY_EMBED_SOURCE_SEP)
  if (idx <= 0) return null
  return {
    vaultId: sourceId.slice(0, idx),
    diaryId: sourceId.slice(idx + 1)
  }
}

/** 筛选尚未嵌入或日记内容已更新、需重新嵌入的条目 */
export function filterUnindexedDiaries<T extends { id: unknown; updatedAt?: Date }>(
  diaries: T[],
  embeddedIds: Set<string>,
  embeddedUpdatedAtMap: Map<string, number>,
  options?: { resolveSourceId?: (diary: T) => string }
): T[] {
  const resolveSourceId = options?.resolveSourceId ?? ((d) => String(d.id))

  return diaries.filter((d) => {
    const sId = resolveSourceId(d)
    if (!embeddedIds.has(sId)) {
      return true
    }
    const existingUpdatedAt = embeddedUpdatedAtMap.get(sId)
    if (existingUpdatedAt === undefined) {
      return true
    }
    if (d.updatedAt) {
      return d.updatedAt.getTime() > existingUpdatedAt
    }
    return false
  })
}
