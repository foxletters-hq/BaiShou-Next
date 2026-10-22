import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  GRAPH_ALIGN_MIN_SIMILARITY_PERCENT,
  describeGraphExtractPhase,
  emptyGraphExtractQueueSnapshot,
  formatLocalDate,
  graphExtractOverallProgress,
  loadGraphExtractConcurrency,
  localizeAiApiErrorMessage,
  saveGraphExtractConcurrency
} from '@baishou/shared'
import { ensureDesktopGraphSelfName } from '../diary/utils/ensure-graph-self-name'
import { refreshMemoryReadiness } from '../memory/useMemoryReadiness'
import {
  getRagRuntimeSnapshot,
  patchCachedRagActiveState,
  subscribeRagRuntime
} from '../settings/rag-runtime-cache'
import {
  graphCancelQueueItem,
  graphGetQueueState,
  graphOnQueueProgress,
  graphQueueExtract,
  graphSetExtractConcurrency,
  graphStopExtract,
  type GraphExtractQueueSnapshot
} from './graph-extract-queue.api'
import {
  buildGraphQueueByPath,
  graphExtractAlreadyQueued,
  graphExtractErrorCopy,
  graphExtractRequestedPaths
} from './graph-page-derive.util'
import { isGraphExtractDate } from './graph-page-view.util'

type ExtractDeps = {
  t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => string
  toast: {
    showSuccess: (message: string) => void
    showError: (message: string) => void
    showInfo: (message: string) => void
  }
  dialog: {
    confirm: (message: string, title?: string) => Promise<boolean>
  }
  setStatus: (status: string) => void
  setSelfNameReady: (ready: boolean) => void
  setDismissGuide: (dismiss: boolean) => void
  pendingReextract: any[]
  refreshRef: { current: () => Promise<void> }
  navigate: (path: string) => void
}

