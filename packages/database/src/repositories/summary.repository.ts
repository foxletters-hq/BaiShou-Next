import { Summary, CreateSummaryInput, UpdateSummaryInput, SummaryType } from '@baishou/shared'

export interface SummaryRepository {
  save(summary: CreateSummaryInput): Promise<Summary>
  upsert(summary: CreateSummaryInput): Promise<Summary>
  update(id: number, summary: UpdateSummaryInput): Promise<Summary>
  getByDateRange(
    type: SummaryType,
    start: Date,
    end: Date,
    vaultId?: string | null
  ): Promise<Summary | null>
  /** 按 type + 起始本地日历日查找（忽略 start/end 的时分秒差异） */
  findAllByTypeAndStartDay(
    type: SummaryType,
    startDate: Date,
    vaultId?: string | null
  ): Promise<Summary[]>
  getSummaries(options?: { start?: Date; vaultId?: string | null }): Promise<Summary[]>
  countByType(vaultId?: string | null): Promise<Partial<Record<SummaryType, number>>>
  delete(id: number): Promise<void>
  /** 仅删除指定 vault；无 vaultId 且无默认解析器时 no-op（fail-closed） */
  deleteAll(vaultId?: string | null): Promise<void>
}
