import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  GRAPH_INVENTORY_PAGE_SIZE_DEFAULT,
  graphInventoryPageOffset,
  resolveGraphInventoryList,
  toGraphInventoryNode,
  type GraphInventoryNode,
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

  const load = useCallback(async () => {
    const requestRevision = deps.revision
    const seq = ++seqRef.current
    setLoading(true)
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
      setPageItems((nodes || []).map(toGraphInventoryNode))
      setTotal(Number(filteredTotal) || 0)
      setNodeCount(Number(liveNodes) || 0)
      setEdgeCount(Number(liveEdges) || 0)
      if (searchMode === 'semantic' && query.trim()) {
        const hits = await window.api.graph.search({
          query: query.trim(),
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
      setPageItems([])
      setSearchHits([])
      const copy = graphSearchErrorCopy(error)
      const message = 'key' in copy ? tRef.current(copy.key, copy.fallback) : copy.raw
      toastRef.current.showError(message)
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [deps.revision, page, pageSize, query, searchMode, debouncedQuery])

  useEffect(() => {
    void load()
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
    }
  }
}
