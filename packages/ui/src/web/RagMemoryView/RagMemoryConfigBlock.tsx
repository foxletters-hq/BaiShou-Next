import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdTune } from 'react-icons/md'
import {
  BATCH_EMBED_CONCURRENCY_MAX,
  BATCH_EMBED_CONCURRENCY_MIN,
  DEFAULT_BATCH_EMBED_CONCURRENCY
} from '@baishou/shared'
import { HelpTooltip } from '../HelpTooltip'
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
          <div className={styles.paramLabelGroup}>
            <span className={styles.paramLabel}>{t('settings.rag_top_k', '召回数量上限 (Top-K)')}</span>
            <HelpTooltip
              content={t(
                'settings.rag_top_k_tooltip',
                'AI 检索记忆时，最多返回多少条最相似的结果。数值越大召回越多，也可能带入不太相关的片段。'
              )}
            />
          </div>
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
          <div className={styles.paramLabelGroup}>
            <span className={styles.paramLabel}>
              {t('settings.rag_similarity_threshold', '相似度阈值')}
            </span>
            <HelpTooltip
              content={t(
                'settings.rag_similarity_threshold_tooltip',
                '只保留相似度高于此值的记忆片段。阈值越高，匹配越严格、结果越少。'
              )}
            />
          </div>
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
          <div className={styles.paramLabelGroup}>
            <span className={styles.paramLabel}>
              {t('settings.rag_batch_embed_concurrency', '批量嵌入并发')}
            </span>
            <HelpTooltip
              content={t(
                'settings.rag_batch_embed_concurrency_hint',
                '同时嵌入的日记篇数。数值越大越快，但更容易触发 API 限流；建议 2–3。'
              )}
            />
          </div>
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
      </div>
    </div>
  )
}
