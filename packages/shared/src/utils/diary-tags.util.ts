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
    const trimmed = tags.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          return normalizeDiaryTags(parsed)
        }
      } catch {
        /* fall through to comma split */
      }
    }
    return trimmed
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  }
  return []
}

/** RAG 嵌入 chunk 前缀：兼容 tags 为 string / string[] / JSON 数组字符串 */
export function buildDiaryEmbeddingTagPrefix(tags: unknown): string {
  const normalized = normalizeDiaryTags(tags)
  return normalized.length > 0 ? `[标签: ${normalized.join(', ')}] ` : ''
}

/** 合并日记标签字符串，去重并保持顺序（先 existing 后 incoming） */
export function mergeDiaryTags(existing: string | null | undefined, incoming: string): string {
  const existingArr = (existing || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const incomingArr = incoming
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return Array.from(new Set([...existingArr, ...incomingArr])).join(', ')
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
