import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  describeGraphExtractPhase,
  describeGraphExtractQueueError,
  graphExtractBarPercent
} from '@baishou/shared'
import { Button, MarkdownRenderer, Modal } from '@baishou/ui'
import { GraphCreateNodeModal } from './GraphCreateNodeModal'
import { GraphIrreversibleConfirm, type GraphMergeConfirmTarget } from './GraphIrreversibleConfirm'
import { GraphMergeSearchModal } from './GraphMergeSearchModal'
import { GraphSplitNodeModal } from './GraphSplitNodeModal'
import type { GraphExtractQueueSnapshot } from './graph-extract-queue.api'
import type { GraphNameCandidate, GraphPageNode, GraphSourcePreview } from './graph-page.types'
import {
  canApproveGraphNode,
  graphMergeSearchSeed,
  graphSplitInitialLabel,
  readGraphNodeSuspectReason
} from './graph-page-view.util'
import styles from './GraphPage.module.css'

export function GraphPageOverlays(props: {
  createOpen: boolean
  splitOpen: boolean
  mergeSearchOpen: boolean
  mergeConfirm: GraphMergeConfirmTarget | null
  queueModalOpen: boolean
  sourcePreview: GraphSourcePreview | null
  busy: boolean
  selectedId: string | null
  selectedNode: GraphPageNode | null
  nameCandidates: GraphNameCandidate[]
  findNode: (id: string) => GraphPageNode | null
  extractRunning: boolean
  extractQueue: GraphExtractQueueSnapshot | null
  queueItemCount: number
  queueOverallPct: number
  onCloseCreate: () => void
  onCreated: (id: string) => void
  onOpenExisting: (id: string) => void
  onCloseSplit: () => void
  onSplit: (id: string) => void
  onApprove: () => void
  onCloseMergeSearch: () => void
  onRequestMerge: (target: GraphMergeConfirmTarget) => void
  onCancelMerge: () => void
  onConfirmMerge: () => void
  onCloseQueue: () => void
  onCancelQueueItem: (filePath: string) => void
  onCancelExtract: () => void
  onCloseSource: () => void
}): React.ReactElement {
  const { t } = useTranslation()
  return (
    <>
      <GraphCreateNodeModal
        isOpen={props.createOpen}
        busy={props.busy}
        onClose={props.onCloseCreate}
        onCreated={props.onCreated}
        onOpenExisting={props.onOpenExisting}
      />
      <GraphSplitNodeModal
        isOpen={props.splitOpen}
        nodeId={props.selectedNode?.id ?? null}
        nodeName={props.selectedNode?.name}
        initialDiscriminator={props.selectedNode?.discriminator || ''}
        initialLabel={graphSplitInitialLabel(props.selectedNode, props.nameCandidates)}
        busy={props.busy}
        canApprove={canApproveGraphNode(props.selectedNode)}
        hasSuspectReason={Boolean(readGraphNodeSuspectReason(props.selectedNode))}
        onClose={props.onCloseSplit}
        onSplit={props.onSplit}
        onApprove={props.onApprove}
      />
      <GraphMergeSearchModal
        isOpen={props.mergeSearchOpen}
        seed={graphMergeSearchSeed({
          selectedId: props.selectedId,
          selectedNode: props.selectedNode,
          findNode: props.findNode
        })}
        busy={props.busy}
        onClose={props.onCloseMergeSearch}
        onRequestMerge={props.onRequestMerge}
      />
      <GraphIrreversibleConfirm
        isOpen={!!props.mergeConfirm}
        title={t('graph.merge_nodes', '合并节点')}
        warning={t(
          'graph.merge_irreversible',
          '合并不可撤销。被合并节点会并入保留节点，关系改挂到保留节点，对端同步后只保留目标节点。'
        )}
        detail={
          props.mergeConfirm ? (
            <ul className={styles.mergeConfirmList}>
              <li>
                {t('graph.merge_keep', '保留 · {{name}}', {
                  name: props.mergeConfirm.survivorName
                })}
              </li>
              {props.mergeConfirm.losers.map((n) => (
                <li key={n.id}>{t('graph.merge_absorb', '并入 · {{name}}', { name: n.name })}</li>
              ))}
            </ul>
          ) : null
        }
        busy={props.busy}
        onCancel={props.onCancelMerge}
        onConfirm={() => void props.onConfirmMerge()}
      />
      <Modal
        isOpen={props.queueModalOpen && props.queueItemCount > 0}
        onClose={props.onCloseQueue}
        closeOnOverlayClick
        className={styles.queueModal}
        zIndex={1800}
      >
        <div className={styles.queueModalShell}>
          <header className={styles.queueModalHeader}>
            <div className={styles.queueModalHeaderText}>
              <div className={styles.sourceEyebrow}>
                {t('graph.queue_modal_eyebrow', '人生关系图')}
              </div>
              <h2 className={styles.queueModalTitle}>
                {props.extractRunning
                  ? t('graph.queue_modal_title_running', '正在整理日记')
                  : t('graph.queue_modal_title_done', '整理进度')}
              </h2>
              <p className={styles.queueModalSubtitle}>
                {props.extractRunning
                  ? t('graph.queue_modal_hint', '关掉窗口不会中断，可继续添加其他日记')
                  : t('graph.queue_modal_progress', '已完成 {{current}} / {{total}} 篇', {
                      current: props.extractQueue?.completedCount ?? 0,
                      total: props.queueItemCount
                    })}
              </p>
            </div>
            <button
              type="button"
              className={styles.sourceClose}
              onClick={props.onCloseQueue}
              aria-label={t('common.close', '关闭')}
            >
              ×
            </button>
          </header>
          <div className={styles.queueModalOverall}>
            <div className={styles.queueOverallRow}>
              <span className={styles.queueOverallPct}>
                {t('graph.queue_overall_pct', '总进度 {{percent}}%', {
                  percent: props.queueOverallPct
                })}
              </span>
              <span>
                {t('graph.queue_modal_progress', '已完成 {{current}} / {{total}} 篇', {
                  current: props.extractQueue?.completedCount ?? 0,
                  total: props.queueItemCount
                })}
              </span>
            </div>
            <div className={styles.queueProgress}>
              <div
                className={styles.queueProgressBar}
                style={{ width: `${props.queueOverallPct}%` }}
              />
            </div>
          </div>
          <div className={styles.queueModalList}>
            {(props.extractQueue?.items ?? []).map((q) => (
              <div key={q.id} className={styles.queueModalItem}>
                <div className={styles.queueDockItemRow}>
                  <span className={styles.queueDockName}>{q.date || q.filePath}</span>
                  <span
                    className={
                      q.status === 'completed'
                        ? styles.queueBadgeDone
                        : q.status === 'error'
                          ? styles.queueBadgeError
                          : styles.queueBadge
                    }
                  >
                    {q.status === 'running'
                      ? t('graph.queue_running', '抽取中')
                      : q.status === 'aligning'
                        ? t('graph.extract_aligning', '对齐中')
                        : q.status === 'pending'
                          ? t('graph.queue_pending', '排队中')
                          : q.status === 'completed'
                            ? t('graph.queue_done', '已完成')
                            : t('graph.queue_error', '失败')}
                  </span>
                  {q.status === 'pending' || q.status === 'running' || q.status === 'aligning' ? (
                    <button
                      type="button"
                      className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                      onClick={() => void props.onCancelQueueItem(q.filePath)}
                    >
                      {t('graph.queue_remove', '取消')}
                    </button>
                  ) : null}
                </div>
                {q.status === 'running' || q.status === 'aligning' ? (
                  <>
                    <div className={styles.queueProgress}>
                      <div
                        className={styles.queueProgressBar}
                        style={{ width: `${graphExtractBarPercent(q)}%` }}
                      />
                    </div>
                    <div className={styles.queuePhase}>
                      {(() => {
                        const copy = describeGraphExtractPhase(q)
                        return t(copy.key, copy.defaultValue, copy.params)
                      })()}
                    </div>
                  </>
                ) : null}
                {q.status === 'error' && q.error ? (
                  <div className={styles.queueItemError}>
                    {(() => {
                      const copy = describeGraphExtractQueueError(q.error)
                      return t(copy.key, copy.defaultValue, copy.params)
                    })()}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <footer className={styles.queueModalFooter}>
            {props.extractRunning ? (
              <Button type="button" onClick={() => void props.onCancelExtract()}>
                {t('graph.stop_extract', '全部停止')}
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" onClick={props.onCloseQueue}>
              {props.extractRunning
                ? t('graph.queue_modal_minimize', '收起，继续整理')
                : t('common.close', '关闭')}
            </Button>
          </footer>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(props.sourcePreview)}
        onClose={props.onCloseSource}
        closeOnOverlayClick
        className={styles.sourceModal}
        zIndex={2000}
      >
        <div className={styles.sourceShell}>
          <header className={styles.sourceHeader}>
            <div className={styles.sourceHeaderText}>
              <div className={styles.sourceEyebrow}>
                {t('graph.source_preview_eyebrow', '日记原文')}
              </div>
              <h2 className={styles.sourceTitle}>
                {props.sourcePreview?.date
                  ? props.sourcePreview.date
                  : t('graph.source_preview_title_generic', '原文')}
              </h2>
            </div>
            <button
              type="button"
              className={styles.sourceClose}
              onClick={props.onCloseSource}
              aria-label={t('common.close', '关闭')}
            >
              ×
            </button>
          </header>
          <div className={styles.sourceScroll}>
            {props.sourcePreview?.loading ? (
              <div className={styles.sourceLoading}>{t('graph.source_loading', '加载中…')}</div>
            ) : (
              <>
                {props.sourcePreview?.excerpt &&
                props.sourcePreview.excerpt.trim() !== props.sourcePreview.content.trim() ? (
                  <aside className={styles.sourceExcerpt}>
                    <div className={styles.sourceExcerptLabel}>
                      {t('graph.source_excerpt_label', '关系摘录')}
                    </div>
                    <div className={styles.sourceExcerptText}>{props.sourcePreview.excerpt}</div>
                  </aside>
                ) : null}
                <div className={styles.sourceMarkdown}>
                  <MarkdownRenderer
                    content={props.sourcePreview?.content || ''}
                    basePath={props.sourcePreview?.basePath}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}
