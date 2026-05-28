import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdTune } from 'react-icons/md'
import {
  BATCH_EMBED_CONCURRENCY_MAX,
  BATCH_EMBED_CONCURRENCY_MIN,
  DEFAULT_BATCH_EMBED_CONCURRENCY
} from '@baishou/shared'
import type { RagConfig } from './rag-memory.types'
import styles from './RagMemoryView.module.css'

interface RagMemoryConfigBlockProps {
  config: RagConfig
  onChange: (config: RagConfig) => void
}

export const RagMemoryConfigBlock: React.FC<RagMemoryConfigBlockProps> = ({ config, onChange }) => {
  const { t } = useTranslation()

  return (
    <div className={styles.configBlock}>
      <div className={styles.configBlockHeader}>
        <span className={styles.configBlockIcon}>
          <MdTune size={18} />
        </span>
        <span className={styles.configBlockTitle}>
          {t('settings.rag_config_params', '检索参数调节')}
        </span>
      </div>
      <div className={styles.paramSliders}>
        <div className={styles.paramSliderRow}>
          <span className={styles.paramLabel}>Top K</span>
          <input
            type="range"
            className={styles.rangeInput}
            min="1"
            max="50"
            step="1"
            value={config.ragTopK || 30}
            onChange={(e) => onChange({ ...config, ragTopK: parseInt(e.target.value) })}
          />
          <span className={styles.paramValueBlue}>{config.ragTopK || 30}</span>
        </div>
        <div className={styles.paramSliderRow}>
          <span className={styles.paramLabel}>
            {t('settings.rag_similarity_threshold', '相似度阈值')}
          </span>
          <input
            type="range"
            className={styles.rangeInput}
            min="0"
            max="1"
            step="0.05"
            value={config.ragSimilarityThreshold ?? 0.4}
            onChange={(e) =>
              onChange({
                ...config,
                ragSimilarityThreshold: parseFloat(e.target.value)
              })
            }
          />
          <span className={styles.paramValueBlue}>
            {(config.ragSimilarityThreshold ?? 0.4).toFixed(2)}
          </span>
        </div>
        <div className={styles.paramSliderRow}>
          <span className={styles.paramLabel}>
            {t('settings.rag_batch_embed_concurrency', '批量嵌入并发')}
          </span>
          <input
            type="range"
            className={styles.rangeInput}
            min={BATCH_EMBED_CONCURRENCY_MIN}
            max={BATCH_EMBED_CONCURRENCY_MAX}
            step="1"
            value={config.batchEmbedConcurrency ?? DEFAULT_BATCH_EMBED_CONCURRENCY}
            onChange={(e) =>
              onChange({
                ...config,
                batchEmbedConcurrency: parseInt(e.target.value, 10)
              })
            }
          />
          <span className={styles.paramValueBlue}>
            {config.batchEmbedConcurrency ?? DEFAULT_BATCH_EMBED_CONCURRENCY}
          </span>
        </div>
        <p className={styles.paramHint}>
          {t(
            'settings.rag_batch_embed_concurrency_hint',
            '同时嵌入的日记篇数。数值越大越快，但更容易触发 API 限流；建议 2–3。'
          )}
        </p>
      </div>
    </div>
  )
}
