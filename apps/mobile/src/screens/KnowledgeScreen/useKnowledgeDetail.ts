import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { unstable_batchedUpdates } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_VIEW_MAX_NODES_DEFAULT,
  GRAPH_VIEW_MAX_NODES_STORAGE_KEY,
  clampOcrConcurrency,
  DEFAULT_OCR_CONCURRENCY,
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
  mobileListNotebookOrganizeJobs,
  mobileListSources,
  mobileRecoverStaleIngest,
  mobileResolveNotebookCoverUri,
  overlayMobileOrganizeJobsLive,
  resolveMobileActiveVaultId,
  subscribeMobileKnowledgeExtractProgress,
  subscribeMobileKnowledgeIngestLive
} from '@/src/services/mobile-knowledge.service'
import {
  mobileListNotebookSimilarPendingPairs,
  mobileWaitNotebookGraphIndexSync,
  subscribeNotebookGraphChanged
} from '@/src/services/mobile-notebook-graph-review'
import {
  mobileGetKnowledgeProcessLabels,
  peekCachedKnowledgeProcessLabels
} from '@/src/services/mobile-knowledge-models.service'
import { applyNotebookGraphLocalReviewBatch } from '@/src/services/notebook-graph-review.util'
import { type KnowledgeNotebookStats } from './knowledge-screen.util'
import type {
  KnowledgeGraphEdgeRow,
  KnowledgeGraphNodeRow,
  KnowledgeOcrProgressState,
  KnowledgeSourceRow
} from './knowledge-detail.types'
import {
  knowledgeOrganizeHasLiveWork,
  notebookOrganizeShouldKeepWatching
} from './knowledge-organize-fab.util'
import {
  createLatestThrottled,
  knowledgeOrganizeRememberedTotal,
  knowledgeOrganizeSourceCount,
  mergeKnowledgeOrganizeJobProgress,
  type KnowledgeOrganizeJobItem
} from './knowledge-organize-banner.util'
import { useKnowledgeDetailImport } from './useKnowledgeDetailImport'
import { useKnowledgeDetailSources } from './useKnowledgeDetailSources'
import { useKnowledgeDetailGraph } from './useKnowledgeDetailGraph'
import { useKnowledgeDetailNotebook } from './useKnowledgeDetailNotebook'
import { useKnowledgeDetailVectors } from './useKnowledgeDetailVectors'
import { useKnowledgeHeavyConfirm } from './KnowledgeHeavyConfirmDialog'
import { extractEngineShortLabel } from './knowledge-screen.util'

