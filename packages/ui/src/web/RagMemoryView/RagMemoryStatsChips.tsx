import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdMemory, MdStorage, MdCheckCircleOutline, MdRefresh } from 'react-icons/md'
import type { RagStats } from './rag-memory.types'
import styles from './RagMemoryView.module.css'

interface RagMemoryStatsChipsProps {
  stats: RagStats
  embeddingModelId?: string
  isBusy: boolean
  onNavigateToConfig?: () => void
  onDetectDimension?: () => Promise<void>
}

export const RagMemoryStatsChips: React.FC<RagMemoryStatsChipsProps> = ({
  stats,
  embeddingModelId,
  isBusy,
  onNavigateToConfig,
  onDetectDimension
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.statsChipsRow}>
      <div className={`${styles.statChip} ${styles.chipBlue}`}>
        <span className={styles.chipIcon}>
          <MdStorage size={14} />
        </span>
        <span className={styles.chipLabel}>{t('settings.rag_total_count', '总条目:')}</span>
        <span className={styles.chipStrong}>{stats.totalCount}</span>
      </div>
      <div className={`${styles.statChip} ${styles.chipGreen}`}>
        <span className={styles.chipIcon}>
          <MdMemory size={14} />
        </span>
        <span className={styles.chipLabel}>{t('settings.rag_model', '模型:')}</span>
        {embeddingModelId ? (
          <span className={styles.chipStrong}>{embeddingModelId}</span>
        ) : (
          <span
            className={styles.chipStrong}
            style={{
              cursor: 'pointer',
              textDecoration: 'underline',
              opacity: 0.9
            }}
            onClick={onNavigateToConfig}
          >
            {t('settings.rag_model_unassigned', '未配置(点击跳转)')}
          </span>
        )}
      </div>
      <div className={`${styles.statChip} ${styles.chipGrey}`}>
        <span className={styles.chipIcon}>
          <MdStorage size={14} />
        </span>
        <span className={styles.chipLabel}>{t('settings.rag_dimension', '维度:')}</span>
        <span className={styles.chipStrong}>
          {stats.currentDimension > 0 ? stats.currentDimension : '---'}
        </span>
      </div>
      <div
        className={`${styles.statChip} ${styles.chipGreenLight}`}
        style={{
          cursor: isBusy ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          opacity: isBusy ? 0.5 : 1
        }}
        onClick={isBusy ? undefined : onDetectDimension}
      >
        <span className={styles.chipIcon}>
          <MdCheckCircleOutline size={14} />
        </span>
        <span className={styles.chipStrong}>{t('settings.rag_detect_dimension', '检测维度')}</span>
        <span className={styles.chipActionIcon}>
          <MdRefresh size={14} />
        </span>
      </div>
    </div>
  )
}
