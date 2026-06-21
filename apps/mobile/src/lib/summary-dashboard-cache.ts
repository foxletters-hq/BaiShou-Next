/**
 * 总结/回忆面板 Dashboard 快照缓存（Stale-While-Revalidate）。
 * 注册于 globalCacheRegistry['summary.dashboard']，由 DomainMutationBus + Coordinator 统一失效。
 */

import {
  createStaleWhileRevalidateStore,
  globalCacheRegistry,
  type CacheKey
} from '@baishou/shared/cache'

export interface SummaryDashboardStats {
  totalDiaryCount: number
  totalWeeklyCount: number
  totalMonthlyCount: number
  totalQuarterlyCount: number
  totalYearlyCount: number
}

export interface SummaryDashboardSnapshot {
  vaultRevision: number
  stats: SummaryDashboardStats
  /** 日记归档日 → 篇数（热力图稀疏索引） */
  activityByDate: Record<string, number>
  availableYears: number[]
  fetchedAt: number
}

const SUMMARY_DASHBOARD_CACHE_KEY = 'summary.dashboard' satisfies CacheKey

const dashboardStore = createStaleWhileRevalidateStore<SummaryDashboardSnapshot>()
let storeRegistered = false

export function registerSummaryDashboardCacheStore(): void {
  if (storeRegistered) return
  storeRegistered = true
  globalCacheRegistry.register(SUMMARY_DASHBOARD_CACHE_KEY, {
    invalidate: () => dashboardStore.invalidate(),
    clear: () => dashboardStore.clear()
  })
}

export function subscribeSummaryDashboardCache(listener: () => void): () => void {
  registerSummaryDashboardCacheStore()
  return dashboardStore.subscribe(listener)
}

export function peekSummaryDashboardCache(vaultRevision: number): {
  snapshot: SummaryDashboardSnapshot
  stale: boolean
} | null {
  registerSummaryDashboardCacheStore()
  const peek = dashboardStore.peek(String(vaultRevision))
  if (!peek) return null
  return { snapshot: peek.value, stale: peek.stale }
}

export function commitSummaryDashboardCache(
  vaultRevision: number,
  data: Omit<SummaryDashboardSnapshot, 'vaultRevision' | 'fetchedAt'>
): void {
  registerSummaryDashboardCacheStore()
  dashboardStore.commit(String(vaultRevision), {
    ...data,
    vaultRevision,
    fetchedAt: Date.now()
  })
}

export function getSummaryDashboardCacheVersion(): number {
  return dashboardStore.getVersion()
}

/** @deprecated 请改用 DomainMutationBus；保留供过渡期调用 */
export function invalidateSummaryDashboardCache(_reason?: string): void {
  registerSummaryDashboardCacheStore()
  dashboardStore.invalidate()
}

/** 工作区切换：丢弃旧 vault 快照 */
export function clearSummaryDashboardCache(): void {
  registerSummaryDashboardCacheStore()
  dashboardStore.clear()
}
