import React from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { Switch } from '../Switch/Switch'
import type { RagConfig, RagStats } from './rag-memory.types'
import styles from './RagMemoryView.module.css'

interface RagMemoryStatusStripProps {
  config: RagConfig
  stats: RagStats
  embeddingModelId?: string
  isBusy: boolean
  extraChips?: React.ReactNode
  onChange: (config: RagConfig) => void
  onNavigateToConfig?: () => void
  onDetectDimension?: () => Promise<void>
}

export const RagMemoryStatusStrip: React.FC<RagMemoryStatusStripProps> = ({
  config,
  stats,
  embeddingModelId,
  isBusy,
  extraChips,
  onChange,
  onNavigateToConfig,
  onDetectDimension
}) => {
  const { t } = useTranslation()
  const count = stats.diaryCountForVault != null ? stats.diaryCountForVault : stats.totalCount

  return (
    <div className={styles.statusStrip}>
      <label className={styles.enableChip}>
        <Switch
          size="sm"
          checked={config.ragEnabled}
          onChange={(e) => onChange({ ...config, ragEnabled: e.target.checked })}
        />
        <span>{t('settings.rag_enable_short', '向量记忆')}</span>
      </label>

      {extraChips}

      <div className={styles.statusMeta}>
        <span>{t('settings.rag_meta_entries', '{{count}} 条片段', { count })}</span>
        <span className={styles.metaSep}>·</span>
        {stats.currentDimension > 0 ? (
          <span>
            {t('settings.rag_meta_dimension', '{{dim}} 维', { dim: stats.currentDimension })}
          </span>
        ) : (
          <span className={styles.metaWarn}>
            {t('settings.rag_meta_dimension_unknown', '维度未检测')}
          </span>
        )}
        <span className={styles.metaSep}>·</span>
        {embeddingModelId ? (
          <span className={styles.metaModel} title={embeddingModelId}>
            {embeddingModelId}
          </span>
        ) : (
          <button type="button" className={styles.metaLink} onClick={onNavigateToConfig}>
            {t('settings.rag_meta_model_unset', '未配置嵌入模型')}
          </button>
        )}
        <button
          type="button"
          className={styles.metaIconBtn}
          title={t('settings.rag_detect_dimension', '检测维度')}
          aria-label={t('settings.rag_detect_dimension', '检测维度')}
          disabled={isBusy}
          onClick={() => void onDetectDimension?.()}
        >
          <RefreshCw size={14} />
        </button>
      </div>
    </div>
  )
}
