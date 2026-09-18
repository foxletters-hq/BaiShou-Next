import { useCallback, useRef, useState } from 'react'
import {
  GRAPH_GLOBAL_MAX_NODES,
  clampGraphMonthRange,
  omitInFlightGraphDeletes,
  remapGraphViewReviewForDisplay,
  type GraphMonthRange
} from '@baishou/shared'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import {
  mobileEstimateExtraction,
  mobileGetNode,
  mobileGetView,
  mobileListPending,
  mobileListPendingReextract,
  mobileListSimilarPairs,
  mobileLoadGlobalGraph
} from '@/src/services/mobile-graph.service'
import type { GraphSimilarPendingPair } from '@baishou/shared'
import type { GraphCostEstimate } from './graph-screen.types'
import { viewDepthFor } from './graph-screen-view.util'
import type { GraphFocusDepth } from '@baishou/shared'

type DataDeps = {
  services: {
    pathService: unknown
    fileSystem: unknown
  } | null
  dbReady: boolean
  vaultId: string
  vaultName: string
  monthRange: GraphMonthRange
}

export function useGraphScreenData(deps: DataDeps) {
  const [pending, setPending] = useState<any[]>([])
  const [pendingNodes, setPendingNodes] = useState<any[]>([])
  const [pendingEdges, setPendingEdges] = useState<any[]>([])
  const [pendingEndpointNodes, setPendingEndpointNodes] = useState<any[]>([])
  const [graphNodes, setGraphNodes] = useState<any[]>([])
  const [graphEdges, setGraphEdges] = useState<any[]>([])
  const [estimate, setEstimate] = useState<GraphCostEstimate | null>(null)
  const [similarPairs, setSimilarPairs] = useState<GraphSimilarPendingPair[]>([])
  const inFlightDeletedNodeIdsRef = useRef(new Set<string>())
  const inFlightDeletedEdgeIdsRef = useRef(new Set<string>())
  const graphViewRef = useRef({
    nodes: graphNodes,
    edges: graphEdges,
    pendingNodes,
    pendingEdges,
    localView: null as { nodes: any[]; edges: any[] } | null
  })

  const refresh = useCallback(async () => {
    if (!deps.services || !deps.dbReady) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), deps.vaultId)
    setPending(
      await mobileListPendingReextract({
        vaultName: deps.vaultName,
        vaultId: deps.vaultId,
        shadowRepo,
        pathService: deps.services.pathService as never,
        fileSystem: deps.services.fileSystem as never
      })
    )
    const pendingBundle = await mobileListPending(runtime.drizzleDb, deps.vaultId)
    const similar = await mobileListSimilarPairs(runtime.drizzleDb, deps.vaultId).catch(
      () => [] as GraphSimilarPendingPair[]
    )
    const pendingView = remapGraphViewReviewForDisplay(pendingBundle.nodes, pendingBundle.edges)
    const graph = await mobileLoadGlobalGraph(
      runtime.drizzleDb,
      deps.vaultId,
      GRAPH_GLOBAL_MAX_NODES,
      clampGraphMonthRange(deps.monthRange)
    )
    const remapped = remapGraphViewReviewForDisplay(graph.nodes, graph.edges)
    const visible = omitInFlightGraphDeletes({
      nodes: remapped.nodes,
      edges: remapped.edges,
      pendingNodes: pendingView.nodes.filter((node) => node.reviewStatus === 'pending'),
      pendingEdges: pendingView.edges.filter((edge) => edge.reviewStatus === 'pending'),
      deletedNodeIds: inFlightDeletedNodeIdsRef.current,
      deletedEdgeIds: inFlightDeletedEdgeIdsRef.current
    })
    setSimilarPairs(similar)
    setPendingNodes(visible.pendingNodes)
    setPendingEdges(visible.pendingEdges)
    setPendingEndpointNodes(
      (pendingBundle.endpointNodes || []).filter(
        (node) => !inFlightDeletedNodeIdsRef.current.has(node.id)
      )
    )
    setGraphNodes(visible.nodes)
    setGraphEdges(visible.edges)
    try {
      setEstimate(
        await mobileEstimateExtraction({
          vaultName: deps.vaultName,
          vaultId: deps.vaultId,
          shadowRepo,
          pathService: deps.services.pathService as never,
          fileSystem: deps.services.fileSystem as never
        })
      )
    } catch {
      setEstimate(null)
    }
  }, [deps.services, deps.dbReady, deps.vaultName, deps.vaultId, deps.monthRange])
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  const refreshVisibleAfterReview = async (opts: {
    selectedId: string | null
    pinNeighborhood: boolean
    localView: { nodes: any[]; edges: any[] } | null
    focusDepth: GraphFocusDepth
    setSelectedNode: (node: any | null) => void
    setLocalView: (view: { nodes: any[]; edges: any[] } | null) => void
  }) => {
    await refresh()
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    if (opts.selectedId) {
      opts.setSelectedNode(await mobileGetNode(runtime.drizzleDb, deps.vaultId, opts.selectedId))
    }
    if (!opts.pinNeighborhood || !opts.localView) return
    if (opts.selectedId) {
      const view = await mobileGetView(runtime.drizzleDb, deps.vaultId, {
        centerNodeId: opts.selectedId,
        depth: viewDepthFor(opts.focusDepth)
      })
      opts.setLocalView(view)
      return
    }
    const ids = (opts.localView.nodes || [])
      .map((n: { id?: string }) => n.id)
      .filter(Boolean) as string[]
    const freshNodes = (
      await Promise.all(ids.map((id) => mobileGetNode(runtime.drizzleDb, deps.vaultId, id)))
    ).filter((n): n is NonNullable<typeof n> => n != null && n.reviewStatus !== 'rejected')
    const edgeById = new Map<string, any>()
    for (const id of ids.slice(0, 2)) {
      const view = await mobileGetView(runtime.drizzleDb, deps.vaultId, {
        centerNodeId: id,
        depth: 1
      })
      for (const edge of view.edges || []) edgeById.set(edge.id, edge)
    }
    opts.setLocalView({
      nodes: freshNodes,
      edges: (opts.localView.edges || [])
        .map((edge: { id: string }) => edgeById.get(edge.id) || edge)
        .filter((edge: { reviewStatus?: string }) => edge.reviewStatus !== 'rejected')
    })
  }

  return {
    pending,
    pendingNodes,
    setPendingNodes,
    pendingEdges,
    setPendingEdges,
    pendingEndpointNodes,
    similarPairs,
    graphNodes,
    setGraphNodes,
    graphEdges,
    setGraphEdges,
    estimate,
    refresh,
    refreshRef,
    refreshVisibleAfterReview,
    inFlightDeletedNodeIdsRef,
    inFlightDeletedEdgeIdsRef,
    graphViewRef
  }
}
