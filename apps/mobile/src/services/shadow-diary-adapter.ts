import type { ShadowIndexRepository } from '@baishou/database'
import type { DiaryRepository } from '@baishou/database'
import { parseDateStr, formatLocalDate, type Diary } from '@baishou/shared'

/** 将 ShadowIndex 记录适配为 Summary 模块所需的 DiaryRepository 子集 */
export function createShadowDiaryRepoAdapter(
  shadowRepo: ShadowIndexRepository
): Pick<DiaryRepository, 'list' | 'findByDateRange'> {
  const mapRecord = (r: {
    id: number
    date: string
    title?: string | null
    rawContent?: string | null
    content?: string | null
    tags?: string | null
    createdAt?: string | null
    updatedAt?: string | null
  }): Diary => {
    const diaryDate = parseDateStr(r.date)
    return {
      id: r.id,
      title: r.title ?? undefined,
      date: diaryDate,
      content: r.rawContent ?? r.content ?? '',
      tags: r.tags ?? '',
      isFavorite: false,
      mediaPaths: [],
      createdAt: r.createdAt ? new Date(r.createdAt) : diaryDate,
      updatedAt: r.updatedAt ? new Date(r.updatedAt) : diaryDate
    } as Diary
  }

  return {
    async list() {
      const records = await shadowRepo.getAllRecords()
      return records.map((r) => mapRecord(r as any))
    },
    async findByDateRange(start: Date, end: Date) {
      const records = await shadowRepo.findByDateRange(
        formatLocalDate(start),
        formatLocalDate(end)
      )
      return records.map((r) => mapRecord(r as any))
    }
  }
}
