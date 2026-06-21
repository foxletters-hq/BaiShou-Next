import { useState, useEffect, useCallback, useRef, useMemo, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { useBaishou } from '../providers/BaishouProvider'
import { resolveSummaryConfig } from '../services/mobile-summary-config.util'
import { SummaryType, logger, type MissingSummary as DetectedMissingSummary } from '@baishou/shared'
import { appendVaultDebugLog } from '../services/summary-debug-log.util'
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

interface GenerationState {
  progress: number
  phase: number
  status: 'pending' | 'running' | 'completed' | 'error'
  error?: string
}

interface QueueItem {
  id: string
  target: MissingSummary
  progress: number
  phaseIdx: number
  status: 'pending' | 'running' | 'completed' | 'error'
  error?: string
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
  const [generationStates, setGenerationStates] = useState<Record<string, GenerationState>>({})
  const [loading, setLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDashboardRefreshing, setIsDashboardRefreshing] = useState(false)

  const queueRef = useRef<QueueItem[]>([])
  const activeCountRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const concurrencyLimitRef = useRef(1)
  const isSchedulingRef = useRef(false)

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
    if (!dbReady || storageIndexing || !missingSummaryDetector) return

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
    archiveRestoreEpoch,
    ecosystemResyncEpoch
  ])

  const refreshDashboard = useCallback(
    async (options?: { force?: boolean }) => {
      if (!dbReady || storageIndexing || !summaryManager || !diaryService) return

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
      scopeKey
    ]
  )

  const fetchSummariesForGallery = useCallback(async () => {
    if (!dbReady || storageIndexing || !summaryManager) return

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
  }, [bootstrapper, dbReady, refreshDashboard, storageIndexing, summaryManager, vaultRevision])

  useEffect(() => {
    hydrateDashboardFromCache()
    void refreshDashboard()
    void fetchMissingSummaries()
  }, [
    fetchMissingSummaries,
    hydrateDashboardFromCache,
    refreshDashboard,
    vaultRevision,
    ecosystemResyncEpoch
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

  const broadcastState = useCallback(() => {
    const states: Record<string, GenerationState> = {}
    queueRef.current.forEach((item) => {
      states[item.id] = {
        progress: item.progress,
        phase: item.phaseIdx,
        status: item.status,
        error: item.error
      }
    })
    setGenerationStates(states)
  }, [])

  const processTask = useCallback(
    async (task: QueueItem) => {
      const signal = abortControllerRef.current?.signal
      const taskStartTime = Date.now()

      try {
        logger.info(`[SummaryQueue] Starting task: ${task.id}`)
        task.status = 'running'
        task.phaseIdx = 0
        task.progress = 5
        broadcastState()

        await new Promise((r) => setTimeout(r, 500))
        if (signal?.aborted) throw new Error('用户取消了生成')

        if (!services) throw new Error('Services not ready')

        const resolution = await resolveSummaryConfig(services.settingsManager)
        if (!resolution.ok) {
          if (resolution.reason === 'no_api_key') {
            throw new Error(
              `No active provider with API key for summary generation (provider: ${
                resolution.providerName ?? 'unknown'
              })`
            )
          }
          throw new Error('No summary model configured')
        }

        const finalModelId = resolution.modelId

        await appendVaultDebugLog(services.pathService, services.fileSystem, {
          timestamp: new Date().toISOString(),
          event: 'start',
          taskId: task.id,
          targetType: task.target.type,
          modelId: finalModelId,
          providerId: resolution.providerConfig.id,
          usedDialogueFallback: resolution.isFallback
        })

        const target = {
          type: task.target.type as SummaryType,
          startDate: new Date(task.target.startDate),
          endDate: new Date(task.target.endDate),
          label: task.target.label ?? ''
        }
        const stream = services.summaryGenerator.generate(target, finalModelId)

        let finalContent = ''

        for await (const chunk of stream) {
          if (signal?.aborted) {
            task.status = 'error'
            task.error = '用户取消了生成'
            broadcastState()
            break
          }

          if (chunk.includes('STATUS:reading_data')) {
            task.phaseIdx = 1
            task.progress = 25
            broadcastState()
            await new Promise((r) => setTimeout(r, 600))
          } else if (chunk.includes('STATUS:thinking_via_')) {
            logger.info(`[SummaryQueue] Task ${task.id} entered thinking phase: ${chunk}`)
            task.phaseIdx = 2
            task.progress = 50
          } else if (chunk.includes('STATUS:generation_failed_error')) {
            const cleanMsg = chunk.replace('STATUS:generation_failed_error:', '').trim()
            throw new Error(cleanMsg)
          } else if (chunk.includes('STATUS:no_data_error')) {
            logger.warn(`[SummaryQueue] Task ${task.id} skipped: no context data available`)
            task.status = 'completed'
            task.progress = 100
            task.phaseIdx = 4
            broadcastState()
            return
          } else if (!chunk.startsWith('STATUS:')) {
            const textLength = chunk.length
            const stepSize = 12
            let currentIdx = 0
            while (currentIdx < textLength) {
              if (signal?.aborted) {
                break
              }
              const nextPart = chunk.substring(currentIdx, currentIdx + stepSize)
              finalContent += nextPart
              currentIdx += stepSize

              task.phaseIdx = 3
              task.progress = 85
              broadcastState()
              await new Promise((r) => setTimeout(r, 30))
            }
          }
          broadcastState()
        }

        if (task.status === 'error') return

        if (finalContent.trim().length > 0) {
          task.progress = 95
          broadcastState()
          await new Promise((r) => setTimeout(r, 600))

          logger.info(
            `[SummaryQueue] Saving generated summary for task: ${task.id}, content length: ${finalContent.length}`
          )
          await services.summaryManager.save({
            type: task.target.type as SummaryType,
            startDate: new Date(task.target.startDate),
            endDate: new Date(task.target.endDate),
            content: finalContent
          })

          task.status = 'completed'
          task.progress = 100
          task.phaseIdx = 4
          broadcastState()
          logger.info(`[SummaryQueue] Task completed successfully: ${task.id}`)

          await appendVaultDebugLog(services.pathService, services.fileSystem, {
            timestamp: new Date().toISOString(),
            event: 'success',
            taskId: task.id,
            durationMs: Date.now() - taskStartTime,
            contentLength: finalContent.length
          })

          await fetchData()
        } else {
          throw new Error('Generated content was empty.')
        }
      } catch (e: any) {
        logger.error(`[SummaryQueue] Task ${task.id} failed:`, e)
        task.status = 'error'
        task.error = e.message || String(e)
        broadcastState()

        if (services) {
          await appendVaultDebugLog(services.pathService, services.fileSystem, {
            timestamp: new Date().toISOString(),
            event: 'error',
            taskId: task.id,
            durationMs: Date.now() - taskStartTime,
            errorMessage: e?.message || String(e),
            errorStack: e?.stack || ''
          })
        }
      }
    },
    [broadcastState, fetchData, services]
  )

  const scheduleNext = useCallback(async () => {
    if (isSchedulingRef.current) return
    isSchedulingRef.current = true

    try {
      while (
        activeCountRef.current < concurrencyLimitRef.current &&
        queueRef.current.some((q) => q.status === 'pending')
      ) {
        const next = queueRef.current.find((q) => q.status === 'pending')
        if (!next) break

        next.status = 'running'
        next.progress = 5
        activeCountRef.current++
        broadcastState()

        processTask(next).finally(() => {
          activeCountRef.current--
          broadcastState()

          if (!abortControllerRef.current?.signal.aborted) {
            scheduleNext()
          }

          if (activeCountRef.current === 0) {
            abortControllerRef.current = null
            setIsGenerating(false)
            void fetchData()

            setTimeout(() => {
              const hasFinished = queueRef.current.some(
                (q) => q.status === 'completed' || q.status === 'error'
              )
              if (hasFinished) {
                queueRef.current = queueRef.current.filter(
                  (q) => q.status === 'pending' || q.status === 'running'
                )
                broadcastState()
              }
            }, 3000)
          }
        })
      }
    } finally {
      isSchedulingRef.current = false
    }
  }, [broadcastState, fetchData, processTask])

  const queueGeneration = async (items: MissingSummary[], concurrency?: number) => {
    if (!dbReady || !services) return

    if (concurrency !== undefined) {
      concurrencyLimitRef.current = Math.max(1, Math.min(5, concurrency))
    }

    let added = 0
    for (const item of items) {
      const uKey = `${item.type}_${new Date(item.startDate).getTime()}`
      if (!queueRef.current.find((q) => q.id === uKey)) {
        queueRef.current.push({
          id: uKey,
          target: item,
          progress: 0,
          phaseIdx: 0,
          status: 'pending'
        })
        added++
      }
    }

    if (added > 0) {
      if (!abortControllerRef.current) {
        abortControllerRef.current = new AbortController()
      }
      setIsGenerating(true)
      broadcastState()
      await scheduleNext()
    }
  }

  const stopGeneration = async () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null

    for (const item of queueRef.current) {
      if (item.status === 'running' || item.status === 'pending') {
        item.status = 'error'
        item.error = '用户取消了生成'
      }
    }

    queueRef.current = queueRef.current.filter((q) => q.status !== 'error')
    activeCountRef.current = 0
    setIsGenerating(false)
    broadcastState()
  }

  const generateSummary = async (
    type: string,
    dateRange: { startDate: string; endDate: string }
  ) => {
    if (!dbReady || !services) return

    await queueGeneration([
      {
        type,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      }
    ])
  }

  const setConcurrency = useCallback((limit: number) => {
    concurrencyLimitRef.current = Math.max(1, Math.min(5, limit))
  }, [])

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
