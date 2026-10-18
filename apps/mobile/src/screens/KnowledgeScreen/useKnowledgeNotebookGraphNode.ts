import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { collectNotebookGraphSourceWindows } from '@baishou/shared'
import { useDialog, useNativeToast } from '@baishou/ui/native'
import { mobileGetExtractedWindows } from '@/src/services/mobile-knowledge-preview.service'
import {
  mobileGetNotebookGraphNodePage,
  mobileSearchNotebookGraph,
  mobileSearchNotebookGraphNodes
} from '@/src/services/mobile-knowledge.service'
import {
  mobileMergeNotebookGraphNodes,
  mobileReviewNotebookGraphEdge,
  mobileReviewNotebookGraphNode
} from '@/src/services/mobile-notebook-graph-review'
import { knowledgeIngestUserMessage } from './knowledge-screen.util'
import {
  buildGraphFragmentItems,
  type KnowledgeSourceFragment
} from './knowledge-source-preview.util'
import { filterNotebookGraphMergeHits } from './knowledge-notebook-graph.util'
import type { KnowledgeGraphEdgeRow, KnowledgeGraphNodeRow } from './knowledge-detail.types'

function mapNode(row: {
  id: string
  name: string
  nodeType: string
  reviewStatus?: string
  summary?: string | null
  propsJson?: string | null
  mentionCount?: number
}): KnowledgeGraphNodeRow {
  return {
    id: row.id,
    name: row.name,
    nodeType: row.nodeType,
    reviewStatus: row.reviewStatus,
    summary: row.summary ?? undefined,
    propsJson: row.propsJson ?? undefined,
    mentionCount: row.mentionCount
  }
}

function mapEdge(row: {
  id: string
  fromId: string
  toId: string
  edgeType: string
  reviewStatus?: string
  sourceExcerpt?: string | null
  sourceRef?: string | null
}): KnowledgeGraphEdgeRow {
  return {
    id: row.id,
    fromId: row.fromId,
    toId: row.toId,
    edgeType: row.edgeType,
    reviewStatus: row.reviewStatus,
    sourceExcerpt: row.sourceExcerpt ?? undefined,
    sourceRef: row.sourceRef
  }
}

