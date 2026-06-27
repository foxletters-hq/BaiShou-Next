/** 将日记 tags 统一规范为 string[]（兼容 Diary 字符串与 DiaryMeta 数组） */
export function normalizeDiaryTags(tags: unknown): string[] {
  if (!tags) return []
  if (Array.isArray(tags)) {
    return tags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter(Boolean)
  }
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  }
  return []
}

/** 预览卡片默认最多展示的标签数，避免标签挤占正文区域 */
export const DIARY_PREVIEW_TAG_LIMIT = 4

export type LimitedDiaryPreviewTags = {
  visibleTags: string[]
  overflowCount: number
}

/** 预览卡片标签截断：保留前 N 个，其余计入 overflowCount */
export function limitDiaryPreviewTags(
  tags: string[] | null | undefined,
  maxVisible = DIARY_PREVIEW_TAG_LIMIT
): LimitedDiaryPreviewTags {
  const normalized = normalizeDiaryTags(tags)
  if (normalized.length <= maxVisible) {
    return { visibleTags: normalized, overflowCount: 0 }
  }
  return {
    visibleTags: normalized.slice(0, maxVisible),
    overflowCount: normalized.length - maxVisible
  }
}
