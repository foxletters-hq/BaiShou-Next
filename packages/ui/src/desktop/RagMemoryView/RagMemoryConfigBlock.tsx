import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  BATCH_EMBED_CONCURRENCY_MAX,
  BATCH_EMBED_CONCURRENCY_MIN,
  DEFAULT_BATCH_EMBED_CONCURRENCY,
  RAG_TOP_K_MAX
} from '@baishou/shared'
import { HelpTooltip } from '../HelpTooltip'
import { Switch } from '../Switch/Switch'
import stack from '../shared/SettingsStack.module.css'
import type { RagConfig } from './rag-memory.types'
import styles from './RagMemoryView.module.css'

interface RagMemoryConfigBlockProps {
  config: RagConfig
  onChange: (config: RagConfig) => void
}

function coerceNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const RagMemoryConfigBlock: React.FC<RagMemoryConfigBlockProps> = ({ config, onChange }) => {
  const { t } = useTranslation()
  const ragTopK = coerceNumber(config.ragTopK, 30)
  const ragSimilarityThreshold = coerceNumber(config.ragSimilarityThreshold, 0.4)
  const batchEmbedConcurrency = coerceNumber(
    config.batchEmbedConcurrency,
    DEFAULT_BATCH_EMBED_CONCURRENCY
  )

  return (
    <div className={stack.stackGroup}>
      <div className={stack.sectionLabelRow}>
        <h3 className={stack.sectionLabel}>
          {t('settings.rag_config_params', '检索参数调节')}
        </h3>
      </div>
      <section className={stack.cardSection}>
        <div className={`${styles.paramSliders} ${stack.cardBodyPadded}`}>
          <div className={styles.paramSliderRow}>
            <div className={styles.paramLabelGroup}>
              <span className={styles.paramLabel}>
                {t('settings.rag_top_k', '召回数量上限 (Top-K)')}
              </span>
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
              max={String(RAG_TOP_K_MAX)}
              step="1"
              value={ragTopK}
              onChange={(e) => onChange({ ...config, ragTopK: parseInt(e.target.value) })}
            />
            <span className={styles.paramValueBlue}>{ragTopK}</span>
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
              value={ragSimilarityThreshold}
              onChange={(e) =>
                onChange({
                  ...config,
                  ragSimilarityThreshold: parseFloat(e.target.value)
                })
              }
            />
            <span className={styles.paramValueBlue}>{ragSimilarityThreshold.toFixed(2)}</span>
          </div>
          <div className={styles.paramSliderRow}>
            <div className={styles.paramLabelGroup}>
              <span className={styles.paramLabel}>
                {t('settings.rag_batch_embed_concurrency', '批量嵌入并发')}
              </span>
              <HelpTooltip
                content={t(
                  'settings.rag_batch_embed_concurrency_hint',
                  '同时嵌入的日记篇数。数值越大越快，但更容易触发 API 限流；默认 20，遇限流可调低。'
                )}
              />
            </div>
            <input
              type="range"
              className={styles.rangeInput}
              min={BATCH_EMBED_CONCURRENCY_MIN}
              max={BATCH_EMBED_CONCURRENCY_MAX}
              step="1"
              value={batchEmbedConcurrency}
              onChange={(e) =>
                onChange({
                  ...config,
                  batchEmbedConcurrency: parseInt(e.target.value, 10)
                })
              }
            />
            <span className={styles.paramValueBlue}>{batchEmbedConcurrency}</span>
          </div>
          <div className={styles.paramSliderRow}>
            <div className={styles.paramLabelGroup}>
              <span className={styles.paramLabel}>
                {t('settings.rag_auto_resume_embed_on_online', '联网后自动恢复嵌入')}
              </span>
              <HelpTooltip
                content={t(
                  'settings.rag_auto_resume_embed_on_online_hint',
                  '开启后，冷启动入账或嵌入失败的日记会在联网/空闲时自动补嵌。关闭后仍可手动「全量扫描未索引日记」。'
                )}
              />
            </div>
            <Switch
              size="sm"
              checked={config.autoResumeEmbedOnOnline !== false}
              onChange={(e) =>
                onChange({
                  ...config,
                  autoResumeEmbedOnOnline: e.target.checked
                })
              }
            />
          </div>
        </div>
      </section>
    </div>
  )
}
