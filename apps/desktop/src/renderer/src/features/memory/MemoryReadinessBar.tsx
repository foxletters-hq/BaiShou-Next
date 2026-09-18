import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, CircleAlert, CircleDashed } from 'lucide-react'
import type { MemoryReadinessRow, MemoryReadinessRowId, PendingEmbedCounts } from '@baishou/shared'
import { AnchoredContextMenu } from '@baishou/ui'
import {
  formatRagIndexingStatus,
  type RagIndexingSnapshot
} from '../settings/rag-indexing-snapshot'
import { listPendingEmbedPartLines } from './pending-embed-part-lines.util'
import styles from './MemoryReadinessBar.module.css'

export type MemoryReadinessBarProps = {
  rows: MemoryReadinessRow[]
  omit?: MemoryReadinessRowId[]
  /** 单条展示时（如向量页）标签是多余的，可关闭 */
  showLabel?: boolean
  onConfigureEmbedding?: () => void
  onStartIndex?: () => void
  onStartOrganize?: () => void
  pendingEmbedParts?: PendingEmbedCounts
  pendingGraphCount?: number
  indexing?: RagIndexingSnapshot | null
  extracting?: { current: number; total: number; percent: number } | null
  organizePipeline?: 'idle' | 'embed' | 'graph'
  /** 长状态允许在条内换行，避免挤成一行省略 */
  wrap?: boolean
}

function rowLabel(id: MemoryReadinessRow['id'], t: (key: string, fallback: string) => string) {
  switch (id) {
    case 'embedding':
      return t('memory.readiness_embedding', '嵌入模型')
    case 'extract':
      return t('memory.readiness_extract', '关系抽取')
    case 'vector':
      return t('memory.readiness_vector', '向量片段')
    case 'graph':
      return t('memory.readiness_graph', '关系图谱')
  }
}

