import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { graphPageSpan } from './notebook-graph-progress.util'
import type { KnowledgeOcrProgressState } from './knowledge-detail.types'

type GraphWindowProgress = {
  done: number
  total: number
  pageFrom?: number
  pageTo?: number
  pageTotal?: number
}

export function useKnowledgeDetailJobWatch(input: {
  refresh: () => Promise<void>
  refreshGraphJobs: () => Promise<void>
  setOcrProgressBySource: Dispatch<SetStateAction<Record<string, KnowledgeOcrProgressState>>>
  setGraphWindowProgress: Dispatch<SetStateAction<GraphWindowProgress | null>>
  graphBusy: boolean
  graphJobs: { pending: number; running: number }
  reprocessWatching: boolean
  setReprocessWatching: (value: boolean) => void
  reprocessSawWorkRef: MutableRefObject<boolean>
  hasActiveIngest: boolean
  vectorPending: number
  setVectorKnownTotal: Dispatch<SetStateAction<number>>
  setStatus: (message: string) => void
  t: TFunction
}): void {
  const {
    refresh,
    refreshGraphJobs,
    setOcrProgressBySource,
    setGraphWindowProgress,
    graphBusy,
    graphJobs,
    reprocessWatching,
    setReprocessWatching,
    reprocessSawWorkRef,
    hasActiveIngest,
    vectorPending,
    setVectorKnownTotal,
    setStatus,
    t
  } = input

  useEffect(() => {
    const unsubscribe = window.api.knowledge.onOcrProgress?.((progress) => {
      if (progress.total <= 0) {
        setOcrProgressBySource((prev) => {
          if (!prev[progress.sourceId]) return prev
          const next = { ...prev }
          delete next[progress.sourceId]
          return next
        })
        void refresh().catch(() => undefined)
        return
      }
      setOcrProgressBySource((prev) => ({
        ...prev,
        [progress.sourceId]: {
          page: progress.page,
          total: progress.total,
          phase: progress.phase
        }
      }))
      if (progress.page >= progress.total && progress.total > 0) {
        void refresh().catch(() => undefined)
      }
    })
    return () => {
      unsubscribe?.()
    }
  }, [refresh, setOcrProgressBySource])

  useEffect(() => {
    const onProgress = (progress?: {
      windowsDone?: number
      windowsTotal?: number
      pageFrom?: number
      pageTo?: number
      pageTotal?: number
    }) => {
      if (typeof progress?.windowsTotal === 'number' && progress.windowsTotal > 0) {
        const pages = graphPageSpan(progress)
        setGraphWindowProgress({
          done: Number(progress.windowsDone ?? 0),
          total: progress.windowsTotal,
          pageFrom: pages?.pageFrom,
          pageTo: pages?.pageTo,
          pageTotal: pages?.pageTotal
        })
      }
      void refreshGraphJobs()
      void refresh().catch(() => undefined)
    }
    const unsubscribe = window.api.knowledge.onGraphProgress?.(onProgress)
    let fallback: (() => void) | undefined
    if (!unsubscribe && typeof window.electron?.ipcRenderer?.on === 'function') {
      const handler = (
        _event: unknown,
        progress?: {
          windowsDone?: number
          windowsTotal?: number
          pageFrom?: number
          pageTo?: number
          pageTotal?: number
        }
      ) => onProgress(progress)
      const off = window.electron.ipcRenderer.on('knowledge:graph-progress', handler)
      fallback = typeof off === 'function' ? off : undefined
    }
    return () => {
      unsubscribe?.()
      fallback?.()
    }
  }, [refresh, refreshGraphJobs, setGraphWindowProgress])

  useEffect(() => {
    if (graphJobs.pending <= 0 && graphJobs.running <= 0 && !graphBusy && !reprocessWatching) return
    const timer = window.setInterval(() => {
      void refreshGraphJobs()
    }, 1000)
    return () => window.clearInterval(timer)
  }, [graphBusy, graphJobs.pending, graphJobs.running, refreshGraphJobs, reprocessWatching])

  useEffect(() => {
    if (!reprocessWatching) return
    const active = hasActiveIngest || graphJobs.pending > 0 || graphJobs.running > 0
    if (active) {
      reprocessSawWorkRef.current = true
      return
    }
    if (!reprocessSawWorkRef.current) return
    setReprocessWatching(false)
    setStatus(t('knowledge.data_manage_reprocess_done', '重新整理已完成'))
  }, [
    graphJobs.pending,
    graphJobs.running,
    hasActiveIngest,
    reprocessSawWorkRef,
    reprocessWatching,
    setReprocessWatching,
    setStatus,
    t
  ])

  useEffect(() => {
    if (vectorPending > 0) {
      setVectorKnownTotal((prev) => Math.max(prev, vectorPending))
      return
    }
    if (!reprocessWatching && !hasActiveIngest) setVectorKnownTotal(0)
  }, [hasActiveIngest, reprocessWatching, setVectorKnownTotal, vectorPending])
}
