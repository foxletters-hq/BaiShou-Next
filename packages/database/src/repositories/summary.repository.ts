import { Summary, CreateSummaryInput, UpdateSummaryInput, SummaryType } from '@baishou/shared'

export interface SummaryRepository {
  save(summary: CreateSummaryInput): Promise<Summary>
  upsert(summary: CreateSummaryInput): Promise<Summary>
  update(id: number, summary: UpdateSummaryInput): Promise<Summary>
  getByDateRange(type: SummaryType, start: Date, end: Date): Promise<Summary | null>
  /** 按 type + 起始本地日历日查找（忽略 start/end 的时分秒差异） */
  findAllByTypeAndStartDay(type: SummaryType, startDate: Date): Promise<Summary[]>
  getSummaries(options?: { start?: Date }): Promise<Summary[]>
  countByType(): Promise<Partial<Record<SummaryType, number>>>
  delete(id: number): Promise<void>
  deleteAll(): Promise<void>
}
