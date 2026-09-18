import type { DiaryTagColorRegistry } from '@baishou/shared'
import type { DiaryListEntry } from './components/DiaryList'

export type DiaryListSourceRow = {
  id: number
  date?: string | Date
  createdAt?: string | Date
  content?: string
  tags?: string[]
  preview?: string
  weather?: string
  mood?: string
  location?: string
  isFavorite?: boolean
  tagColors?: DiaryTagColorRegistry
}

export function formatDiaryDateStr(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function mapDiaryListEntries(entries: DiaryListSourceRow[] | undefined): DiaryListEntry[] {
  if (!entries?.length) return []
  return entries.map((e) => {
    let parsedDate = new Date()
    if (e.date) {
      const pd = new Date(e.date)
      if (!isNaN(pd.getTime())) parsedDate = pd
    } else if (e.createdAt) {
      const cd = new Date(e.createdAt)
      if (!isNaN(cd.getTime())) parsedDate = cd
    }
    return {
      id: e.id,
      date: parsedDate,
      content: e.content || '',
      tags: e.tags || [],
      preview: e.preview || e.content?.substring(0, 500) || '',
      weather: e.weather,
      mood: e.mood,
      location: e.location,
      isFavorite: e.isFavorite,
      tagColors: e.tagColors
    }
  })
}
