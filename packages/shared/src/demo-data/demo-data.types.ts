import type { SummaryType } from '../types/summary.types'

/** 演示日记条目（相对 referenceDate 或 dateFixed 定位日期） */
export interface DemoDiaryEntry {
  content: string
  dateDaysOffset?: number
  dateMinutesOffset?: number
  /** ISO 8601，优先于 offset */
  dateFixed?: string
  tags?: string[]
  mood?: string
  weather?: string
  location?: string
}

/** 演示总结条目（日期须与产品周/月/季/年区间一致） */
export interface DemoSummaryEntry {
  type: SummaryType
  /** 区间起始日 yyyy-MM-dd 或 ISO */
  startDateFixed: string
  /** 区间结束日 yyyy-MM-dd 或 ISO */
  endDateFixed: string
  content: string
}

export interface DemoDataBundle {
  diaries: DemoDiaryEntry[]
  summaries: DemoSummaryEntry[]
}
