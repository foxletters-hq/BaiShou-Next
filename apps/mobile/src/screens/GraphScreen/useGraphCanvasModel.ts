import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  collectGraphFocusIds,
  deriveLegacyVaultId,
  clampGraphMonthRange,
  defaultGraphMonthRange,
  type GraphMonthRange
} from '@baishou/shared'
import { useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '@/src/providers/BaishouProvider'
import {
  buildGraphScreenDisplayEdges,
  buildGraphScreenDisplayNodes,
  countGraphCanvasNodes
} from './graph-screen-display.util'
import { shouldShowGraphMonthEmpty } from './graph-screen-derive.util'
import { consumeGraphCanvasLocate, subscribeGraphCanvasLocate } from './graph-cross-page-focus'
import { useGraphScreenData } from './useGraphScreenData'
import { useGraphScreenSearch } from './useGraphScreenSearch'
import { useGraphScreenSettings } from './useGraphScreenSettings'

export function useGraphCanvasModel() {
  const { t } = useTranslation()
  const translate = (key: string, defaultValue?: string, options?: Record<string, unknown>) =>
    options ? t(key, defaultValue ?? '', options) : t(key, defaultValue ?? '')
  const toast = useNativeToast()
  const { services, dbReady } = useBaishou()
  const [status, setStatus] = useState('')
  const [animationTick, setAnimationTick] = useState(0)
  const [peekId, setPeekId] = useState<string | null>(null)

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
  const onSelectNodeRef = useRef(search.onSelectNode)
  const locatePendingEdgeRef = useRef(search.locatePendingEdge)
  onSelectNodeRef.current = search.onSelectNode
  locatePendingEdgeRef.current = search.locatePendingEdge

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

  useEffect(() => {
    const applyLocate = () => {
      const req = consumeGraphCanvasLocate()
      if (!req) return
      if (req.type === 'node') {
        setPeekId(req.id)
        void onSelectNodeRef.current(req.id, { locate: true, bypassMonth: true })
        return
      }
      setPeekId(req.edge.fromId)
      void locatePendingEdgeRef.current(req.edge)
    }
    applyLocate()
    return subscribeGraphCanvasLocate(applyLocate)
  }, [])

  const updateMonthRange = useCallback(
    (next: GraphMonthRange | Partial<GraphMonthRange>) => {
      const merged = clampGraphMonthRange({ ...settings.monthRange, ...next })
      settings.persistMonthRange(merged)
      search.resetViewForMonthChange()
      setPeekId(null)
    },
    [settings, search]
  )
  const resetMonthRange = useCallback(() => {
    updateMonthRange(defaultGraphMonthRange())
  }, [updateMonthRange])

  const canvasNodeCount = countGraphCanvasNodes(data.graphNodes)
  const showMonthEmpty = shouldShowGraphMonthEmpty({
    selfNameReady: settings.selfNameReady,
    showEmptyGuide: false,
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
    const id = peekId || search.selectedId
    if (!id) return undefined
    return collectGraphFocusIds(id, displayEdges, search.focusDepth)
  }, [peekId, search.selectedId, displayEdges, search.focusDepth])

  const peekNode =
    displayNodes.find((n) => n.id === peekId) ||
    (search.selectedId && peekId === search.selectedId ? search.selectedNode : null)

  const onPeekNode = (id: string) => {
    setPeekId(id)
    search.setSelectedId(id)
    search.setSelectedNode(
      displayNodes.find((n) => n.id === id) ||
        data.graphNodes.find((n) => n.id === id) ||
        search.findGraphNode(id)
    )
  }

  const onClearPeek = () => {
    setPeekId(null)
    search.clearSelectionKeepPin()
  }

  return {
    t: translate,
    settings,
    search,
    data,
    status,
    animationTick,
    setAnimationTick,
    peekNode,
    onPeekNode,
    onClearPeek,
    updateMonthRange,
    resetMonthRange,
    showMonthEmpty,
    displayNodes,
    displayEdges,
    focusIds,
    selfNameReady: settings.selfNameReady
  }
}
