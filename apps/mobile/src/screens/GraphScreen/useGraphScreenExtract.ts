import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from 'react-native'
import {
  GRAPH_ALIGN_MIN_SIMILARITY_PERCENT,
  GRAPH_EXTRACT_CONCURRENCY_MAX,
  GRAPH_EXTRACT_CONCURRENCY_MIN,
  emptyGraphExtractQueueSnapshot,
  formatLocalDate,
  graphExtractOverallProgress
} from '@baishou/shared'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import { mobileResolveJournalForExtract } from '@/src/services/mobile-graph.service'
import {
  mobileGraphExtractQueue,
  type GraphExtractQueueSnapshot
} from '@/src/services/mobile-graph-extract-queue.service'
import { ensureMobileGraphSelfName } from '../DiaryScreen/ensure-graph-self-name'
import {
  buildGraphQueueByPath,
  graphExtractAlreadyQueued,
  graphExtractErrorCopy,
  graphExtractRequestedPaths
} from './graph-screen-derive.util'
import { isGraphExtractDate } from './graph-screen-view.util'
import type { GraphScreenTranslateFn } from './graph-screen.types'

type ExtractDeps = {
  t: GraphScreenTranslateFn
  toast: {
    showSuccess: (message: string) => void
    showError: (message: string) => void
    showInfo: (message: string) => void
  }
  dialog: { confirm: (message: string, title?: string) => Promise<boolean> }
  services: {
    settingsManager: unknown
    pathService: unknown
    fileSystem: unknown
    ragService: { getPendingEmbedCounts?: () => Promise<{ diaries?: number }> }
  } | null
  vaultId: string
  vaultName: string
  pending: Array<{ filePath?: string }>
  setStatus: (status: string) => void
  setSelfNameReady: (ready: boolean) => void
  setDismissGuide: (dismiss: boolean) => void
  refreshRef: { current: () => Promise<void> }
}

