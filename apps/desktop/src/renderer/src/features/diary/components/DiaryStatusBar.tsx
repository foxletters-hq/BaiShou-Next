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
  const embedText = indexing
    ? formatRagIndexingStatus(t, indexing)
    : t('diary.status_pending_embed', '待嵌入：{{count}}个', {
        count: pendingEmbedCount
      })
  const embedPartsText = !indexing && partsLabel ? `（${partsLabel}）` : ''

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
        interactive && onPendingEmbedClick ? (
          <button
            type="button"
            className="diary-status-bar-item diary-status-bar-item--action"
            onClick={onPendingEmbedClick}
          >
            {embedText}
            {embedPartsText}
          </button>
        ) : (
          <span className="diary-status-bar-item">
            {embedText}
            {embedPartsText}
          </span>
        )
      ) : null}
    </div>
  )
}
