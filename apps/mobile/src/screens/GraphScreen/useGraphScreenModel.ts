import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  collectGraphFocusIds,
  deriveLegacyVaultId,
  emptyGraphExtractQueueSnapshot,
  parseDateStr,
  resolveGraphNodeDisplayName,
  buildGraphNodeNameMap,
  clampGraphMonthRange,
  defaultGraphMonthRange,
  type GraphMonthRange
} from '@baishou/shared'
import { useDialog, useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { invalidateMobilePendingEmbedCountsCache } from '@/src/services/mobile-pending-embed-counts'
import {
  mobileClearLifeGraph,
  mobileGetNode,
  mobileListEdgesTouching
} from '@/src/services/mobile-graph.service'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import { subscribeGraphDataChanged } from '@/src/services/mobile-graph-data-changed'
import { mobileGraphExtractQueue } from '@/src/services/mobile-graph-extract-queue.service'
import {
  buildGraphScreenDetailEdges,
  buildGraphScreenDisplayEdges,
  buildGraphScreenDisplayNodes,
  countGraphCanvasNodes
} from './graph-screen-display.util'
import {
  graphScreenPhaseKey,
  parseGraphSourceDate,
  resolveGraphNodeSourcePreview,
  shouldShowGraphEmptyGuide,
  shouldShowGraphMonthEmpty
} from './graph-screen-derive.util'
import type {
  GraphScreenTab,
  GraphScreenTranslateFn,
  GraphSourcePreview
} from './graph-screen.types'
import { useGraphScreenData } from './useGraphScreenData'
import { useGraphScreenDetail } from './useGraphScreenDetail'
import { useGraphScreenExtract } from './useGraphScreenExtract'
import { useGraphScreenReview } from './useGraphScreenReview'
import { useGraphScreenSearch } from './useGraphScreenSearch'
import { useGraphScreenInventory } from './useGraphScreenInventory'
import { consumeGraphPendingFocus, subscribeGraphPendingFocus } from './graph-pending-focus'
import { consumeGraphOpsNodeFocus, subscribeGraphOpsNodeFocus } from './graph-cross-page-focus'
import { useGraphScreenSettings } from './useGraphScreenSettings'

export function useGraphScreenModel(options?: { onUnifiedOrganize?: () => void | Promise<void> }) {
  const { t } = useTranslation()
  const tr = useCallback((key: string, defaultValue?: string) => t(key, defaultValue ?? ''), [t])
  const translate: GraphScreenTranslateFn = useCallback(
    (key, defaultValue, options) =>
      options ? t(key, defaultValue ?? '', options) : t(key, defaultValue ?? ''),
    [t]
  )
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady } = useBaishou()
  const [tab, setTab] = useState<GraphScreenTab>('search')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [dismissGuide, setDismissGuide] = useState(false)
  const [animationTick, setAnimationTick] = useState(0)
  const [sourcePreview, setSourcePreview] = useState<GraphSourcePreview | null>(null)

  useEffect(() => {
    const applyPendingFocus = () => {
      if (consumeGraphPendingFocus()) setTab('pending')
    }
    applyPendingFocus()
    return subscribeGraphPendingFocus(applyPendingFocus)
  }, [])

  const activeVault = services?.vaultService.getActiveVault()
  const vaultName = activeVault?.name || 'Personal'
  const vaultId = activeVault?.id ?? deriveLegacyVaultId(vaultName)

  const settings = useGraphScreenSettings({
    t: translate,
    toast,
    services,
    dbReady,
    vaultId,
    vaultName,
    setStatus
  })
  const data = useGraphScreenData({
    services,
    dbReady,
    vaultId,
    vaultName,
    monthRange: settings.monthRange,
    viewMaxNodes: settings.viewMaxNodes
  })
  const search = useGraphScreenSearch({
    t: translate,
    toast,
    vaultId,
    services,
    graphNodes: data.graphNodes,
    pendingNodes: data.pendingNodes,
    setStatus
  })
  const inventory = useGraphScreenInventory({
    vaultId,
    dbReady,
    query: search.query,
    searchMode: search.searchMode,
    searchHits: search.hits,
    revision: data.revision
  })
  const onSelectNodeRef = useRef(search.onSelectNode)
  onSelectNodeRef.current = search.onSelectNode

  useEffect(() => {
    const applyOpsNodeFocus = () => {
      const id = consumeGraphOpsNodeFocus()
      if (id) void onSelectNodeRef.current(id)
    }
    applyOpsNodeFocus()
    return subscribeGraphOpsNodeFocus(applyOpsNodeFocus)
  }, [])
  const refreshVisibleAfterReview = (opts?: { stripSuspectOnNodeId?: string }) =>
    data.refreshVisibleAfterReview({
      selectedId: search.selectedId,
      pinNeighborhood: search.pinNeighborhood,
      localView: search.localView,
      focusDepth: search.focusDepth,
      setSelectedNode: search.setSelectedNode,
      setLocalView: search.setLocalView,
      stripSuspectOnNodeId: opts?.stripSuspectOnNodeId
    })
  const review = useGraphScreenReview({
    t: translate,
    toast,
    dialog,
    services,
    vaultId,
    vaultName,
    graphNodes: data.graphNodes,
    pendingNodes: data.pendingNodes,
    pendingEdges: data.pendingEdges,
    similarPairs: data.similarPairs,
    selectedId: search.selectedId,
    setSelectedId: search.setSelectedId,
    setSelectedNode: search.setSelectedNode,
    setBusy,
    refresh: data.refresh,
    refreshVisibleAfterReview
  })
  const detail = useGraphScreenDetail({
    t: translate,
    toast,
    dialog,
    services,
    vaultId,
    vaultName,
    selectedId: search.selectedId,
    selectedNode: search.selectedNode,
    setSelectedId: search.setSelectedId,
    setSelectedNode: search.setSelectedNode,
    setLocalView: search.setLocalView,
    setPinNeighborhood: search.setPinNeighborhood,
    setHighlightIds: search.setHighlightIds,
    setHighlightedEdgeIds: search.setHighlightedEdgeIds,
    setLocateIds: search.setLocateIds,
    setStatus,
    setBusy,
    graphNodes: data.graphNodes,
    graphEdges: data.graphEdges,
    pendingNodes: data.pendingNodes,
    pendingEdges: data.pendingEdges,
    pendingSelected: review.pendingSelected,
    setGraphNodes: data.setGraphNodes,
    setGraphEdges: data.setGraphEdges,
    setPendingNodes: data.setPendingNodes,
    setPendingEdges: data.setPendingEdges,
    setPendingSelected: review.setPendingSelected,
    highlightIds: search.highlightIds,
    highlightedEdgeIds: search.highlightedEdgeIds,
    locateIds: search.locateIds,
    localView: search.localView,
    pinNeighborhood: search.pinNeighborhood,
    focusDepth: search.focusDepth,
    refresh: data.refresh,
    onSelectNode: search.onSelectNode,
    inFlightDeletedNodeIdsRef: data.inFlightDeletedNodeIdsRef,
    inFlightDeletedEdgeIdsRef: data.inFlightDeletedEdgeIdsRef,
    graphViewRef: data.graphViewRef
  })
  const extract = useGraphScreenExtract({
    t: translate,
    toast,
    dialog,
    services,
    vaultId,
    vaultName,
    pending: data.pending,
    setStatus,
    setSelfNameReady: settings.setSelfNameReady,
    setDismissGuide,
    refreshRef: data.refreshRef
  })

  data.graphViewRef.current = {
    nodes: data.graphNodes,
    edges: data.graphEdges,
    pendingNodes: data.pendingNodes,
    pendingEdges: data.pendingEdges,
    localView: search.localView
  }

  useEffect(() => {
    if (!dbReady || !vaultId) return
    void data.refreshRef.current().catch((e) => setStatus(String(e?.message || e)))
  }, [dbReady, vaultId, settings.monthRange, settings.viewMaxNodes, data.refreshRef])

  useEffect(() => {
    return subscribeGraphDataChanged(() => {
      void data.refreshRef.current()
    })
  }, [data.refreshRef])

  const updateMonthRange = useCallback(
    (next: GraphMonthRange | Partial<GraphMonthRange>) => {
      const merged = clampGraphMonthRange({ ...settings.monthRange, ...next })
      settings.persistMonthRange(merged)
      search.resetViewForMonthChange()
    },
    [settings, search]
  )
  const resetMonthRange = useCallback(() => {
    updateMonthRange(defaultGraphMonthRange())
  }, [updateMonthRange])

  const canvasNodeCount = countGraphCanvasNodes(data.graphNodes)
  const showAwakenGate = false
  const awakenPending = false
  const showEmptyGuide = shouldShowGraphEmptyGuide({
    selfNameReady: true,
    dismissGuide,
    canvasNodeCount,
    estimate: data.estimate,
    pendingReextractCount: data.pending.length,
    monthRange: settings.monthRange
  })
  const showMonthEmpty = shouldShowGraphMonthEmpty({
    selfNameReady: true,
    showEmptyGuide,
    canvasNodeCount,
    pinNeighborhood: search.pinNeighborhood
  })

  const displayNodes = useMemo(
    () =>
      buildGraphScreenDisplayNodes({
        nodes: data.graphNodes,
        hideEntry: settings.hideEntry,
        approvedOnly: settings.approvedOnly,
        enabledNodeTypes: settings.enabledNodeTypes,
        localView: search.localView,
        selectedId: search.selectedId,
        selectedNode: search.selectedNode,
        pinNeighborhood: search.pinNeighborhood,
        highlightIds: search.highlightIds,
        highlightedEdgeIds: search.highlightedEdgeIds
      }),
    [
      data.graphNodes,
      settings.hideEntry,
      settings.approvedOnly,
      settings.enabledNodeTypes,
      search.localView,
      search.selectedId,
      search.selectedNode,
      search.pinNeighborhood,
      search.highlightIds,
      search.highlightedEdgeIds
    ]
  )
  const displayEdges = useMemo(
    () =>
      buildGraphScreenDisplayEdges({
        displayNodes,
        edges: data.graphEdges,
        approvedOnly: settings.approvedOnly,
        localView: search.localView,
        selectedId: search.selectedId,
        nodes: data.graphNodes,
        pinNeighborhood: search.pinNeighborhood
      }),
    [
      displayNodes,
      data.graphEdges,
      settings.approvedOnly,
      search.localView,
      search.selectedId,
      data.graphNodes,
      search.pinNeighborhood
    ]
  )
  const focusIds = useMemo(() => {
    if (!search.selectedId) return undefined
    return collectGraphFocusIds(search.selectedId, displayEdges, search.focusDepth)
  }, [search.selectedId, displayEdges, search.focusDepth])
  const graphNodeNameById = useMemo(
    () =>
      buildGraphNodeNameMap([
        ...data.graphNodes,
        ...data.pendingNodes,
        ...data.pendingEndpointNodes,
        ...(search.localView?.nodes || [])
      ]),
    [data.graphNodes, data.pendingNodes, data.pendingEndpointNodes, search.localView]
  )
  const detailEdges = useMemo(
    () =>
      buildGraphScreenDetailEdges({
        selectedId: search.selectedId,
        localView: search.localView,
        edges: data.graphEdges,
        resolvePartnerName: (partnerId) =>
          resolveGraphNodeDisplayName(
            graphNodeNameById,
            partnerId,
            t('graph.unknown_node', '未知节点')
          )
      }),
    [search.localView, search.selectedId, data.graphEdges, graphNodeNameById, t]
  )

  const tabItems = useMemo(
    () =>
      [
        ['search', t('graph.tab_search', '搜索')],
        ['pending', `${t('graph.tab_pending', '待确认')}(${review.pendingItems.length})`],
        ['similar', `${t('graph.tab_similar', '相似待合并')}(${data.similarPairs.length})`],
        ['reextract', `${t('graph.tab_reextract', '待重抽')}(${data.pending.length})`]
      ] as const,
    [t, data.pending.length, review.pendingItems.length, data.similarPairs.length]
  )

  const openSource = async (
    dateOrRef: string | null | undefined,
    fallbackExcerpt?: string | null
  ) => {
    const { raw, date } = parseGraphSourceDate(dateOrRef)
    const excerpt = String(fallbackExcerpt || '').trim()
    if (!date && !excerpt && !raw) {
      toast.showInfo(t('graph.source_unavailable', '没有可预览的原文'))
      return
    }
    setSourcePreview({
      date,
      content: excerpt || '',
      excerpt: excerpt || null,
      loading: Boolean(date)
    })
    if (!date) {
      setSourcePreview({
        date: null,
        content: excerpt || raw,
        excerpt: excerpt || null,
        loading: false
      })
      return
    }
    if (!services?.diaryService) {
      setSourcePreview({
        date,
        content: excerpt || t('graph.source_load_failed', '加载原文失败'),
        excerpt: excerpt || null,
        loading: false
      })
      return
    }
    try {
      const entry = await services.diaryService.findByDate(parseDateStr(date))
      const content = String(entry?.content || '').trim() || excerpt
      setSourcePreview({
        date,
        content: content || t('graph.source_not_found', '未找到该日日记原文'),
        excerpt: excerpt || null,
        loading: false
      })
    } catch (e: any) {
      setSourcePreview({
        date,
        content:
          excerpt || String(e?.message || e) || t('graph.source_load_failed', '加载原文失败'),
        excerpt: excerpt || null,
        loading: false
      })
    }
  }

  const openNodeSource = async (nodeId: string, node?: { propsJson?: string | null } | null) => {
    const inMemory = resolveGraphNodeSourcePreview({
      nodeId,
      node,
      edges: [...data.pendingEdges, ...data.graphEdges, ...(search.localView?.edges || [])]
    })
    if (inMemory.sourceRef || inMemory.excerpt) {
      await openSource(inMemory.sourceRef, inMemory.excerpt)
      return
    }
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) {
      toast.showInfo(t('graph.source_unavailable', '没有可预览的原文'))
      return
    }
    try {
      const [freshNode, touching] = await Promise.all([
        node ? Promise.resolve(node) : mobileGetNode(runtime.drizzleDb, vaultId, nodeId),
        mobileListEdgesTouching(runtime.drizzleDb, vaultId, nodeId)
      ])
      const resolved = resolveGraphNodeSourcePreview({
        nodeId,
        node: freshNode,
        edges: touching
      })
      if (!resolved.sourceRef && !resolved.excerpt) {
        toast.showInfo(t('graph.source_unavailable', '没有可预览的原文'))
        return
      }
      await openSource(resolved.sourceRef, resolved.excerpt)
    } catch (e: any) {
      toast.showError(e?.message || t('graph.source_load_failed', '加载原文失败'))
    }
  }

  const clearLifeGraph = async () => {
    if (!services) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    const phrase = t('graph.clear_life_confirm_phrase', '确认清空')
    const input = await dialog.prompt(
      t(
        'graph.clear_life_confirm_input',
        '将删除本工作区人生关系图的全部节点、连线和抽取记录，包括你手改过的内容。同步后其他设备上的人生关系图也会变空。笔记本关系图不会被改动。请输入「{{phrase}}」以确认：',
        { phrase }
      ),
      '',
      t('graph.clear_life_title', '清空人生关系图')
    )
    if (input !== phrase) {
      if (input !== null) {
        toast.showError(t('graph.clear_life_mismatch', '输入内容不匹配，操作已取消。'))
      }
      return
    }
    setBusy(true)
    try {
      const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultId)
      await mobileClearLifeGraph({
        vaultId,
        vaultName,
        drizzleDb: runtime.drizzleDb,
        shadowRepo,
        pathService: services.pathService,
        fileSystem: services.fileSystem,
        stopExtract: () => {
          void mobileGraphExtractQueue.stopAndDropPersisted()
        }
      })
      invalidateMobilePendingEmbedCountsCache()
      search.resetViewForMonthChange()
      extract.setExtractRunning(false)
      extract.setExtractQueue(emptyGraphExtractQueueSnapshot())
      extract.setQueueModalOpen(false)
      toast.showSuccess(t('graph.clear_life_done', '已清空人生关系图'))
      await data.refreshRef.current()
    } catch (e: any) {
      toast.showError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  // 空图「开始整理」走记忆中心同一条 batchEmbed，不要只在本页抽已嵌入的待重抽
  const startOrganize = async () => {
    if (options?.onUnifiedOrganize) {
      await options.onUnifiedOrganize()
      return
    }
    if (!services) return
    const runtime = getAgentDbRuntime()
    if (runtime?.drizzleDb) {
      mobileGraphExtractQueue.setContext({
        vaultId,
        vaultName,
        drizzleDb: runtime.drizzleDb,
        shadowRepo: new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultId),
        pathService: services.pathService,
        fileSystem: services.fileSystem,
        settingsManager: services.settingsManager
      })
    }
    setBusy(true)
    try {
      toast.showInfo(t('memory.readiness_organizing', '正在整理记忆…'))
      await services.ragService.batchEmbed()
      await data.refresh()
    } catch (e: unknown) {
      toast.showError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const saveProfileFromSettings = () =>
    settings.saveProfileFromSettings({
      selectedId: search.selectedId,
      selectedNode: search.selectedNode,
      focusDepth: search.focusDepth,
      setLocalView: search.setLocalView,
      setSelectedNode: search.setSelectedNode,
      refresh: data.refresh
    })

  return {
    t,
    tr,
    toast,
    dialog,
    services,
    dbReady,
    tab,
    setTab,
    tabItems,
    busy,
    status,
    animationTick,
    setAnimationTick,
    sourcePreview,
    setSourcePreview,
    vaultId,
    vaultName,
    settings,
    data,
    search,
    inventory,
    review,
    detail,
    extract,
    updateMonthRange,
    resetMonthRange,
    showEmptyGuide,
    showMonthEmpty,
    displayNodes,
    displayEdges,
    focusIds,
    graphNodeNameById,
    detailEdges,
    openSource,
    openNodeSource,
    clearLifeGraph,
    saveProfileFromSettings,
    setDismissGuide,
    startOrganize,
    phaseKey: graphScreenPhaseKey({ awakenPending, showAwakenGate })
  }
}
