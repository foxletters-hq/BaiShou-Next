import type { DiaryListEntryData } from './hooks/useDiaryData'

export function diaryListEntriesUnchanged(
  prev: DiaryListEntryData[],
  next: DiaryListEntryData[]
): boolean {
  if (prev.length !== next.length) return false
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i]!
    const b = next[i]!
    if (
      a.id !== b.id ||
      a.preview !== b.preview ||
      a.weather !== b.weather ||
      a.mood !== b.mood ||
      a.isFavorite !== b.isFavorite ||
      String(a.updatedAt ?? '') !== String(b.updatedAt ?? '')
    ) {
      return false
    }
  }
  return true
}
