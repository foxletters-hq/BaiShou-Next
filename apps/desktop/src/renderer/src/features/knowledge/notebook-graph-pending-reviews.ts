import type { TFunction } from 'i18next'
import { toast, useDialog } from '@baishou/ui'
import { splitGraphReviewSelection } from '@baishou/shared'
import { callKnowledgeApi } from './call-knowledge-api'

export async function applyNotebookGraphPendingReviews(input: {
  notebookId: string
  reviewStatus: 'approved' | 'rejected'
  allPending?: boolean
  pendingCount: number
  pendingSelectedCount: number
  pendingItemKeys: string[]
  pendingSelected: Set<string>
  pendingNodes: Array<{ id: string }>
  pendingEdges: Array<{ id: string }>
  t: TFunction
  dialog: Pick<ReturnType<typeof useDialog>, 'confirm'>
  loadView: () => Promise<void>
  setPendingSelected: (next: Set<string>) => void
  setReviewBusy: (busy: boolean) => void
}): Promise<void> {
  const selected = input.allPending
    ? {
        nodeIds: input.pendingNodes.map((node) => node.id),
        edgeIds: input.pendingEdges.map((edge) => edge.id)
      }
    : splitGraphReviewSelection(
        input.pendingItemKeys.filter((key) => input.pendingSelected.has(key))
      )
  const count = input.allPending ? input.pendingCount : input.pendingSelectedCount
  if (count === 0) return
  if (input.reviewStatus === 'rejected' || input.allPending) {
    const ok = await input.dialog.confirm(
      input.allPending
        ? input.reviewStatus === 'approved'
          ? input.t(
              'graph.confirm_approve_all',
              '将通过全部 {{count}} 项待确认内容。通过节点时会同时通过相连的待审关系。',
              { count }
            )
          : input.t(
              'graph.confirm_reject_all',
              '将拒绝全部 {{count}} 项待确认内容。拒绝节点时会同时拒绝与它相连的关系。',
              { count }
            )
        : input.t(
            'graph.confirm_reject_selected',
            '将拒绝已选的 {{count}} 项。拒绝节点时会同时拒绝与它相连的关系。',
            { count }
          ),
      input.allPending
        ? input.reviewStatus === 'approved'
          ? input.t('graph.approve_all', '全部通过')
          : input.t('graph.reject_all', '全部拒绝')
        : input.t('graph.reject_selected', '拒绝所选')
    )
    if (!ok) return
  }
  input.setReviewBusy(true)
  try {
    await callKnowledgeApi('setGraphReviewsBatch', 'knowledge:set-graph-reviews-batch', {
      notebookId: input.notebookId,
      reviewStatus: input.reviewStatus,
      allPending: input.allPending,
      nodeIds: selected.nodeIds,
      edgeIds: selected.edgeIds
    })
    input.setPendingSelected(new Set())
    await input.loadView()
    toast.showSuccess(
      input.reviewStatus === 'approved'
        ? input.t('graph.batch_approved', '已通过 {{count}} 项', { count })
        : input.t('graph.batch_rejected', '已拒绝 {{count}} 项', { count })
    )
  } catch (error) {
    toast.showError(String((error as Error)?.message || error))
  } finally {
    input.setReviewBusy(false)
  }
}

export function toggleNotebookGraphPendingKey(current: Set<string>, key: string): Set<string> {
  const next = new Set(current)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

export function nextNotebookGraphPendingSelection(
  allSelected: boolean,
  keys: string[]
): Set<string> {
  return allSelected ? new Set() : new Set(keys)
}
