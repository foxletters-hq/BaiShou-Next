import type { DiaryListEntryData } from './hooks/useDiaryData'

/** 清空列表时复用已有空数组，避免 setEntries([]) 因引用变化反复重渲染 */
export function reuseEmptyDiaryEntries<T>(prev: T[]): T[] {
  return prev.length === 0 ? prev : []
}

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
