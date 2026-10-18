import { useCallback, useEffect, useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import {
  collectNotebookGraphSourceWindows,
  GRAPH_FOCUS_DEPTH_DEFAULT,
  graphPendingItemKey,
  splitGraphReviewSelection,
  type GraphFocusDepth,
  type GraphSimilarPendingPair
} from '@baishou/shared'
import { useDialog, useNativeToast } from '@baishou/ui/native'
import {
  mobileCountNotebookGraph,
  mobileListNotebookGraphNodesPage,
  mobileSearchNotebookGraph,
  mobileSearchNotebookGraphNodes
} from '@/src/services/mobile-knowledge.service'
import { mobileGetExtractedWindows } from '@/src/services/mobile-knowledge-preview.service'
import {
  mobileDismissNotebookSimilarPair,
  mobileMergeNotebookGraphNodes,
  mobileReviewNotebookGraphBatch,
  mobileReviewNotebookGraphEdge,
  mobileReviewNotebookGraphNode
} from '@/src/services/mobile-notebook-graph-review'
import { knowledgeIngestUserMessage } from './knowledge-screen.util'
import {
  buildGraphFragmentItems,
  type KnowledgeSourceFragment
} from './knowledge-source-preview.util'
import type { KnowledgeGraphEdgeRow, KnowledgeGraphNodeRow } from './knowledge-detail.types'
import type { KnowledgeGraphSearchHit } from './KnowledgeNotebookGraphCanvasTab'
import {
  isCurrentNotebookGraphSearch,
  shouldResetNotebookGraphSearch
} from './knowledge-notebook-graph.util'

export function useKnowledgeDetailGraph(input: {
  notebookId: string
  vaultId: string
  nodes: KnowledgeGraphNodeRow[]
  t: TFunction
  toast: ReturnType<typeof useNativeToast>
  dialog: ReturnType<typeof useDialog>
  setError: (message: string) => void
  refreshDetail: () => Promise<void>
  applyLocalGraphReview: (input: {
    kind: 'node' | 'edge'
    id: string
    status: 'approved' | 'rejected'
  }) => void
  applyLocalGraphReviewBatch: (input: {
    nodeIds: string[]
    edgeIds: string[]
    status: 'approved' | 'rejected'
  }) => void
  enabled?: boolean
}) {
  const {
    notebookId,
    vaultId,
    nodes,
    t,
    toast,
    dialog,
    setError,
    refreshDetail,
    applyLocalGraphReview,
    applyLocalGraphReviewBatch,
    enabled = true
  } = input
  const [graphSearchQuery, setGraphSearchQueryState] = useState('')
  const [graphSearchMode, setGraphSearchModeState] = useState<'text' | 'semantic'>('semantic')
  const [graphTab, setGraphTab] = useState<'pending' | 'similar' | 'reextract'>('pending')
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null)
  const [graphHighlightIds, setGraphHighlightIds] = useState<Set<string>>(() => new Set())
  const [graphLocateIds, setGraphLocateIds] = useState<string[] | null>(null)
  const [graphLocateSeq, setGraphLocateSeq] = useState(0)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewingSelectedStatus, setReviewingSelectedStatus] = useState<
    'approved' | 'rejected' | null
  >(null)
  const [fragments, setFragments] = useState<KnowledgeSourceFragment[]>([])
  const [pendingSelection, setPendingSelection] = useState<Set<string>>(() => new Set())
  const [mergeSearchQuery, setMergeSearchQuery] = useState('')
  const [mergeHits, setMergeHits] = useState<
    Array<{ id: string; name: string; nodeType?: string }>
  >([])
  const [mergeLoserIds, setMergeLoserIds] = useState<Set<string>>(() => new Set())
  const [graphSearchHits, setGraphSearchHits] = useState<KnowledgeGraphSearchHit[]>([])
  const [focusDepth, setFocusDepth] = useState<GraphFocusDepth>(GRAPH_FOCUS_DEPTH_DEFAULT)
  const [graphNodePage, setGraphNodePage] = useState(1)
  const [graphNodePageSize, setGraphNodePageSize] = useState(20)
  const [graphNodesPage, setGraphNodesPage] = useState<KnowledgeGraphNodeRow[]>([])
  const [graphNodeTotal, setGraphNodeTotal] = useState(0)
  const [graphInventoryNodeCount, setGraphInventoryNodeCount] = useState(0)
  const [graphInventoryEdgeCount, setGraphInventoryEdgeCount] = useState(0)
  const [graphLoading, setGraphLoading] = useState(false)
  const graphSearchSeqRef = useRef(0)
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
      const keyword = graphSearchMode === 'text' ? graphSearchQuery.trim() : undefined
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
  }, [notebookId, enabled, graphSearchMode, graphSearchQuery, graphNodePage, graphNodePageSize])

  useEffect(() => {
    if (!enabled) return
    void loadGraphPage()
  }, [enabled, loadGraphPage])

  const setGraphSearchQuery = (value: string) => {
    setGraphNodePage(1)
    setGraphSearchQueryState(value)
  }
  const setGraphSearchMode = (mode: 'text' | 'semantic') => {
    setGraphNodePage(1)
    setGraphSearchModeState(mode)
  }
  const setGraphNodePageSizeAndReset = (size: number) => {
    setGraphNodePage(1)
    setGraphNodePageSize(size)
  }

  const locateGraphNode = (nodeId: string) => {
    setSelectedGraphId(nodeId)
    setGraphLocateIds([nodeId])
    setGraphLocateSeq((n) => n + 1)
  }

  const searchGraph = async (overrideQuery?: string, overrideMode?: 'text' | 'semantic') => {
    const q = (overrideQuery !== undefined ? overrideQuery : graphSearchQuery).trim()
    const mode = overrideMode ?? graphSearchMode
    const seq = ++graphSearchSeqRef.current
    if (shouldResetNotebookGraphSearch(q)) {
      setGraphHighlightIds(new Set())
      setGraphLocateIds(null)
      setGraphSearchHits([])
      setSelectedGraphId(null)
      return
    }
    if (mode !== 'semantic') return
    try {
      const groups = await mobileSearchNotebookGraph({
        notebookId,
        query: q,
        limit: graphNodePageSize
      })
      if (!isCurrentNotebookGraphSearch(seq, graphSearchSeqRef.current)) return
      const hits: KnowledgeGraphSearchHit[] = groups.flatMap((group) =>
        group.nodes.map((node) => ({
          id: node.id,
          name: node.name,
          nodeType: node.nodeType,
          summary: node.summary
        }))
      )
      setGraphSearchHits(hits)
      const ids = hits.map((hit) => hit.id)
      setGraphHighlightIds(new Set(ids))
      setGraphLocateIds(ids)
      setGraphLocateSeq((n) => n + 1)
    } catch (e) {
      if (!isCurrentNotebookGraphSearch(seq, graphSearchSeqRef.current)) return
      setError(knowledgeIngestUserMessage(e, t))
    }
  }

  const requireVault = () => {
    if (vaultId) return true
    toast.showError(t('knowledge.vault_required', '还没有打开工作区，无法修改本笔记本图谱'))
    return false
  }

  const reviewDoneMessage = (status: 'approved' | 'rejected', count: number) =>
    status === 'approved'
      ? t('graph.batch_approved', '已通过 {{count}} 项', { count })
      : t('graph.batch_rejected', '已拒绝 {{count}} 项', { count })

  const reviewNode = async (nodeId: string, status: 'approved' | 'rejected') => {
    if (!requireVault()) return
    applyLocalGraphReview({ kind: 'node', id: nodeId, status })
    setReviewBusy(true)
    try {
      await mobileReviewNotebookGraphNode({ notebookId, nodeId, reviewStatus: status, vaultId })
      toast.showSuccess(reviewDoneMessage(status, 1))
    } catch (e) {
      toast.showError(knowledgeIngestUserMessage(e, t))
      await refreshDetail()
    } finally {
      setReviewBusy(false)
    }
  }

  const reviewEdge = async (edgeId: string, status: 'approved' | 'rejected') => {
    if (!requireVault()) return
    applyLocalGraphReview({ kind: 'edge', id: edgeId, status })
    setReviewBusy(true)
    try {
      await mobileReviewNotebookGraphEdge({ notebookId, edgeId, reviewStatus: status, vaultId })
      toast.showSuccess(reviewDoneMessage(status, 1))
    } catch (e) {
      toast.showError(knowledgeIngestUserMessage(e, t))
      await refreshDetail()
    } finally {
      setReviewBusy(false)
    }
  }

  const reviewAllPending = async (status: 'approved' | 'rejected') => {
    if (!requireVault()) return
    setReviewBusy(true)
    try {
      await mobileReviewNotebookGraphBatch({
        notebookId,
        vaultId,
        reviewStatus: status,
        allPending: true
      })
      setPendingSelection(new Set())
      await refreshDetail()
      toast.showSuccess(t('common.success', '操作成功'))
    } catch (e) {
      toast.showError(knowledgeIngestUserMessage(e, t))
    } finally {
      setReviewBusy(false)
    }
  }

  const toggleSelectAllPending = (
    pendingNodeRows: Array<{ id: string }>,
    pendingEdgeRows: Array<{ id: string }>
  ) => {
    const keys = [
      ...pendingNodeRows.map((node) => graphPendingItemKey('node', node.id)),
      ...pendingEdgeRows.map((edge) => graphPendingItemKey('edge', edge.id))
    ]
    setPendingSelection((prev) => {
      const allSelected = keys.length > 0 && keys.every((key) => prev.has(key))
      return allSelected ? new Set() : new Set(keys)
    })
  }

  const togglePendingSelection = (kind: 'node' | 'edge', id: string) => {
    const key = graphPendingItemKey(kind, id)
    setPendingSelection((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const reviewSelectedPending = async (status: 'approved' | 'rejected') => {
    if (!requireVault()) return
    if (pendingSelection.size === 0) return
    const previousSelection = pendingSelection
    setReviewingSelectedStatus(status)
    setReviewBusy(true)
    try {
      // 先让原生界面画出 loading，再做同步的本地批量更新，避免点击后首帧卡顿。
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
      const split = splitGraphReviewSelection(previousSelection)
      const count = split.nodeIds.length + split.edgeIds.length
      if (count === 0) return
      // 先在本地一次性乐观更新：列表立即变化，不等写库，更不等索引同步
      applyLocalGraphReviewBatch({ nodeIds: split.nodeIds, edgeIds: split.edgeIds, status })
      setPendingSelection(new Set())
      await mobileReviewNotebookGraphBatch({
        notebookId,
        vaultId,
        reviewStatus: status,
        nodeIds: split.nodeIds,
        edgeIds: split.edgeIds
      })
      toast.showSuccess(reviewDoneMessage(status, count))
    } catch (e) {
      toast.showError(knowledgeIngestUserMessage(e, t))
      // 写库失败：恢复选择，并从数据库回滚乐观更新
      setPendingSelection(previousSelection)
      await refreshDetail().catch(() => undefined)
    } finally {
      setReviewingSelectedStatus(null)
      setReviewBusy(false)
    }
  }

  const searchMergeNodes = async () => {
    const q = mergeSearchQuery.trim()
    if (!q) {
      setMergeHits([])
      return
    }
    try {
      const selectedType = nodes.find((node) => node.id === selectedGraphId)?.nodeType
      const hits = await mobileSearchNotebookGraphNodes({ notebookId, query: q, limit: 12 })
      setMergeHits(
        hits
          .filter((row) => !selectedType || row.nodeType === selectedType)
          .map((row) => ({ id: row.id, name: row.name, nodeType: row.nodeType }))
      )
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    }
  }

  const toggleMergeLoser = (id: string) => {
    setMergeLoserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const mergeSearchedNodes = async () => {
    if (!requireVault()) return
    const survivorId = selectedGraphId
    if (!survivorId) {
      toast.showError(t('graph.merge_need_survivor', '先在画布点选要保留的节点'))
      return
    }
    const losers = [...mergeLoserIds].filter((id) => id !== survivorId)
    if (losers.length === 0) return
    const loserNames = losers.map(
      (id) =>
        mergeHits.find((hit) => hit.id === id)?.name ||
        nodes.find((node) => node.id === id)?.name ||
        id
    )
    const survivorName = nodes.find((node) => node.id === survivorId)?.name || survivorId
    const ok = await dialog.confirm(
      t('graph.merge_irreversible', '保留 · {{survivor}}\n并入 · {{losers}}\n此操作不能撤销。', {
        survivor: survivorName,
        losers: loserNames.join('、')
      }),
      { title: t('graph.merge', '合并') }
    )
    if (!ok) return
    setReviewBusy(true)
    try {
      for (const loserId of losers) {
        await mobileMergeNotebookGraphNodes({
          notebookId,
          vaultId,
          survivorId,
          loserId
        })
      }
      setMergeLoserIds(new Set())
      setMergeHits([])
      await refreshDetail()
      toast.showSuccess(t('graph.nodes_merged', '已合并节点'))
    } catch (e) {
      toast.showError(knowledgeIngestUserMessage(e, t))
    } finally {
      setReviewBusy(false)
    }
  }

  const mergeSimilar = async (pair: GraphSimilarPendingPair) => {
    if (!requireVault()) return
    const ok = await dialog.confirm(
      t('graph.merge_irreversible', '保留 · {{survivor}}\n并入 · {{losers}}\n此操作不能撤销。', {
        survivor: pair.nodeName,
        losers: pair.peerName
      }),
      { title: t('graph.merge', '合并') }
    )
    if (!ok) return
    setReviewBusy(true)
    try {
      await mobileMergeNotebookGraphNodes({
        notebookId,
        vaultId,
        survivorId: pair.nodeId,
        loserId: pair.peerId
      })
      await refreshDetail()
      toast.showSuccess(t('graph.nodes_merged', '已合并节点'))
    } catch (e) {
      toast.showError(knowledgeIngestUserMessage(e, t))
    } finally {
      setReviewBusy(false)
    }
  }

  const dismissSimilar = async (pair: GraphSimilarPendingPair) => {
    if (!requireVault()) return
    const ok = await dialog.confirm(
      pair.nodeName && pair.peerName
        ? t(
            'graph.confirm_keep_apart_named',
            '确定「{{name1}}」和「{{name2}}」不是同一人？确认后将分开保留，不再提示合并。',
            { name1: pair.nodeName, name2: pair.peerName }
          )
        : t('graph.confirm_keep_apart', '确定不是同一人？确认后将分开保留，不再提示合并。'),
      { title: t('graph.similar_keep_apart', '不是同一人') }
    )
    if (!ok) return
    setReviewBusy(true)
    try {
      await mobileDismissNotebookSimilarPair({
        notebookId,
        vaultId,
        nodeId: pair.nodeId,
        peerId: pair.peerId
      })
      await refreshDetail()
      toast.showSuccess(t('graph.similar_dismissed', '已分开保留'))
    } catch (e) {
      toast.showError(knowledgeIngestUserMessage(e, t))
    } finally {
      setReviewBusy(false)
    }
  }

  const previewGraphFragments = async (edges: KnowledgeGraphEdgeRow[]) => {
    const windows = collectNotebookGraphSourceWindows(edges)
    if (windows.length === 0) {
      setFragments([])
      return []
    }
    try {
      const result = await mobileGetExtractedWindows({
        notebookId,
        windows: windows.map((row) => ({ sourceId: row.sourceId, windowIndex: row.windowIndex }))
      })
      const next = buildGraphFragmentItems(windows, result.items || [])
      setFragments(next)
      return next
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
      return []
    }
  }

  return {
    graphSearchQuery,
    setGraphSearchQuery,
    graphSearchMode,
    setGraphSearchMode,
    graphTab,
    setGraphTab,
    selectedGraphId,
    setSelectedGraphId,
    graphHighlightIds,
    graphLocateIds,
    graphLocateSeq,
    reviewBusy,
    reviewingSelectedStatus,
    fragments,
    graphFragments: fragments,
    setFragments,
    pendingSelection,
    mergeSearchQuery,
    setMergeSearchQuery,
    mergeHits,
    mergeLoserIds,
    graphSearchHits,
    graphNodePage,
    graphNodePageSize,
    graphNodesPage,
    graphNodeTotal,
    graphInventoryNodeCount,
    graphInventoryEdgeCount,
    graphLoading,
    loadGraphPage,
    setGraphNodePage,
    setGraphNodePageSize: setGraphNodePageSizeAndReset,
    focusDepth,
    graphFocusDepth: focusDepth,
    setFocusDepth,
    setGraphFocusDepth: setFocusDepth,
    locateGraphNode,
    searchGraph,
    searchMergeNodes,
    toggleMergeLoser,
    mergeSearchedNodes,
    togglePendingSelection,
    toggleSelectAllPending,
    reviewSelectedPending,
    reviewNode,
    reviewEdge,
    reviewAllPending,
    mergeSimilar,
    dismissSimilar,
    previewGraphFragments
  }
}
