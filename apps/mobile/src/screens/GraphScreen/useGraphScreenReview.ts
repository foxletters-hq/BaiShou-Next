import { useMemo, useState } from 'react'
import { Alert } from 'react-native'
import { graphPendingItemKey, splitGraphReviewSelection } from '@baishou/shared'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import {
  mobileDismissSimilarPair,
  mobileMergeGraphNodeGroup,
  mobileMergeGraphNodes,
  mobileSetEdgeReview,
  mobileSetNodeReview,
  mobileSetReviewsBatch
} from '@/src/services/mobile-graph.service'
import type { GraphMergeConfirmTarget } from './GraphIrreversibleConfirm'
import { findGraphScreenNode } from './graph-screen-derive.util'
import type { GraphPendingItem, GraphScreenTranslateFn } from './graph-screen.types'

type ReviewDeps = {
  t: GraphScreenTranslateFn
  toast: { showSuccess: (message: string) => void; showError: (message: string) => void }
  services: { pathService: unknown; fileSystem: unknown } | null
  vaultId: string
  vaultName: string
  graphNodes: any[]
  pendingNodes: any[]
  pendingEdges: any[]
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  setSelectedNode: (node: any | null) => void
  setBusy: (busy: boolean) => void
  refresh: () => Promise<void>
  refreshVisibleAfterReview: () => Promise<void>
}

