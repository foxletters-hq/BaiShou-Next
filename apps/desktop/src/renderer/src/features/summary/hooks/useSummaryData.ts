import { useState, useEffect, useCallback, useRef, useMemo, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { filterActivityForYear } from '@baishou/shared/cache'
import { logger } from '@baishou/shared'
import {
  commitSummaryDashboardCache,
  getSummaryDashboardCacheVersion,
  peekSummaryDashboardCache,
  subscribeSummaryDashboardCache,
  type SummaryDashboardSnapshot
} from '../../../lib/summary-dashboard-cache'
import {
  getDesktopVaultScopeKey,
  isDesktopVaultScopeReady,
  subscribeDesktopVaultScope
} from '../../../cache/desktop-vault-scope'
import { fetchSummaryDashboardSnapshot } from '../services/summary-dashboard.service'

interface Stats {
  totalDiaryCount: number
  totalWeeklyCount: number
  totalMonthlyCount: number
  totalQuarterlyCount: number
  totalYearlyCount: number
}

const EMPTY_STATS: Stats = {
  totalDiaryCount: 0,
  totalWeeklyCount: 0,
  totalMonthlyCount: 0,
  totalQuarterlyCount: 0,
  totalYearlyCount: 0
}

function snapshotToStats(snapshot: SummaryDashboardSnapshot): Stats {
  return snapshot.stats
}

export function useSummaryData(selectedYear: number) {
  const { i18n } = useTranslation()
  const scopeKey = useSyncExternalStore(subscribeDesktopVaultScope, getDesktopVaultScopeKey)
  const scopeReady = useSyncExternalStore(subscribeDesktopVaultScope, isDesktopVaultScopeReady)

  const [summaries, setSummaries] = useState<any[]>([])
  const [stats, setStats] = useState<Stats>(EMPTY_STATS)
  const [activityByDate, setActivityByDate] = useState<Record<string, number>>({})
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()])
  const [missingSummaries, setMissingSummaries] = useState<any[]>([])
  const [isDetectingMissing, setIsDetectingMissing] = useState(false)
  const [generationStates, setGenerationStates] = useState<
    Record<string, { progress: number; phase: number; status: string; error?: string }>
  >({})

  const dashboardFetchRef = useRef(0)
  const cacheVersion = useSyncExternalStore(
    subscribeSummaryDashboardCache,
    getSummaryDashboardCacheVersion
  )
  const cacheInvalidationHandledRef = useRef(false)
  const prevScopeKeyRef = useRef(scopeKey)

  useEffect(() => {
    if (prevScopeKeyRef.current === scopeKey) return
    prevScopeKeyRef.current = scopeKey
    setSummaries([])
    setStats(EMPTY_STATS)
    setActivityByDate({})
    setAvailableYears([new Date().getFullYear()])
    setMissingSummaries([])
  }, [scopeKey])

  const applyDashboardSnapshot = useCallback((snapshot: SummaryDashboardSnapshot) => {
    setStats(snapshotToStats(snapshot))
    setActivityByDate(snapshot.activityByDate)
    setAvailableYears(snapshot.availableYears)
  }, [])

  const hydrateDashboardFromCache = useCallback(() => {
    if (!scopeReady) return true
    const peek = peekSummaryDashboardCache(scopeKey)
    if (peek) {
      applyDashboardSnapshot(peek.snapshot)
      return peek.stale
    }
    return true
  }, [applyDashboardSnapshot, scopeKey, scopeReady])

  const refreshDashboard = useCallback(
    async (options?: { force?: boolean }) => {
      if (!scopeReady || typeof window === 'undefined' || !window.electron) return

      const stale = hydrateDashboardFromCache()
      if (!options?.force && !stale) return

      const requestId = ++dashboardFetchRef.current
      try {
        const data = await fetchSummaryDashboardSnapshot(scopeKey)
        if (requestId !== dashboardFetchRef.current) return

        commitSummaryDashboardCache(scopeKey, data)
        applyDashboardSnapshot({
          scopeKey,
          fetchedAt: Date.now(),
          ...data
        })
      } catch (e) {
        logger.warn('[SummaryData] refreshDashboard failed:', e)
      }
    },
    [applyDashboardSnapshot, hydrateDashboardFromCache, scopeKey, scopeReady]
  )

  const fetchSummariesForGallery = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electron) return
    try {
      const list = await window.electron.ipcRenderer.invoke('summary:list')
      setSummaries(list || [])
    } catch (e) {
      logger.warn('[SummaryData] summary:list failed:', e)
      setSummaries([])
    }
  }, [])

  const fetchMissingSummaries = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electron) return

    setIsDetectingMissing(true)
    try {
      const missing = await window.electron.ipcRenderer.invoke(
        'summary:detect-missing',
        i18n.language
      )
      setMissingSummaries(missing || [])
    } catch (e) {
      logger.warn('[SummaryData] summary:detect-missing failed:', e)
      setMissingSummaries([])
    } finally {
      setIsDetectingMissing(false)
    }
  }, [i18n.language])

  const fetchQueueState = useCallback(async () => {
    if (typeof window !== 'undefined' && window.electron) {
      try {
        const queue = await window.electron.ipcRenderer.invoke('summary:get-queue-state')
        if (queue && Array.isArray(queue)) {
          const map: Record<
            string,
            { progress: number; phase: number; status: string; error?: string }
          > = {}
          queue.forEach((q) => {
            map[q.id] = {
              progress: q.progress,
              phase: q.phaseIdx,
              status: q.status,
              error: q.error
            }
          })
          setGenerationStates(map)
        }
      } catch (e) {
        logger.warn('get-queue-state failed', e)
      }
    }
  }, [])

  const fetchData = useCallback(async () => {
    await refreshDashboard({ force: true })
    void fetchMissingSummaries()
    await fetchSummariesForGallery()
  }, [fetchMissingSummaries, fetchSummariesForGallery, refreshDashboard])

  useEffect(() => {
    if (!scopeReady) return
    hydrateDashboardFromCache()
    void refreshDashboard({ force: true })
    void fetchMissingSummaries()
    void fetchSummariesForGallery()
    fetchQueueState()
  }, [
    fetchMissingSummaries,
    fetchQueueState,
    fetchSummariesForGallery,
    hydrateDashboardFromCache,
    refreshDashboard,
    scopeKey,
    scopeReady
  ])

  useEffect(() => {
    if (!scopeReady) return
    if (!cacheInvalidationHandledRef.current) {
      cacheInvalidationHandledRef.current = true
      return
    }
    void refreshDashboard()
  }, [cacheVersion, refreshDashboard, scopeReady])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electron) {
      const handler = (_event: unknown, queue: any[]) => {
        const map: Record<
          string,
          { progress: number; phase: number; status: string; error?: string }
        > = {}
        queue.forEach((q) => {
          map[q.id] = { progress: q.progress, phase: q.phaseIdx, status: q.status, error: q.error }
        })
        setGenerationStates(map)

        if (queue.some((q) => q.status === 'completed')) {
          setTimeout(() => void fetchData(), 1000)
        }
      }
      const removeListener = window.electron.ipcRenderer.on('summary:queue-progress', handler)
      return () => removeListener()
    }
    return undefined
  }, [fetchData])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electron) {
      const handler = () => {
        void fetchData()
      }
      const removeListener = window.electron.ipcRenderer.on('summary:file-changed', handler)
      return () => removeListener()
    }
    return undefined
  }, [fetchData])

  const activityData = useMemo(
    () => filterActivityForYear(activityByDate, selectedYear),
    [activityByDate, selectedYear]
  )

  const queueGeneration = async (items: any[], concurrency?: number) => {
    if (typeof window !== 'undefined' && window.electron) {
      return window.electron.ipcRenderer.invoke('summary:queue-generation', items, concurrency)
    }
  }

  const setConcurrency = async (limit: number) => {
    if (typeof window !== 'undefined' && window.electron) {
      return window.electron.ipcRenderer.invoke('summary:set-concurrency', limit)
    }
  }

  const stopGeneration = async () => {
    if (typeof window !== 'undefined' && window.electron) {
      return window.electron.ipcRenderer.invoke('summary:stop-generation')
    }
  }

  return {
    summaries,
    stats,
    activityData,
    availableYears,
    scopeKey,
    missingSummaries,
    setMissingSummaries,
    queueGeneration,
    stopGeneration,
    setConcurrency,
    generationStates,
    isDetectingMissing,
    refreshDashboard,
    refreshSummaries: fetchSummariesForGallery,
    refreshData: fetchData,
    refreshMissing: fetchMissingSummaries
  }
}