export function useKnowledgeDetail(
  notebookId: string,
  activeTab: 'sources' | 'graph' | 'vectors' = 'sources'
) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { dbReady } = useBaishou()
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
  const [detailLoaded, setDetailLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [modelMismatch, setModelMismatch] = useState(false)
  const [importProcessMode, setImportProcessMode] = useState<KnowledgeImportProcessMode>('both')
  const [graphNodes, setGraphNodes] = useState<KnowledgeGraphNodeRow[]>([])
  const [graphEdges, setGraphEdges] = useState<KnowledgeGraphEdgeRow[]>([])
  const [manageAction, setManageAction] = useState<NotebookDataManageAction>('reprocess')
  const [manageVector, setManageVector] = useState(true)
  const [manageGraph, setManageGraph] = useState(true)
  const [clearPhrase, setClearPhrase] = useState('')
  const [engine, setEngine] = useState<'ocr' | 'vision'>('vision')
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
  const [graphJobItems, setGraphJobItems] = useState<
    Array<{
      sourceId: string
      title: string
      stage?: string
      status: string
      lastError?: string | null
      windowsDone?: number
      windowsTotal?: number
      nodesDone?: number
      nodesTotal?: number
      pageFrom?: number
      pageTo?: number
      pageTotal?: number
    }>
  >([])
  const [organizeJobItems, setOrganizeJobItems] = useState<
    Array<{
      sourceId: string
      title: string
      stage?: string
      status: string
      lastError?: string | null
      windowsDone?: number
      windowsTotal?: number
      nodesDone?: number
      nodesTotal?: number
      pageFrom?: number
      pageTo?: number
      pageTotal?: number
    }>
  >([])
  const [organizeWatching, setOrganizeWatching] = useState(false)
  const [organizeKnownTotal, setOrganizeKnownTotal] = useState(0)
  const [viewMaxNodes, setViewMaxNodes] = useState(GRAPH_VIEW_MAX_NODES_DEFAULT)
  const [vaultId, setVaultId] = useState('')
  const [ocrCapReason, setOcrCapReason] = useState('')
  const [visionCapReason, setVisionCapReason] = useState('')
  const cachedLabels = peekCachedKnowledgeProcessLabels()
  const [embeddingModelLabel, setEmbeddingModelLabel] = useState(
    cachedLabels?.embeddingModelLabel ?? ''
  )
  const [graphModelLabel, setGraphModelLabel] = useState(cachedLabels?.graphModelLabel ?? '')
  const [embeddingProviderId, setEmbeddingProviderId] = useState(
    cachedLabels?.embeddingProviderId ?? ''
  )
  const [graphProviderId, setGraphProviderId] = useState(cachedLabels?.graphProviderId ?? '')
  const [modelsLoaded, setModelsLoaded] = useState(Boolean(cachedLabels))
  const [visionProviderId, setVisionProviderId] = useState('')
  const [visionModelId, setVisionModelId] = useState('')
  const [embeddingModelId, setEmbeddingModelId] = useState(cachedLabels?.embeddingModelId ?? '')
  const [graphModelId, setGraphModelId] = useState(cachedLabels?.graphModelLabel ?? '')
  const [modelSwitcherSlot, setModelSwitcherSlot] = useState<
    'vision' | 'embedding' | 'graph' | null
  >(null)

  const vectors = useKnowledgeDetailVectors({ notebookId, dbReady })

  const refreshModels = useCallback(async () => {
    try {
      const labels = await mobileGetKnowledgeProcessLabels()
      setEmbeddingModelLabel(labels.embeddingModelLabel)
      setGraphModelLabel(labels.graphModelLabel)
      setEmbeddingProviderId(labels.embeddingProviderId || '')
      setGraphProviderId(labels.graphProviderId || '')
      setEmbeddingModelId(labels.embeddingModelId || '')
      setGraphModelId(labels.graphModelLabel || '')
    } catch {
      /* 模型名仅作提示 */
    } finally {
      setModelsLoaded(true)
    }
  }, [])

  const refreshDetail = useCallback(async () => {
    if (!notebookId) return
    // 后台索引同步还在跑时先等它完成，否则读到的是同步前的图谱
    const activeVaultId = await resolveMobileActiveVaultId().catch(() => '')
    await mobileWaitNotebookGraphIndexSync(notebookId, activeVaultId)
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
    setDetailLoaded(true)

    const statsTask = mobileGetKnowledgeStats(notebookId)
      .then((next) => {
        setStats({
          sources: next.sources,
          chunks: next.chunks,
          pendingJobs: next.pendingJobs,
          originalBytes: next.originalBytes ?? 0,
          totalBytes: next.totalBytes ?? 0
        })
      })
      .catch(() => undefined)

    const mismatchTask = mobileHasKnowledgeModelMismatch([notebookId])
      .then((mismatch) => setModelMismatch(mismatch))
      .catch(() => setModelMismatch(false))

    const graphTask = mobileGetNotebookGraphView(notebookId, viewMaxNodes)
      .then((view) => {
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
      })
      .catch(() => {
        setGraphNodes([])
        setGraphEdges([])
      })

    const similarTask = resolveMobileActiveVaultId()
      .then(async (activeVaultId) => {
        setVaultId(activeVaultId)
        const pairs = await mobileListNotebookSimilarPendingPairs({
          notebookId,
          vaultId: activeVaultId
        })
        setSimilarPairs(pairs)
      })
      .catch(() => setSimilarPairs([]))

    const jobsTask = mobileListNotebookOrganizeJobs(notebookId)
      .then((jobs) => {
        const items = overlayMobileOrganizeJobsLive(jobs.items || [])
        setOrganizeJobItems((prev) => mergeKnowledgeOrganizeJobProgress(items, prev))
        setGraphJobItems((prev) =>
          mergeKnowledgeOrganizeJobProgress(
            items.filter((item) => item.stage === 'graph'),
            prev
          )
        )
      })
      .catch(() => undefined)

    void refreshModels()

    await Promise.all([statsTask, mismatchTask, graphTask, similarTask, jobsTask])
  }, [notebookId, refreshModels, t, viewMaxNodes])

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
    if (!dbReady) return
    void refreshModels()
  }, [dbReady, refreshModels])

  const lastDetailFocusTimeRef = useRef(0)

  useEffect(() => {
    if (!dbReady || !notebookId) return
    let cancelled = false
    lastDetailFocusTimeRef.current = Date.now()
    void (async () => {
      await mobileRecoverStaleIngest().catch(() => undefined)
    })()
    void (async () => {
      await refreshDetail().catch((e) => setError(String((e as Error)?.message || e)))
      if (!cancelled) setDetailLoaded(true)
    })()
    void mobileGetKnowledgeConfig()
      .then((cfg) => {
        setEngine('vision')
        setOcrLanguage(cfg.ocrLanguage || 'chi_sim+eng')
        setOcrConcurrency(clampOcrConcurrency(cfg.ocrConcurrency))
        setImportProcessMode(cfg.importProcessMode ?? 'both')
        setVisionProviderId(cfg.visionProviderId || '')
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
    return () => {
      cancelled = true
    }
  }, [dbReady, notebookId, refreshDetail])

  useEffect(() => {
    if (!dbReady || !notebookId) return
    return subscribeNotebookGraphChanged(notebookId, () => {
      void refreshDetail().catch(() => undefined)
    })
  }, [dbReady, notebookId, refreshDetail])

  const isInitialMountRef = useRef(true)
  const blurredRef = useRef(false)
  useFocusEffect(
    useCallback(() => {
      if (!dbReady || !notebookId) return
      if (isInitialMountRef.current) {
        isInitialMountRef.current = false
        return () => {
          blurredRef.current = true
        }
      }
      const now = Date.now()
      const wasBlurred = blurredRef.current
      blurredRef.current = false
      if (!wasBlurred && now - lastDetailFocusTimeRef.current < 400) return
      lastDetailFocusTimeRef.current = now
      void refreshDetail().catch(() => undefined)
      return () => {
        blurredRef.current = true
      }
    }, [dbReady, notebookId, refreshDetail])
  )

  useEffect(() => {
    const applyProgress = (
      info: Parameters<Parameters<typeof subscribeMobileKnowledgeExtractProgress>[0]>[0]
    ) => {
      unstable_batchedUpdates(() => {
        setOcrProgressBySource((prev) => {
          if (info.total <= 0 && !(info.windowsTotal && info.windowsTotal > 0)) {
            const next = { ...prev }
            delete next[info.sourceId]
            return next
          }
          return {
            ...prev,
            [info.sourceId]: {
              page: info.page,
              total: info.total,
              phase: info.phase,
              windowsDone: info.windowsDone,
              windowsTotal: info.windowsTotal,
              nodesDone: info.nodesDone,
              nodesTotal: info.nodesTotal,
              pageFrom: info.pageFrom,
              pageTo: info.pageTo,
              pageTotal: info.pageTotal
            }
          }
        })
        if (info.phase !== 'graph' && info.phase !== 'graphNodes') return
        const patchGraphProgress = (prev: KnowledgeOrganizeJobItem[]) => {
          const idx = prev.findIndex((item) => item.sourceId === info.sourceId)
          const nextItem: KnowledgeOrganizeJobItem = {
            sourceId: info.sourceId,
            title: prev[idx]?.title || info.sourceId,
            stage: 'graph',
            status: 'running',
            lastError: prev[idx]?.lastError,
            windowsDone: info.windowsDone,
            windowsTotal: info.windowsTotal,
            nodesDone: info.nodesDone,
            nodesTotal: info.nodesTotal,
            pageFrom: info.pageFrom,
            pageTo: info.pageTo,
            pageTotal: info.pageTotal
          }
          if (idx < 0) return [...prev, nextItem]
          const next = [...prev]
          next[idx] = { ...next[idx], ...nextItem }
          return next
        }
        setGraphJobItems(patchGraphProgress)
        setOrganizeJobItems(patchGraphProgress)
      })
    }
    const throttled = createLatestThrottled(250, applyProgress)
    const unsubscribe = subscribeMobileKnowledgeExtractProgress((info) => {
      if (info.total <= 0 && !(info.windowsTotal && info.windowsTotal > 0)) {
        throttled.flush()
        applyProgress(info)
        return
      }
      throttled.push(info)
    })
    return () => {
      unsubscribe()
      throttled.flush()
    }
  }, [])

  useEffect(() => {
    return subscribeMobileKnowledgeIngestLive((info) => {
      if (!info.live) {
        void refreshDetail().catch(() => undefined)
        return
      }
      const patchRunning = (
        prev: Array<{
          sourceId: string
          title: string
          stage?: string
          status: string
          lastError?: string | null
        }>
      ) => {
        const idx = prev.findIndex(
          (item) => item.sourceId === info.sourceId && (item.stage || '') === info.stage
        )
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], status: 'running' }
          return next
        }
        return [
          ...prev,
          {
            sourceId: info.sourceId,
            title: info.sourceId,
            stage: info.stage,
            status: 'running'
          }
        ]
      }
      setOrganizeJobItems(patchRunning)
      if (info.stage === 'graph') setGraphJobItems(patchRunning)
    })
  }, [refreshDetail])

  const organizeLiveInput = {
    ingestingCount: sources.filter((s) => s.status === 'extracting' || s.status === 'embedding')
      .length,
    sources,
    graphJobItems,
    ingestJobItems: organizeJobItems,
    ocrProgressBySource
  }
  const hasLiveIngest = knowledgeOrganizeHasLiveWork(organizeLiveInput)
  const keepWatching = notebookOrganizeShouldKeepWatching(organizeLiveInput)
  const currentOrganizeCount = knowledgeOrganizeSourceCount({
    ingestingCount: organizeLiveInput.ingestingCount,
    pendingJobs: stats?.pendingJobs ?? 0,
    graphJobItems,
    ingestJobItems: organizeJobItems,
    ocrProgressBySource
  })
  const runningGraph = graphJobItems.find((item) => item.status === 'running')
  const runningGraphProgress = runningGraph ? ocrProgressBySource[runningGraph.sourceId] : undefined
  const graphProgress = runningGraph
    ? [
        runningGraph.title,
        runningGraph.pageTotal && runningGraph.pageTo
          ? `${runningGraph.pageTo}/${runningGraph.pageTotal}`
          : runningGraph.windowsTotal
            ? `${runningGraph.windowsDone ?? 0}/${runningGraph.windowsTotal}`
            : runningGraphProgress?.total
              ? `${runningGraphProgress.page}/${runningGraphProgress.total}`
              : ''
      ]
        .filter(Boolean)
        .join(' ')
    : ''

  useEffect(() => {
    setOrganizeKnownTotal((prev) =>
      knowledgeOrganizeRememberedTotal(
        prev,
        currentOrganizeCount,
        organizeWatching || hasLiveIngest
      )
    )
  }, [currentOrganizeCount, hasLiveIngest, organizeWatching])

  useEffect(() => {
    if (!organizeWatching) return
    if (keepWatching) return
    setOrganizeWatching(false)
  }, [hasLiveIngest, keepWatching, organizeJobItems, organizeWatching, sources])

  const graphRowsRef = useRef({ nodes: graphNodes, edges: graphEdges })
  graphRowsRef.current = { nodes: graphNodes, edges: graphEdges }

  const applyLocalGraphReviewBatch = useCallback(
    (input: { nodeIds: string[]; edgeIds: string[]; status: 'approved' | 'rejected' }) => {
      const next = applyNotebookGraphLocalReviewBatch({
        nodes: graphRowsRef.current.nodes,
        edges: graphRowsRef.current.edges,
        ...input
      })
      graphRowsRef.current = next
      setGraphNodes(next.nodes)
      setGraphEdges(next.edges)
    },
    []
  )
  const applyLocalGraphReview = useCallback(
    (input: { kind: 'node' | 'edge'; id: string; status: 'approved' | 'rejected' }) =>
      applyLocalGraphReviewBatch({
        nodeIds: input.kind === 'node' ? [input.id] : [],
        edgeIds: input.kind === 'edge' ? [input.id] : [],
        status: input.status
      }),
    [applyLocalGraphReviewBatch]
  )

  const persistViewMaxNodes = async (value: number) => {
    const next = parseGraphViewMaxNodes(JSON.stringify(value))
    setViewMaxNodes(next)
    await AsyncStorage.setItem(GRAPH_VIEW_MAX_NODES_STORAGE_KEY, JSON.stringify(next))
  }

  const importing = useKnowledgeDetailImport({
    notebookId,
    embeddingModelLabel,
    graphModelLabel,
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
    refreshDetail,
    applyLocalGraphReview,
    applyLocalGraphReviewBatch,
    enabled: activeTab === 'graph'
  })
  const sourceActions = useKnowledgeDetailSources({
    notebookId,
    t,
    toast,
    dialog,
    askHeavyConfirm: heavy.askHeavyConfirm,
    setBusy,
    setError,
    refreshDetail,
    setOrganizeWatching,
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
    setBusy,
    setError,
    setEngine,
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
    refreshDetail,
    setOrganizeWatching
  })

  // 勾选等纯 UI 状态变化不应重新过滤整本笔记本的节点和边
  const pendingNodes = useMemo(
    () => graphNodes.filter((node) => node.reviewStatus === 'pending'),
    [graphNodes]
  )
  const pendingEdges = useMemo(
    () => graphEdges.filter((edge) => edge.reviewStatus === 'pending'),
    [graphEdges]
  )
  const ingestingCount = sources.filter(
    (s) => s.status === 'extracting' || s.status === 'embedding'
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
    detailLoaded,
    busy,
    modelMismatch,
    ingestingCount,
    pasteTitle: importing.pasteTitle,
    setPasteTitle: importing.setPasteTitle,
    pasteText: importing.pasteText,
    setPasteText: importing.setPasteText,
    urlValue: importing.urlValue,
    setUrlValue: importing.setUrlValue,
    importMode: importing.importMode,
    setImportMode: importing.setImportMode,
    openAddSource: importing.openAddSource,
    extractHintPrompt: importing.extractHintPrompt,
    settleExtractHint: importing.settleExtractHint,
    importProcessPrompt: importing.importProcessPrompt,
    settleImportProcess: importing.settleImportProcess,
    importProcessMode,
    embeddingModelLabel,
    graphModelLabel,
    embeddingProviderId,
    graphProviderId,
    visionProviderId,
    modelsLoaded,
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
    applyCoverImage: notebook.applyCoverImage,
    rebuildIndex: notebook.rebuildIndex,
    retrySource: sourceActions.retrySource,
    retryFailedGraph: sourceActions.retryFailedGraph,
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
    probeExtract: notebook.probeExtract,
    probing: notebook.probing,
    probeSourceId,
    setProbeSourceId,
    pickVisionModel: () => setModelSwitcherSlot('vision'),
    pickEmbeddingModel: () => setModelSwitcherSlot('embedding'),
    pickGraphModel: () => setModelSwitcherSlot('graph'),
    modelSwitcherSlot,
    closeModelSwitcher: () => setModelSwitcherSlot(null),
    applyModelSwitcher: async (providerId: string, modelId: string) => {
      const slot = modelSwitcherSlot
      if (!slot) return
      if (slot === 'vision') {
        const prevProvider = visionProviderId
        const prevModel = visionModelId
        setVisionProviderId(providerId)
        setVisionModelId(modelId)
        const ok = await notebook.saveVisionModel(providerId, modelId)
        if (!ok) {
          setVisionProviderId(prevProvider)
          setVisionModelId(prevModel)
          return
        }
        setModelSwitcherSlot(null)
        return
      }
      const ok = await notebook.applySlotModel(slot, providerId, modelId)
      if (!ok) return
      setModelSwitcherSlot(null)
    },
    embeddingModelId,
    graphModelId,
    ocrProgressBySource,
    embedSource: sourceActions.embedSource,
    cancelExtract: sourceActions.cancelExtract,
    cancelOrganizeSource: sourceActions.cancelOrganizeSource,
    restartOrganizeSource: sourceActions.restartOrganizeSource,
    previewExtracted: sourceActions.previewExtracted,
    previewOriginal: sourceActions.previewOriginal,
    sourcePreview: sourceActions.sourcePreview,
    ...vectors,
    ...graph,
    closeSourcePreview: () => {
      sourceActions.closeSourcePreview()
      graph.setFragments([])
    },
    previewGraphFragments: async (edges: KnowledgeGraphEdgeRow[]) => {
      await graph.previewGraphFragments(edges)
      sourceActions.openFragmentPreview(t('knowledge.graph_fragments', '查看原文窗口'))
    },
    extractedPreview,
    closeExtractedPreview: () => setExtractedPreview(null),
    openTextPreview: (title: string, text: string) => setExtractedPreview({ title, text }),
    pendingNodes,
    pendingEdges,
    similarPairs,
    graphProgress,
    graphJobItems,
    organizeJobItems,
    organizeWatching,
    organizeKnownTotal,
    viewMaxNodes,
    persistViewMaxNodes,
    uploadingSources: importing.uploadingSources,
    dismissUploading: importing.dismissUploading,
    heavyPrompt: heavy.prompt,
    settleHeavyConfirm: heavy.settle
  }
}
