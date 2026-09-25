import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { emptyGraphExtractQueueSnapshot } from '@baishou/shared'
import { useDialog, useToast } from '@baishou/ui'
import { useMemoryReadiness } from '../memory/useMemoryReadiness'
import {
  GRAPH_FILTER_NODE_TYPES,
  countGraphCanvasNodes,
  isGraphCanvasFilterActive,
  isGraphTypeFilterActive
} from './graph-page-display.util'
import {
  graphPagePhaseKey,
  shouldShowGraphEmptyGuide,
  shouldShowGraphMonthEmpty
} from './graph-page-derive.util'
import type { GraphPageProps, GraphPageTranslateFn, GraphSideTab } from './graph-page.types'
import { useGraphPageAwaken } from './useGraphPageAwaken'
import { useGraphPageData } from './useGraphPageData'
import { useGraphPageDetail } from './useGraphPageDetail'
import { useGraphPageExtract } from './useGraphPageExtract'
import { useGraphPageModalEscape } from './useGraphPageModalEscape'
import { useGraphPageMonthRange } from './useGraphPageMonthRange'
import { useGraphPageReview } from './useGraphPageReview'
import { useGraphPageSearch } from './useGraphPageSearch'
import { useGraphPageSelection } from './useGraphPageSelection'
import { useGraphPageSettings } from './useGraphPageSettings'
import { useGraphPageSideLayout } from './useGraphPageSideLayout'
import { useGraphPageSourcePreview } from './useGraphPageSourcePreview'
import { consumeGraphPendingFocus, subscribeGraphPendingFocus } from './graph-pending-focus'

