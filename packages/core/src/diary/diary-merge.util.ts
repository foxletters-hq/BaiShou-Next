import {
  mergeDiaryTagColorRegistries,
  normalizeDiaryTagColorRegistry,
  type Diary,
  type UpdateDiaryInput
} from '@baishou/shared'

/**
 * 日期飞跃覆盖冲撞时，把源更新负荷安全合并进目标日记。
 */
export function mergeDiariesOnDateJump(source: UpdateDiaryInput, target: Diary): void {
  const oldContent = (target.content || '').trimEnd()
  const newContent = (source.content || '').trimEnd()

  source.content = oldContent ? `${oldContent}\n\n${newContent}` : newContent

  const mergedTags = new Set<string>()
  const parseTags = (t: unknown): string[] => {
    if (!t) return []
    if (Array.isArray(t)) return t.map((item) => String(item))
    if (typeof t === 'string')
      return t
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    return []
  }

  parseTags(target.tags).forEach((t) => mergedTags.add(t))
  parseTags(source.tags).forEach((t) => mergedTags.add(t))
  source.tags = Array.from(mergedTags).join(',')

  const mergedTagColors = mergeDiaryTagColorRegistries(
    normalizeDiaryTagColorRegistry(target.tagColors),
    normalizeDiaryTagColorRegistry(source.tagColors)
  )
  source.tagColors = Object.keys(mergedTagColors).length > 0 ? mergedTagColors : undefined

  source.weather = source.weather ?? target.weather
  source.mood = source.mood ?? target.mood
  source.location = source.location ?? target.location
  source.locationDetail = source.locationDetail ?? target.locationDetail
  source.isFavorite = source.isFavorite ?? target.isFavorite
}
