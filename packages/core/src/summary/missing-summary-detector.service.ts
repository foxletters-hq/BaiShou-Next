import { Diary, Summary, MissingSummary, detectMissingSummaries } from '@baishou/shared'
import type { DiaryRepository, SummaryRepository } from '@baishou/database'

export class MissingSummaryDetector {
  constructor(
    private readonly diaryRepo: DiaryRepository,
    private readonly summaryRepo: SummaryRepository
  ) {}

  async getAllMissing(
    locale: string = 'zh',
    monthlySummarySource: 'weeklies' | 'diaries' = 'weeklies'
  ): Promise<MissingSummary[]> {
    const allDiaries = await this.diaryRepo.list() // assuming list() returns all when no options passed
    const allSummaries = await this.summaryRepo.getSummaries()

    if (allDiaries.length === 0) return []

    return this.detectMissing(allDiaries, allSummaries, locale, monthlySummarySource)
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
