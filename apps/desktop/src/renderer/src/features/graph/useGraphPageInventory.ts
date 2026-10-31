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
import { graphSearchErrorCopy } from './graph-page-derive.util'

export function useGraphPageInventory(deps: {
  revision: number
  t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => string
  toast: { showError: (message: string) => void }
}) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchMode, setSearchMode] = useState<GraphSearchMode>('text')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(GRAPH_INVENTORY_PAGE_SIZE_DEFAULT)
  const [pageItems, setPageItems] = useState<GraphInventoryNode[]>([])
  const [searchHits, setSearchHits] = useState<GraphInventoryNode[]>([])
  const [total, setTotal] = useState(0)
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const seqRef = useRef(0)
  const prevRevisionRef = useRef(deps.revision)
  const stateRef = useRef({
    pageItems,
    searchHits,
    total,
    nodeCount,
    edgeCount,
    page
  })
  stateRef.current = {
    pageItems,
    searchHits,
    total,
    nodeCount,
    edgeCount,
    page
  }
  const toastRef = useRef(deps.toast)
  const tRef = useRef(deps.t)
  toastRef.current = deps.toast
  tRef.current = deps.t

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [debouncedQuery, searchMode])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const requestRevision = deps.revision
      const isRevisionRefresh = prevRevisionRef.current !== deps.revision
      prevRevisionRef.current = deps.revision
      const hasExistingItems =
        stateRef.current.pageItems.length > 0 || stateRef.current.searchHits.length > 0
      const silent = Boolean(opts?.silent || (isRevisionRefresh && hasExistingItems))
      const seq = ++seqRef.current
      if (!silent) setLoading(true)
      try {
        const keyword = searchMode === 'text' ? debouncedQuery : ''
        const [nodes, filteredTotal, liveNodes, liveEdges] = await Promise.all([
          window.api.graph.listLiveNodes({
            keyword,
            limit: pageSize,
            offset: graphInventoryPageOffset(page, pageSize)
          }),
          window.api.graph.countLiveNodes({ keyword }),
          window.api.graph.countLiveNodes(),
          window.api.graph.countLiveEdges()
        ])
        if (seq !== seqRef.current || requestRevision !== deps.revision) return
        const nextTotal = Number(filteredTotal) || 0
        if (nextTotal > 0 && (page - 1) * pageSize >= nextTotal) {
          setPage(Math.max(1, Math.ceil(nextTotal / pageSize)))
          return
        }
        setPageItems((nodes || []).map(toGraphInventoryNode))
        setTotal(nextTotal)
        setNodeCount(Number(liveNodes) || 0)
        setEdgeCount(Number(liveEdges) || 0)
        if (searchMode === 'semantic' && debouncedQuery.trim()) {
          const hits = await window.api.graph.search({
            query: debouncedQuery.trim(),
            limit: pageSize,
            mode: 'semantic'
          })
          if (seq !== seqRef.current || requestRevision !== deps.revision) return
          setSearchHits((hits || []).map(toGraphInventoryNode))
        } else {
          setSearchHits([])
        }
      } catch (error) {
        if (seq !== seqRef.current) return
        if (!silent) {
          setPageItems([])
          setSearchHits([])
        }
        const copy = graphSearchErrorCopy(error)
        const message = 'key' in copy ? tRef.current(copy.key, copy.fallback) : copy.raw
        toastRef.current.showError(message)
      } finally {
        if (seq === seqRef.current) setLoading(false)
      }
    },
    [deps.revision, page, pageSize, searchMode, debouncedQuery]
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
    setSearchHits(next.searchHits)
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
    if (snap.searchHits) setSearchHits(snap.searchHits)
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
        searchHits,
        searchMode,
        query,
        page,
        pageSize
      }),
    [page, pageItems, pageSize, query, searchHits, searchMode, total]
  )

  return {
    query,
    setQuery,
    searchMode,
    setSearchMode,
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
