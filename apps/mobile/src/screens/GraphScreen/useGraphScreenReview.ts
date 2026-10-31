import { useMemo, useState } from 'react'
import {
  graphPendingItemKey,
  groupSimilarPendingPairsForMerge,
  splitGraphReviewSelection
} from '@baishou/shared'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import {
  mobileDismissSimilarPair,
  mobileGetNode,
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
  dialog: { confirm: (message: any, titleOrOptions?: any) => Promise<boolean> }
  services: { pathService: unknown; fileSystem: unknown } | null
  vaultId: string
  vaultName: string
  graphNodes: any[]
  pendingNodes: any[]
  pendingEdges: any[]
  similarPairs?: any[]
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  setSelectedNode: (node: any | null) => void
  setBusy: (busy: boolean) => void
  refresh: () => Promise<void>
  refreshVisibleAfterReview: (opts?: {
    stripSuspectOnNodeId?: string
    selectedIdOverride?: string
  }) => Promise<void>
}

export function useGraphScreenReview(deps: ReviewDeps) {
  const [pendingSelected, setPendingSelected] = useState<Set<string>>(() => new Set())
  const [reviewingSelectedStatus, setReviewingSelectedStatus] = useState<
    'approved' | 'rejected' | null
  >(null)
  const [mergeSearchOpen, setMergeSearchOpen] = useState(false)
  const [mergeConfirm, setMergeConfirm] = useState<GraphMergeConfirmTarget | null>(null)

  const syncMergedSelection = async (drizzleDb: any, survivorId?: string) => {
    setMergeConfirm(null)
    setMergeSearchOpen(false)
    if (!survivorId) {
      await deps.refresh()
      return
    }
    deps.setSelectedId(survivorId)
    try {
      const updatedSurvivor = await mobileGetNode(drizzleDb, deps.vaultId, survivorId)
      deps.setSelectedNode(updatedSurvivor)
    } catch {
      deps.setSelectedNode(null)
    }
    await deps.refreshVisibleAfterReview({ selectedIdOverride: survivorId })
  }

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
    if (!deps.services) {
      deps.toast.showError(deps.t('graph.review_unavailable', '现在无法审核，请稍后重试'))
      return
    }
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) {
      deps.toast.showError(deps.t('graph.review_unavailable', '现在无法审核，请稍后重试'))
      return
    }
    deps.setBusy(true)
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
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
          const freshNode = await mobileGetNode(runtime.drizzleDb, deps.vaultId, nodeId)
          if (freshNode && freshNode.reviewStatus === 'pending') {
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
      deps.toast.showSuccess(
        reviewStatus === 'approved'
          ? deps.t('graph.batch_approved', '已通过 {{count}} 项', { count: 1 })
          : deps.t('graph.batch_rejected', '已拒绝 {{count}} 项', { count: 1 })
      )
    } catch (e: any) {
      deps.toast.showError(e?.message || String(e))
    } finally {
      deps.setBusy(false)
    }
  }

  const reviewNode = async (nodeId: string, reviewStatus: 'approved' | 'rejected') => {
    if (!deps.services) {
      deps.toast.showError(deps.t('graph.review_unavailable', '现在无法审核，请稍后重试'))
      return
    }
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) {
      deps.toast.showError(deps.t('graph.review_unavailable', '现在无法审核，请稍后重试'))
      return
    }
    deps.setBusy(true)
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
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
      await deps.refreshVisibleAfterReview({ stripSuspectOnNodeId: nodeId })
      deps.toast.showSuccess(
        reviewStatus === 'approved'
          ? deps.t('graph.batch_approved', '已通过 {{count}} 项', { count: 1 })
          : deps.t('graph.batch_rejected', '已拒绝 {{count}} 项', { count: 1 })
      )
    } catch (e: any) {
      deps.toast.showError(e?.message || String(e))
    } finally {
      deps.setBusy(false)
    }
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
    deps.dialog.confirm(opts.message, {
      title: opts.title,
      confirmText: opts.confirmLabel,
      destructive: opts.destructive
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
    setReviewingSelectedStatus(opts.reviewStatus)
    deps.setBusy(true)
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
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
      setReviewingSelectedStatus(null)
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

  const mergeAllSimilarPairs = async () => {
    if (!deps.services) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return
    const groups = groupSimilarPendingPairsForMerge(deps.similarPairs || [])
    if (groups.length === 0) return
    const loserIds = groups.flatMap((group) => group.loserIds)
    if (loserIds.length === 0) return

    const title = deps.t('graph.similar_merge_all', '一键合并全部')
    const message = deps.t(
      'graph.confirm_merge_all_similar',
      '将合并全部 {{count}} 个相似待合并节点（共 {{groups}} 组）。合并不可撤销，被合并节点的关系会改挂到保留节点。',
      { count: loserIds.length, groups: groups.length }
    )
    const ok = await confirmPendingBatch({
      title,
      message,
      confirmLabel: deps.t('common.confirm', '确定')
    })
    if (!ok) return

    const selectedId = deps.selectedId
    const selectedGroup = selectedId
      ? groups.find((group) => group.loserIds.includes(selectedId))
      : undefined
    const failures: string[] = []
    deps.setBusy(true)
    try {
      for (const group of groups) {
        try {
          await mobileMergeGraphNodeGroup({
            drizzleDb: runtime.drizzleDb,
            pathService: deps.services.pathService as never,
            fileSystem: deps.services.fileSystem as never,
            vaultId: deps.vaultId,
            vaultName: deps.vaultName,
            survivorId: group.survivorId,
            loserIds: group.loserIds,
            reason: 'merge-all-similar'
          })
        } catch (e: any) {
          failures.push(e?.message || String(e))
        }
      }
      await syncMergedSelection(runtime.drizzleDb, selectedGroup?.survivorId)
      if (failures.length > 0) {
        deps.toast.showError(
          deps.t('graph.similar_merge_all_failed', '有 {{count}} 组相似节点合并失败：{{message}}', {
            count: failures.length,
            message: failures[0]
          })
        )
        return
      }
      deps.toast.showSuccess(
        deps.t('graph.similar_merged_all', '已合并 {{count}} 个相似节点', {
          count: loserIds.length
        })
      )
    } finally {
      deps.setBusy(false)
    }
  }

  const dismissSimilarPair = async (
    nodeId: string,
    peerId: string,
    nodeName?: string,
    peerName?: string
  ) => {
    if (!deps.services) return
    const runtime = getAgentDbRuntime()
    if (!runtime?.drizzleDb) return

    const pair = (deps.similarPairs || []).find(
      (p) =>
        (p.nodeId === nodeId && p.peerId === peerId) || (p.nodeId === peerId && p.peerId === nodeId)
    )
    const n1 =
      nodeName ||
      pair?.nodeName ||
      deps.graphNodes.find((n) => n.id === nodeId)?.name ||
      deps.pendingNodes.find((n) => n.id === nodeId)?.name
    const n2 =
      peerName ||
      pair?.peerName ||
      deps.graphNodes.find((n) => n.id === peerId)?.name ||
      deps.pendingNodes.find((n) => n.id === peerId)?.name

    const title = deps.t('graph.similar_keep_apart', '不是同一人')
    const message =
      n1 && n2
        ? deps.t(
            'graph.confirm_keep_apart_named',
            '确定「{{name1}}」和「{{name2}}」不是同一人？确认后将分开保留，不再提示合并。',
            { name1: n1, name2: n2 }
          )
        : deps.t('graph.confirm_keep_apart', '确定不是同一人？确认后将分开保留，不再提示合并。')

    const ok = await confirmPendingBatch({
      title,
      message,
      confirmLabel: deps.t('common.confirm', '确定')
    })
    if (!ok) return

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
      const shouldSelectSurvivor = Boolean(
        deps.selectedId && (loserIds.has(deps.selectedId) || deps.selectedId === survivorId)
      )
      await syncMergedSelection(runtime.drizzleDb, shouldSelectSurvivor ? survivorId : undefined)
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
    reviewingSelectedStatus,
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
    mergeAllSimilarPairs,
    dismissSimilarPair,
    runConfirmedMerge
  }
}
