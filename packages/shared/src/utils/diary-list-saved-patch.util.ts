import type { DiaryListSavedPatch } from '../cache/diary-list-cache'
import { normalizeDiaryTags } from './diary-tags.util'
import {
  normalizeDiaryPreviewMarkdown,
  prepareDiaryCardPreviewMarkdown
} from './diary-preview.util'

export type DiaryListSavedPatchSource = {
  id?: number | null
  content?: string | null
  tags?: string | string[] | null
  weather?: string | null
  mood?: string | null
  isFavorite?: boolean | null
  updatedAt?: Date | null
  tagColors?: Record<string, number> | null
}

/** 从已落库的日记实体构造列表卡片即时更新 payload */
export function buildDiaryListSavedPatch(
  diary: DiaryListSavedPatchSource
): DiaryListSavedPatch | null {
  if (diary.id == null) return null
  const preview = prepareDiaryCardPreviewMarkdown(
    normalizeDiaryPreviewMarkdown(diary.content?.substring(0, 500) ?? '')
  )
  return {
    id: diary.id,
    preview,
    tags: normalizeDiaryTags(diary.tags ?? []),
    weather: diary.weather ?? undefined,
    mood: diary.mood ?? undefined,
    isFavorite: diary.isFavorite ?? undefined,
    updatedAt: diary.updatedAt ?? undefined,
    tagColors: diary.tagColors ?? undefined
  }
}
