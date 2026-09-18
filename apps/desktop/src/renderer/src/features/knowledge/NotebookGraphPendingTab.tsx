import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  graphPendingItemKey,
  translateGraphEdgeType,
  translateGraphNodeType
} from '@baishou/shared'
import { Checkbox } from '@baishou/ui'
import type { NotebookGraphViewEdge, NotebookGraphViewNode } from './notebook-graph-view.util'
import graphStyles from '../graph/GraphPage.module.css'

export function NotebookGraphPendingTab({
  pendingNodes,
  pendingEdges,
  nodes,
  pendingSelected,
  allPendingSelected,
  pendingSelectedCount,
  reviewBusy,
  tr,
  onToggleSelectAll,
  onToggleItem,
  onApproveSelected,
  onRejectSelected,
  onApproveAll,
  onRejectAll,
  onReviewNode,
  onReviewEdge,
  onLocate
}: {
  pendingNodes: NotebookGraphViewNode[]
  pendingEdges: NotebookGraphViewEdge[]
  nodes: NotebookGraphViewNode[]
  pendingSelected: Set<string>
  allPendingSelected: boolean
  pendingSelectedCount: number
  reviewBusy: boolean
  tr: (key: string, defaultValue?: string) => string
  onToggleSelectAll: () => void
  onToggleItem: (key: string) => void
  onApproveSelected: () => void
  onRejectSelected: () => void
  onApproveAll: () => void
  onRejectAll: () => void
  onReviewNode: (nodeId: string, reviewStatus: 'approved' | 'rejected') => void
  onReviewEdge: (edgeId: string, reviewStatus: 'approved' | 'rejected') => void
  onLocate: (id: string) => void
}) {
  const { t } = useTranslation()
  const pendingCount = pendingNodes.length + pendingEdges.length
  if (pendingCount === 0) {
    return <div className={graphStyles.empty}>{t('graph.no_pending', '暂无待确认内容')}</div>
  }

  return (
    <>
      <div className={graphStyles.pendingSticky}>
        <p className={graphStyles.pendingHint}>
          {t(
            'graph.pending_hint',
            '确认关系会同时通过两端节点；确认节点也会通过与它相连的待审关系。可勾选后批量处理。'
          )}
        </p>
        <div className={graphStyles.pendingToolbar}>
          <label className={graphStyles.pendingSelectAll}>
            <Checkbox
              checked={allPendingSelected}
              indeterminate={pendingSelectedCount > 0 && !allPendingSelected}
              onChange={onToggleSelectAll}
            />
            {allPendingSelected
              ? t('graph.pending_deselect_all', '取消全选')
              : t('graph.pending_select_all', '全选')}
          </label>
          <span className={graphStyles.pendingSelectedCount}>
            {t('graph.pending_selected_count', '已选 {{count}} 项', {
              count: pendingSelectedCount
            })}
          </span>
          <div className={graphStyles.pendingToolbarBtns}>
            <button
              type="button"
              className={graphStyles.linkBtn}
              disabled={reviewBusy || pendingSelectedCount === 0}
              onClick={onApproveSelected}
            >
              {t('graph.approve_selected', '通过所选')}
            </button>
            <button
              type="button"
              className={`${graphStyles.linkBtn} ${graphStyles.linkBtnMuted}`}
              disabled={reviewBusy || pendingSelectedCount === 0}
              onClick={onRejectSelected}
            >
              {t('graph.reject_selected', '拒绝所选')}
            </button>
            <button
              type="button"
              className={graphStyles.linkBtn}
              disabled={reviewBusy}
              onClick={onApproveAll}
            >
              {t('graph.approve_all', '全部通过')}
            </button>
            <button
              type="button"
              className={`${graphStyles.linkBtn} ${graphStyles.linkBtnMuted}`}
              disabled={reviewBusy}
              onClick={onRejectAll}
            >
              {t('graph.reject_all', '全部拒绝')}
            </button>
          </div>
        </div>
      </div>
      {pendingNodes.map((node) => {
        const key = graphPendingItemKey('node', node.id)
        return (
          <div key={node.id} className={graphStyles.itemCompact}>
            <div className={graphStyles.itemRow}>
              <label className={graphStyles.pendingCheckLabel}>
                <Checkbox checked={pendingSelected.has(key)} onChange={() => onToggleItem(key)} />
                <span className={graphStyles.itemTitle}>
                  {t('graph.pending_node', '节点')} · {node.name}
                </span>
              </label>
              <div className={graphStyles.rowActionsInline}>
                <button
                  type="button"
                  className={graphStyles.linkBtn}
                  disabled={reviewBusy}
                  onClick={() => onReviewNode(node.id, 'approved')}
                >
                  {t('graph.approve', '通过')}
                </button>
                <button
                  type="button"
                  className={`${graphStyles.linkBtn} ${graphStyles.linkBtnMuted}`}
                  disabled={reviewBusy}
                  onClick={() => onReviewNode(node.id, 'rejected')}
                >
                  {t('graph.reject', '拒绝')}
                </button>
                <button
                  type="button"
                  className={`${graphStyles.linkBtn} ${graphStyles.linkBtnMuted}`}
                  onClick={() => onLocate(node.id)}
                >
                  {t('graph.view', '查看')}
                </button>
              </div>
            </div>
            <div className={graphStyles.itemMetaCompact}>
              {translateGraphNodeType(tr, node.nodeType)}
            </div>
          </div>
        )
      })}
      {pendingEdges.map((edge) => {
        const key = graphPendingItemKey('edge', edge.id)
        const fromName = nodes.find((node) => node.id === edge.fromId)?.name || edge.fromId
        const toName = nodes.find((node) => node.id === edge.toId)?.name || edge.toId
        return (
          <div key={edge.id} className={graphStyles.itemCompact}>
            <div className={graphStyles.itemRow}>
              <label className={graphStyles.pendingCheckLabel}>
                <Checkbox checked={pendingSelected.has(key)} onChange={() => onToggleItem(key)} />
                <span className={graphStyles.itemTitle}>
                  {t('graph.pending_edge', '关系')} · {translateGraphEdgeType(tr, edge.edgeType)}
                </span>
              </label>
              <div className={graphStyles.rowActionsInline}>
                <button
                  type="button"
                  className={graphStyles.linkBtn}
                  disabled={reviewBusy}
                  onClick={() => onReviewEdge(edge.id, 'approved')}
                >
                  {t('graph.approve', '通过')}
                </button>
                <button
                  type="button"
                  className={`${graphStyles.linkBtn} ${graphStyles.linkBtnMuted}`}
                  disabled={reviewBusy}
                  onClick={() => onReviewEdge(edge.id, 'rejected')}
                >
                  {t('graph.reject', '拒绝')}
                </button>
                <button
                  type="button"
                  className={`${graphStyles.linkBtn} ${graphStyles.linkBtnMuted}`}
                  onClick={() => onLocate(edge.fromId)}
                >
                  {t('graph.view', '查看')}
                </button>
              </div>
            </div>
            <div className={graphStyles.itemMetaCompact}>
              {fromName} → {toName}
              {edge.sourceExcerpt ? ` · ${edge.sourceExcerpt}` : ''}
            </div>
          </div>
        )
      })}
    </>
  )
}
