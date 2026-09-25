import { useMemo, useState } from 'react'
import {
  buildGraphNodeNameMap,
  clampGraphFocusDepth,
  collectGraphFocusIds,
  loadGraphFocusDepth,
  resolveGraphNodeDisplayName,
  saveGraphFocusDepth,
  type GraphFocusDepth,
  type GraphMonthRange
} from '@baishou/shared'
import {
  buildGraphPageDetailEdges,
  buildGraphPageDisplayEdges,
  buildGraphPageDisplayNodes
} from './graph-page-display.util'
import { stripGraphNodeSuspectReason, viewDepthFor } from './graph-page-view.util'
import type { GraphSideMode, GraphSideTab } from './graph-page.types'

type SelectionDeps = {
  nodes: any[]
  edges: any[]
  pendingNodes: any[]
  pendingEndpointNodes: any[]
  hideEntry: boolean
  approvedOnly: boolean
  enabledNodeTypes: Set<string>
  unknownNodeLabel: string
  mergeMonthRange: (next: GraphMonthRange | Partial<GraphMonthRange>) => GraphMonthRange
  resetMonthRangeValue: () => GraphMonthRange
  openSide: (mode: GraphSideMode) => void
  sideCollapsed: boolean
  setSideCollapsedPersist: (collapsed: boolean) => void
  setTab: (tab: GraphSideTab) => void
  refresh: () => Promise<void>
}

