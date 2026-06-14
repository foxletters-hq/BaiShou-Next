import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { logger } from '@baishou/shared'

export function useSummaryData() {
  const { i18n } = useTranslation()
  const [summaries, setSummaries] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalDiaryCount: 0,
    totalWeeklyCount: 0,
    totalMonthlyCount: 0,
    totalQuarterlyCount: 0,
    totalYearlyCount: 0
  })
  const [missingSummaries, setMissingSummaries] = useState<any[]>([])
  const [isDetectingMissing, setIsDetectingMissing] = useState(false)
  const [generationStates, setGenerationStates] = useState<
    Record<string, { progress: number; phase: number; status: string; error?: string }>
  >({})

  const fetchMissingSummaries = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electron) return

    setIsDetectingMissing(true)
    try {
      const missing = await window.electron.ipcRenderer.invoke(
        'summary:detect-missing',
        i18n.language
      )
      logger.info(`[RENDERER-DEBUG] summary:detect-missing → ${missing?.length ?? 0} items`)
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
    if (typeof window === 'undefined' || !window.electron) return

    setIsDetectingMissing(true)

    const [listResult, statsResult, missingResult] = await Promise.allSettled([
      window.electron.ipcRenderer.invoke('summary:list'),
      window.electron.ipcRenderer.invoke('summary:stats'),
      window.electron.ipcRenderer.invoke('summary:detect-missing', i18n.language)
    ])

    if (listResult.status === 'fulfilled') {
      setSummaries(listResult.value || [])
    } else {
      logger.warn('[SummaryData] summary:list failed:', listResult.reason)
      setSummaries([])
    }

    if (statsResult.status === 'fulfilled') {
      const st = statsResult.value
      logger.info('[RENDERER-DEBUG] summary:stats →', st)
      setStats({
        totalDiaryCount: st?.totalDiaryCount || 0,
        totalWeeklyCount: st?.weeklyCount || 0,
        totalMonthlyCount: st?.monthlyCount || 0,
        totalQuarterlyCount: st?.quarterlyCount || 0,
        totalYearlyCount: st?.yearlyCount || 0
      })
    } else {
      logger.warn('[SummaryData] summary:stats failed:', statsResult.reason)
    }

    if (missingResult.status === 'fulfilled') {
      const missing = missingResult.value
      logger.info(`[RENDERER-DEBUG] summary:detect-missing → ${missing?.length ?? 0} items`)
      setMissingSummaries(missing || [])
    } else {
      logger.warn('[SummaryData] summary:detect-missing failed:', missingResult.reason)
      setMissingSummaries([])
    }

    setIsDetectingMissing(false)
  }, [i18n.language])

  useEffect(() => {
    fetchData()
    fetchQueueState()
  }, [fetchData, fetchQueueState])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electron) {
      const handler = (_event: any, queue: any[]) => {
        const map: Record<
          string,
          { progress: number; phase: number; status: string; error?: string }
        > = {}
        queue.forEach((q) => {
          map[q.id] = { progress: q.progress, phase: q.phaseIdx, status: q.status, error: q.error }
        })
        setGenerationStates(map)

        // If something completed, eagerly refresh data after a short delay
        if (queue.some((q) => q.status === 'completed')) {
          setTimeout(fetchData, 1000)
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
        logger.info('[SummaryData] summary:file-changed event received, reloading summaries...')
        fetchData()
      }
      const removeListener = window.electron.ipcRenderer.on('summary:file-changed', handler)
      return () => removeListener()
    }
    return undefined
  }, [fetchData])

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
    missingSummaries,
    setMissingSummaries,
    queueGeneration,
    stopGeneration,
    setConcurrency,
    generationStates,
    isDetectingMissing,
    refreshData: fetchData,
    refreshMissing: fetchMissingSummaries
  }
}
