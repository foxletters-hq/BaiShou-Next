import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from 'react'
import type { TFunction } from 'i18next'
import { toast, type ContextMenuItem } from '@baishou/ui'
import type { KnowledgeExtractHint } from '@baishou/shared'
import { callKnowledgeApi } from './call-knowledge-api'
import type { KnowledgeHeavyConfirmKind } from './KnowledgeHeavyConfirmDialog'
import { knowledgeSourceMenuLabel } from './knowledge-detail-labels.util'
import type { KnowledgeOcrProgressState, KnowledgeSourceRow } from './knowledge-detail.types'
import {
  knowledgeSourceMenuOcrRunning,
  mapKnowledgeDetailSourceMenuItems
} from './knowledge-detail-source-menu.util'
import { useKnowledgeDetailPreview } from './useKnowledgeDetailPreview'
import {
  buildKnowledgeSourceMenuActions,
  type KnowledgeSourceMenuAction
} from './knowledge-source-menu.util'
import {
  notebookDataManageFeedback,
  notebookDataManageStatusKind,
  notebookDataManageWatch,
  parseNotebookDataManageResult,
  type NotebookDataManageResult
} from './notebook-data-manage.util'
import type { NotebookDataManageConfirm } from './NotebookDataManageDialog'
import type { KnowledgeNotebookTab } from './knowledge-notebook-tab.util'

