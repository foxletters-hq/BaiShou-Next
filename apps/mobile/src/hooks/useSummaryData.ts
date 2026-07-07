import { useState, useEffect, useCallback, useRef, useMemo, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { useBaishou } from '../providers/BaishouProvider'
import { logger, type MissingSummary as DetectedMissingSummary } from '@baishou/shared'
import {
  commitSummaryDashboardCache,
  getSummaryDashboardCacheVersion,
  peekSummaryDashboardCache,
  subscribeSummaryDashboardCache,
  type SummaryDashboardSnapshot
} from '../lib/summary-dashboard-cache'
import {
  fetchSummaryDashboardSnapshot,
  filterActivityForYear
} from '../services/summary-dashboard.service'
import { useSummaryGenerationQueue } from './useSummaryGenerationQueue'

interface Summary {
  id: string
  type: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  startDate: string
  endDate: string
  content: string
}

interface Stats {
  totalDiaryCount: number
  totalWeeklyCount: number
  totalMonthlyCount: number
  totalQuarterlyCount: number
  totalYearlyCount: number
}

interface MissingSummary {
  type: string
  startDate: string
  endDate: string
  label?: string
  dateRangeStr?: string
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
  const {
    services,
    dbReady,
    vaultRevision,
    vaultSwitching,
    archiveRestoreEpoch,
    storageIndexing,
    ecosystemResyncEpoch
  } = useBaishou()
  const summaryManager = services?.summaryManager
  const diaryService = services?.diaryService
  const missingSummaryDetector = services?.missingSummaryDetector
  const bootstrapper = services?.bootstrapper
  const autoRescanAttemptedRef = useRef(-1)
  const dashboardFetchRef = useRef(0)
  const scopeKey = String(vaultRevision)

  const cacheVersion = useSyncExternalStore(
    subscribeSummaryDashboardCache,
    getSummaryDashboardCacheVersion
  )
  const cacheInvalidationHandledRef = useRef(false)

  const [summaries, setSummaries] = useState<Summary[]>([])
  const [stats, setStats] = useState<Stats>(EMPTY_STATS)
  const [activityByDate, setActivityByDate] = useState<Record<string, number>>({})
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()])
  const [missingSummaries, setMissingSummaries] = useState<MissingSummary[]>([])
  const [isDetectingMissing, setIsDetectingMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isDashboardRefreshing, setIsDashboardRefreshing] = useState(false)

  const applyDashboardSnapshot = useCallback((snapshot: SummaryDashboardSnapshot) => {
    setStats(snapshotToStats(snapshot))
    setActivityByDate(snapshot.activityByDate)
    setAvailableYears(snapshot.availableYears)
  }, [])

  const hydrateDashboardFromCache = useCallback(() => {
    const peek = peekSummaryDashboardCache(scopeKey)
    if (peek) {
      applyDashboardSnapshot(peek.snapshot)
      return peek.stale
    }
    return true
  }, [applyDashboardSnapshot, scopeKey])

  useEffect(() => {
    setSummaries([])
    setStats(EMPTY_STATS)
    setActivityByDate({})
    setAvailableYears([new Date().getFullYear()])
    setMissingSummaries([])
  }, [vaultRevision])

  const mapDetectedMissing = useCallback(
    (detected: DetectedMissingSummary[]) =>
      detected.map((m) => ({
        type: m.type,
        startDate: m.startDate instanceof Date ? m.startDate.toISOString() : String(m.startDate),
        endDate: m.endDate instanceof Date ? m.endDate.toISOString() : String(m.endDate),
        label: m.label,
        dateRangeStr: `${new Date(m.startDate).toLocaleDateString()} - ${new Date(m.endDate).toLocaleDateString()}`
      })),
    []
  )

  const fetchMissingSummaries = useCallback(async () => {
    if (!dbReady || storageIndexing || vaultSwitching || !missingSummaryDetector) return

    setIsDetectingMissing(true)
    try {
      const detected = await missingSummaryDetector.getAllMissing(i18n.language)
      setMissingSummaries(mapDetectedMissing(detected))
    } catch (e) {
      console.warn('Detect missing summaries failed:', e)
      setMissingSummaries([])
    } finally {
      setIsDetectingMissing(false)
    }
  }, [
    dbReady,
    missingSummaryDetector,
    i18n.language,
    mapDetectedMissing,
    vaultSwitching,
    storageIndexing
  ])

  const refreshDashboard = useCallback(
    async (options?: { force?: boolean }) => {
      if (!dbReady || storageIndexing || vaultSwitching || !summaryManager || !diaryService) return

      const stale = hydrateDashboardFromCache()
      if (!options?.force && !stale) return

      const requestId = ++dashboardFetchRef.current
      setIsDashboardRefreshing(true)
      try {
        const data = await fetchSummaryDashboardSnapshot({ diaryService, summaryManager })
        if (requestId !== dashboardFetchRef.current) return

        commitSummaryDashboardCache(scopeKey, data)
        applyDashboardSnapshot({
          scopeKey,
          fetchedAt: Date.now(),
          ...data
        })
      } catch (e) {
        console.warn('[useSummaryData] refreshDashboard failed:', e)
      } finally {
        if (requestId === dashboardFetchRef.current) {
          setIsDashboardRefreshing(false)
        }
      }
    },
    [
      applyDashboardSnapshot,
      dbReady,
      diaryService,
      hydrateDashboardFromCache,
      storageIndexing,
      summaryManager,
      scopeKey,
      vaultSwitching
    ]
  )

  const fetchSummariesForGallery = useCallback(async () => {
    if (!dbReady || storageIndexing || vaultSwitching || !summaryManager) return

    try {
      setLoading(true)

      let summaryList = await summaryManager.list()

      if (
        summaryList.length === 0 &&
        bootstrapper &&
        autoRescanAttemptedRef.current !== vaultRevision
      ) {
        autoRescanAttemptedRef.current = vaultRevision
        try {
          await bootstrapper.resyncFromDisk()
          summaryList = await summaryManager.list()
          await refreshDashboard({ force: true })
        } catch (e) {
          logger.warn('[useSummaryData] auto resync after empty summary list failed:', e as Error)
        }
      }

      setSummaries(
        summaryList.map((s) => ({
          id: String(s.id),
          type: s.type,
          startDate: s.startDate instanceof Date ? s.startDate.toISOString() : s.startDate,
          endDate: s.endDate instanceof Date ? s.endDate.toISOString() : s.endDate,
          content: s.content
        }))
      )
    } catch (e) {
      console.warn('Failed to fetch summary gallery data', e)
    } finally {
      setLoading(false)
    }
  }, [
    bootstrapper,
    dbReady,
    refreshDashboard,
    storageIndexing,
    summaryManager,
    vaultRevision,
    vaultSwitching
  ])

  useEffect(() => {
    hydrateDashboardFromCache()
    void refreshDashboard()
    void fetchMissingSummaries()
  }, [
    fetchMissingSummaries,
    hydrateDashboardFromCache,
    refreshDashboard,
    vaultRevision,
    ecosystemResyncEpoch,
    archiveRestoreEpoch,
    vaultSwitching
  ])

  useEffect(() => {
    if (!cacheInvalidationHandledRef.current) {
      cacheInvalidationHandledRef.current = true
      return
    }
    void refreshDashboard()
  }, [cacheVersion, refreshDashboard])

  const activityData = useMemo(
    () => filterActivityForYear(activityByDate, selectedYear),
    [activityByDate, selectedYear]
  )

  const fetchData = useCallback(async () => {
    await refreshDashboard({ force: true })
    void fetchMissingSummaries()
    await fetchSummariesForGallery()
  }, [fetchMissingSummaries, fetchSummariesForGallery, refreshDashboard])

  const {
    generationStates,
    isGenerating,
    queueGeneration,
    stopGeneration,
    generateSummary,
    setConcurrency
  } = useSummaryGenerationQueue({
    dbReady,
    services: services ?? null,
    i18n,
    onRefreshData: fetchData
  })

  return {
    summaries,
    stats,
    activityData,
    availableYears,
    missingSummaries,
    setMissingSummaries,
    generateSummary,
    queueGeneration,
    stopGeneration,
    setConcurrency,
    generationStates,
    isDetectingMissing,
    isDashboardRefreshing,
    refreshDashboard,
    refreshSummaries: fetchSummariesForGallery,
    refreshData: fetchData,
    refreshMissing: fetchMissingSummaries,
    loading,
    isGenerating
  }
}
