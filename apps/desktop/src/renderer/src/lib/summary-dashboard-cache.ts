/**
 * Desktop 总结/回忆面板 Dashboard 快照缓存（Stale-While-Revalidate）。
 * 注册于 globalCacheRegistry['summary.dashboard']，由 DomainMutationBus + Coordinator 统一失效。
 */

import {
  createStaleWhileRevalidateStore,
  globalCacheRegistry,
  type CacheKey,
  type SummaryDashboardSnapshot
} from '@baishou/shared/cache'

export type { SummaryDashboardSnapshot, SummaryDashboardStats } from '@baishou/shared/cache'

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

export function peekSummaryDashboardCache(scopeKey: string): {
  snapshot: SummaryDashboardSnapshot
  stale: boolean
} | null {
  registerSummaryDashboardCacheStore()
  const peek = dashboardStore.peek(scopeKey)
  if (!peek) return null
  return { snapshot: peek.value, stale: peek.stale }
}

export function commitSummaryDashboardCache(
  scopeKey: string,
  data: Omit<SummaryDashboardSnapshot, 'scopeKey' | 'fetchedAt'>
): void {
  registerSummaryDashboardCacheStore()
  dashboardStore.commit(scopeKey, {
    ...data,
    scopeKey,
    fetchedAt: Date.now()
  })
}

export function getSummaryDashboardCacheVersion(): number {
  return dashboardStore.getVersion()
}
