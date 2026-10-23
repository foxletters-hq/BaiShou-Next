import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { unstable_batchedUpdates } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import {
  clampOcrConcurrency,
  DEFAULT_OCR_CONCURRENCY,
  type KnowledgeImportProcessMode,
  type NotebookDataManageAction
} from '@baishou/shared'
import { useDialog, useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '@/src/providers/BaishouProvider'
import {
  mobileGetKnowledgeCapabilities,
  mobileGetKnowledgeConfig,
  mobileGetNotebook,
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
import { peekCachedKnowledgeProcessLabels } from '@/src/services/mobile-knowledge-models.service'
import { applyNotebookGraphLocalReviewBatch } from '@/src/services/notebook-graph-review.util'
import { loadKnowledgeDetailOverview } from './knowledge-detail-overview.util'
import { type KnowledgeNotebookStats } from './knowledge-screen.util'
import type {
  KnowledgeGraphEdgeRow,
  KnowledgeGraphNodeRow,
  KnowledgeOcrProgressState,
  KnowledgeSourceRow
} from './knowledge-detail.types'
import {
  createLatestThrottled,
  mergeKnowledgeOrganizeJobProgress
} from './knowledge-organize-banner.util'
import {
  applyKnowledgeExtractProgress,
  patchRunningOrganizeJob
} from './knowledge-organize-live.util'
import { useKnowledgeDetailImport } from './useKnowledgeDetailImport'
import { useKnowledgeDetailSources } from './useKnowledgeDetailSources'
import { useKnowledgeDetailGraph } from './useKnowledgeDetailGraph'
import { useKnowledgeDetailNotebook } from './useKnowledgeDetailNotebook'
import { useKnowledgeDetailVectors } from './useKnowledgeDetailVectors'
import { useKnowledgeDetailModels } from './useKnowledgeDetailModels'
import { useKnowledgeDetailOrganize } from './useKnowledgeDetailOrganize'
import { useKnowledgeDetailPreview } from './useKnowledgeDetailPreview'
import { useKnowledgeDetailViewMaxNodes } from './useKnowledgeDetailViewMaxNodes'
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
  const [similarPairs, setSimilarPairs] = useState<
    Awaited<ReturnType<typeof mobileListNotebookSimilarPendingPairs>>
  >([])
  const [vaultId, setVaultId] = useState('')
  const [ocrCapReason, setOcrCapReason] = useState('')
  const [visionCapReason, setVisionCapReason] = useState('')

  const cachedLabels = peekCachedKnowledgeProcessLabels()
  const {
    fields: modelFields,
    refreshModels,
    setVisionProviderId,
    setVisionModelId,
    setModelSwitcherSlot
  } = useKnowledgeDetailModels({ cachedLabels })
  const preview = useKnowledgeDetailPreview()
  const organize = useKnowledgeDetailOrganize({
    sources,
    pendingJobs: stats?.pendingJobs ?? 0,
    ocrProgressBySource
  })
  const { setGraphJobItems, setOrganizeJobItems, setOrganizeWatching } = organize
  const { viewMaxNodes, persistViewMaxNodes } = useKnowledgeDetailViewMaxNodes()

  const vectors = useKnowledgeDetailVectors({ notebookId, dbReady })

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

    const overviewTask = loadKnowledgeDetailOverview({
      notebookId,
      viewMaxNodes,
      setStats,
      setModelMismatch,
      setGraphNodes,
      setGraphEdges,
      setVaultId,
      setSimilarPairs
    })

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

    await Promise.all([overviewTask, jobsTask])
  }, [notebookId, refreshModels, t, viewMaxNodes, setGraphJobItems, setOrganizeJobItems])

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
  }, [dbReady, notebookId, refreshDetail, setVisionProviderId, setVisionModelId])

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
        applyKnowledgeExtractProgress(info, {
          setOcrProgressBySource,
          setGraphJobItems,
          setOrganizeJobItems
        })
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
  }, [setGraphJobItems, setOrganizeJobItems])

  useEffect(() => {
    return subscribeMobileKnowledgeIngestLive((info) => {
      if (!info.live) {
        void refreshDetail().catch(() => undefined)
        return
      }
      setOrganizeJobItems((prev) => patchRunningOrganizeJob(prev, info))
      if (info.stage === 'graph') {
        setGraphJobItems((prev) => patchRunningOrganizeJob(prev, info))
      }
    })
  }, [refreshDetail, setGraphJobItems, setOrganizeJobItems])

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

  const importing = useKnowledgeDetailImport({
    notebookId,
    embeddingModelLabel: modelFields.embeddingModelLabel,
    graphModelLabel: modelFields.graphModelLabel,
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
    openTextPreview: preview.fields.openTextPreview
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
    setExtractedPreview: preview.setExtractedPreview,
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
    ...organize.fields,
    ...importing,
    importProcessMode,
    ...modelFields,
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
    applyModelSwitcher: async (providerId: string, modelId: string) => {
      const slot = modelFields.modelSwitcherSlot
      if (!slot) return
      if (slot === 'vision') {
        const prevProvider = modelFields.visionProviderId
        const prevModel = modelFields.visionModelId
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
    ...preview.fields,
    pendingNodes,
    pendingEdges,
    similarPairs,
    viewMaxNodes,
    persistViewMaxNodes,
    heavyPrompt: heavy.prompt,
    settleHeavyConfirm: heavy.settle
  }
}
