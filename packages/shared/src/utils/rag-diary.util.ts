/** 批量嵌入时优先处理最早日记（日期从旧到新） */
export function sortDiariesByDateAsc<T extends { date: Date }>(diaries: T[]): T[] {
  return [...diaries].sort((a, b) => a.date.getTime() - b.date.getTime())
}

/** 按日记日期从新到旧排序（展示等场景） */
export function sortDiariesByDateDesc<T extends { date: Date }>(diaries: T[]): T[] {
  return [...diaries].sort((a, b) => b.date.getTime() - a.date.getTime())
}

export const DIARY_EMBED_GROUP_PREFIX = 'diary:'

/** 旧版未按工作空间隔离的日记嵌入 groupId（迁移时需清理） */
export const LEGACY_DIARY_EMBED_GROUP_IDS = ['diary_batch', 'diary_auto', 'diary_post_sync'] as const

const DIARY_EMBED_SOURCE_SEP = '#'

/** 日记向量 sourceId：{vaultName}#{diaryId}，避免多工作空间 numeric id 冲突 */
export function buildDiaryEmbeddingSourceId(vaultName: string, diaryId: number | string): string {
  const vault = vaultName.trim() || 'Personal'
  return `${vault}${DIARY_EMBED_SOURCE_SEP}${String(diaryId)}`
}

/** 日记向量 groupId：diary:{vaultName}，用于检索/统计按工作空间过滤 */
export function buildDiaryEmbeddingGroupId(vaultName: string): string {
  const vault = vaultName.trim() || 'Personal'
  return `${DIARY_EMBED_GROUP_PREFIX}${vault}`
}

export function isLegacyDiaryEmbeddingSourceId(sourceId: string): boolean {
  return !sourceId.includes(DIARY_EMBED_SOURCE_SEP)
}

export function parseDiaryEmbeddingSourceId(
  sourceId: string
): { vaultName: string; diaryId: string } | null {
  const idx = sourceId.indexOf(DIARY_EMBED_SOURCE_SEP)
  if (idx <= 0) return null
  return {
    vaultName: sourceId.slice(0, idx),
    diaryId: sourceId.slice(idx + 1)
  }
}

/** 混合检索结果：日记向量仅限指定工作空间，chat/manual 等保持可见 */
export function filterDiaryScopedSearchResults<
  T extends { sourceType?: string; sessionId?: string; groupId?: string }
>(results: T[], vaultName: string): T[] {
  const expectedGroupId = buildDiaryEmbeddingGroupId(vaultName)
  return results.filter((row) => {
    if (row.sourceType !== 'diary') return true
    const groupId = row.sessionId ?? row.groupId
    return groupId === expectedGroupId
  })
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
