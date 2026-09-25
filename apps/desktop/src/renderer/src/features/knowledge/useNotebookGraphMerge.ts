import { useCallback, useState } from 'react'
import type { GraphSimilarPendingPair } from '@baishou/shared'
import { toast } from '@baishou/ui'
import { callKnowledgeApi } from './call-knowledge-api'
import type { GraphMergeConfirmTarget } from '../graph/GraphIrreversibleConfirm'
import type { NotebookGraphViewNode } from './notebook-graph-view.util'

export function useNotebookGraphMerge(input: {
  notebookId: string
  nodes: NotebookGraphViewNode[]
  selectedId: string | null
  selectedNode: NotebookGraphViewNode | null
  t: (key: string, defaultValue?: string) => string
  loadView: () => Promise<void>
  locateNode: (id: string) => void
}) {
  const [similarPairs, setSimilarPairs] = useState<GraphSimilarPendingPair[]>([])
  const [mergeSearchOpen, setMergeSearchOpen] = useState(false)
  const [mergeConfirm, setMergeConfirm] = useState<GraphMergeConfirmTarget | null>(null)
  const [mergeBusy, setMergeBusy] = useState(false)

  const loadSimilar = useCallback(async () => {
    if (!input.notebookId) {
      setSimilarPairs([])
      return
    }
    try {
      const pairs = await callKnowledgeApi<GraphSimilarPendingPair[]>(
        'listGraphSimilarPairs',
        'knowledge:list-graph-similar-pairs',
        input.notebookId
      )
      setSimilarPairs(pairs || [])
    } catch {
      setSimilarPairs([])
    }
  }, [input.notebookId])

  const searchMergeNodes = useCallback(
    async (opts: { query: string; nodeTypes?: string[]; limit?: number }) => {
      const hits = await callKnowledgeApi<
        Array<{ id: string; name: string; nodeType: string; reviewStatus?: string }>
      >('graphSearch', 'knowledge:graph-search', {
        notebookId: input.notebookId,
        query: opts.query,
        limit: opts.limit
      })
      const allowed = opts.nodeTypes?.length ? new Set(opts.nodeTypes) : null
      return (hits || []).filter((hit) => !allowed || allowed.has(hit.nodeType))
    },
    [input.notebookId]
  )

  const openMergeConfirm = (target: GraphMergeConfirmTarget) => {
    if (target.losers.length === 0) return
    setMergeConfirm(target)
  }

  const mergePair = (pair: GraphSimilarPendingPair) => {
    openMergeConfirm({
      survivorId: pair.peerId,
      survivorName: pair.peerName,
      losers: [{ id: pair.nodeId, name: pair.nodeName }]
    })
  }

  const dismissPair = async (pair: GraphSimilarPendingPair) => {
    setMergeBusy(true)
    try {
      await callKnowledgeApi('dismissGraphSimilarPair', 'knowledge:dismiss-graph-similar-pair', {
        notebookId: input.notebookId,
        nodeId: pair.nodeId,
        peerId: pair.peerId
      })
      await Promise.all([input.loadView(), loadSimilar()])
      toast.showSuccess(input.t('graph.similar_dismissed', '已分开保留'))
    } catch (error) {
      toast.showError(String((error as Error)?.message || error))
    } finally {
      setMergeBusy(false)
    }
  }

  const runConfirmedMerge = async () => {
    if (!mergeConfirm) return
    const { survivorId, losers } = mergeConfirm
    setMergeBusy(true)
    try {
      if (losers.length === 1) {
        await callKnowledgeApi('mergeGraphNodes', 'knowledge:merge-graph-nodes', {
          notebookId: input.notebookId,
          survivorId,
          loserId: losers[0]!.id,
          reason: 'explicit-merge'
        })
      } else {
        await callKnowledgeApi('mergeGraphNodesBatch', 'knowledge:merge-graph-nodes-batch', {
          notebookId: input.notebookId,
          survivorId,
          loserIds: losers.map((item) => item.id),
          reason: 'explicit-merge'
        })
      }
      setMergeConfirm(null)
      setMergeSearchOpen(false)
      await Promise.all([input.loadView(), loadSimilar()])
      input.locateNode(survivorId)
      toast.showSuccess(input.t('graph.nodes_merged', '已合并节点'))
    } catch (error) {
      toast.showError(String((error as Error)?.message || error))
    } finally {
      setMergeBusy(false)
    }
  }

  return {
    similarPairs,
    mergeSearchOpen,
    mergeConfirm,
    mergeBusy,
    loadSimilar,
    searchMergeNodes,
    setMergeSearchOpen,
    setMergeConfirm,
    openMergeConfirm,
    mergePair,
    dismissPair,
    runConfirmedMerge
  }
}
