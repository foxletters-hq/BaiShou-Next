import { useMemo, useState } from 'react'
import { graphPendingItemKey, splitGraphReviewSelection } from '@baishou/shared'
import { findGraphPageNode } from './graph-page-derive.util'
import type { GraphMergeConfirmTarget } from './GraphIrreversibleConfirm'

type ReviewDeps = {
  t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => string
  toast: { showSuccess: (message: string) => void; showError: (message: string) => void }
  dialog: { confirm: (message: string, title?: string) => Promise<boolean> }
  nodes: any[]
  pendingNodes: any[]
  pendingEdges: any[]
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  setSelectedNode: (node: any | null) => void
  setBusy: (busy: boolean) => void
  refresh: () => Promise<void>
  refreshVisibleAfterReview: () => Promise<void>
  onSelectNode: (id: string) => Promise<void> | void
}

export function useGraphPageReview(deps: ReviewDeps) {
  const [pendingSelected, setPendingSelected] = useState<Set<string>>(() => new Set())
  const [mergeSearchOpen, setMergeSearchOpen] = useState(false)
  const [mergeConfirm, setMergeConfirm] = useState<GraphMergeConfirmTarget | null>(null)

  const pendingCount = deps.pendingNodes.length + deps.pendingEdges.length
  const pendingItemKeys = useMemo(
    () => [
      ...deps.pendingNodes.map((node) => graphPendingItemKey('node', node.id)),
      ...deps.pendingEdges.map((edge) => graphPendingItemKey('edge', edge.id))
    ],
    [deps.pendingNodes, deps.pendingEdges]
  )
  const pendingSelectedCount = pendingItemKeys.filter((key) => pendingSelected.has(key)).length
  const allPendingSelected =
    pendingItemKeys.length > 0 && pendingSelectedCount === pendingItemKeys.length

  const reviewEdge = async (
    edgeId: string,
    reviewStatus: 'approved' | 'rejected',
    endpoints?: { fromId?: string; toId?: string }
  ) => {
    await window.api.graph.setEdgeReview({ edgeId, reviewStatus })
    if (reviewStatus === 'approved') {
      const pendingEnds = [endpoints?.fromId, endpoints?.toId].filter(Boolean) as string[]
      for (const nodeId of pendingEnds) {
        const node =
          deps.pendingNodes.find((n) => n.id === nodeId) ||
          deps.nodes.find((n) => n.id === nodeId && n.reviewStatus === 'pending')
        if (node) {
          await window.api.graph.setNodeReview({ nodeId, reviewStatus: 'approved' })
        }
      }
    }
    await deps.refreshVisibleAfterReview()
  }

  const findGraphNode = (id: string) => findGraphPageNode(id, deps.nodes, deps.pendingNodes)

  const openMergeConfirm = (target: GraphMergeConfirmTarget) => {
    if (target.losers.length === 0) return
    setMergeConfirm(target)
  }

  const dismissSimilarPair = async (nodeId: string, peerId: string) => {
    deps.setBusy(true)
    try {
      await window.api.graph.dismissSimilarPair({ nodeId, peerId })
      await deps.refresh()
      deps.toast.showSuccess(deps.t('graph.similar_dismissed', '已分开保留'))
    } catch (e: any) {
      deps.toast.showError(e?.message || String(e))
    } finally {
      deps.setBusy(false)
    }
  }

  const mergeNodes = (survivorId: string, loserId: string) => {
    if (!survivorId || !loserId || survivorId === loserId) return
    const survivor = findGraphNode(survivorId)
    const loser = findGraphNode(loserId)
    openMergeConfirm({
      survivorId,
      survivorName: String(survivor?.name || survivorId),
      losers: [{ id: loserId, name: String(loser?.name || loserId) }]
    })
  }

  const runConfirmedMerge = async () => {
    if (!mergeConfirm) return
    const { survivorId, losers } = mergeConfirm
    deps.setBusy(true)
    try {
      if (losers.length === 1) {
        await window.api.graph.mergeNodes({
          survivorId,
          loserId: losers[0]!.id,
          reason: 'explicit-merge'
        })
      } else {
        await window.api.graph.mergeNodesBatch({
          survivorId,
          loserIds: losers.map((n) => n.id),
          reason: 'explicit-merge'
        })
      }
      const loserIds = new Set(losers.map((n) => n.id))
      if (deps.selectedId && loserIds.has(deps.selectedId)) {
        deps.setSelectedId(survivorId)
        deps.setSelectedNode(null)
      }
      setMergeConfirm(null)
      setMergeSearchOpen(false)
      await deps.refresh()
      void deps.onSelectNode(survivorId)
      deps.toast.showSuccess(deps.t('graph.nodes_merged', '已合并节点'))
    } catch (e: any) {
      deps.toast.showError(e?.message || String(e))
    } finally {
      deps.setBusy(false)
    }
  }

  const reviewNode = async (nodeId: string, reviewStatus: 'approved' | 'rejected') => {
    await window.api.graph.setNodeReview({ nodeId, reviewStatus })
    if (reviewStatus === 'approved') {
      const incident = deps.pendingEdges.filter((e) => e.fromId === nodeId || e.toId === nodeId)
      for (const edge of incident) {
        await window.api.graph.setEdgeReview({ edgeId: edge.id, reviewStatus: 'approved' })
      }
    }
    await deps.refreshVisibleAfterReview()
  }

  const togglePendingItem = (key: string) => {
    setPendingSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSelectAllPending = () => {
    setPendingSelected(allPendingSelected ? new Set() : new Set(pendingItemKeys))
  }

  const applyPendingReviews = async (opts: {
    reviewStatus: 'approved' | 'rejected'
    allPending?: boolean
  }) => {
    const selected = opts.allPending
      ? { nodeIds: [] as string[], edgeIds: [] as string[] }
      : splitGraphReviewSelection(pendingItemKeys.filter((key) => pendingSelected.has(key)))
    if (!opts.allPending && selected.nodeIds.length === 0 && selected.edgeIds.length === 0) return
    const count = opts.allPending ? pendingCount : pendingSelectedCount
    if (count <= 0) return
    if (opts.reviewStatus === 'rejected' || opts.allPending) {
      const ok = await deps.dialog.confirm(
        opts.allPending
          ? opts.reviewStatus === 'approved'
            ? deps.t(
                'graph.confirm_approve_all',
                '将通过全部 {{count}} 项待确认内容。通过节点时会同时通过相连的待审关系。',
                { count }
              )
            : deps.t(
                'graph.confirm_reject_all',
                '将拒绝全部 {{count}} 项待确认内容。拒绝节点时会同时拒绝与它相连的关系。',
                { count }
              )
          : deps.t(
              'graph.confirm_reject_selected',
              '将拒绝已选的 {{count}} 项。拒绝节点时会同时拒绝与它相连的关系。',
              { count }
            ),
        opts.allPending
          ? opts.reviewStatus === 'approved'
            ? deps.t('graph.approve_all', '全部通过')
            : deps.t('graph.reject_all', '全部拒绝')
          : deps.t('graph.reject_selected', '拒绝所选')
      )
      if (!ok) return
    }
    deps.setBusy(true)
    try {
      await window.api.graph.setReviewsBatch({
        reviewStatus: opts.reviewStatus,
        allPending: Boolean(opts.allPending),
        nodeIds: opts.allPending ? undefined : selected.nodeIds,
        edgeIds: opts.allPending ? undefined : selected.edgeIds
      })
      setPendingSelected(new Set())
      await deps.refreshVisibleAfterReview()
      deps.toast.showSuccess(
        opts.reviewStatus === 'approved'
          ? deps.t('graph.batch_approved', '已通过 {{count}} 项', { count })
          : deps.t('graph.batch_rejected', '已拒绝 {{count}} 项', { count })
      )
    } catch (e: any) {
      deps.toast.showError(e?.message || String(e))
    } finally {
      deps.setBusy(false)
    }
  }

  return {
    pendingSelected,
    setPendingSelected,
    pendingCount,
    pendingItemKeys,
    pendingSelectedCount,
    allPendingSelected,
    mergeSearchOpen,
    setMergeSearchOpen,
    mergeConfirm,
    setMergeConfirm,
    reviewEdge,
    findGraphNode,
    openMergeConfirm,
    mergeNodes,
    dismissSimilarPair,
    runConfirmedMerge,
    reviewNode,
    togglePendingItem,
    toggleSelectAllPending,
    applyPendingReviews
  }
}