export function useGraphPageSelection(deps: SelectionDeps) {
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set())
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<Set<string>>(() => new Set())
  const [locateIds, setLocateIds] = useState<string[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<any | null>(null)
  const [localView, setLocalView] = useState<{ nodes: any[]; edges: any[] } | null>(null)
  /** Pending「查看」：忽略月份切片，画布改用邻域子图。 */
  const [pinNeighborhood, setPinNeighborhood] = useState(false)
  const [locateSeq, setLocateSeq] = useState(0)
  const [focusDepth, setFocusDepth] = useState<GraphFocusDepth>(() => loadGraphFocusDepth())

  const clearViewSelection = () => {
    setPinNeighborhood(false)
    setLocalView(null)
    setHighlightIds(new Set())
    setHighlightedEdgeIds(new Set())
    setLocateIds(null)
    setSelectedId(null)
    setSelectedNode(null)
  }

  const updateMonthRange = (next: GraphMonthRange | Partial<GraphMonthRange>) => {
    deps.mergeMonthRange(next)
    clearViewSelection()
  }

  const resetMonthRange = () => {
    deps.resetMonthRangeValue()
    clearViewSelection()
  }

  const clearToGlobal = () => {
    clearViewSelection()
  }

  const displayNodes = useMemo(
    () =>
      buildGraphPageDisplayNodes({
        nodes: deps.nodes,
        hideEntry: deps.hideEntry,
        approvedOnly: deps.approvedOnly,
        enabledNodeTypes: deps.enabledNodeTypes,
        localView,
        selectedId,
        selectedNode,
        pinNeighborhood,
        highlightIds,
        highlightedEdgeIds
      }),
    [
      deps.nodes,
      deps.hideEntry,
      deps.approvedOnly,
      deps.enabledNodeTypes,
      localView,
      selectedId,
      selectedNode,
      pinNeighborhood,
      highlightIds,
      highlightedEdgeIds
    ]
  )

  const displayEdges = useMemo(
    () =>
      buildGraphPageDisplayEdges({
        displayNodes,
        edges: deps.edges,
        approvedOnly: deps.approvedOnly,
        localView,
        selectedId,
        nodes: deps.nodes,
        pinNeighborhood
      }),
    [
      displayNodes,
      deps.edges,
      deps.approvedOnly,
      localView,
      selectedId,
      deps.nodes,
      pinNeighborhood
    ]
  )

  const focusIds = useMemo(() => {
    if (!selectedId) return undefined
    return collectGraphFocusIds(selectedId, displayEdges, focusDepth)
  }, [selectedId, displayEdges, focusDepth])

  const updateFocusDepth = (depth: GraphFocusDepth) => {
    const next = clampGraphFocusDepth(depth)
    setFocusDepth(next)
    saveGraphFocusDepth(next)
    if (pinNeighborhood && selectedId) {
      void (async () => {
        const view = await window.api.graph.getView({
          centerNodeId: selectedId,
          depth: viewDepthFor(next)
        })
        setLocalView(view)
        setLocateSeq((n) => n + 1)
      })()
    }
  }

  const graphNodeNameById = useMemo(
    () =>
      buildGraphNodeNameMap([
        ...deps.nodes,
        ...deps.pendingNodes,
        ...deps.pendingEndpointNodes,
        ...(localView?.nodes || [])
      ]),
    [deps.nodes, deps.pendingNodes, deps.pendingEndpointNodes, localView]
  )

  const detailEdges = useMemo(
    () =>
      buildGraphPageDetailEdges({
        selectedId,
        localView,
        edges: deps.edges,
        resolvePartnerName: (partnerId) =>
          resolveGraphNodeDisplayName(graphNodeNameById, partnerId, deps.unknownNodeLabel)
      }),
    [localView, selectedId, deps.edges, graphNodeNameById, deps.unknownNodeLabel]
  )

  const onSelectNode = async (id: string, opts?: { locate?: boolean; bypassMonth?: boolean }) => {
    setHighlightedEdgeIds(new Set())
    setLocateIds(null)
    let depthSetting = focusDepth
    if (opts?.bypassMonth && focusDepth < 2) {
      depthSetting = 2
      setFocusDepth(2)
      saveGraphFocusDepth(2)
    }
    const depth = viewDepthFor(depthSetting)
    const node = await window.api.graph.getNode(id)
    const view = await window.api.graph.getView({
      centerNodeId: id,
      depth
    })
    setSelectedId(id)
    setSelectedNode(node)
    setLocalView(view)
    if (opts?.bypassMonth) setPinNeighborhood(true)
    deps.openSide('content')
    if (deps.sideCollapsed) deps.setSideCollapsedPersist(false)
    deps.setTab('detail')
    if (opts?.locate || opts?.bypassMonth) setLocateSeq((n) => n + 1)
  }

  const locatePendingNode = (id: string) => {
    setHighlightedEdgeIds(new Set())
    setLocateIds(null)
    setHighlightIds(new Set())
    void onSelectNode(id, { locate: true, bypassMonth: true })
  }

  const locatePendingEdge = async (edge: {
    id: string
    fromId: string
    toId: string
    edgeType?: string
    reviewStatus?: string
  }) => {
    const from =
      deps.nodes.find((n) => n.id === edge.fromId) ||
      deps.pendingNodes.find((n) => n.id === edge.fromId) ||
      (await window.api.graph.getNode(edge.fromId).catch(() => null))
    const to =
      deps.nodes.find((n) => n.id === edge.toId) ||
      deps.pendingNodes.find((n) => n.id === edge.toId) ||
      (await window.api.graph.getNode(edge.toId).catch(() => null))
    if (!from && !to) return
    if (!from || !to) {
      const only = (from || to) as { id: string }
      void onSelectNode(only.id, { locate: true, bypassMonth: true })
      return
    }
    setSelectedId(null)
    setSelectedNode(null)
    setHighlightIds(new Set([from.id, to.id]))
    setHighlightedEdgeIds(new Set([edge.id]))
    setLocateIds([from.id, to.id])
    setLocalView({ nodes: [from, to], edges: [edge] })
    setPinNeighborhood(true)
    setLocateSeq((n) => n + 1)
  }

  const refreshVisibleAfterReview = async (opts?: { stripSuspectOnNodeId?: string }) => {
    await deps.refresh()
    if (selectedId) {
      try {
        const fresh = await window.api.graph.getNode(selectedId)
        setSelectedNode(
          fresh && opts?.stripSuspectOnNodeId === fresh.id
            ? stripGraphNodeSuspectReason(fresh)
            : fresh
        )
      } catch {
        setSelectedNode(null)
      }
    }
    if (!pinNeighborhood || !localView) return
    if (selectedId) {
      const view = await window.api.graph.getView({
        centerNodeId: selectedId,
        depth: viewDepthFor(focusDepth)
      })
      setLocalView(view)
      return
    }
    const ids = (localView.nodes || [])
      .map((n: { id?: string }) => n.id)
      .filter(Boolean) as string[]
    const freshNodes = (
      await Promise.all(ids.map((id) => window.api.graph.getNode(id).catch(() => null)))
    ).filter((n): n is NonNullable<typeof n> => Boolean(n) && n.reviewStatus !== 'rejected')
    const edgeById = new Map<string, any>()
    for (const id of ids.slice(0, 2)) {
      const view = await window.api.graph.getView({ centerNodeId: id, depth: 1 })
      for (const edge of view.edges || []) edgeById.set(edge.id, edge)
    }
    setLocalView({
      nodes: freshNodes,
      edges: (localView.edges || [])
        .map((edge: { id: string }) => edgeById.get(edge.id) || edge)
        .filter((edge: { reviewStatus?: string }) => edge.reviewStatus !== 'rejected')
    })
  }

  return {
    highlightIds,
    setHighlightIds,
    highlightedEdgeIds,
    setHighlightedEdgeIds,
    locateIds,
    setLocateIds,
    selectedId,
    setSelectedId,
    selectedNode,
    setSelectedNode,
    localView,
    setLocalView,
    pinNeighborhood,
    setPinNeighborhood,
    locateSeq,
    setLocateSeq,
    focusDepth,
    displayNodes,
    displayEdges,
    focusIds,
    updateFocusDepth,
    graphNodeNameById,
    detailEdges,
    onSelectNode,
    locatePendingNode,
    locatePendingEdge,
    updateMonthRange,
    resetMonthRange,
    clearToGlobal,
    clearViewSelection,
    refreshVisibleAfterReview
  }
}
