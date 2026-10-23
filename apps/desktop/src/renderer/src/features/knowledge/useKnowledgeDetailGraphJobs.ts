import { useCallback, useMemo, useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import { callKnowledgeApi } from './call-knowledge-api'
import { knowledgeIngestUserMessage } from './knowledge-ingest-user-error.util'
import {
  formatNotebookGraphProgress,
  graphPageSpan,
  notebookGraphProgressCopy,
  type NotebookGraphJobsState
} from './notebook-graph-progress.util'

/**
 * 知识库详情页的图谱任务状态与进度轮询。
 * 与 OCR/向量化进度分开，避免详情页主 Hook 继续膨胀。
 */
export function useKnowledgeDetailGraphJobs(notebookId: string, t: TFunction) {
  const [graphBusy, setGraphBusy] = useState(false)
  const [graphJobs, setGraphJobs] = useState<NotebookGraphJobsState>({
    pending: 0,
    running: 0,
    failed: 0,
    currentSourceId: null,
    currentSourceTitle: null,
    lastError: null,
    failedSourceTitle: null,
    statusBySourceId: {},
    jobsBySourceId: {}
  })
  const [graphKnownTotal, setGraphKnownTotal] = useState(0)
  const [graphWindowProgress, setGraphWindowProgress] = useState<{
    done: number
    total: number
    pageFrom?: number
    pageTo?: number
    pageTotal?: number
  } | null>(null)
  const [leftoverIngestSourceIds, setLeftoverIngestSourceIds] = useState<string[]>([])
  const [reprocessWatching, setReprocessWatching] = useState(false)
  const reprocessSawWorkRef = useRef(false)

  const refreshGraphJobs = useCallback(async () => {
    if (!notebookId) return
    try {
      const snap = await callKnowledgeApi<{
        pending: number
        running: number
        failed: number
        currentSourceId: string | null
        currentSourceTitle: string | null
        lastError?: string | null
        failedSourceTitle?: string | null
        windowsDone?: number
        windowsTotal?: number
        pageFrom?: number
        pageTo?: number
        pageTotal?: number
        leftoverIngestSourceIds?: string[]
        items?: Array<{
          sourceId: string
          status: string
          lastError?: string | null
          windowsDone?: number
          windowsTotal?: number
          pageFrom?: number
          pageTo?: number
          pageTotal?: number
        }>
      }>('listGraphJobs', 'knowledge:list-graph-jobs', notebookId)
      const statusBySourceId: Record<string, string> = {}
      const jobsBySourceId: NotebookGraphJobsState['jobsBySourceId'] = {}
      for (const item of snap?.items ?? []) {
        const sourceId = item.sourceId?.trim()
        if (!sourceId) continue
        statusBySourceId[sourceId] = item.status
        jobsBySourceId[sourceId] = {
          sourceId,
          status: item.status,
          lastError: item.lastError,
          windowsDone: item.windowsDone,
          windowsTotal: item.windowsTotal,
          pageFrom: item.pageFrom,
          pageTo: item.pageTo,
          pageTotal: item.pageTotal
        }
      }
      setGraphJobs(
        snap
          ? {
              pending: snap.pending,
              running: snap.running,
              failed: snap.failed,
              currentSourceId: snap.currentSourceId,
              currentSourceTitle: snap.currentSourceTitle,
              lastError: snap.lastError ?? null,
              failedSourceTitle: snap.failedSourceTitle ?? null,
              statusBySourceId,
              jobsBySourceId
            }
          : {
              pending: 0,
              running: 0,
              failed: 0,
              currentSourceId: null,
              currentSourceTitle: null,
              lastError: null,
              failedSourceTitle: null,
              statusBySourceId: {},
              jobsBySourceId: {}
            }
      )
      setLeftoverIngestSourceIds(snap?.leftoverIngestSourceIds ?? [])
      if ((snap?.pending || 0) > 0) {
        setGraphKnownTotal((prev) => Math.max(prev, snap.pending))
      }
      if ((snap?.windowsTotal || 0) > 0) {
        setGraphWindowProgress((prev) => {
          const total = Math.max(prev?.total ?? 0, snap.windowsTotal ?? 0)
          const done = Math.min(total, Math.max(prev?.done ?? 0, snap.windowsDone ?? 0))
          const pages =
            (snap.windowsDone ?? 0) >= (prev?.done ?? 0)
              ? (graphPageSpan(snap) ?? graphPageSpan(prev))
              : (graphPageSpan(prev) ?? graphPageSpan(snap))
          return {
            done,
            total,
            pageFrom: pages?.pageFrom,
            pageTo: pages?.pageTo,
            pageTotal: pages?.pageTotal
          }
        })
      }
      if ((snap?.pending || 0) === 0 && (snap?.running || 0) === 0 && (snap?.failed || 0) === 0) {
        setGraphWindowProgress(null)
      }
    } catch {
      /* 旧进程未注册通道时忽略，完全重启后即可 */
    }
  }, [notebookId])

  const graphProgress = useMemo(
    () =>
      formatNotebookGraphProgress(
        notebookGraphProgressCopy({
          pending: graphJobs.pending,
          running: graphJobs.running,
          failed: graphJobs.failed,
          currentSourceTitle: graphJobs.currentSourceTitle,
          knownTotal: graphKnownTotal,
          windowsDone: graphWindowProgress?.done,
          windowsTotal: graphWindowProgress?.total,
          pageFrom: graphWindowProgress?.pageFrom,
          pageTo: graphWindowProgress?.pageTo,
          pageTotal: graphWindowProgress?.pageTotal,
          lastError: graphJobs.lastError
            ? knowledgeIngestUserMessage(graphJobs.lastError, t)
            : null,
          failedSourceTitle: graphJobs.failedSourceTitle
        }),
        (key, params) => t(key, params)
      ),
    [graphJobs, graphKnownTotal, graphWindowProgress, t]
  )

  return {
    graphBusy,
    setGraphBusy,
    graphJobs,
    setGraphJobs,
    graphKnownTotal,
    setGraphKnownTotal,
    graphWindowProgress,
    setGraphWindowProgress,
    graphProgress,
    refreshGraphJobs,
    leftoverIngestSourceIds,
    reprocessWatching,
    setReprocessWatching,
    reprocessSawWorkRef
  }
}
