import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_VIEW_MAX_NODES_DEFAULT,
  GRAPH_VIEW_MAX_NODES_STORAGE_KEY,
  clampOcrConcurrency,
  DEFAULT_OCR_CONCURRENCY,
  normalizeKnowledgeDefaultExtractEngine,
  parseGraphViewMaxNodes,
  type KnowledgeImportProcessMode,
  type NotebookDataManageAction
} from '@baishou/shared'
import { useDialog, useNativeToast } from '@baishou/ui/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useBaishou } from '@/src/providers/BaishouProvider'
import {
  mobileGetKnowledgeCapabilities,
  mobileGetKnowledgeConfig,
  mobileGetKnowledgeStats,
  mobileGetNotebook,
  mobileGetNotebookGraphView,
  mobileHasKnowledgeModelMismatch,
  mobileListNotebookGraphJobs,
  mobileListSources,
  mobileRecoverStaleIngest,
  mobileResolveNotebookCoverUri,
  resolveMobileActiveVaultId,
  subscribeMobileKnowledgeExtractProgress
} from '@/src/services/mobile-knowledge.service'
import { mobileListNotebookSimilarPendingPairs } from '@/src/services/mobile-notebook-graph-review'
import { mobileGetKnowledgeProcessLabels } from '@/src/services/mobile-knowledge-models.service'
import { type KnowledgeNotebookStats } from './knowledge-screen.util'
import type {
  KnowledgeGraphEdgeRow,
  KnowledgeGraphNodeRow,
  KnowledgeOcrProgressState,
  KnowledgeSourceRow
} from './knowledge-detail.types'
import { useKnowledgeDetailImport } from './useKnowledgeDetailImport'
import { useKnowledgeDetailSources } from './useKnowledgeDetailSources'
import { useKnowledgeDetailGraph } from './useKnowledgeDetailGraph'
import { useKnowledgeDetailNotebook } from './useKnowledgeDetailNotebook'
import { useKnowledgeDetailVectors } from './useKnowledgeDetailVectors'
import { useKnowledgeHeavyConfirm } from './KnowledgeHeavyConfirmDialog'
import { extractEngineShortLabel } from './knowledge-screen.util'

