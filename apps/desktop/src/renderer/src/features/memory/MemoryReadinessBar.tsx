import React from 'react'
import { useTranslation } from 'react-i18next'
import { Check, CircleAlert, CircleDashed } from 'lucide-react'
import type { MemoryReadinessRow, MemoryReadinessRowId } from '@baishou/shared'
import styles from './MemoryReadinessBar.module.css'

export type MemoryReadinessBarProps = {
  rows: MemoryReadinessRow[]
  omit?: MemoryReadinessRowId[]
  /** 单条展示时（如向量页）标签是多余的，可关闭 */
  showLabel?: boolean
  onConfigureEmbedding?: () => void
  onStartIndex?: () => void
  onStartOrganize?: () => void
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
  onStartOrganize
}) => {
  const { t } = useTranslation()
  const hidden = new Set(omit ?? [])

  return (
    <>
      {rows.map((row) => {
        if (hidden.has(row.id)) return null

        let value = ''
        let onAction: (() => void) | undefined
        let actionLabel = ''

        if (row.id === 'embedding') {
          if (row.state === 'ready') {
            value = row.modelId || t('memory.readiness_ready', '已就绪')
          } else {
            value = t('memory.readiness_not_configured', '未配置')
            onAction = onConfigureEmbedding
            actionLabel = t('memory.go_configure', '去配置')
          }
        } else if (row.id === 'extract') {
          if (row.state === 'ready') {
            value = t('memory.readiness_follow_dialogue', '跟随对话模型 {{model}}', {
              model: row.modelId || ''
            })
          } else {
            value = t('memory.readiness_dialogue_missing', '未配置对话模型')
          }
        } else if (row.id === 'vector') {
          if (row.state === 'ready') {
            value = t('memory.readiness_vector_done', '已全部索引')
          } else if (row.state === 'pending') {
            value = t('memory.readiness_vector_pending', '未索引 {{count}} 篇', {
              count: row.count ?? 0
            })
            onAction = onStartIndex
            actionLabel = t('memory.start_index', '开始索引')
          } else {
            value = t('memory.readiness_need_embedding', '需要先配置嵌入模型')
          }
        } else if (row.state === 'ready') {
          value = t('memory.readiness_graph_done', '已全部整理')
        } else if (row.state === 'pending') {
          value = t('memory.readiness_graph_pending', '待整理 {{count}} 篇', {
            count: row.count ?? 0
          })
          onAction = onStartOrganize
          actionLabel = t('memory.start_organize', '开始整理')
        } else {
          value = t('memory.readiness_need_embedding', '需要先配置嵌入模型')
        }

        const tone =
          row.state === 'ready'
            ? styles.chipReady
            : row.state === 'pending'
              ? styles.chipPending
              : styles.chipBlocked
        const className = `${styles.chip} ${tone}${onAction ? ` ${styles.chipAction}` : ''}`

        const body = (
          <>
            <span className={styles.chipIcon} aria-hidden="true">
              {row.state === 'ready' ? (
                <Check size={13} />
              ) : row.state === 'pending' ? (
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
    </>
  )
}