export function useGraphScreenReview(deps: ReviewDeps) {
  const [pendingSelected, setPendingSelected] = useState<Set<string>>(() => new Set())
  const [mergeSearchOpen, setMergeSearchOpen] = useState(false)
  const [mergeConfirm, setMergeConfirm] = useState<GraphMergeConfirmTarget | null>(null)

  const pendingItems: GraphPendingItem[] = useMemo(
    () => [
      ...deps.pendingNodes.map((n) => ({ kind: 'node' as const, id: n.id, data: n })),
      ...deps.pendingEdges.map((e) => ({ kind: 'edge' as const, id: e.id, data: e }))
    ],
    [deps.pendingNodes, deps.pendingEdges]
  )
  const pendingItemKeys = useMemo(
    () => pendingItems.map((item) => graphPendingItemKey(item.kind, item.id)),
    [pendingItems]
  )
  const pendingSelectedCount = pendingItemKeys.filter((key) => pendingSelected.has(key)).length
  const allPendingSelected =
    pendingItemKeys.length > 0 && pendingSelectedCount === pendingItemKeys.length

  const findGraphNode = (id: string) => findGraphScreenNode(id, deps.graphNodes, deps.pendingNodes)

  const reviewEdge = async (
    edgeId: string,
    reviewStatus: 'approved' | 'rejected',
    endpoints?: { fromId?: string; toId?: string }
  ) => {
    if (!deps.services) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    await mobileSetEdgeReview({
      drizzleDb: runtime.drizzleDb,
      pathService: deps.services.pathService as never,
      fileSystem: deps.services.fileSystem as never,
      edgeId,
      reviewStatus,
      vaultDisplayName: deps.vaultName
    })
    if (reviewStatus === 'approved') {
      const pendingEnds = [endpoints?.fromId, endpoints?.toId].filter(Boolean) as string[]
      for (const nodeId of pendingEnds) {
        const node =
          deps.pendingNodes.find((n) => n.id === nodeId) ||
          deps.graphNodes.find((n) => n.id === nodeId && n.reviewStatus === 'pending')
        if (node) {
          await mobileSetNodeReview({
            drizzleDb: runtime.drizzleDb,
            pathService: deps.services.pathService as never,
            fileSystem: deps.services.fileSystem as never,
            nodeId,
            reviewStatus: 'approved',
            vaultDisplayName: deps.vaultName
          })
        }
      }
    }
    await deps.refreshVisibleAfterReview()
  }

  const reviewNode = async (nodeId: string, reviewStatus: 'approved' | 'rejected') => {
    if (!deps.services) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    await mobileSetNodeReview({
      drizzleDb: runtime.drizzleDb,
      pathService: deps.services.pathService as never,
      fileSystem: deps.services.fileSystem as never,
      nodeId,
      reviewStatus,
      vaultDisplayName: deps.vaultName
    })
    if (reviewStatus === 'approved') {
      const incident = deps.pendingEdges.filter((e) => e.fromId === nodeId || e.toId === nodeId)
      for (const edge of incident) {
        await mobileSetEdgeReview({
          drizzleDb: runtime.drizzleDb,
          pathService: deps.services.pathService as never,
          fileSystem: deps.services.fileSystem as never,
          edgeId: edge.id,
          reviewStatus: 'approved',
          vaultDisplayName: deps.vaultName
        })
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

  const confirmPendingBatch = (opts: {
    title: string
    message: string
    confirmLabel: string
    destructive?: boolean
  }): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert(opts.title, opts.message, [
        { text: deps.t('common.cancel', '取消'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: opts.confirmLabel,
          style: opts.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true)
        }
      ])
    })

  const applyPendingReviews = async (opts: {
    reviewStatus: 'approved' | 'rejected'
    allPending?: boolean
  }) => {
    if (!deps.services) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    const selected = opts.allPending
      ? { nodeIds: [] as string[], edgeIds: [] as string[] }
      : splitGraphReviewSelection(pendingItemKeys.filter((key) => pendingSelected.has(key)))
    if (!opts.allPending && selected.nodeIds.length === 0 && selected.edgeIds.length === 0) return
    const count = opts.allPending ? pendingItems.length : pendingSelectedCount
    if (count <= 0) return
    if (opts.reviewStatus === 'rejected' || opts.allPending) {
      const title = opts.allPending
        ? opts.reviewStatus === 'approved'
          ? deps.t('graph.approve_all', '全部通过')
          : deps.t('graph.reject_all', '全部拒绝')
        : deps.t('graph.reject_selected', '拒绝所选')
      const message = opts.allPending
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
          )
      const ok = await confirmPendingBatch({
        title,
        message,
        confirmLabel: title,
        destructive: opts.reviewStatus === 'rejected'
      })
      if (!ok) return
    }
    deps.setBusy(true)
    try {
      await mobileSetReviewsBatch({
        drizzleDb: runtime.drizzleDb,
        pathService: deps.services.pathService as never,
        fileSystem: deps.services.fileSystem as never,
        vaultId: deps.vaultId,
        reviewStatus: opts.reviewStatus,
        allPending: Boolean(opts.allPending),
        nodeIds: opts.allPending ? undefined : selected.nodeIds,
        edgeIds: opts.allPending ? undefined : selected.edgeIds,
        vaultDisplayName: deps.vaultName
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

  const mergeSimilarPair = (
    survivorId: string,
    loserId: string,
    survivorName: string,
    loserName: string
  ) => {
    if (!survivorId || !loserId || survivorId === loserId) return
    setMergeConfirm({
      survivorId,
      survivorName,
      losers: [{ id: loserId, name: loserName }]
    })
  }

  const dismissSimilarPair = async (nodeId: string, peerId: string) => {
    if (!deps.services) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    deps.setBusy(true)
    try {
      await mobileDismissSimilarPair({
        drizzleDb: runtime.drizzleDb,
        pathService: deps.services.pathService as never,
        fileSystem: deps.services.fileSystem as never,
        nodeId,
        peerId,
        vaultDisplayName: deps.vaultName
      })
      await deps.refresh()
      deps.toast.showSuccess(deps.t('graph.similar_dismissed', '已分开保留'))
    } catch (e: any) {
      deps.toast.showError(e?.message || String(e))
    } finally {
      deps.setBusy(false)
    }
  }

  const runConfirmedMerge = async () => {
    if (!deps.services || !mergeConfirm) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    const { survivorId, losers } = mergeConfirm
    deps.setBusy(true)
    try {
      if (losers.length === 1) {
        await mobileMergeGraphNodes({
          drizzleDb: runtime.drizzleDb,
          pathService: deps.services.pathService as never,
          fileSystem: deps.services.fileSystem as never,
          vaultId: deps.vaultId,
          vaultName: deps.vaultName,
          survivorId,
          loserId: losers[0]!.id,
          reason: 'explicit-merge'
        })
      } else {
        await mobileMergeGraphNodeGroup({
          drizzleDb: runtime.drizzleDb,
          pathService: deps.services.pathService as never,
          fileSystem: deps.services.fileSystem as never,
          vaultId: deps.vaultId,
          vaultName: deps.vaultName,
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
      deps.toast.showSuccess(deps.t('graph.nodes_merged', '已合并节点'))
    } catch (e: any) {
      deps.toast.showError(e?.message || String(e))
    } finally {
      deps.setBusy(false)
    }
  }

  return {
    pendingItems,
    pendingItemKeys,
    pendingSelected,
    setPendingSelected,
    pendingSelectedCount,
    allPendingSelected,
    mergeSearchOpen,
    setMergeSearchOpen,
    mergeConfirm,
    setMergeConfirm,
    findGraphNode,
    reviewEdge,
    reviewNode,
    togglePendingItem,
    toggleSelectAllPending,
    applyPendingReviews,
    mergeSimilarPair,
    dismissSimilarPair,
    runConfirmedMerge
  }
}