export function useGraphPageExtract(deps: ExtractDeps) {
  const [extractRunning, setExtractRunning] = useState(false)
  const [extractConcurrency, setExtractConcurrency] = useState(() => loadGraphExtractConcurrency())
  const [extractDate, setExtractDate] = useState(() => formatLocalDate(new Date()))
  const [extractQueue, setExtractQueue] = useState<GraphExtractQueueSnapshot | null>(null)
  const [queueModalOpen, setQueueModalOpen] = useState(false)
  const queueUnsubRef = useRef<(() => void) | null>(null)
  const wasRunningRef = useRef(false)
  const wasBatchEmbeddingRef = useRef(false)
  const depsRef = useRef(deps)
  depsRef.current = deps

  const applyQueueSnapshot = useCallback((state: GraphExtractQueueSnapshot) => {
    const d = depsRef.current
    setExtractQueue(state)
    const running =
      state.pendingCount > 0 || state.runningCount > 0 || (state.aligningCount ?? 0) > 0
    setExtractRunning(running)
    if (running) {
      wasRunningRef.current = true
      const done = state.completedCount + (state.aligningCount ?? 0)
      const total = state.items.length
      const current = Math.min(done, total)
      const activeItems = state.items.filter(
        (it) => it.status === 'running' || it.status === 'aligning'
      )
      const activeItem =
        activeItems.find(
          (it) =>
            it.phase === 'recalling' ||
            it.phase === 'waiting_align' ||
            it.phase === 'aligning' ||
            it.phase === 'writing'
        ) ??
        activeItems.find((it) => it.status === 'running') ??
        activeItems[0]
      const baseText = d.t(
        'graph.extract_queue_progress',
        '后台整理中 {{current}}/{{total}} · {{percent}}%（可继续添加）',
        {
          current,
          total,
          percent: state.overallProgress ?? graphExtractOverallProgress(state.items)
        }
      )
      if (activeItem) {
        const phaseDesc = describeGraphExtractPhase(activeItem)
        const phaseLabel = d.t(phaseDesc.key, phaseDesc.defaultValue, phaseDesc.params)
        const itemLabel = activeItem.date || activeItem.filePath.split(/[/\\]/).pop() || ''
        d.setStatus(`${baseText} · ${itemLabel}（${phaseLabel}）`)
      } else {
        d.setStatus(baseText)
      }
    } else if (state.completedCount > 0 || state.errorCount > 0) {
      d.setStatus(
        d.t('graph.extract_batch_result', '关系整理：完成 {{done}}，失败 {{failed}}', {
          done: state.completedCount,
          failed: state.errorCount
        })
      )
      if (wasRunningRef.current) {
        wasRunningRef.current = false
        if (state.lastError && !getRagRuntimeSnapshot().activeRagState.isRunning) {
          const friendlyError = localizeAiApiErrorMessage(state.lastError, (key, fallback) =>
            d.t(key, fallback)
          )
          patchCachedRagActiveState({ error: friendlyError })
          d.toast.showError(friendlyError)
        }
        void d.refreshRef.current().finally(() => {
          void refreshMemoryReadiness()
        })
      }
    }
  }, [])

  const queueByPath = useMemo(
    () => buildGraphQueueByPath(extractQueue?.items ?? []),
    [extractQueue]
  )

  const queueItemCount = extractQueue?.items.length ?? 0
  const queueOverallPct =
    extractQueue?.overallProgress ??
    (queueItemCount > 0 ? graphExtractOverallProgress(extractQueue?.items ?? []) : 0)

  useEffect(() => {
    let cancelled = false
    void graphGetQueueState()
      .then((state) => {
        if (cancelled) return
        applyQueueSnapshot(state)
      })
      .catch(() => {
        // Preload/main not ready yet (e.g. mid HMR); ignore.
      })
    const unsub = graphOnQueueProgress((state) => {
      applyQueueSnapshot(state)
    })
    queueUnsubRef.current = unsub
    return () => {
      cancelled = true
      queueUnsubRef.current?.()
      queueUnsubRef.current = null
    }
  }, [applyQueueSnapshot])

  useEffect(() => {
    // 新一轮嵌入开始时清掉上一轮抽图的完成/失败文案，
    // 避免「正在嵌入日记」旁边一直挂着旧的「完成 0，失败 74」。
    const apply = () => {
      const state = getRagRuntimeSnapshot().activeRagState
      const embedding = state.isRunning && state.type === 'batchEmbed'
      if (embedding && !wasBatchEmbeddingRef.current) {
        depsRef.current.setStatus('')
      }
      wasBatchEmbeddingRef.current = embedding
    }
    apply()
    return subscribeRagRuntime(apply)
  }, [])

  useEffect(() => {
    void graphSetExtractConcurrency(extractConcurrency).catch(() => undefined)
  }, [extractConcurrency])

  const confirmBatchExtract = async (): Promise<boolean> => {
    const count = deps.pendingReextract.length
    if (count <= 0) return false
    return deps.dialog.confirm(
      deps.t(
        'graph.confirm_batch_extract',
        '将把 {{count}} 篇待重抽日记加入整理队列。最多同时 {{concurrency}} 篇调用模型，攒满 10 篇或本批抽完后，召回相似度大于 {{similarity}}% 的候选并由模型判断是否合并再写入。',
        {
          count,
          concurrency: extractConcurrency,
          similarity: GRAPH_ALIGN_MIN_SIMILARITY_PERCENT
        }
      ),
      deps.t('graph.process_pending_reextract_title', '梳理待重抽')
    )
  }

  const runExtract = async (filePaths?: string[], options?: { skipConfirm?: boolean }) => {
    const selfName = await ensureDesktopGraphSelfName()
    if (!selfName) {
      deps.setSelfNameReady(false)
      deps.setStatus(deps.t('graph.self_name_required', '请先在关系图谱页完成唤醒后再抽取'))
      return
    }
    if (!filePaths?.length && !options?.skipConfirm) {
      const ok = await confirmBatchExtract()
      if (!ok) return
    }
    deps.setSelfNameReady(true)
    deps.setDismissGuide(true)
    try {
      const result = await graphQueueExtract({ filePaths, concurrency: extractConcurrency })
      if (result.blockedPendingEmbed && result.blockedPendingEmbed > 0) {
        const go = await deps.dialog.confirm(
          deps.t(
            'graph.extract_blocked_pending_embed',
            '有 {{count}} 篇日记还没有嵌入，先补齐嵌入再整理关系',
            {
              count: result.blockedPendingEmbed
            }
          ),
          deps.t('graph.extract_blocked_pending_embed_action', '去补齐')
        )
        if (go) deps.navigate('/memory/vectors')
        return
      }
      if (result.skippedNotEmbedded?.length) {
        deps.toast.showInfo(
          deps.t('graph.extract_skipped_not_embedded', '有 {{count}} 篇日记尚未嵌入，已跳过', {
            count: result.skippedNotEmbedded.length
          })
        )
      }
      if (result.queued === 0) {
        const requested = graphExtractRequestedPaths(filePaths, deps.pendingReextract)
        const alreadyQueued = graphExtractAlreadyQueued(requested, queueByPath)
        if (alreadyQueued) {
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
      patchCachedRagActiveState({ error: undefined })
      setExtractRunning(true)
      setQueueModalOpen(true)
      deps.setStatus(
        deps.t('graph.extract_queued', '已加入整理队列（{{count}} 篇），可继续点其他日记', {
          count: result.queued
        })
      )
      deps.toast.showSuccess(
        deps.t('graph.extract_queued', '已加入整理队列（{{count}} 篇），可继续点其他日记', {
          count: result.queued
        })
      )
    } catch (e: any) {
      const message = e?.message || String(e)
      const mapped = graphExtractErrorCopy(message)
      const friendly = mapped ? deps.t(mapped.key, mapped.fallback) : message
      deps.setStatus(friendly)
      deps.toast.showError(friendly)
    }
  }

  const runExtractOne = async () => {
    const date = extractDate.trim()
    if (!isGraphExtractDate(date)) {
      deps.toast.showError(
        deps.t('graph.extract_one_not_found', '这一天没有日记，或影子索引里还没有路径。')
      )
      return
    }
    try {
      const resolved = await window.api.graph.resolveJournal({ date })
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
      const message = e?.message || String(e)
      deps.toast.showError(message)
    }
  }

  const cancelExtract = async () => {
    await graphStopExtract()
    setExtractRunning(false)
    setExtractQueue(emptyGraphExtractQueueSnapshot())
    setQueueModalOpen(false)
    deps.setStatus(deps.t('graph.extract_stopped', '已停止后台整理'))
    void deps.refreshRef.current()
  }

  const cancelQueueItem = async (filePath: string) => {
    await graphCancelQueueItem(filePath)
  }

  const changeExtractConcurrency = (value: string) => {
    const n = saveGraphExtractConcurrency(value)
    setExtractConcurrency(n)
    void graphSetExtractConcurrency(n)
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
    queueItemCount,
    queueOverallPct,
    runExtract,
    runExtractOne,
    cancelExtract,
    cancelQueueItem,
    changeExtractConcurrency
  }
}
