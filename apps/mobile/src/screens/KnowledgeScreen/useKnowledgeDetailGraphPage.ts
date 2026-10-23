import { useCallback, useEffect, useRef, useState } from 'react'
import {
  mobileCountNotebookGraph,
  mobileListNotebookGraphNodesPage
} from '@/src/services/mobile-knowledge.service'
import type { KnowledgeGraphNodeRow } from './knowledge-detail.types'

/**
 * 图数据列表的分页与计数缓存。
 * 搜索关键词/模式变化时由主 hook 重置页码，这里只负责按当前条件取页。
 */
export function useKnowledgeDetailGraphPage(input: {
  notebookId: string
  enabled: boolean
  searchMode: 'text' | 'semantic'
  searchQuery: string
}) {
  const { notebookId, enabled, searchMode, searchQuery } = input
  const [graphNodePage, setGraphNodePage] = useState(1)
  const [graphNodePageSize, setGraphNodePageSize] = useState(20)
  const [graphNodesPage, setGraphNodesPage] = useState<KnowledgeGraphNodeRow[]>([])
  const [graphNodeTotal, setGraphNodeTotal] = useState(0)
  const [graphInventoryNodeCount, setGraphInventoryNodeCount] = useState(0)
  const [graphInventoryEdgeCount, setGraphInventoryEdgeCount] = useState(0)
  const [graphLoading, setGraphLoading] = useState(false)
  const pageSeqRef = useRef(0)
  const countsCacheRef = useRef<{
    keyword: string | undefined
    counts: {
      nodeCount: number
      edgeCount: number
      filteredNodeCount: number
    }
  } | null>(null)

  const loadGraphPage = useCallback(async () => {
    if (!notebookId || !enabled) return
    const seq = ++pageSeqRef.current
    setGraphLoading(true)
    try {
      const keyword = searchMode === 'text' ? searchQuery.trim() : undefined
      const offset = (graphNodePage - 1) * graphNodePageSize
      const cached = countsCacheRef.current
      const needCounts = !cached || cached.keyword !== keyword
      const countsPromise = needCounts
        ? mobileCountNotebookGraph(notebookId, keyword).then((res) => {
            countsCacheRef.current = { keyword, counts: res }
            return res
          })
        : Promise.resolve(cached.counts)
      const [rows, counts] = await Promise.all([
        mobileListNotebookGraphNodesPage({
          notebookId,
          keyword,
          limit: graphNodePageSize,
          offset
        }),
        countsPromise
      ])
      if (seq !== pageSeqRef.current) return
      setGraphNodesPage(rows as KnowledgeGraphNodeRow[])
      setGraphNodeTotal(counts.filteredNodeCount)
      setGraphInventoryNodeCount(counts.nodeCount)
      setGraphInventoryEdgeCount(counts.edgeCount)
    } catch {
      if (seq !== pageSeqRef.current) return
      setGraphNodesPage([])
      setGraphNodeTotal(0)
    } finally {
      if (seq === pageSeqRef.current) {
        setGraphLoading(false)
      }
    }
  }, [notebookId, enabled, searchMode, searchQuery, graphNodePage, graphNodePageSize])

  useEffect(() => {
    if (!enabled) return
    void loadGraphPage()
  }, [enabled, loadGraphPage])

  const setPageSizeAndReset = (size: number) => {
    setGraphNodePage(1)
    setGraphNodePageSize(size)
  }

  return {
    graphNodePage,
    graphNodePageSize,
    graphNodesPage,
    graphNodeTotal,
    graphInventoryNodeCount,
    graphInventoryEdgeCount,
    graphLoading,
    loadGraphPage,
    setGraphNodePage,
    setGraphNodePageSize: setPageSizeAndReset
  }
}
