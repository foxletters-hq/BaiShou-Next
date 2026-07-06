import type { DiaryListSavedPatch } from '@baishou/shared/cache'
import type { DiaryListEntryData } from '../hooks/useDiaryData'

export function applyDiaryListSavedPatch(
  entries: DiaryListEntryData[],
  patch: DiaryListSavedPatch
): DiaryListEntryData[] | null {
  const idx = entries.findIndex((entry) => entry.id === patch.id)
  if (idx < 0) return null
  const current = entries[idx]!
  const nextEntry: DiaryListEntryData = {
    ...current,
    preview: patch.preview,
    content: patch.preview,
    tags: patch.tags ?? current.tags,
    weather: patch.weather ?? current.weather,
    mood: patch.mood ?? current.mood,
    isFavorite: patch.isFavorite ?? current.isFavorite,
    updatedAt: patch.updatedAt ?? current.updatedAt,
    tagColors: patch.tagColors ?? current.tagColors
  }
  if (
    current.preview === nextEntry.preview &&
    current.weather === nextEntry.weather &&
    current.mood === nextEntry.mood &&
    current.isFavorite === nextEntry.isFavorite &&
    String(current.updatedAt ?? '') === String(nextEntry.updatedAt ?? '')
  ) {
    return null
  }
  const next = [...entries]
  next[idx] = nextEntry
  return next
}
