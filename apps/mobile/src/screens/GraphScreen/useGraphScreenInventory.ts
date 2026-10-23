import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  GRAPH_INVENTORY_PAGE_SIZE_DEFAULT,
  graphInventoryPageOffset,
  resolveGraphInventoryList,
  toGraphInventoryNode,
  type GraphInventoryNode,
  type GraphSearchMode
} from '@baishou/shared'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import {
  mobileCountLiveCurrentEdges,
  mobileCountLiveNodes,
  mobileListLiveNodesPage
} from '@/src/services/mobile-graph.service'

export function useGraphScreenInventory(deps: {
  vaultId: string
  dbReady: boolean
  query: string
  searchMode: GraphSearchMode
  searchHits: Array<{
    id: string
    name?: string
    nodeType?: string
    summary?: string
    discriminator?: string
    mentionCount?: number
    reviewStatus?: string
  }>
  revision: number
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(GRAPH_INVENTORY_PAGE_SIZE_DEFAULT)
  const [pageItems, setPageItems] = useState<GraphInventoryNode[]>([])
  const [total, setTotal] = useState(0)
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const seqRef = useRef(0)

  useEffect(() => {
    setPage(1)
  }, [deps.query, deps.searchMode])

  const load = useCallback(async () => {
    const requestRevision = deps.revision
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb || !deps.dbReady || !deps.vaultId) return
    const seq = ++seqRef.current
    setLoading(true)
    try {
      const [nodes, filteredTotal, liveNodes, liveEdges] = await Promise.all([
        mobileListLiveNodesPage(runtime.drizzleDb, deps.vaultId, {
          keyword: deps.searchMode === 'text' ? deps.query : '',
          limit: pageSize,
          offset: graphInventoryPageOffset(page, pageSize)
        }),
        mobileCountLiveNodes(
          runtime.drizzleDb,
          deps.vaultId,
          deps.searchMode === 'text' ? deps.query : undefined
        ),
        mobileCountLiveNodes(runtime.drizzleDb, deps.vaultId),
        mobileCountLiveCurrentEdges(runtime.drizzleDb, deps.vaultId)
      ])
      if (seq !== seqRef.current || requestRevision !== deps.revision) return
      setPageItems(nodes.map(toGraphInventoryNode))
      setTotal(filteredTotal)
      setNodeCount(liveNodes)
      setEdgeCount(liveEdges)
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [deps.dbReady, deps.query, deps.searchMode, deps.vaultId, page, pageSize, deps.revision])

  useEffect(() => {
    void load()
  }, [load])

  const listed = useMemo(
    () =>
      resolveGraphInventoryList({
        pageItems,
        total,
        searchHits: deps.searchHits.map(toGraphInventoryNode),
        searchMode: deps.searchMode,
        query: deps.query,
        page,
        pageSize
      }),
    [deps.query, deps.searchHits, deps.searchMode, page, pageItems, pageSize, total]
  )

  return {
    listed,
    nodeCount,
    edgeCount,
    loading,
    pageSize,
    setPage,
    setPageSize: (size: number) => {
      setPageSize(size)
      setPage(1)
    }
  }
}
