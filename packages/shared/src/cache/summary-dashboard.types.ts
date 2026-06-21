/** 总结/回忆面板 Dashboard 快照（Mobile + Desktop 共用类型） */
export interface SummaryDashboardStats {
  totalDiaryCount: number
  totalWeeklyCount: number
  totalMonthlyCount: number
  totalQuarterlyCount: number
  totalYearlyCount: number
}

export interface SummaryDashboardSnapshot {
  /** 工作区 scope（Mobile: vaultRevision 字符串；Desktop: vault 名） */
  scopeKey: string
  stats: SummaryDashboardStats
  /** 日记归档日 → 篇数（热力图稀疏索引） */
  activityByDate: Record<string, number>
  availableYears: number[]
  fetchedAt: number
}

export function buildActivityIndex(rows: Array<{ date: string; count: number }>): {
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

export function filterActivityForYear(
  activityByDate: Record<string, number>,
  year: number
): Array<{ date: string; count: number }> {
  const prefix = `${year}-`
  return Object.entries(activityByDate)
    .filter(([date]) => date.startsWith(prefix))
    .map(([date, count]) => ({ date, count }))
}
