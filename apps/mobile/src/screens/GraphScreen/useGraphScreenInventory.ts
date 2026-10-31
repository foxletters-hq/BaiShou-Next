import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  GRAPH_INVENTORY_PAGE_SIZE_DEFAULT,
  applyGraphInventoryEdgeDelete,
  applyGraphInventoryNodeDelete,
  graphInventoryPageOffset,
  resolveGraphInventoryList,
  toGraphInventoryNode,
  type GraphInventoryNode,
  type GraphInventorySnapshot,
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
  const prevRevisionRef = useRef(deps.revision)
  const stateRef = useRef({
    pageItems,
    total,
    nodeCount,
    edgeCount,
    page
  })
  stateRef.current = {
    pageItems,
    total,
    nodeCount,
    edgeCount,
    page
  }

  useEffect(() => {
    setPage(1)
  }, [deps.query, deps.searchMode])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const requestRevision = deps.revision
      const isRevisionRefresh = prevRevisionRef.current !== deps.revision
      prevRevisionRef.current = deps.revision
      const silent = Boolean(
        opts?.silent || (isRevisionRefresh && stateRef.current.pageItems.length > 0)
      )
      const runtime = getAgentDbRuntime()
      if (!runtime?.drizzleDb || !deps.dbReady || !deps.vaultId) return
      const seq = ++seqRef.current
      if (!silent) setLoading(true)
      try {
        const trimmedKeyword = deps.searchMode === 'text' ? deps.query.trim() : ''
        const [nodes, liveNodes, filteredTotalMaybe, liveEdges] = await Promise.all([
          mobileListLiveNodesPage(runtime.drizzleDb, deps.vaultId, {
            keyword: trimmedKeyword,
            limit: pageSize,
            offset: graphInventoryPageOffset(page, pageSize)
          }),
          mobileCountLiveNodes(runtime.drizzleDb, deps.vaultId),
          trimmedKeyword
            ? mobileCountLiveNodes(runtime.drizzleDb, deps.vaultId, trimmedKeyword)
            : Promise.resolve<number | null>(null),
          mobileCountLiveCurrentEdges(runtime.drizzleDb, deps.vaultId)
        ])
        const filteredTotal = filteredTotalMaybe ?? liveNodes
        if (seq !== seqRef.current || requestRevision !== deps.revision) return
        if (filteredTotal > 0 && (page - 1) * pageSize >= filteredTotal) {
          setPage(Math.max(1, Math.ceil(filteredTotal / pageSize)))
          return
        }
        setPageItems(nodes.map(toGraphInventoryNode))
        setTotal(filteredTotal)
        setNodeCount(liveNodes)
        setEdgeCount(liveEdges)
      } finally {
        if (seq === seqRef.current) setLoading(false)
      }
    },
    [deps.dbReady, deps.query, deps.searchMode, deps.vaultId, page, pageSize, deps.revision]
  )

  useEffect(() => {
    void load()
  }, [load])

  const snapshot = useCallback((): GraphInventorySnapshot => ({ ...stateRef.current }), [])

  const applyLocalNodeDelete = useCallback((nodeId: string, deletedEdgeCount = 0) => {
    const next = applyGraphInventoryNodeDelete({
      nodeId,
      deletedEdgeCount,
      ...stateRef.current
    })
    setPageItems(next.pageItems)
    setTotal(next.total)
    setNodeCount(next.nodeCount)
    setEdgeCount(next.edgeCount)
    if (next.page !== stateRef.current.page) {
      setPage(next.page)
    }
  }, [])

  const applyLocalEdgeDelete = useCallback((deletedEdgeCount = 1) => {
    setEdgeCount((prev) => applyGraphInventoryEdgeDelete(prev, deletedEdgeCount))
  }, [])

  const restoreSnapshot = useCallback((snap: GraphInventorySnapshot) => {
    setPageItems(snap.pageItems)
    setTotal(snap.total)
    setNodeCount(snap.nodeCount)
    setEdgeCount(snap.edgeCount)
    setPage(snap.page)
  }, [])

  const reloadSilent = useCallback(async () => {
    await load({ silent: true })
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
    },
    snapshot,
    applyLocalNodeDelete,
    applyLocalEdgeDelete,
    restoreSnapshot,
    reloadSilent
  }
}
