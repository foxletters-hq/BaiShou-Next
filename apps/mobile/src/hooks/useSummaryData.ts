import { useState, useEffect, useCallback, useRef, useMemo, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { useBaishou } from '../providers/BaishouProvider'
import {
  logger,
  type MissingSummary as DetectedMissingSummary,
  formatLocalDate
} from '@baishou/shared'
import {
  commitSummaryDashboardCache,
  getSummaryDashboardCacheVersion,
  peekSummaryDashboardCache,
  subscribeSummaryDashboardCache,
  type SummaryDashboardSnapshot
} from '../lib/summary-dashboard-cache'
import {
  clearAllSummaryDetailPatches,
  reconcileSummaryContentPatches
} from '../screens/SummaryScreen/utils/summaryDetailCache'
import {
  parseSummaryBoundaryDate,
  summaryDateToStorageKey
} from '../screens/SummaryScreen/utils/summary-detail.helpers'
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
  generatedAt?: string
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
  const hasGalleryDataRef = useRef(false)
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
    const nextStats = snapshotToStats(snapshot)
    setStats((prev) =>
      prev.totalDiaryCount === nextStats.totalDiaryCount &&
      prev.totalWeeklyCount === nextStats.totalWeeklyCount &&
      prev.totalMonthlyCount === nextStats.totalMonthlyCount &&
      prev.totalQuarterlyCount === nextStats.totalQuarterlyCount &&
      prev.totalYearlyCount === nextStats.totalYearlyCount
        ? prev
        : nextStats
    )
    setActivityByDate((prev) => (prev === snapshot.activityByDate ? prev : snapshot.activityByDate))
    setAvailableYears((prev) => {
      const next = snapshot.availableYears
      if (prev.length === next.length && prev.every((year, index) => year === next[index])) {
        return prev
      }
      return next
    })
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
    hasGalleryDataRef.current = false
    setStats(EMPTY_STATS)
    setActivityByDate({})
    setAvailableYears([new Date().getFullYear()])
    setMissingSummaries([])
    clearAllSummaryDetailPatches()
  }, [vaultRevision])

  const mapDetectedMissing = useCallback(
    (detected: DetectedMissingSummary[]) =>
      detected.map((m) => {
        const startKey = summaryDateToStorageKey(m.startDate)
        const endKey = summaryDateToStorageKey(m.endDate)
        const startLocal = parseSummaryBoundaryDate(startKey)
        const endLocal = parseSummaryBoundaryDate(endKey)
        return {
          type: m.type,
          startDate: startKey,
          endDate: endKey,
          label: m.label,
          dateRangeStr: `${startLocal.toLocaleDateString()} - ${endLocal.toLocaleDateString()}`
        }
      }),
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
      if (!hasGalleryDataRef.current) {
        setLoading(true)
      }

      let summaryList = await summaryManager.listForGallery()

      if (
        summaryList.length === 0 &&
        bootstrapper &&
        bootstrapper.getStatus() !== 'running' &&
        !storageIndexing &&
        !vaultSwitching &&
        autoRescanAttemptedRef.current !== vaultRevision
      ) {
        autoRescanAttemptedRef.current = vaultRevision
        try {
          await bootstrapper.resyncFromDisk()
          summaryList = await summaryManager.listForGallery()
          await refreshDashboard({ force: true })
        } catch (e) {
          logger.warn('[useSummaryData] auto resync after empty summary list failed:', e as Error)
        }
      }

      const mapped = summaryList.map((s) => ({
        id: String(s.id),
        type: s.type,
        startDate: s.startDate instanceof Date ? formatLocalDate(s.startDate) : s.startDate,
        endDate: s.endDate instanceof Date ? formatLocalDate(s.endDate) : s.endDate,
        content: s.content,
        generatedAt:
          s.generatedAt instanceof Date
            ? s.generatedAt.toISOString()
            : s.generatedAt != null
              ? String(s.generatedAt)
              : undefined
      }))
      // DB 仍空时保留本地已保存正文，避免刚编辑的预览被清空
      setSummaries(reconcileSummaryContentPatches(mapped))
      hasGalleryDataRef.current = summaryList.length > 0
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

  const fetchMissingSummariesRef = useRef(fetchMissingSummaries)
  fetchMissingSummariesRef.current = fetchMissingSummaries

  const refreshDashboardRef = useRef(refreshDashboard)
  refreshDashboardRef.current = refreshDashboard

  const fetchSummariesForGalleryRef = useRef(fetchSummariesForGallery)
  fetchSummariesForGalleryRef.current = fetchSummariesForGallery

  useEffect(() => {
    hydrateDashboardFromCache()
    void refreshDashboardRef.current()
    void fetchMissingSummariesRef.current()
    if (!vaultSwitching && !storageIndexing) {
      void fetchSummariesForGalleryRef.current()
    }
  }, [
    hydrateDashboardFromCache,
    vaultRevision,
    ecosystemResyncEpoch,
    archiveRestoreEpoch,
    vaultSwitching,
    storageIndexing
  ])

  useEffect(() => {
    if (!cacheInvalidationHandledRef.current) {
      cacheInvalidationHandledRef.current = true
      return
    }
    void refreshDashboardRef.current()
  }, [cacheVersion])

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