export function useKnowledgeDetailActions(input: {
  notebookId: string
  engine: 'simple' | 'ocr' | 'vision'
  sources: KnowledgeSourceRow[]
  ocrProgressBySource: Record<string, KnowledgeOcrProgressState>
  t: TFunction
  refresh: () => Promise<void>
  refreshGraphJobs: () => Promise<void>
  askExtractHint: (prompt: {
    fileNames: string[]
    reason: KnowledgeExtractHint['reason']
    currentEngine: 'simple' | 'ocr' | 'vision'
    visionConfigured: boolean
    visionModelId?: string | null
  }) => Promise<'vision' | 'ocr' | 'keep' | 'cancel'>
  setError: (message: string) => void
  setStatus: (message: string) => void
  setBusy: (busy: boolean) => void
  setActiveTab: (tab: KnowledgeNotebookTab) => void
  setOcrProgressBySource: Dispatch<SetStateAction<Record<string, KnowledgeOcrProgressState>>>
  setGraphBusy: (busy: boolean) => void
  setGraphKnownTotal: Dispatch<SetStateAction<number>>
  setGraphWindowProgress: Dispatch<
    SetStateAction<{
      done: number
      total: number
      pageFrom?: number
      pageTo?: number
      pageTotal?: number
    } | null>
  >
  setGraphJobs: Dispatch<
    SetStateAction<{
      pending: number
      running: number
      failed: number
      currentSourceId: string | null
      currentSourceTitle: string | null
      lastError: string | null
      failedSourceTitle: string | null
      statusBySourceId: Record<string, string>
      jobsBySourceId: Record<string, { sourceId: string; status: string }>
    }>
  >
  setPendingJobs: Dispatch<SetStateAction<number>>
  setVectorKnownTotal: Dispatch<SetStateAction<number>>
  setQueuedSourceIds: Dispatch<SetStateAction<string[]>>
  setReprocessWatching: (watching: boolean) => void
  reprocessSawWorkRef: MutableRefObject<boolean>
  setDataManageOpen: (open: boolean) => void
}) {
  const {
    notebookId,
    engine,
    sources,
    ocrProgressBySource,
    t,
    refresh,
    refreshGraphJobs,
    askExtractHint,
    setError,
    setStatus,
    setBusy,
    setActiveTab,
    setOcrProgressBySource,
    setGraphBusy,
    setGraphKnownTotal,
    setGraphWindowProgress,
    setGraphJobs,
    setPendingJobs,
    setVectorKnownTotal,
    setQueuedSourceIds,
    setReprocessWatching,
    reprocessSawWorkRef,
    setDataManageOpen
  } = input

  const preview = useKnowledgeDetailPreview(notebookId)
  const [sourceMenu, setSourceMenu] = useState<{ sourceId: string; x: number; y: number } | null>(
    null
  )
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeSourceRow | null>(null)
  const [heavyConfirmKind, setHeavyConfirmKind] = useState<KnowledgeHeavyConfirmKind | null>(null)
  const [heavyConfirmSource, setHeavyConfirmSource] = useState<KnowledgeSourceRow | null>(null)

  const onOcrMissing = useCallback(
    async (sourceId: string) => {
      setError('')
      try {
        let nextEngine: 'simple' | 'ocr' | 'vision' = engine === 'simple' ? 'ocr' : engine
        if (engine !== 'vision') {
          try {
            const hint = await window.api.knowledge.probeExtractHint({ sourceId })
            if (hint.recommendVision) {
              const choice = await askExtractHint({
                fileNames: [hint.fileName],
                reason: hint.reason,
                currentEngine: engine,
                visionConfigured: hint.visionConfigured,
                visionModelId: hint.visionModelId
              })
              if (choice === 'cancel') return
              if (choice === 'vision') nextEngine = 'vision'
              else if (choice === 'ocr' || choice === 'keep') nextEngine = 'ocr'
            }
          } catch {
            /* 探测失败时仍按当前引擎补抽 */
          }
        }
        await window.api.knowledge.ocrMissingPages({
          sourceId,
          engine: nextEngine
        })
        setOcrProgressBySource((prev) => ({
          ...prev,
          [sourceId]: prev[sourceId] ?? { page: 0, total: 0 }
        }))
        setStatus(t('knowledge.ocr_queued', '已加入 OCR 队列'))
        await refresh()
      } catch (e: any) {
        setError(String(e?.message || e))
      }
    },
    [askExtractHint, engine, refresh, setError, setOcrProgressBySource, setStatus, t]
  )

  const onCancelExtract = useCallback(
    async (sourceId: string) => {
      setError('')
      try {
        await callKnowledgeApi('cancelExtract', 'knowledge:cancel-extract', sourceId)
        setOcrProgressBySource((prev) => {
          if (!prev[sourceId]) return prev
          const next = { ...prev }
          delete next[sourceId]
          return next
        })
        setStatus(t('knowledge.extract_cancelled', '已取消提取'))
        await refresh()
      } catch (e: any) {
        setError(String(e?.message || e))
      }
    },
    [refresh, setError, setOcrProgressBySource, setStatus, t]
  )

  const queueSource = useCallback((sourceId: string) => {
    setQueuedSourceIds((prev) => (prev.includes(sourceId) ? prev : [...prev, sourceId]))
  }, [setQueuedSourceIds])

  const onRetry = useCallback(
    async (sourceId: string) => {
      setBusy(true)
      try {
        queueSource(sourceId)
        await window.api.knowledge.retrySource(sourceId)
        await refresh()
      } catch (e: any) {
        setError(String(e?.message || e))
      } finally {
        setBusy(false)
      }
    },
    [queueSource, refresh, setBusy, setError]
  )

  const onEmbed = async (sourceId: string) => {
    setBusy(true)
    try {
      queueSource(sourceId)
      await callKnowledgeApi('retrySource', 'knowledge:retry-source', sourceId)
      await refresh()
      setStatus(t('knowledge.embed_queued', '已开始嵌入'))
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onReprocess = async (sourceId: string, target: 'embed' | 'graph') => {
    setBusy(true)
    try {
      queueSource(sourceId)
      if (target === 'graph') {
        const title = sources.find((row) => row.id === sourceId)?.title || null
        setGraphKnownTotal((prev) => Math.max(prev, 1))
        setGraphWindowProgress(null)
        setGraphJobs((prev) => ({
          ...prev,
          pending: Math.max(prev.pending, 1),
          currentSourceId: sourceId,
          currentSourceTitle: title,
          lastError: null,
          failedSourceTitle: null,
          statusBySourceId: { ...prev.statusBySourceId, [sourceId]: 'pending' },
          jobsBySourceId: {
            ...prev.jobsBySourceId,
            [sourceId]: { sourceId, status: 'pending' }
          }
        }))
        setActiveTab('graph')
      }
      await callKnowledgeApi('reprocessSource', 'knowledge:reprocess-source', {
        sourceId,
        target
      })
      await refresh()
      await refreshGraphJobs()
      setStatus(
        target === 'graph'
          ? t('knowledge.reembed_graph_queued', '已开始重新抽取图数据')
          : t('knowledge.reembed_vector_queued', '已开始重新嵌入向量')
      )
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onDeleteSource = async (sourceId: string) => {
    setBusy(true)
    setError('')
    try {
      await callKnowledgeApi('deleteSource', 'knowledge:delete-source', sourceId)
      setDeleteTarget(null)
      await refresh()
      setStatus(t('knowledge.source_deleted', '已删除资料'))
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onRebuild = async () => {
    if (!notebookId) return
    setBusy(true)
    setError('')
    try {
      await window.api.knowledge.rebuildIndex(notebookId)
      await refresh()
      setStatus(t('knowledge.rebuild_queued', '已开始重建本机索引（不产生同步流量）'))
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onManageNotebookData = async (manageInput: NotebookDataManageConfirm) => {
    if (!notebookId) return
    setBusy(true)
    setError('')
    try {
      const raw = await callKnowledgeApi<NotebookDataManageResult>(
        'manageData',
        'knowledge:manage-data',
        {
          notebookId,
          action: manageInput.action,
          vector: manageInput.vector,
          graph: manageInput.graph
        }
      )
      const result =
        parseNotebookDataManageResult(raw) ??
        ({
          action: manageInput.action,
          vector: manageInput.vector,
          graph: manageInput.graph,
          sourceCount: sources.length,
          vectorQueued:
            manageInput.action === 'reprocess' && manageInput.vector ? sources.length : 0,
          graphQueued: manageInput.action === 'reprocess' && manageInput.graph ? sources.length : 0
        } satisfies NotebookDataManageResult)
      const kind = notebookDataManageStatusKind(result)
      const watch = notebookDataManageWatch(result)
      setDataManageOpen(false)
      if (watch.watch) {
        reprocessSawWorkRef.current = false
        setReprocessWatching(true)
        if (watch.vectorQueued > 0) {
          setPendingJobs((prev) => Math.max(prev, watch.vectorQueued))
          setVectorKnownTotal((prev) => Math.max(prev, watch.vectorQueued))
          setQueuedSourceIds((prev) => [...new Set([...prev, ...sources.map((row) => row.id)])])
        }
        if (watch.graphQueued > 0) {
          setGraphKnownTotal((prev) => Math.max(prev, watch.graphQueued, sources.length))
          setGraphJobs((prev) => ({
            ...prev,
            pending: Math.max(prev.pending, watch.graphQueued)
          }))
          if (!manageInput.vector) setActiveTab('graph')
        }
      } else {
        setReprocessWatching(false)
      }
      await refreshGraphJobs()
      await refresh()
      if (notebookDataManageFeedback(kind) === 'toast') {
        toast.showInfo(
          kind === 'reprocess-empty'
            ? t(
                'knowledge.data_manage_reprocess_empty',
                '这本笔记本还没有资料，没有可重新整理的数据'
              )
            : t(
                'knowledge.data_manage_reprocess_none',
                '没有可重新整理的数据。需要资料已完成文本提取后才能重建向量或图谱。'
              )
        )
        return
      }
      setStatus(
        kind === 'cleared'
          ? t('knowledge.data_manage_cleared', '已清除所选派生数据')
          : t(
              'knowledge.data_manage_reprocess_queued_counts',
              '已开始重新整理：向量 {{vector}} 项，图谱 {{graph}} 项',
              { vector: watch.vectorQueued, graph: watch.graphQueued }
            )
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const onRebuildGraph = async () => {
    setGraphBusy(true)
    setError('')
    try {
      setGraphKnownTotal(Math.max(sources.length, 1))
      setActiveTab('graph')
      await callKnowledgeApi('rebuildGraph', 'knowledge:rebuild-graph', notebookId)
      await refreshGraphJobs()
      await refresh()
    } catch (e) {
      setError(String((e as Error)?.message || e))
    } finally {
      setGraphBusy(false)
    }
  }

  const sourceMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!sourceMenu) return []
    const source = sources.find((row) => row.id === sourceMenu.sourceId)
    if (!source) return []
    const actions = buildKnowledgeSourceMenuActions({
      status: source.status,
      extractEngine: source.extractEngine,
      ocrRunning: knowledgeSourceMenuOcrRunning(source, ocrProgressBySource[source.id])
    })
    const run = (action: KnowledgeSourceMenuAction) => {
      if (action === 'preview') void preview.onPreview(source)
      else if (action === 'embed') {
        setHeavyConfirmSource(source)
        setHeavyConfirmKind('embed-source')
      } else if (action === 'reembed-vector') {
        setHeavyConfirmSource(source)
        setHeavyConfirmKind('reembed-vector')
      } else if (action === 'reembed-graph') {
        setHeavyConfirmSource(source)
        setHeavyConfirmKind('reembed-graph')
      } else if (action === 'delete') setDeleteTarget(source)
      else if (action === 'cancel') void onCancelExtract(source.id)
      else if (action === 'retry') void onRetry(source.id)
      else if (action === 'ocr') void onOcrMissing(source.id)
    }
    return mapKnowledgeDetailSourceMenuItems(
      actions,
      (action) => knowledgeSourceMenuLabel(t, action),
      run
    )
  }, [ocrProgressBySource, onCancelExtract, onOcrMissing, onRetry, preview, sourceMenu, sources, t])

  const confirmHeavy = () => {
    const kind = heavyConfirmKind
    const source = heavyConfirmSource
    setHeavyConfirmKind(null)
    setHeavyConfirmSource(null)
    if (kind === 'rebuild-graph') void onRebuildGraph()
    else if (kind === 'rebuild-index') void onRebuild()
    else if (kind === 'embed-source' && source) void onEmbed(source.id)
    else if (kind === 'reembed-vector' && source) void onReprocess(source.id, 'embed')
    else if (kind === 'reembed-graph' && source) void onReprocess(source.id, 'graph')
  }

  return {
    ...preview,
    sourceMenu,
    setSourceMenu,
    deleteTarget,
    setDeleteTarget,
    heavyConfirmKind,
    setHeavyConfirmKind,
    heavyConfirmSource,
    setHeavyConfirmSource,
    sourceMenuItems,
    onDeleteSource,
    onManageNotebookData,
    onRebuildGraph,
    onRebuild,
    confirmHeavy
  }
}
