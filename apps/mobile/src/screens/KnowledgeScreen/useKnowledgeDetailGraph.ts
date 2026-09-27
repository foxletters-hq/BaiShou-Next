import { useState } from 'react'
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

export function useKnowledgeDetailGraph(input: {
  notebookId: string
  vaultId: string
  nodes: KnowledgeGraphNodeRow[]
  t: TFunction
  toast: ReturnType<typeof useNativeToast>
  dialog: ReturnType<typeof useDialog>
  setError: (message: string) => void
  refreshDetail: () => Promise<void>
}) {
  const { notebookId, vaultId, nodes, t, toast, dialog, setError, refreshDetail } = input
  const [graphSearchQuery, setGraphSearchQuery] = useState('')
  const [graphSearchMode, setGraphSearchMode] = useState<'text' | 'semantic'>('text')
  const [graphTab, setGraphTab] = useState<'canvas' | 'reextract' | 'pending' | 'similar'>('canvas')
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null)
  const [graphHighlightIds, setGraphHighlightIds] = useState<Set<string>>(() => new Set())
  const [graphLocateIds, setGraphLocateIds] = useState<string[] | null>(null)
  const [graphLocateSeq, setGraphLocateSeq] = useState(0)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [fragments, setFragments] = useState<KnowledgeSourceFragment[]>([])
  const [pendingSelection, setPendingSelection] = useState<Set<string>>(() => new Set())
  const [mergeSearchQuery, setMergeSearchQuery] = useState('')
  const [mergeHits, setMergeHits] = useState<
    Array<{ id: string; name: string; nodeType?: string }>
  >([])
  const [mergeLoserIds, setMergeLoserIds] = useState<Set<string>>(() => new Set())
  const [graphSearchHits, setGraphSearchHits] = useState<KnowledgeGraphSearchHit[]>([])
  const [focusDepth, setFocusDepth] = useState<GraphFocusDepth>(GRAPH_FOCUS_DEPTH_DEFAULT)

  const locateGraphNode = (nodeId: string) => {
    setGraphTab('canvas')
    setSelectedGraphId(nodeId)
    setGraphLocateIds([nodeId])
    setGraphLocateSeq((n) => n + 1)
  }

  const searchGraph = async () => {
    const q = graphSearchQuery.trim()
    if (!q) {
      setGraphHighlightIds(new Set())
      setGraphLocateIds(null)
      setGraphSearchHits([])
      return
    }
    try {
      const hits: KnowledgeGraphSearchHit[] =
        graphSearchMode === 'semantic'
          ? (await mobileSearchNotebookGraph({ notebookId, query: q, limit: 12 })).flatMap(
              (group) =>
                group.nodes.map((node) => ({
                  id: node.id,
                  name: node.name,
                  nodeType: node.nodeType,
                  summary: node.summary
                }))
            )
          : (await mobileSearchNotebookGraphNodes({ notebookId, query: q, limit: 12 })).map(
              (row) => ({
                id: row.id,
                name: row.name,
                nodeType: row.nodeType,
                summary: row.summary ?? undefined
              })
            )
      setGraphSearchHits(hits)
      const ids = hits.map((hit) => hit.id)
      setGraphHighlightIds(new Set(ids))
      setGraphLocateIds(ids)
      setGraphLocateSeq((n) => n + 1)
      if (ids[0]) setSelectedGraphId(ids[0])
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    }
  }

  const requireVault = () => {
    if (vaultId) return true
    toast.showError(t('knowledge.vault_required', '还没有打开工作区，无法修改本笔记本图谱'))
    return false
  }

  const reviewNode = async (nodeId: string, status: 'approved' | 'rejected') => {
    if (!requireVault()) return
    setReviewBusy(true)
    try {
      await mobileReviewNotebookGraphNode({ notebookId, nodeId, reviewStatus: status, vaultId })
      await refreshDetail()
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setReviewBusy(false)
    }
  }

  const reviewEdge = async (edgeId: string, status: 'approved' | 'rejected') => {
    if (!requireVault()) return
    setReviewBusy(true)
    try {
      await mobileReviewNotebookGraphEdge({ notebookId, edgeId, reviewStatus: status, vaultId })
      await refreshDetail()
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
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
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
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
    const split = splitGraphReviewSelection(pendingSelection)
    if (split.nodeIds.length === 0 && split.edgeIds.length === 0) return
    setReviewBusy(true)
    try {
      await mobileReviewNotebookGraphBatch({
        notebookId,
        vaultId,
        reviewStatus: status,
        nodeIds: split.nodeIds,
        edgeIds: split.edgeIds
      })
      setPendingSelection(new Set())
      await refreshDetail()
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
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
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
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
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setReviewBusy(false)
    }
  }

  const dismissSimilar = async (pair: GraphSimilarPendingPair) => {
    if (!requireVault()) return
    setReviewBusy(true)
    try {
      await mobileDismissNotebookSimilarPair({
        notebookId,
        vaultId,
        nodeId: pair.nodeId,
        peerId: pair.peerId
      })
      await refreshDetail()
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
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
    fragments,
    setFragments,
    pendingSelection,
    mergeSearchQuery,
    setMergeSearchQuery,
    mergeHits,
    mergeLoserIds,
    graphSearchHits,
    focusDepth,
    setFocusDepth,
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
