import { useCallback, useRef, useState } from 'react'
import {
  GRAPH_GLOBAL_MAX_NODES,
  clampGraphMonthRange,
  omitInFlightGraphDeletes,
  remapGraphViewReviewForDisplay,
  type GraphMonthRange
} from '@baishou/shared'
import type { GraphSimilarPendingPair } from '@baishou/shared'
import type { GraphCostEstimate } from './graph-page.types'

export function useGraphPageData(monthRange: GraphMonthRange) {
  const [nodes, setNodes] = useState<any[]>([])
  const [edges, setEdges] = useState<any[]>([])
  const [pendingReextract, setPendingReextract] = useState<any[]>([])
  const [graphHydrated, setGraphHydrated] = useState(false)
  const [pendingNodes, setPendingNodes] = useState<any[]>([])
  const [pendingEdges, setPendingEdges] = useState<any[]>([])
  const [pendingEndpointNodes, setPendingEndpointNodes] = useState<any[]>([])
  const [estimate, setEstimate] = useState<GraphCostEstimate | null>(null)
  const [similarPairs, setSimilarPairs] = useState<GraphSimilarPendingPair[]>([])
  const inFlightDeletedNodeIdsRef = useRef(new Set<string>())
  const inFlightDeletedEdgeIdsRef = useRef(new Set<string>())
  const graphViewRef = useRef({
    nodes,
    edges,
    pendingNodes,
    pendingEdges,
    localView: null as { nodes: any[]; edges: any[] } | null
  })

  const refresh = useCallback(async () => {
    const graph = await window.api.graph.getGlobalGraph({
      maxNodes: GRAPH_GLOBAL_MAX_NODES,
      monthRange: clampGraphMonthRange(monthRange)
    })
    const remapped = remapGraphViewReviewForDisplay(graph.nodes || [], graph.edges || [])
    const pending = await window.api.graph.listPending()
    const similar = await window.api.graph.listSimilarPairs().catch(() => [])
    const pendingView = remapGraphViewReviewForDisplay(pending.nodes || [], pending.edges || [])
    const visible = omitInFlightGraphDeletes({
      nodes: remapped.nodes,
      edges: remapped.edges,
      pendingNodes: pendingView.nodes.filter((node) => node.reviewStatus === 'pending'),
      pendingEdges: pendingView.edges.filter((edge) => edge.reviewStatus === 'pending'),
      deletedNodeIds: inFlightDeletedNodeIdsRef.current,
      deletedEdgeIds: inFlightDeletedEdgeIdsRef.current
    })
    setNodes(visible.nodes)
    setEdges(visible.edges)
    setPendingReextract(await window.api.graph.listPendingReextract())
    setPendingNodes(visible.pendingNodes)
    setPendingEdges(visible.pendingEdges)
    setSimilarPairs(similar)
    setPendingEndpointNodes(
      (pending.endpointNodes || []).filter(
        (node) => !inFlightDeletedNodeIdsRef.current.has(node.id)
      )
    )
    try {
      setEstimate(await window.api.graph.estimateExtraction())
    } catch {
      setEstimate(null)
    }
    setGraphHydrated(true)
  }, [monthRange])
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    pendingReextract,
    graphHydrated,
    pendingNodes,
    setPendingNodes,
    pendingEdges,
    setPendingEdges,
    pendingEndpointNodes,
    similarPairs,
    estimate,
    refresh,
    refreshRef,
    inFlightDeletedNodeIdsRef,
    inFlightDeletedEdgeIdsRef,
    graphViewRef
  }
}