export function useKnowledgeNotebookGraphNode(input: { notebookId: string; nodeId: string }) {
  const { notebookId, nodeId } = input
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const [vaultId, setVaultId] = useState('')
  const [node, setNode] = useState<KnowledgeGraphNodeRow | null>(null)
  const [partners, setPartners] = useState<KnowledgeGraphNodeRow[]>([])
  const [relatedEdges, setRelatedEdges] = useState<KnowledgeGraphEdgeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)
  const [mergeSearchQuery, setMergeSearchQuery] = useState('')
  const [mergeSearchMode, setMergeSearchMode] = useState<'text' | 'semantic'>('semantic')
  const [mergeHits, setMergeHits] = useState<
    Array<{ id: string; name: string; nodeType?: string }>
  >([])
  const [mergeLoserIds, setMergeLoserIds] = useState<Set<string>>(() => new Set())
  const [mergeSearched, setMergeSearched] = useState(false)
  const [fragments, setFragments] = useState<KnowledgeSourceFragment[]>([])
  const [fragmentsLoading, setFragmentsLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!notebookId || !nodeId) {
      setMissing(true)
      setLoading(false)
      return
    }
    try {
      const page = await mobileGetNotebookGraphNodePage(notebookId, nodeId)
      setVaultId(page.vaultId)
      if (!page.node) {
        setNode(null)
        setPartners([])
        setRelatedEdges([])
        setFragments([])
        setMissing(true)
        return
      }
      setMissing(false)
      setNode(mapNode(page.node))
      setPartners(page.partners.map(mapNode))
      const mappedEdges = page.edges.map(mapEdge).sort((a, b) => {
        const aPending = a.reviewStatus === 'pending' ? 1 : 0
        const bPending = b.reviewStatus === 'pending' ? 1 : 0
        return bPending - aPending
      })
      setRelatedEdges(mappedEdges)
      setFragmentsLoading(true)
      try {
        const windows = collectNotebookGraphSourceWindows(mappedEdges)
        if (windows.length === 0) {
          setFragments([])
        } else {
          const result = await mobileGetExtractedWindows({
            notebookId,
            windows: windows.map((row) => ({
              sourceId: row.sourceId,
              windowIndex: row.windowIndex
            }))
          })
          setFragments(buildGraphFragmentItems(windows, result.items || []))
        }
      } catch (e) {
        setFragments([])
        setError(knowledgeIngestUserMessage(e, t))
      } finally {
        setFragmentsLoading(false)
      }
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setLoading(false)
    }
  }, [notebookId, nodeId, t])

  useEffect(() => {
    setLoading(true)
    setMissing(false)
    setError('')
    setFragments([])
    setFragmentsLoading(false)
    setMergeHits([])
    setMergeLoserIds(new Set())
    setMergeSearched(false)
    setMergeSearchQuery('')
    setMergeSearchMode('semantic')
    void refresh()
  }, [refresh])

  const requireVault = () => {
    if (vaultId) return true
    toast.showError(t('knowledge.vault_required', '还没有打开工作区，无法修改本笔记本图谱'))
    return false
  }

  const reviewNode = async (targetId: string, status: 'approved' | 'rejected') => {
    if (!requireVault()) return
    setReviewBusy(true)
    try {
      await mobileReviewNotebookGraphNode({
        notebookId,
        nodeId: targetId,
        reviewStatus: status,
        vaultId
      })
      await refresh()
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
      await mobileReviewNotebookGraphEdge({
        notebookId,
        edgeId,
        reviewStatus: status,
        vaultId
      })
      await refresh()
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setReviewBusy(false)
    }
  }

  const changeMergeSearchQuery = (value: string) => {
    setMergeSearchQuery(value)
    if (value.trim()) return
    setMergeHits([])
    setMergeLoserIds(new Set())
    setMergeSearched(false)
  }

  const searchMergeNodes = async (overrideQuery?: string, overrideMode?: 'text' | 'semantic') => {
    const q = (overrideQuery !== undefined ? overrideQuery : mergeSearchQuery).trim()
    const mode = overrideMode ?? mergeSearchMode
    if (!q) {
      setMergeHits([])
      setMergeSearched(false)
      return
    }
    try {
      const rows =
        mode === 'semantic'
          ? (
              await mobileSearchNotebookGraph({
                notebookId,
                query: q,
                limit: 12
              })
            ).flatMap((group) =>
              group.nodes.map((row) => ({
                id: row.id,
                name: row.name,
                nodeType: row.nodeType
              }))
            )
          : (
              await mobileSearchNotebookGraphNodes({
                notebookId,
                query: q,
                limit: 12
              })
            ).map((row) => ({
              id: row.id,
              name: row.name,
              nodeType: row.nodeType
            }))
      setMergeHits(
        filterNotebookGraphMergeHits(rows, { currentId: nodeId, nodeType: node?.nodeType })
      )
      setMergeSearched(true)
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
    if (!requireVault() || !node) return
    const losers = [...mergeLoserIds].filter((id) => id !== node.id)
    if (losers.length === 0) return
    const loserNames = losers.map((id) => {
      const hit = mergeHits.find((row) => row.id === id)
      const partner = partners.find((row) => row.id === id)
      return hit?.name || partner?.name || id
    })
    const ok = await dialog.confirm(
      t('graph.merge_irreversible', '保留 · {{survivor}}\n并入 · {{losers}}\n此操作不能撤销。', {
        survivor: node.name,
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
          survivorId: node.id,
          loserId
        })
      }
      setMergeLoserIds(new Set())
      setMergeHits([])
      setMergeSearchQuery('')
      setMergeSearched(false)
      await refresh()
    } catch (e) {
      setError(knowledgeIngestUserMessage(e, t))
    } finally {
      setReviewBusy(false)
    }
  }

  return {
    node,
    partners,
    relatedEdges,
    loading,
    missing,
    error,
    reviewBusy,
    mergeSearchQuery,
    setMergeSearchQuery: changeMergeSearchQuery,
    mergeSearchMode,
    setMergeSearchMode,
    mergeHits,
    mergeLoserIds,
    mergeSearched,
    fragments,
    fragmentsLoading,
    reviewNode,
    reviewEdge,
    searchMergeNodes,
    toggleMergeLoser,
    mergeSearchedNodes
  }
}