export const MemoryReadinessBar: React.FC<MemoryReadinessBarProps> = ({
  rows,
  omit,
  showLabel = true,
  onConfigureEmbedding,
  onStartIndex,
  onStartOrganize,
  pendingEmbedParts,
  pendingGraphCount = 0,
  indexing = null,
  extracting = null,
  organizePipeline = 'idle',
  wrap = false
}) => {
  const { t } = useTranslation()
  const hidden = new Set(omit ?? [])
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  const openOrganizeMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuAt({ x: rect.right, y: rect.bottom + 6 })
  }

  return (
    <>
      {rows.map((row) => {
        if (hidden.has(row.id)) return null

        let value = ''
        let onAction: ((e: React.MouseEvent<HTMLButtonElement>) => void) | undefined
        let actionLabel = ''

        if (row.id === 'embedding') {
          if (row.state === 'ready') {
            value = row.modelId || t('memory.readiness_ready', '已就绪')
          } else {
            value = t('memory.readiness_not_configured', '未配置')
            onAction = onConfigureEmbedding ? () => onConfigureEmbedding() : undefined
            actionLabel = t('memory.go_configure', '去配置')
          }
        } else if (row.id === 'extract') {
          if (row.state === 'ready') {
            value = row.modelId || t('memory.readiness_ready', '已就绪')
          } else {
            value = t('memory.readiness_extract_missing', '未配置图抽取模型')
          }
        } else if (row.id === 'vector') {
          if (indexing) {
            value =
              organizePipeline === 'embed' || organizePipeline === 'graph'
                ? t('memory.readiness_organizing', '正在整理记忆…')
                : formatRagIndexingStatus(t, indexing)
          } else if (extracting && extracting.total > 0) {
            value = t('graph.extract_progress', '正在整理 {{current}}/{{total}}', {
              current: extracting.current,
              total: extracting.total
            })
          } else if (organizePipeline === 'graph') {
            value = t('memory.readiness_graph_starting', '正在开始整理关系图谱')
          } else if (row.state === 'ready' && pendingGraphCount <= 0) {
            value = t('memory.readiness_vector_done', '已全部整理')
          } else if (row.state === 'pending' || pendingGraphCount > 0) {
            value = t('memory.readiness_vector_pending', '未整理 {{count}} 篇', {
              count: row.count ?? 0
            })
            onAction = pendingEmbedParts
              ? openOrganizeMenu
              : onStartIndex
                ? () => onStartIndex()
                : undefined
            actionLabel = t('memory.start_organize', '开始整理记忆')
          } else {
            value = t('memory.readiness_need_embedding', '需要先配置嵌入模型')
            onAction = onConfigureEmbedding ? () => onConfigureEmbedding() : undefined
            actionLabel = t('memory.go_configure', '去配置')
          }
        } else if (extracting && extracting.total > 0) {
          value = t('graph.extract_progress', '正在整理 {{current}}/{{total}}', {
            current: extracting.current,
            total: extracting.total
          })
        } else if (organizePipeline === 'graph') {
          value = t('memory.readiness_graph_starting', '正在开始整理关系图谱')
        } else if (row.state === 'ready') {
          value = t('memory.readiness_graph_done', '已全部整理')
        } else if (row.state === 'pending') {
          value = t('memory.readiness_graph_pending', '待整理 {{count}} 篇', {
            count: row.count ?? 0
          })
          onAction = onStartOrganize ? () => onStartOrganize() : undefined
          actionLabel = t('memory.start_organize', '开始整理记忆')
        } else {
          value = t('memory.readiness_need_embedding', '需要先配置嵌入模型')
          onAction = onConfigureEmbedding ? () => onConfigureEmbedding() : undefined
          actionLabel = t('memory.go_configure', '去配置')
        }

        const vectorBusy =
          row.id === 'vector' &&
          (Boolean(indexing) ||
            Boolean(extracting && extracting.total > 0) ||
            organizePipeline === 'graph' ||
            row.state === 'pending' ||
            pendingGraphCount > 0)
        const tone =
          vectorBusy ||
          (extracting && row.id === 'graph' && extracting.total > 0) ||
          (organizePipeline === 'graph' && row.id === 'graph')
            ? styles.chipPending
            : row.state === 'ready'
              ? styles.chipReady
              : row.state === 'pending'
                ? styles.chipPending
                : styles.chipBlocked
        const className = `${styles.chip} ${tone}${onAction ? ` ${styles.chipAction}` : ''}${
          wrap ? ` ${styles.chipWrap}` : ''
        }`

        const body = (
          <>
            <span className={styles.chipIcon} aria-hidden="true">
              {row.state === 'ready' && !vectorBusy ? (
                <Check size={13} />
              ) : row.state === 'pending' || vectorBusy ? (
                <CircleAlert size={13} />
              ) : (
                <CircleDashed size={13} />
              )}
            </span>
            {showLabel ? <span className={styles.chipLabel}>{rowLabel(row.id, t)}</span> : null}
            <span className={styles.chipValue}>{value}</span>
            {onAction ? <span className={styles.chipHint}>{actionLabel}</span> : null}
          </>
        )

        if (onAction) {
          return (
            <button key={row.id} type="button" className={className} onClick={onAction}>
              {body}
            </button>
          )
        }

        return (
          <div key={row.id} className={className} role="status">
            {body}
          </div>
        )
      })}
      {menuAt && pendingEmbedParts ? (
        <AnchoredContextMenu
          x={menuAt.x}
          y={menuAt.y}
          alignEnd
          menuClassName={`context-menu ${styles.detailMenu}`}
          onClose={() => setMenuAt(null)}
          items={[
            ...listPendingEmbedPartLines(pendingEmbedParts, pendingGraphCount).map((line) => ({
              label: t(line.key, { count: line.count }),
              disabled: true
            })),
            { label: '', divider: true },
            {
              label: t('memory.start_organize', '开始整理记忆'),
              onClick: () => onStartIndex?.()
            }
          ]}
        />
      ) : null}
    </>
  )
}