export function useGraphScreenExtract(deps: ExtractDeps) {
  const [extractRunning, setExtractRunning] = useState(false)
  const [extractConcurrency, setExtractConcurrency] = useState(() =>
    mobileGraphExtractQueue.getConcurrency()
  )
  const [extractDate, setExtractDate] = useState(() => formatLocalDate(new Date()))
  const [extractQueue, setExtractQueue] = useState<GraphExtractQueueSnapshot | null>(null)
  const [queueModalOpen, setQueueModalOpen] = useState(false)

  const applyQueueSnapshot = useCallback(
    (state: GraphExtractQueueSnapshot) => {
      setExtractQueue(state)
      const running =
        state.pendingCount > 0 || state.runningCount > 0 || (state.aligningCount ?? 0) > 0
      setExtractRunning(running)
      if (running) {
        const total = state.items.length
        const current = Math.min(
          state.completedCount + state.runningCount + (state.aligningCount ?? 0),
          total
        )
        deps.setStatus(
          deps.t(
            'graph.extract_queue_progress',
            '后台整理中 {{current}}/{{total}} · {{percent}}%（可继续添加）',
            {
              current,
              total,
              percent: state.overallProgress ?? graphExtractOverallProgress(state.items)
            }
          )
        )
      } else if (state.completedCount > 0 || state.errorCount > 0) {
        deps.setStatus(
          deps.t('graph.extract_done', '完成 {{done}}，失败 {{failed}}', {
            done: state.completedCount,
            failed: state.errorCount
          })
        )
        void deps.refreshRef.current()
      }
    },
    // applyQueueSnapshot 只读翻译与状态入口，deps 对象每次渲染都会换引用
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 见上
    [deps.t, deps.setStatus, deps.refreshRef]
  )

  const queueByPath = useMemo(
    () => buildGraphQueueByPath(extractQueue?.items ?? []),
    [extractQueue]
  )

  useEffect(() => {
    return mobileGraphExtractQueue.subscribe(applyQueueSnapshot)
  }, [applyQueueSnapshot])

  const confirmBatchExtract = (): Promise<boolean> => {
    const count = deps.pending.length
    if (count <= 0) return Promise.resolve(false)
    return new Promise((resolve) => {
      Alert.alert(
        deps.t('graph.process_pending_reextract_title', '梳理待重抽'),
        deps.t(
          'graph.confirm_batch_extract',
          '将把 {{count}} 篇待重抽日记加入整理队列。最多同时 {{concurrency}} 篇调用模型，攒满 10 篇或本批抽完后，召回相似度大于 {{similarity}}% 的候选并由模型判断是否合并再写入。',
          {
            count,
            concurrency: extractConcurrency,
            similarity: GRAPH_ALIGN_MIN_SIMILARITY_PERCENT
          }
        ),
        [
          { text: deps.t('common.cancel', '取消'), style: 'cancel', onPress: () => resolve(false) },
          { text: deps.t('common.confirm', '开始'), onPress: () => resolve(true) }
        ]
      )
    })
  }

  const runExtract = async (filePaths?: string[]) => {
    if (!deps.services) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    const selfName = await ensureMobileGraphSelfName({
      settingsManager: deps.services.settingsManager as never
    })
    if (!selfName) {
      deps.setSelfNameReady(false)
      deps.setStatus(deps.t('graph.self_name_required', '请先在关系图谱页完成唤醒后再抽取'))
      deps.toast.showError(deps.t('graph.self_name_required', '请先在关系图谱页完成唤醒后再抽取'))
      return
    }
    if (!filePaths?.length) {
      const ok = await confirmBatchExtract()
      if (!ok) return
    }
    deps.setSelfNameReady(true)
    deps.setDismissGuide(true)
    try {
      const pendingCounts = await deps.services.ragService.getPendingEmbedCounts?.()
      if ((pendingCounts?.diaries ?? 0) > 0) {
        const message = deps.t(
          'graph.extract_blocked_pending_embed',
          '有 {{count}} 篇日记还没有嵌入，先补齐嵌入再整理关系',
          { count: pendingCounts!.diaries }
        )
        deps.toast.showInfo(message)
        deps.setStatus(message)
        return
      }
      const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), deps.vaultId)
      const result = await mobileGraphExtractQueue.enqueue(
        { filePaths, concurrency: extractConcurrency },
        {
          vaultId: deps.vaultId,
          vaultName: deps.vaultName,
          drizzleDb: runtime.drizzleDb,
          shadowRepo,
          pathService: deps.services.pathService as never,
          fileSystem: deps.services.fileSystem as never,
          settingsManager: deps.services.settingsManager as never
        }
      )
      if (result.skippedNotEmbedded?.length) {
        deps.toast.showInfo(
          deps.t('graph.extract_skipped_not_embedded', '有 {{count}} 篇日记尚未嵌入，已跳过', {
            count: result.skippedNotEmbedded.length
          })
        )
      }
      if (result.queued === 0) {
        const requested = graphExtractRequestedPaths(filePaths, deps.pending)
        if (graphExtractAlreadyQueued(requested, queueByPath)) {
          deps.setStatus(deps.t('graph.extract_already_queued', '已在整理队列中'))
          deps.toast.showInfo(deps.t('graph.extract_already_queued', '已在整理队列中'))
        } else if (result.skippedNotEmbedded?.length) {
          deps.setStatus(
            deps.t('graph.extract_diary_not_embedded', '这篇日记还没有向量，请先嵌入后再抽取')
          )
          deps.toast.showInfo(
            deps.t('graph.extract_diary_not_embedded', '这篇日记还没有向量，请先嵌入后再抽取')
          )
        } else {
          deps.setStatus(deps.t('graph.extract_nothing', '没有可抽取的日记'))
          deps.toast.showInfo(deps.t('graph.extract_nothing', '没有可抽取的日记'))
        }
        return
      }
      setExtractRunning(true)
      const queued = deps.t(
        'graph.extract_queued',
        '已加入整理队列（{{count}} 篇），可继续点其他日记',
        {
          count: result.queued
        }
      )
      deps.setStatus(queued)
      deps.toast.showSuccess(queued)
    } catch (e: any) {
      const message = e?.message || String(e)
      const copy = graphExtractErrorCopy(message)
      const friendly = copy ? deps.t(copy.key, copy.fallback) : message
      deps.setStatus(friendly)
      deps.toast.showError(friendly)
    }
  }

  const runExtractOne = async () => {
    if (!deps.services) return
    const date = extractDate.trim()
    if (!isGraphExtractDate(date)) {
      deps.toast.showError(
        deps.t('graph.extract_one_not_found', '这一天没有日记，或影子索引里还没有路径。')
      )
      return
    }
    try {
      const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), deps.vaultId)
      const resolved = await mobileResolveJournalForExtract(date, shadowRepo)
      if (!resolved?.filePath) {
        deps.toast.showError(
          deps.t('graph.extract_one_not_found', '这一天没有日记，或影子索引里还没有路径。')
        )
        return
      }
      const ok = await deps.dialog.confirm(
        deps.t(
          'graph.confirm_extract_one',
          '将把 {{date}} 这篇日记加入整理队列。系统写出的关系会被这次结果替换；你手改过的边会留下。',
          { date }
        ),
        deps.t('graph.extract_one_title', '重新梳理这篇日记')
      )
      if (!ok) return
      await runExtract([resolved.filePath])
    } catch (e: any) {
      deps.toast.showError(e?.message || String(e))
    }
  }

  const stopExtract = () => {
    mobileGraphExtractQueue.stop()
    setExtractRunning(false)
    setExtractQueue(emptyGraphExtractQueueSnapshot())
    setQueueModalOpen(false)
    deps.setStatus(deps.t('graph.extract_stopped', '已停止后台整理'))
    void deps.refreshRef.current()
  }

  const cancelQueueItem = (filePath: string) => {
    mobileGraphExtractQueue.cancelItem(filePath)
  }

  const changeExtractConcurrency = (n: number) => {
    setExtractConcurrency(mobileGraphExtractQueue.setConcurrency(n))
  }

  return {
    extractRunning,
    setExtractRunning,
    extractConcurrency,
    extractDate,
    setExtractDate,
    extractQueue,
    setExtractQueue,
    queueModalOpen,
    setQueueModalOpen,
    queueByPath,
    runExtract,
    runExtractOne,
    stopExtract,
    cancelQueueItem,
    changeExtractConcurrency,
    GRAPH_EXTRACT_CONCURRENCY_MIN,
    GRAPH_EXTRACT_CONCURRENCY_MAX
  }
}
