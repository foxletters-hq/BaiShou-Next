import React from 'react'
import { useTranslation } from 'react-i18next'
import type { MemoryReadinessRow } from '@baishou/shared'
import styles from './MemoryReadinessBar.module.css'

export type MemoryReadinessBarProps = {
  rows: MemoryReadinessRow[]
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
  onConfigureEmbedding,
  onStartIndex,
  onStartOrganize
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.bar} role="status" aria-label={t('memory.readiness', '记忆就绪状态')}>
      {rows.map((row) => {
        let value = ''
        let muted = false
        let action: React.ReactNode = null

        if (row.id === 'embedding') {
          if (row.state === 'ready') {
            value = row.modelId || t('memory.readiness_ready', '已就绪')
          } else {
            value = t('memory.readiness_not_configured', '未配置')
            muted = true
            action = (
              <button
                type="button"
                className={`${styles.action} ${styles.primary}`}
                onClick={onConfigureEmbedding}
              >
                {t('memory.go_configure', '去配置')}
              </button>
            )
          }
        } else if (row.id === 'extract') {
          if (row.state === 'ready') {
            value = t('memory.readiness_follow_dialogue', '跟随对话模型 {{model}}', {
              model: row.modelId || ''
            })
          } else {
            value = t('memory.readiness_dialogue_missing', '未配置对话模型')
            muted = true
          }
        } else if (row.id === 'vector') {
          if (row.state === 'ready') {
            value = t('memory.readiness_vector_done', '已全部索引')
          } else if (row.state === 'pending') {
            value = t('memory.readiness_vector_pending', '未索引 {{count}} 篇', {
              count: row.count ?? 0
            })
            action = (
              <button
                type="button"
                className={`${styles.action} ${styles.primary}`}
                onClick={onStartIndex}
              >
                {t('memory.start_index', '开始索引')}
              </button>
            )
          } else {
            value = t('memory.readiness_need_embedding', '需要先配置嵌入模型')
            muted = true
            action = (
              <button type="button" className={styles.action} disabled>
                {t('memory.start_index', '开始索引')}
              </button>
            )
          }
        } else if (row.state === 'ready') {
          value = t('memory.readiness_graph_done', '已全部整理')
        } else if (row.state === 'pending') {
          value = t('memory.readiness_graph_pending', '待整理 {{count}} 篇', {
            count: row.count ?? 0
          })
          action = (
            <button
              type="button"
              className={`${styles.action} ${styles.primary}`}
              onClick={onStartOrganize}
            >
              {t('memory.start_organize', '开始整理')}
            </button>
          )
        } else {
          value = t('memory.readiness_need_embedding', '需要先配置嵌入模型')
          muted = true
          action = (
            <button type="button" className={styles.action} disabled>
              {t('memory.start_organize', '开始整理')}
            </button>
          )
        }

        return (
          <div key={row.id} className={styles.row}>
            <span className={styles.label}>{rowLabel(row.id, t)}</span>
            <span className={`${styles.value} ${muted ? styles.valueMuted : ''}`}>{value}</span>
            {action}
          </div>
        )
      })}
    </div>
  )
}
