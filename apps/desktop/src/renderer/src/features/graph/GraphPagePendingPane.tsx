import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  asGraphTranslateFn,
  graphPendingItemKey,
  resolveGraphNodeDisplayName,
  translateGraphEdgeType,
  translateGraphNodeType
} from '@baishou/shared'
import { Checkbox } from '@baishou/ui'
import styles from './GraphPage.module.css'

export function GraphPagePendingPane(props: {
  pendingCount: number
  pendingNodes: any[]
  pendingEdges: any[]
  pendingSelected: Set<string>
  pendingSelectedCount: number
  allPendingSelected: boolean
  graphNodeNameById: Map<string, string>
  busy: boolean
  onToggleSelectAll: () => void
  onToggleItem: (key: string) => void
  onApplyReviews: (opts: { reviewStatus: 'approved' | 'rejected'; allPending?: boolean }) => void
  onReviewNode: (nodeId: string, status: 'approved' | 'rejected') => void
  onReviewEdge: (
    edgeId: string,
    status: 'approved' | 'rejected',
    endpoints?: { fromId?: string; toId?: string }
  ) => void
  onLocateNode: (id: string) => void
  onLocateEdge: (edge: any) => void
  onOpenSource: (ref: string | null | undefined, excerpt?: string | null) => void
}): React.ReactElement {
  const { t } = useTranslation()
  const tr = asGraphTranslateFn(t)
  if (props.pendingCount === 0) {
    return <div className={styles.empty}>{t('graph.no_pending', '没有待确认的节点或边')}</div>
  }
  return (
    <>
      <div className={styles.pendingSticky}>
        <p className={styles.pendingHint}>
          {t(
            'graph.pending_hint',
            '确认关系会同时通过两端节点；确认节点也会通过与它相连的待审关系。可勾选后批量处理。'
          )}
        </p>
        <div className={styles.pendingToolbar}>
          <label className={styles.pendingSelectAll}>
            <Checkbox
              checked={props.allPendingSelected}
              indeterminate={props.pendingSelectedCount > 0 && !props.allPendingSelected}
              onChange={props.onToggleSelectAll}
            />
            {props.allPendingSelected
              ? t('graph.pending_deselect_all', '取消全选')
              : t('graph.pending_select_all', '全选')}
          </label>
          <span className={styles.pendingSelectedCount}>
            {t('graph.pending_selected_count', '已选 {{count}} 项', {
              count: props.pendingSelectedCount
            })}
          </span>
          <div className={styles.pendingToolbarBtns}>
            <button
              type="button"
              className={styles.linkBtn}
              disabled={props.busy || props.pendingSelectedCount === 0}
              onClick={() => void props.onApplyReviews({ reviewStatus: 'approved' })}
            >
              {t('graph.approve_selected', '通过所选')}
            </button>
            <button
              type="button"
              className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
              disabled={props.busy || props.pendingSelectedCount === 0}
              onClick={() => void props.onApplyReviews({ reviewStatus: 'rejected' })}
            >
              {t('graph.reject_selected', '拒绝所选')}
            </button>
            <button
              type="button"
              className={styles.linkBtn}
              disabled={props.busy}
              onClick={() =>
                void props.onApplyReviews({ reviewStatus: 'approved', allPending: true })
              }
            >
              {t('graph.approve_all', '全部通过')}
            </button>
            <button
              type="button"
              className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
              disabled={props.busy}
              onClick={() =>
                void props.onApplyReviews({ reviewStatus: 'rejected', allPending: true })
              }
            >
              {t('graph.reject_all', '全部拒绝')}
            </button>
          </div>
        </div>
      </div>
      {props.pendingNodes.map((node) => {
        const key = graphPendingItemKey('node', node.id)
        return (
          <div key={`n-${node.id}`} className={styles.itemCompact}>
            <div className={styles.itemRow}>
              <label className={styles.pendingCheckLabel}>
                <Checkbox
                  checked={props.pendingSelected.has(key)}
                  onChange={() => props.onToggleItem(key)}
                />
                <span className={styles.itemTitle}>
                  {t('graph.pending_node', '节点')} · {node.name}
                </span>
              </label>
              <div className={styles.rowActionsInline}>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => void props.onReviewNode(node.id, 'approved')}
                >
                  {t('graph.approve', '通过')}
                </button>
                <button
                  type="button"
                  className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                  onClick={() => void props.onReviewNode(node.id, 'rejected')}
                >
                  {t('graph.reject', '拒绝')}
                </button>
                <button
                  type="button"
                  className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                  onClick={() => props.onLocateNode(node.id)}
                >
                  {t('graph.view', '查看')}
                </button>
              </div>
            </div>
            {node.nodeType || node.summary ? (
              <div className={styles.itemMetaCompact}>
                {translateGraphNodeType(tr, node.nodeType)}
                {node.summary ? ` · ${node.summary}` : ''}
              </div>
            ) : null}
          </div>
        )
      })}
      {props.pendingEdges.map((edge) => {
        const key = graphPendingItemKey('edge', edge.id)
        const unknownNode = t('graph.unknown_node', '未知节点')
        const fromName = resolveGraphNodeDisplayName(
          props.graphNodeNameById,
          edge.fromId,
          unknownNode
        )
        const toName = resolveGraphNodeDisplayName(props.graphNodeNameById, edge.toId, unknownNode)
        return (
          <div key={`e-${edge.id}`} className={styles.itemCompact}>
            <div className={styles.itemRow}>
              <label className={styles.pendingCheckLabel}>
                <Checkbox
                  checked={props.pendingSelected.has(key)}
                  onChange={() => props.onToggleItem(key)}
                />
                <span className={styles.itemTitle}>
                  {t('graph.pending_edge', '关系')} · {translateGraphEdgeType(tr, edge.edgeType)}
                </span>
              </label>
              <div className={styles.rowActionsInline}>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() =>
                    void props.onReviewEdge(edge.id, 'approved', {
                      fromId: edge.fromId,
                      toId: edge.toId
                    })
                  }
                >
                  {t('graph.approve', '通过')}
                </button>
                <button
                  type="button"
                  className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                  onClick={() => void props.onReviewEdge(edge.id, 'rejected')}
                >
                  {t('graph.reject', '拒绝')}
                </button>
                <button
                  type="button"
                  className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                  onClick={() => void props.onLocateEdge(edge)}
                >
                  {t('graph.view', '查看')}
                </button>
                <button
                  type="button"
                  className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                  onClick={() => void props.onOpenSource(edge.sourceRef, edge.sourceExcerpt)}
                >
                  {t('graph.source', '原文')}
                </button>
              </div>
            </div>
            <div className={styles.itemMetaCompact}>
              {fromName} → {toName}
              {typeof edge.confidence === 'number' ? ` · ${edge.confidence}` : ''}
              {edge.sourceExcerpt ? ` · ${edge.sourceExcerpt}` : ''}
            </div>
          </div>
        )
      })}
    </>
  )
}
