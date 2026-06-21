import type { SummaryDashboardSnapshot, SummaryDashboardStats } from '@baishou/shared/cache'
import { buildActivityIndex } from '@baishou/shared/cache'

type DashboardIpcPayload = {
  totalDiaryCount: number
  weeklyCount: number
  monthlyCount: number
  quarterlyCount: number
  yearlyCount: number
  activityRows: Array<{ date: string; count: number }>
}

/** 轻量 Dashboard 拉取：IPC 一次返回 stats + activity，不读总结正文 */
export async function fetchSummaryDashboardSnapshot(
  _scopeKey: string
): Promise<Omit<SummaryDashboardSnapshot, 'scopeKey' | 'fetchedAt'>> {
  if (typeof window === 'undefined' || !window.electron) {
    return emptyDashboardPayload()
  }

  const payload = (await window.electron.ipcRenderer.invoke(
    'summary:dashboard-snapshot'
  )) as DashboardIpcPayload | null

  if (!payload) return emptyDashboardPayload()

  const stats: SummaryDashboardStats = {
    totalDiaryCount: payload.totalDiaryCount ?? 0,
    totalWeeklyCount: payload.weeklyCount ?? 0,
    totalMonthlyCount: payload.monthlyCount ?? 0,
    totalQuarterlyCount: payload.quarterlyCount ?? 0,
    totalYearlyCount: payload.yearlyCount ?? 0
  }

  const { activityByDate, availableYears } = buildActivityIndex(payload.activityRows ?? [])

  return { stats, activityByDate, availableYears }
}

function emptyDashboardPayload(): Omit<SummaryDashboardSnapshot, 'scopeKey' | 'fetchedAt'> {
  return {
    stats: {
      totalDiaryCount: 0,
      totalWeeklyCount: 0,
      totalMonthlyCount: 0,
      totalQuarterlyCount: 0,
      totalYearlyCount: 0
    },
    activityByDate: {},
    availableYears: [new Date().getFullYear()]
  }
}
