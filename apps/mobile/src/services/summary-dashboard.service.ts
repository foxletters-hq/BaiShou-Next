import type { DiaryService } from '@baishou/core-mobile'
import type { SummaryManagerService } from '@baishou/core-mobile'
import type { SummaryDashboardSnapshot, SummaryDashboardStats } from '@baishou/shared/cache'
import { buildActivityIndex } from '@baishou/shared/cache'

type DashboardServices = {
  diaryService: DiaryService
  summaryManager: SummaryManagerService
}

/** 轻量 Dashboard 拉取：COUNT + GROUP BY + getActivityData，不读总结正文 */
export async function fetchSummaryDashboardSnapshot(
  services: DashboardServices
): Promise<Omit<SummaryDashboardSnapshot, 'scopeKey' | 'fetchedAt'>> {
  const [diaryCount, summaryCounts, activityRows] = await Promise.all([
    services.diaryService.count(),
    services.summaryManager.countByType(),
    services.diaryService.getActivityData()
  ])

  const stats: SummaryDashboardStats = {
    totalDiaryCount: diaryCount,
    totalWeeklyCount: summaryCounts.weekly ?? 0,
    totalMonthlyCount: summaryCounts.monthly ?? 0,
    totalQuarterlyCount: summaryCounts.quarterly ?? 0,
    totalYearlyCount: summaryCounts.yearly ?? 0
  }

  const { activityByDate, availableYears } = buildActivityIndex(activityRows)

  return { stats, activityByDate, availableYears }
}

export { filterActivityForYear } from '@baishou/shared/cache'
