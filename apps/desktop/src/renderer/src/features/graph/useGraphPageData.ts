import { useCallback, useRef, useState } from 'react'
import {
  clampGraphMonthRange,
  omitInFlightGraphDeletes,
  remapGraphViewReviewForDisplay,
  type GraphMonthRange
} from '@baishou/shared'
import type { GraphSimilarPendingPair } from '@baishou/shared'
import type { GraphCostEstimate } from './graph-page.types'

export function useGraphPageData(monthRange: GraphMonthRange, viewMaxNodes: number) {
  const [nodes, setNodes] = useState<any[]>([])
  const [edges, setEdges] = useState<any[]>([])
  const [pendingReextract, setPendingReextract] = useState<any[]>([])
  const [graphHydrated, setGraphHydrated] = useState(false)
  const [pendingNodes, setPendingNodes] = useState<any[]>([])
  const [pendingEdges, setPendingEdges] = useState<any[]>([])
  const [pendingEndpointNodes, setPendingEndpointNodes] = useState<any[]>([])
  const [estimate, setEstimate] = useState<GraphCostEstimate | null>(null)
  const [similarPairs, setSimilarPairs] = useState<GraphSimilarPendingPair[]>([])
  const [revision, setRevision] = useState(0)
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
    const [graph, pending, similar, nextPendingReextract, nextEstimate] = await Promise.all([
      window.api.graph.getGlobalGraph({
        maxNodes: viewMaxNodes,
        monthRange: clampGraphMonthRange(monthRange)
      }),
      window.api.graph.listPending(),
      window.api.graph.listSimilarPairs().catch(() => [] as GraphSimilarPendingPair[]),
      window.api.graph.listPendingReextract(),
      window.api.graph.estimateExtraction().catch(() => null)
    ])
    const remapped = remapGraphViewReviewForDisplay(graph.nodes || [], graph.edges || [])
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
    setPendingReextract(nextPendingReextract)
    setPendingNodes(visible.pendingNodes)
    setPendingEdges(visible.pendingEdges)
    setSimilarPairs(
      similar.filter(
        (pair) =>
          !inFlightDeletedNodeIdsRef.current.has(pair.nodeId) &&
          !inFlightDeletedNodeIdsRef.current.has(pair.peerId)
      )
    )
    setPendingEndpointNodes(
      (pending.endpointNodes || []).filter(
        (node) => !inFlightDeletedNodeIdsRef.current.has(node.id)
      )
    )
    setEstimate(nextEstimate)
    setGraphHydrated(true)
    setRevision((n) => n + 1)
  }, [monthRange, viewMaxNodes])
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
    setSimilarPairs,
    estimate,
    revision,
    refresh,
    refreshRef,
    inFlightDeletedNodeIdsRef,
    inFlightDeletedEdgeIdsRef,
    graphViewRef
  }
}
