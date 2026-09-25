import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { mobileClearLifeGraph } from '@/src/services/mobile-graph.service'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import { mobileGraphExtractQueue } from '@/src/services/mobile-graph-extract-queue.service'
import {
  GRAPH_FILTER_NODE_TYPES,
  buildGraphScreenDetailEdges,
  buildGraphScreenDisplayEdges,
  buildGraphScreenDisplayNodes,
  countGraphCanvasNodes
} from './graph-screen-display.util'
import {
  graphScreenPhaseKey,
  parseGraphSourceDate,
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
import { consumeGraphPendingFocus, subscribeGraphPendingFocus } from './graph-pending-focus'
import { useGraphScreenSettings } from './useGraphScreenSettings'

export function useGraphScreenModel() {
  const { t } = useTranslation()
  const tr = useCallback((key: string, defaultValue?: string) => t(key, defaultValue ?? ''), [t])
  const translate: GraphScreenTranslateFn = (key, defaultValue, options) =>
    options ? t(key, defaultValue ?? '', options) : t(key, defaultValue ?? '')
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady } = useBaishou()
  const [tab, setTab] = useState<GraphScreenTab>('graph')
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
    monthRange: settings.monthRange
  })
  const search = useGraphScreenSearch({
    t: translate,
    toast,
    vaultId,
    services,
    graphNodes: data.graphNodes,
    pendingNodes: data.pendingNodes,
    setTab,
    setStatus
  })
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
    services,
    vaultId,
    vaultName,
    graphNodes: data.graphNodes,
    pendingNodes: data.pendingNodes,
    pendingEdges: data.pendingEdges,
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
    if (settings.selfNameReady !== true) return
    void data.refresh().catch((e) => setStatus(String(e?.message || e)))
    // 自称就绪后拉图；data 对象每次渲染都会换引用，只跟 refresh 绑定
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 见上
  }, [data.refresh, settings.selfNameReady])

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
  const showAwakenGate = settings.selfNameReady === false
  const awakenPending = settings.selfNameReady === null
  const showEmptyGuide = shouldShowGraphEmptyGuide({
    selfNameReady: settings.selfNameReady,
    dismissGuide,
    canvasNodeCount,
    estimate: data.estimate,
    pendingReextractCount: data.pending.length,
    monthRange: settings.monthRange
  })
  const showMonthEmpty = shouldShowGraphMonthEmpty({
    selfNameReady: settings.selfNameReady,
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
        ['graph', t('graph.tab_graph', '图谱')],
        ['reextract', `${t('graph.tab_reextract', '待重抽')}(${data.pending.length})`],
        ['pending', `${t('graph.tab_pending', '待确认')}(${review.pendingItems.length})`],
        ['similar', `${t('graph.tab_similar', '相似待合并')}(${data.similarPairs.length})`],
        ['search', t('graph.tab_search', '搜索')]
      ] as const,
    [t, data.pending.length, review.pendingItems.length, data.similarPairs.length]
  )

  const openSource = async (
    dateOrRef: string | null | undefined,
    fallbackExcerpt?: string | null
  ) => {
    const { date } = parseGraphSourceDate(dateOrRef)
    const excerpt = String(fallbackExcerpt || '').trim()
    if (!date && !excerpt) return
    setSourcePreview({ date, content: excerpt || '', excerpt: excerpt || null, loading: Boolean(date) })
    if (!date) {
      setSourcePreview({ date: null, content: excerpt, excerpt: excerpt || null, loading: false })
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
        stopExtract: () => mobileGraphExtractQueue.stop()
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
    clearLifeGraph,
    saveProfileFromSettings,
    setDismissGuide,
    startOrganize,
    phaseKey: graphScreenPhaseKey({ awakenPending, showAwakenGate }),
    GRAPH_FILTER_NODE_TYPES
  }
}
