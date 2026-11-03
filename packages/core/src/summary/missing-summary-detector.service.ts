import {
  Diary,
  Summary,
  MissingSummary,
  SummaryType,
  detectMissingSummaries,
  formatLocalDate
} from '@baishou/shared'
import type { DiaryRepository, SummaryRepository } from '@baishou/database'

/** 盘上已识别总结的最小索引能力（用于 DB 缓存滞后时兜底） */
export interface SummaryDiskIndex {
  listAllSummaries(): Promise<
    { type: SummaryType; startDate: Date; endDate: Date; fullPath: string; vaultName?: string }[]
  >
}

export class MissingSummaryDetector {
  constructor(
    private readonly diaryRepo: DiaryRepository,
    private readonly summaryRepo: SummaryRepository,
    private readonly diskIndex?: SummaryDiskIndex
  ) {}

  async getAllMissing(
    locale: string = 'zh',
    monthlySummarySource: 'weeklies' | 'diaries' = 'weeklies'
  ): Promise<MissingSummary[]> {
    const allDiaries = await this.diaryRepo.list() // assuming list() returns all when no options passed
    const dbSummaries = await this.summaryRepo.getSummaries()
    const allSummaries = await this.resolveExistingSummaries(dbSummaries)

    if (allDiaries.length === 0) return []

    return this.detectMissing(allDiaries, allSummaries, locale, monthlySummarySource)
  }

  /**
   * DB 是缓存而非总结真相源。冷启动或外部总结目录切换后缓存可能滞后，
   * 以盘上已识别文件补齐判定基准，避免把实际存在的总结误报为缺失。
   */
  private async resolveExistingSummaries(dbSummaries: Summary[]): Promise<Summary[]> {
    if (!this.diskIndex) return dbSummaries

    let diskFiles: Awaited<ReturnType<SummaryDiskIndex['listAllSummaries']>>
    try {
      diskFiles = await this.diskIndex.listAllSummaries()
    } catch {
      return dbSummaries
    }
    if (diskFiles.length === 0) return dbSummaries

    const existingKeys = new Set(
      dbSummaries.map((s) => `${s.type}:${formatLocalDate(new Date(s.startDate))}`)
    )
    const merged = [...dbSummaries]
    for (const file of diskFiles) {
      const key = `${file.type}:${formatLocalDate(new Date(file.startDate))}`
      if (existingKeys.has(key)) continue
      existingKeys.add(key)
      merged.push({
        type: file.type,
        startDate: file.startDate,
        endDate: file.endDate,
        content: ''
      })
    }
    return merged
  }

  private detectMissing(
    diaries: Diary[],
    summaries: Summary[],
    locale: string,
    monthlySummarySource: 'weeklies' | 'diaries' = 'weeklies'
  ): MissingSummary[] {
    return detectMissingSummaries(diaries, summaries, locale, monthlySummarySource)
  }
}
