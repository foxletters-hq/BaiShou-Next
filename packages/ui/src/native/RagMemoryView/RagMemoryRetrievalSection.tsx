import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { SettingsSliderRow } from '../settings/SettingsSliderRow'
import { settingsCardStyles } from '../settings/settings-card.styles'
import {
  BATCH_EMBED_CONCURRENCY_MIN,
  MOBILE_BATCH_EMBED_CONCURRENCY_CAP,
  resolveMobileBatchEmbedConcurrency
} from '@baishou/shared'
import type { RagConfig } from './rag-memory.types'

interface RagMemoryRetrievalSectionProps {
  config: RagConfig
  onChange: (config: RagConfig) => void
}

/** 持久化/迁移可能把数值存成字符串，统一兜底，避免 toFixed 等数值方法在 render 阶段崩溃 */
function coerceNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const RagMemoryRetrievalSection: React.FC<RagMemoryRetrievalSectionProps> = ({
  config,
  onChange
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const ragTopK = coerceNumber(config.ragTopK, 20)
  const ragSimilarityThreshold = coerceNumber(config.ragSimilarityThreshold, 0.4)

  return (
    <View>
      <Text style={[settingsCardStyles.label, { color: colors.textPrimary, marginBottom: 12 }]}>
        {t('settings.rag_config_params')}
      </Text>

      <SettingsSliderRow
        title={t('settings.rag_top_k')}
        value={ragTopK}
        min={1}
        max={20}
        step={1}
        onChange={(v) => onChange({ ...config, ragTopK: v })}
      />

      <SettingsSliderRow
        title={t('settings.rag_similarity_threshold')}
        value={ragSimilarityThreshold}
        min={0}
        max={1}
        step={0.01}
        formatValue={(v) => coerceNumber(v, 0).toFixed(2)}
        onChange={(v) =>
          onChange({
            ...config,
            ragSimilarityThreshold: Math.round(v * 100) / 100
          })
        }
      />

      <SettingsSliderRow
        title={t('settings.rag_batch_embed_concurrency', '批量嵌入并发')}
        description={t('settings.rag_batch_embed_concurrency_hint')}
        value={resolveMobileBatchEmbedConcurrency(config.batchEmbedConcurrency)}
        min={BATCH_EMBED_CONCURRENCY_MIN}
        max={MOBILE_BATCH_EMBED_CONCURRENCY_CAP}
        step={1}
        onChange={(v) => onChange({ ...config, batchEmbedConcurrency: v })}
      />
    </View>
  )
}
