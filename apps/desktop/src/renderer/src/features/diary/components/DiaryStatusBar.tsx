import React from 'react'
import { useTranslation } from 'react-i18next'
import type { PendingEmbedCounts } from '@baishou/shared'
import {
  formatRagIndexingStatus,
  type RagIndexingSnapshot
} from '../../settings/rag-indexing-snapshot'

export interface DiaryStatusBarProps {
  showPendingExtract: boolean
  pendingExtractCount: number
  showPendingEmbed: boolean
  pendingEmbedCount: number
  pendingEmbedParts?: Pick<PendingEmbedCounts, 'diaries' | 'memories' | 'graphNodes'>
  onPendingExtractClick?: () => void
  onPendingEmbedClick?: () => void
  indexing?: RagIndexingSnapshot | null
  onPauseIndexing?: () => void
  onResumeIndexing?: () => void
  onCancelIndexing?: () => void
  /** false = 只读展示（移动端） */
  interactive?: boolean
}

/** 日记列表常驻底栏：待抽取 / 待嵌入（能力未配置或 count=0 时不显示对应项） */
export const DiaryStatusBar: React.FC<DiaryStatusBarProps> = ({
  showPendingExtract,
  pendingExtractCount,
  showPendingEmbed,
  pendingEmbedCount,
  pendingEmbedParts,
  onPendingExtractClick,
  onPendingEmbedClick,
  indexing = null,
  onPauseIndexing,
  onResumeIndexing,
  onCancelIndexing,
  interactive = true
}) => {
  const { t } = useTranslation()
  const partsLabel = pendingEmbedParts
    ? [
        t('memory.pending_embed_part_diaries', '日记 {{count}} 篇', {
          count: pendingEmbedParts.diaries
        }),
        t('memory.pending_embed_part_memories', '伙伴记忆 {{count}} 条', {
          count: pendingEmbedParts.memories
        }),
        t('memory.pending_embed_part_graph_nodes', '图谱节点 {{count}} 个', {
          count: pendingEmbedParts.graphNodes
        })
      ].join(' · ')
    : ''

  return (
    <div className="diary-status-bar" role="status">
      {showPendingExtract ? (
        interactive && onPendingExtractClick ? (
          <button
            type="button"
            className="diary-status-bar-item diary-status-bar-item--action"
            onClick={onPendingExtractClick}
          >
            {t('diary.status_pending_extract', '待抽取：{{count}}个', {
              count: pendingExtractCount
            })}
          </button>
        ) : (
          <span className="diary-status-bar-item">
            {t('diary.status_pending_extract', '待抽取：{{count}}个', {
              count: pendingExtractCount
            })}
          </span>
        )
      ) : null}
      {showPendingEmbed || indexing ? (
        interactive && onPendingEmbedClick && !indexing ? (
          <button
            type="button"
            className="diary-status-bar-item diary-status-bar-item--action"
            onClick={onPendingEmbedClick}
          >
            {t('diary.status_pending_embed', '待嵌入：{{count}}个', {
              count: pendingEmbedCount
            })}
            {partsLabel ? `（${partsLabel}）` : ''}
          </button>
        ) : (
          <span className="diary-status-bar-item diary-status-bar-indexing">
            <span>
              {indexing
                ? formatRagIndexingStatus(t, indexing)
                : t('diary.status_pending_embed', '待嵌入：{{count}}个', {
                    count: pendingEmbedCount
                  })}
              {!indexing && partsLabel ? `（${partsLabel}）` : ''}
            </span>
            {indexing && interactive && !indexing.cancelling ? (
              <>
                {indexing.paused
                  ? onResumeIndexing && (
                      <button
                        type="button"
                        className="diary-status-bar-item--action"
                        onClick={onResumeIndexing}
                      >
                        {t('settings.rag_batch_embed_resume', '继续')}
                      </button>
                    )
                  : onPauseIndexing && (
                      <button
                        type="button"
                        className="diary-status-bar-item--action"
                        onClick={onPauseIndexing}
                      >
                        {t('settings.rag_batch_embed_pause', '暂停')}
                      </button>
                    )}
                {onCancelIndexing ? (
                  <button
                    type="button"
                    className="diary-status-bar-item--action"
                    onClick={onCancelIndexing}
                  >
                    {t('settings.rag_batch_embed_cancel', '取消')}
                  </button>
                ) : null}
              </>
            ) : null}
          </span>
        )
      ) : null}
    </div>
  )
}
