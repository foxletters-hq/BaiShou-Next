/** 批量嵌入时优先处理最早日记（日期从旧到新） */
export function sortDiariesByDateAsc<T extends { date: Date }>(diaries: T[]): T[] {
  return [...diaries].sort((a, b) => a.date.getTime() - b.date.getTime())
}

/** 按日记日期从新到旧排序（展示等场景） */
export function sortDiariesByDateDesc<T extends { date: Date }>(diaries: T[]): T[] {
  return [...diaries].sort((a, b) => b.date.getTime() - a.date.getTime())
}

/** 筛选尚未嵌入或日记内容已更新、需重新嵌入的条目 */
export function filterUnindexedDiaries<T extends { id: unknown; updatedAt?: Date }>(
  diaries: T[],
  embeddedIds: Set<string>,
  embeddedUpdatedAtMap: Map<string, number>
): T[] {
  return diaries.filter((d) => {
    const sId = String(d.id)
    if (!embeddedIds.has(sId)) {
      return true
    }
    const existingUpdatedAt = embeddedUpdatedAtMap.get(sId)
    if (existingUpdatedAt !== undefined && d.updatedAt) {
      return d.updatedAt.getTime() > existingUpdatedAt
    }
    return false
  })
}
