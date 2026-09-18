import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_FOCUS_DEPTH_OPTIONS,
  clampGraphFocusDepth,
  saveGraphFocusDepth,
  translateGraphEdgeType,
  translateGraphNodeType,
  type GraphFocusDepth,
  asGraphTranslateFn
} from '@baishou/shared'
import { Button } from '@baishou/ui'
import type { NotebookGraphViewEdge, NotebookGraphViewNode } from './notebook-graph-view.util'
import graphStyles from '../graph/GraphPage.module.css'

export function NotebookGraphDetailTab({
  selectedNode,
  relatedEdges,
  nodes,
  focusDepth,
  reviewBusy,
  tr,
  onFocusDepthChange,
  onReviewNode,
  onReviewEdge,
  onLocate,
  onPreviewFragments
}: {
  selectedNode: NotebookGraphViewNode | null
  relatedEdges: NotebookGraphViewEdge[]
  nodes: NotebookGraphViewNode[]
  focusDepth: GraphFocusDepth
  reviewBusy: boolean
  tr: ReturnType<typeof asGraphTranslateFn>
  onFocusDepthChange: (depth: GraphFocusDepth) => void
  onReviewNode: (nodeId: string, reviewStatus: 'approved' | 'rejected') => void
  onReviewEdge: (edgeId: string, reviewStatus: 'approved' | 'rejected') => void
  onLocate: (id: string) => void
  onPreviewFragments?: (edges: NotebookGraphViewEdge[]) => void
}) {
  const { t } = useTranslation()
  if (!selectedNode) {
    return (
      <div className={graphStyles.empty}>
        {t('graph.click_node_for_detail', '点击画布节点查看详情')}
      </div>
    )
  }

  return (
    <>
      <div className={graphStyles.detailDepthRow}>
        <div className={graphStyles.detailDepthMeta}>
          <span className={graphStyles.detailLabel}>{t('graph.focus_depth', '展开等级')}</span>
        </div>
        <div className={graphStyles.depthSeg} role="radiogroup">
          {GRAPH_FOCUS_DEPTH_OPTIONS.map((depth) => (
            <button
              key={depth}
              type="button"
              role="radio"
              aria-checked={focusDepth === depth}
              className={`${graphStyles.depthBtn} ${
                focusDepth === depth ? graphStyles.depthBtnActive : ''
              }`}
              onClick={() => {
                const next = clampGraphFocusDepth(depth)
                onFocusDepthChange(next)
                saveGraphFocusDepth(next)
              }}
            >
              {depth}
              {t('graph.focus_depth_unit', '级')}
            </button>
          ))}
        </div>
      </div>
      <div className={graphStyles.detailBlock}>
        <div className={graphStyles.detailLabel}>{t('graph.label_name', '名称')}</div>
        <div className={graphStyles.detailValue}>{selectedNode.name}</div>
      </div>
      <div className={graphStyles.detailBlock}>
        <div className={graphStyles.detailLabel}>{t('graph.label_type', '类型')}</div>
        <div className={graphStyles.detailValue}>
          {translateGraphNodeType(tr, selectedNode.nodeType)}
        </div>
      </div>
      {selectedNode.summary ? (
        <div className={graphStyles.detailBlock}>
          <div className={graphStyles.detailLabel}>{t('graph.label_summary', '摘要')}</div>
          <div className={graphStyles.detailValue}>{selectedNode.summary}</div>
        </div>
      ) : null}
      <div className={graphStyles.detailBlock}>
        <div className={graphStyles.detailLabel}>{t('graph.label_mentions', '提及')}</div>
        <div className={graphStyles.detailValue}>{selectedNode.mentionCount ?? 0}</div>
      </div>
      {selectedNode.reviewStatus === 'pending' ? (
        <div className={graphStyles.rowActions}>
          <Button
            type="button"
            disabled={reviewBusy}
            onClick={() => void onReviewNode(selectedNode.id, 'approved')}
          >
            {t('graph.approve', '通过')}
          </Button>
          <Button
            type="button"
            disabled={reviewBusy}
            onClick={() => void onReviewNode(selectedNode.id, 'rejected')}
          >
            {t('graph.reject', '拒绝')}
          </Button>
        </div>
      ) : null}
      {relatedEdges.length > 0 ? (
        <div className={graphStyles.detailBlock}>
          <div className={graphStyles.detailLabel}>{t('graph.label_relations', '关系')}</div>
          {relatedEdges.map((edge) => {
            const otherId = edge.fromId === selectedNode.id ? edge.toId : edge.fromId
            const other = nodes.find((node) => node.id === otherId)
            return (
              <div key={edge.id} className={graphStyles.itemRow}>
                <button
                  type="button"
                  className={graphStyles.linkBtn}
                  onClick={() => onLocate(otherId)}
                >
                  {translateGraphEdgeType(tr, edge.edgeType)} · {other?.name || otherId}
                  {edge.reviewStatus === 'pending'
                    ? ` · ${t('graph.pending_badge', '待确认')}`
                    : ''}
                </button>
                {edge.reviewStatus === 'pending' ? (
                  <div className={graphStyles.rowActionsInline}>
                    <button
                      type="button"
                      className={graphStyles.linkBtn}
                      disabled={reviewBusy}
                      onClick={() => void onReviewEdge(edge.id, 'approved')}
                    >
                      {t('graph.approve', '通过')}
                    </button>
                    <button
                      type="button"
                      className={`${graphStyles.linkBtn} ${graphStyles.linkBtnMuted}`}
                      disabled={reviewBusy}
                      onClick={() => void onReviewEdge(edge.id, 'rejected')}
                    >
                      {t('graph.reject', '拒绝')}
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
      {onPreviewFragments && relatedEdges.some((edge) => edge.sourceRef || edge.sourceExcerpt) ? (
        <Button type="button" onClick={() => onPreviewFragments(relatedEdges)}>
          {t('graph.source', '原文')}
        </Button>
      ) : null}
    </>
  )
}