export function useKnowledgeDetail(notebookId: string) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { dbReady, services } = useBaishou()
  const heavy = useKnowledgeHeavyConfirm()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [coverTone, setCoverTone] = useState('')
  const [coverIcon, setCoverIcon] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [coverUri, setCoverUri] = useState<string | null>(null)
  const [sources, setSources] = useState<KnowledgeSourceRow[]>([])
  const [stats, setStats] = useState<KnowledgeNotebookStats | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [modelMismatch, setModelMismatch] = useState(false)
  const [importProcessMode, setImportProcessMode] = useState<KnowledgeImportProcessMode>('both')
  const [graphNodes, setGraphNodes] = useState<KnowledgeGraphNodeRow[]>([])
  const [graphEdges, setGraphEdges] = useState<KnowledgeGraphEdgeRow[]>([])
  const [manageAction, setManageAction] = useState<NotebookDataManageAction>('reprocess')
  const [manageVector, setManageVector] = useState(true)
  const [manageGraph, setManageGraph] = useState(true)
  const [clearPhrase, setClearPhrase] = useState('')
  const [engine, setEngine] = useState<'ocr' | 'vision'>('ocr')
  const [ocrLanguage, setOcrLanguage] = useState('chi_sim+eng')
  const [ocrUseCustom, setOcrUseCustom] = useState(false)
  const [ocrConcurrency, setOcrConcurrency] = useState(DEFAULT_OCR_CONCURRENCY)
  const [ocrProgressBySource, setOcrProgressBySource] = useState<
    Record<string, KnowledgeOcrProgressState>
  >({})
  const [probeSourceId, setProbeSourceId] = useState('')
  const [extractedPreview, setExtractedPreview] = useState<{
    title: string
    text: string
    pages?: Array<{ page: number; text: string }>
  } | null>(null)
  const [similarPairs, setSimilarPairs] = useState<
    Awaited<ReturnType<typeof mobileListNotebookSimilarPendingPairs>>
  >([])
  const [graphProgress, setGraphProgress] = useState('')
  const [graphJobItems, setGraphJobItems] = useState<
    Array<{ sourceId: string; title: string; status: string; lastError?: string | null }>
  >([])
  const [viewMaxNodes, setViewMaxNodes] = useState(GRAPH_VIEW_MAX_NODES_DEFAULT)
  const [vaultId, setVaultId] = useState('')
  const [ocrCapReason, setOcrCapReason] = useState('')
  const [visionCapReason, setVisionCapReason] = useState('')
  const [embeddingModelLabel, setEmbeddingModelLabel] = useState('')
  const [graphModelLabel, setGraphModelLabel] = useState('')
  const [visionModelId, setVisionModelId] = useState('')

  const vectors = useKnowledgeDetailVectors({ notebookId, dbReady })

  const refreshDetail = useCallback(async () => {
    if (!notebookId) return
    const notebook = await mobileGetNotebook(notebookId)
    if (!notebook) throw new Error(t('knowledge.not_found', '找不到这本笔记本'))
    setName(notebook.name)
    setDescription(notebook.description || '')
    setCoverTone(notebook.coverTone || '')
    setCoverIcon(notebook.coverIcon || '')
    setCoverImage(notebook.coverImage || '')
    const uri = notebook.coverImage
      ? await mobileResolveNotebookCoverUri(notebook.coverImage)
      : null
    setCoverUri(uri)
    const list = (await mobileListSources(notebookId)) as KnowledgeSourceRow[]
    setSources(list || [])
    try {
      const next = await mobileGetKnowledgeStats(notebookId)
      setStats({
        sources: next.sources,
        chunks: next.chunks,
        pendingJobs: next.pendingJobs,
        originalBytes: next.originalBytes ?? 0,
        totalBytes: next.totalBytes ?? 0
      })
    } catch {
      /* 统计失败时仍刷新资料 */
    }
    try {
      setModelMismatch(await mobileHasKnowledgeModelMismatch([notebookId]))
    } catch {
      setModelMismatch(false)
    }
    try {
      const view = await mobileGetNotebookGraphView(notebookId, viewMaxNodes)
      setGraphNodes(
        (view.nodes || []).map((n) => ({
          id: n.id,
          name: n.name,
          nodeType: n.nodeType,
          reviewStatus: n.reviewStatus,
          summary: n.summary,
          propsJson: n.propsJson,
          mentionCount: n.mentionCount
        }))
      )
      setGraphEdges(
        (view.edges || []).map((e) => ({
          id: e.id,
          fromId: e.fromId,
          toId: e.toId,
          edgeType: e.edgeType,
          reviewStatus: e.reviewStatus,
          sourceExcerpt: e.sourceExcerpt,
          sourceRef: e.sourceRef
        }))
      )
    } catch {
      setGraphNodes([])
      setGraphEdges([])
    }
    try {
      const activeVaultId = await resolveMobileActiveVaultId()
      setVaultId(activeVaultId)
      setSimilarPairs(
        await mobileListNotebookSimilarPendingPairs({ notebookId, vaultId: activeVaultId })
      )
    } catch {
      setSimilarPairs([])
    }
    try {
      const jobs = await mobileListNotebookGraphJobs(notebookId)
      setGraphJobItems(jobs.items || [])
      setGraphProgress(
        jobs.pending + jobs.running > 0
          ? `${jobs.currentSourceTitle || ''} ${jobs.running}/${jobs.pending + jobs.running}`
          : ''
      )
    } catch {
      setGraphJobItems([])
      setGraphProgress('')
    }
    try {
      const labels = await mobileGetKnowledgeProcessLabels()
      setEmbeddingModelLabel(labels.embeddingModelLabel)
      setGraphModelLabel(labels.graphModelLabel)
    } catch {
      /* 模型名仅作提示 */
    }
  }, [notebookId, t, viewMaxNodes])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(GRAPH_VIEW_MAX_NODES_STORAGE_KEY)
        if (cancelled) return
        setViewMaxNodes(parseGraphViewMaxNodes(raw))
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!dbReady || !notebookId) return
    void refreshDetail().catch((e) => setError(String((e as Error)?.message || e)))
    void mobileGetKnowledgeConfig()
      .then((cfg) => {
        setEngine(
          normalizeKnowledgeDefaultExtractEngine(cfg.defaultExtractEngine) === 'vision'
            ? 'vision'
            : 'ocr'
        )
        setOcrLanguage(cfg.ocrLanguage || 'chi_sim+eng')
        setOcrConcurrency(clampOcrConcurrency(cfg.ocrConcurrency))
        setImportProcessMode(cfg.importProcessMode ?? 'both')
        setVisionModelId(cfg.visionModelId || '')
      })
      .catch(() => undefined)
    void mobileGetKnowledgeCapabilities()
      .then((caps) => {
        setOcrCapReason(caps.ocr.available ? caps.ocr.detail || '' : caps.ocr.reason || '')
        setVisionCapReason(
          caps.vision.available ? caps.vision.detail || '' : caps.vision.reason || ''
        )
      })
      .catch(() => undefined)
    void mobileRecoverStaleIngest().catch(() => undefined)
  }, [dbReady, notebookId, refreshDetail])

  useEffect(() => {
    return subscribeMobileKnowledgeExtractProgress((info) => {
      setOcrProgressBySource((prev) => {
        if (info.total <= 0) {
          const next = { ...prev }
          delete next[info.sourceId]
          return next
        }
        return {
          ...prev,
          [info.sourceId]: { page: info.page, total: info.total, phase: info.phase }
        }
      })
    })
  }, [])

  const hasActiveIngest =
    sources.some(
      (s) => s.status === 'pending' || s.status === 'extracting' || s.status === 'embedding'
    ) || (stats?.pendingJobs ?? 0) > 0

  useEffect(() => {
    if (!hasActiveIngest) return
    const timer = setInterval(() => {
      void refreshDetail().catch(() => undefined)
    }, 4000)
    return () => clearInterval(timer)
  }, [hasActiveIngest, refreshDetail])

  const persistViewMaxNodes = async (value: number) => {
    const next = parseGraphViewMaxNodes(JSON.stringify(value))
    setViewMaxNodes(next)
    await AsyncStorage.setItem(GRAPH_VIEW_MAX_NODES_STORAGE_KEY, JSON.stringify(next))
  }

  const importing = useKnowledgeDetailImport({
    notebookId,
    engine,
    importProcessMode,
    t,
    toast,
    setBusy,
    setError,
    refreshDetail
  })
  const graph = useKnowledgeDetailGraph({
    notebookId,
    vaultId,
    nodes: graphNodes,
    t,
    toast,
    dialog,
    setError,
    refreshDetail
  })
  const sourceActions = useKnowledgeDetailSources({
    notebookId,
    engine,
    t,
    toast,
    dialog,
    askHeavyConfirm: heavy.askHeavyConfirm,
    setBusy,
    setError,
    refreshDetail,
    openTextPreview: (title, text) => setExtractedPreview({ title, text })
  })
  const notebook = useKnowledgeDetailNotebook({
    notebookId,
    name,
    description,
    engine,
    ocrLanguage,
    ocrConcurrency,
    probeSourceId,
    sources,
    manageAction,
    manageVector,
    manageGraph,
    clearPhrase,
    busy,
    t,
    toast,
    dialog,
    askHeavyConfirm: heavy.askHeavyConfirm,
    services,
    setBusy,
    setError,
    setImportProcessMode,
    setName,
    setDescription,
    setCoverTone,
    setCoverIcon,
    setCoverImage,
    setCoverUri,
    setModelMismatch,
    setClearPhrase,
    setExtractedPreview,
    refreshDetail
  })

  const pendingNodes = graphNodes.filter((node) => node.reviewStatus === 'pending')
  const pendingEdges = graphEdges.filter((edge) => edge.reviewStatus === 'pending')
  const ingestingCount = sources.filter(
    (s) => s.status === 'pending' || s.status === 'extracting' || s.status === 'embedding'
  ).length

  return {
    dbReady,
    name,
    description,
    coverTone,
    coverIcon,
    coverImage,
    coverUri,
    sources,
    stats,
    error,
    busy,
    modelMismatch,
    ingestingCount,
    pasteTitle: importing.pasteTitle,
    setPasteTitle: importing.setPasteTitle,
    pasteText: importing.pasteText,
    setPasteText: importing.setPasteText,
    urlValue: importing.urlValue,
    setUrlValue: importing.setUrlValue,
    showImport: importing.showImport,
    setShowImport: importing.setShowImport,
    extractHintPrompt: importing.extractHintPrompt,
    settleExtractHint: importing.settleExtractHint,
    importProcessMode,
    setImportProcessMode: notebook.persistImportProcessMode,
    embeddingModelLabel,
    graphModelLabel,
    visionModelId,
    extractEngineLabel: extractEngineShortLabel(engine, t),
    graphNodes,
    graphEdges,
    manageAction,
    setManageAction,
    manageVector,
    setManageVector,
    manageGraph,
    setManageGraph,
    clearPhrase,
    setClearPhrase,
    phrase: notebook.phrase,
    canConfirm: notebook.canConfirm,
    saveCover: notebook.saveCover,
    pickCoverImage: notebook.pickCoverImage,
    rebuildIndex: notebook.rebuildIndex,
    retrySource: sourceActions.retrySource,
    reprocessSourceGraph: sourceActions.reprocessSourceGraph,
    reprocessSourceVector: sourceActions.reprocessSourceVector,
    rebuildNotebookGraph: notebook.rebuildNotebookGraph,
    startOrganize: notebook.startOrganize,
    onImportText: importing.onImportText,
    onImportUrl: importing.onImportUrl,
    onImportFile: importing.onImportFile,
    onDeleteSource: sourceActions.onDeleteSource,
    confirmManage: notebook.confirmManage,
    deleteNotebook: notebook.deleteNotebook,
    renameNotebook: notebook.renameNotebook,
    editDescription: notebook.editDescription,
    engine,
    ocrLanguage,
    ocrUseCustom,
    ocrConcurrency,
    ocrCapReason,
    visionCapReason,
    setEngine,
    setOcrLanguage,
    setOcrUseCustom,
    setOcrConcurrency,
    saveExtractConfig: notebook.saveExtractConfig,
    recoverStale: notebook.recoverStale,
    probeExtract: notebook.probeExtract,
    probeSourceId,
    setProbeSourceId,
    pickVisionModel: notebook.pickVisionModel,
    pickEmbeddingModel: notebook.pickEmbeddingModel,
    pickGraphModel: notebook.pickGraphModel,
    locateGraphNode: graph.locateGraphNode,
    ocrProgressBySource,
    embedSource: sourceActions.embedSource,
    cancelExtract: sourceActions.cancelExtract,
    ocrMissing: sourceActions.ocrMissing,
    previewExtracted: sourceActions.previewExtracted,
    previewOriginal: sourceActions.previewOriginal,
    sourcePreview: sourceActions.sourcePreview,
    closeSourcePreview: () => {
      sourceActions.closeSourcePreview()
      graph.setFragments([])
    },
    graphFragments: graph.fragments,
    previewGraphFragments: async (edges: KnowledgeGraphEdgeRow[]) => {
      await graph.previewGraphFragments(edges)
      sourceActions.openFragmentPreview(t('knowledge.graph_fragments', '查看原文窗口'))
    },
    ...vectors,
    extractedPreview,
    closeExtractedPreview: () => setExtractedPreview(null),
    openTextPreview: (title: string, text: string) => setExtractedPreview({ title, text }),
    graphSearchQuery: graph.graphSearchQuery,
    setGraphSearchQuery: graph.setGraphSearchQuery,
    graphSearchMode: graph.graphSearchMode,
    setGraphSearchMode: graph.setGraphSearchMode,
    graphSearchHits: graph.graphSearchHits,
    graphFocusDepth: graph.focusDepth,
    setGraphFocusDepth: graph.setFocusDepth,
    graphTab: graph.graphTab,
    setGraphTab: graph.setGraphTab,
    selectedGraphId: graph.selectedGraphId,
    setSelectedGraphId: graph.setSelectedGraphId,
    graphHighlightIds: graph.graphHighlightIds,
    graphLocateIds: graph.graphLocateIds,
    graphLocateSeq: graph.graphLocateSeq,
    searchGraph: graph.searchGraph,
    mergeSearchQuery: graph.mergeSearchQuery,
    setMergeSearchQuery: graph.setMergeSearchQuery,
    mergeHits: graph.mergeHits,
    mergeLoserIds: graph.mergeLoserIds,
    searchMergeNodes: graph.searchMergeNodes,
    toggleMergeLoser: graph.toggleMergeLoser,
    mergeSearchedNodes: graph.mergeSearchedNodes,
    pendingSelection: graph.pendingSelection,
    togglePendingSelection: graph.togglePendingSelection,
    toggleSelectAllPending: graph.toggleSelectAllPending,
    reviewSelectedPending: graph.reviewSelectedPending,
    pendingNodes,
    pendingEdges,
    similarPairs,
    reviewBusy: graph.reviewBusy,
    graphProgress,
    graphJobItems,
    viewMaxNodes,
    persistViewMaxNodes,
    reviewNode: graph.reviewNode,
    reviewEdge: graph.reviewEdge,
    reviewAllPending: graph.reviewAllPending,
    mergeSimilar: graph.mergeSimilar,
    dismissSimilar: graph.dismissSimilar,
    uploadingSources: importing.uploadingSources,
    dismissUploading: importing.dismissUploading,
    heavyPrompt: heavy.prompt,
    settleHeavyConfirm: heavy.settle
  }
}