export function useGraphPageModel({
  autoStartOrganize = false,
  onAutoStartOrganizeConsumed,
  onUnifiedOrganize
}: GraphPageProps) {
  const { t } = useTranslation()
  const translate: GraphPageTranslateFn = (key, defaultValue, options) => {
    if (defaultValue === undefined) {
      return options ? t(key, options) : t(key)
    }
    return options ? t(key, defaultValue, options) : t(key, defaultValue)
  }
  const navigate = useNavigate()
  const readiness = useMemoryReadiness()
  const dialog = useDialog()
  const toast = useToast()
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<GraphSideTab>('reextract')
  const [dismissGuide, setDismissGuide] = useState(false)

  const month = useGraphPageMonthRange()
  const settings = useGraphPageSettings()
  const side = useGraphPageSideLayout()
  useEffect(() => {
    const applyPendingFocus = () => {
      if (!consumeGraphPendingFocus()) return
      side.openSide('content')
      setTab('pending')
    }
    applyPendingFocus()
    return subscribeGraphPendingFocus(applyPendingFocus)
  }, [side])
  const data = useGraphPageData(month.monthRange)
  const selection = useGraphPageSelection({
    nodes: data.nodes,
    edges: data.edges,
    pendingNodes: data.pendingNodes,
    pendingEndpointNodes: data.pendingEndpointNodes,
    hideEntry: settings.hideEntry,
    approvedOnly: settings.approvedOnly,
    enabledNodeTypes: settings.enabledNodeTypes,
    unknownNodeLabel: t('graph.unknown_node', '未知节点'),
    mergeMonthRange: month.mergeMonthRange,
    resetMonthRangeValue: month.resetMonthRangeValue,
    openSide: side.openSide,
    sideCollapsed: side.sideCollapsed,
    setSideCollapsedPersist: side.setSideCollapsedPersist,
    setTab,
    refresh: data.refresh
  })
  const search = useGraphPageSearch({
    t: translate,
    toast,
    setStatus,
    setHighlightIds: selection.setHighlightIds,
    setHighlightedEdgeIds: selection.setHighlightedEdgeIds,
    setSelectedId: selection.setSelectedId,
    setSelectedNode: selection.setSelectedNode,
    setLocalView: selection.setLocalView,
    setPinNeighborhood: selection.setPinNeighborhood,
    setLocateIds: selection.setLocateIds,
    setLocateSeq: selection.setLocateSeq
  })
  const review = useGraphPageReview({
    t: translate,
    toast,
    dialog,
    nodes: data.nodes,
    pendingNodes: data.pendingNodes,
    pendingEdges: data.pendingEdges,
    selectedId: selection.selectedId,
    setSelectedId: selection.setSelectedId,
    setSelectedNode: selection.setSelectedNode,
    setBusy,
    refresh: data.refresh,
    refreshVisibleAfterReview: selection.refreshVisibleAfterReview,
    onSelectNode: selection.onSelectNode
  })
  const detail = useGraphPageDetail({
    t: translate,
    toast,
    dialog,
    selectedId: selection.selectedId,
    selectedNode: selection.selectedNode,
    setSelectedId: selection.setSelectedId,
    setSelectedNode: selection.setSelectedNode,
    setLocalView: selection.setLocalView,
    setPinNeighborhood: selection.setPinNeighborhood,
    setHighlightIds: selection.setHighlightIds,
    setHighlightedEdgeIds: selection.setHighlightedEdgeIds,
    setLocateIds: selection.setLocateIds,
    setStatus,
    setBusy,
    busy,
    nodes: data.nodes,
    edges: data.edges,
    pendingNodes: data.pendingNodes,
    pendingEdges: data.pendingEdges,
    pendingSelected: review.pendingSelected,
    setNodes: data.setNodes,
    setEdges: data.setEdges,
    setPendingNodes: data.setPendingNodes,
    setPendingEdges: data.setPendingEdges,
    setPendingSelected: review.setPendingSelected,
    highlightIds: selection.highlightIds,
    highlightedEdgeIds: selection.highlightedEdgeIds,
    locateIds: selection.locateIds,
    localView: selection.localView,
    pinNeighborhood: selection.pinNeighborhood,
    focusDepth: selection.focusDepth,
    refresh: data.refresh,
    onSelectNode: selection.onSelectNode,
    inFlightDeletedNodeIdsRef: data.inFlightDeletedNodeIdsRef,
    inFlightDeletedEdgeIdsRef: data.inFlightDeletedEdgeIdsRef,
    graphViewRef: data.graphViewRef
  })
  const awaken = useGraphPageAwaken({
    t: translate,
    toast,
    setStatus,
    setEdgeTypes: detail.setEdgeTypes,
    setAddEdgeType: detail.setAddEdgeType,
    refresh: data.refresh,
    selectedId: selection.selectedId,
    selectedNode: selection.selectedNode,
    setSelectedNode: selection.setSelectedNode,
    setLocalView: selection.setLocalView,
    focusDepth: selection.focusDepth
  })
  const extract = useGraphPageExtract({
    t: translate,
    toast,
    dialog,
    setStatus,
    setSelfNameReady: awaken.setSelfNameReady,
    setDismissGuide,
    pendingReextract: data.pendingReextract,
    refreshRef: data.refreshRef,
    navigate
  })
  const source = useGraphPageSourcePreview({ t: translate, toast })
  useGraphPageModalEscape({
    mergeSearchOpen: review.mergeSearchOpen,
    createOpen: detail.createOpen,
    mergeConfirm: review.mergeConfirm,
    splitOpen: detail.splitOpen,
    setMergeConfirm: review.setMergeConfirm,
    setSplitOpen: detail.setSplitOpen,
    setMergeSearchOpen: review.setMergeSearchOpen,
    setCreateOpen: detail.setCreateOpen
  })

  data.graphViewRef.current = {
    nodes: data.nodes,
    edges: data.edges,
    pendingNodes: data.pendingNodes,
    pendingEdges: data.pendingEdges,
    localView: selection.localView
  }

  useEffect(() => {
    if (awaken.selfNameReady !== true) return
    void data.refresh().catch((e) => setStatus(String((e as Error)?.message || e)))
    // 自称就绪后拉图；data 对象每次渲染都会换引用
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 见上
  }, [awaken.selfNameReady, data.refresh])

  useEffect(() => {
    const api = window.api as {
      diary?: { onSyncEvent?: (cb: (event: { type?: string }) => void) => () => void }
    }
    const unsubscribe = api.diary?.onSyncEvent?.((event) => {
      if (event?.type !== 'embed-pending-changed') return
      if (awaken.selfNameReady !== true) return
      void data.refresh().catch((e) => setStatus(String((e as Error)?.message || e)))
    })
    return () => {
      unsubscribe?.()
    }
  }, [awaken.selfNameReady, data.refresh])

  const updateMonthRange = (next: Parameters<typeof selection.updateMonthRange>[0]) => {
    selection.updateMonthRange(next)
    search.clearSearchHits()
  }
  const resetMonthRange = () => {
    selection.resetMonthRange()
    search.clearSearchHits()
  }
  const clearToGlobal = () => {
    selection.clearToGlobal()
    search.clearSearchHits()
  }

  const clearLifeGraph = async () => {
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
        toast.showWarning(t('graph.clear_life_mismatch', '输入内容不匹配，操作已取消。'))
      }
      return
    }
    setBusy(true)
    try {
      await window.api.graph.clearLifeGraph()
      selection.setSelectedId(null)
      selection.setSelectedNode(null)
      selection.setLocalView(null)
      selection.setPinNeighborhood(false)
      selection.setHighlightIds(new Set())
      selection.setHighlightedEdgeIds(new Set())
      selection.setLocateIds(null)
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

  const showAwakenGate = awaken.selfNameReady === false
  const awakenPending = awaken.selfNameReady === null
  const canvasNodeCount = countGraphCanvasNodes(data.nodes)
  const showEmptyGuide = shouldShowGraphEmptyGuide({
    selfNameReady: awaken.selfNameReady,
    dismissGuide,
    canvasNodeCount,
    estimate: data.estimate,
    pendingReextractCount: data.pendingReextract.length,
    monthRange: month.monthRange
  })
  const showMonthEmpty = shouldShowGraphMonthEmpty({
    selfNameReady: awaken.selfNameReady,
    showEmptyGuide,
    canvasNodeCount,
    pinNeighborhood: selection.pinNeighborhood
  })
  const typeFilterActive = isGraphTypeFilterActive(settings.enabledNodeTypes)
  const filterActive = isGraphCanvasFilterActive({
    hideEntry: settings.hideEntry,
    approvedOnly: settings.approvedOnly,
    enabledNodeTypes: settings.enabledNodeTypes
  })

  const startOrganize = useCallback(() => {
    if (onUnifiedOrganize) {
      onUnifiedOrganize()
      return
    }
    void (
      window as { api?: { rag?: { triggerBatchEmbed?: () => Promise<unknown> } } }
    ).api?.rag?.triggerBatchEmbed?.()
  }, [onUnifiedOrganize])

  const autoStartConsumedRef = useRef(false)
  useEffect(() => {
    if (!autoStartOrganize || autoStartConsumedRef.current) return
    if (awaken.selfNameReady !== true) return
    if (!data.graphHydrated) return
    autoStartConsumedRef.current = true
    startOrganize()
    onAutoStartOrganizeConsumed?.()
  }, [
    autoStartOrganize,
    awaken.selfNameReady,
    data.graphHydrated,
    startOrganize,
    onAutoStartOrganizeConsumed
  ])

  return {
    t,
    navigate,
    readiness,
    toast,
    status,
    busy,
    tab,
    setTab,
    month,
    settings,
    side,
    data,
    selection,
    search,
    review,
    detail,
    awaken,
    extract,
    source,
    updateMonthRange,
    resetMonthRange,
    clearToGlobal,
    clearLifeGraph,
    showEmptyGuide,
    showMonthEmpty,
    typeFilterActive,
    filterActive,
    phaseKey: graphPagePhaseKey({ awakenPending, showAwakenGate }),
    startOrganize,
    setDismissGuide,
    GRAPH_FILTER_NODE_TYPES
  }
}
