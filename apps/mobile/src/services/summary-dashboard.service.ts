import type { DiaryService } from '@baishou/core-mobile'
import type { SummaryManagerService } from '@baishou/core-mobile'
import type {
  SummaryDashboardSnapshot,
  SummaryDashboardStats
} from '../lib/summary-dashboard-cache'

type DashboardServices = {
  diaryService: DiaryService
  summaryManager: SummaryManagerService
}

function buildActivityIndex(rows: Array<{ date: string; count: number }>): {
  activityByDate: Record<string, number>
  availableYears: number[]
} {
  const activityByDate: Record<string, number> = {}
  const yearSet = new Set<number>()

  for (const row of rows) {
    activityByDate[row.date] = (activityByDate[row.date] ?? 0) + (row.count || 1)
    const y = parseInt(row.date.substring(0, 4), 10)
    if (!Number.isNaN(y)) yearSet.add(y)
  }

  const availableYears = Array.from(yearSet).sort((a, b) => a - b)
  if (availableYears.length === 0) {
    availableYears.push(new Date().getFullYear())
  }

  return { activityByDate, availableYears }
}

/** 轻量 Dashboard 拉取：COUNT + GROUP BY + getActivityData，不读总结正文 */
export async function fetchSummaryDashboardSnapshot(
  services: DashboardServices
): Promise<Omit<SummaryDashboardSnapshot, 'vaultRevision' | 'fetchedAt'>> {
  const [diaryCount, summaryCounts, activityRows] = await Promise.all([
    services.diaryService.count(),
    services.summaryManager.countByType(),
    services.diaryService.getActivityData()
  ])

  const stats: SummaryDashboardStats = {
    totalDiaryCount: diaryCount,
    totalWeeklyCount: summaryCounts.weekly,
    totalMonthlyCount: summaryCounts.monthly,
    totalQuarterlyCount: summaryCounts.quarterly,
    totalYearlyCount: summaryCounts.yearly
  }

  const { activityByDate, availableYears } = buildActivityIndex(activityRows)

  return { stats, activityByDate, availableYears }
}

export function filterActivityForYear(
  activityByDate: Record<string, number>,
  year: number
): Array<{ date: string; count: number }> {
  const prefix = `${year}-`
  return Object.entries(activityByDate)
    .filter(([date]) => date.startsWith(prefix))
    .map(([date, count]) => ({ date, count }))
}
