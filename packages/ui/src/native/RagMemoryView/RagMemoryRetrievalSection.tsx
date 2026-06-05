import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { NativeSlider } from '../Slider'
import {
  BATCH_EMBED_CONCURRENCY_MAX,
  BATCH_EMBED_CONCURRENCY_MIN,
  DEFAULT_BATCH_EMBED_CONCURRENCY
} from '@baishou/shared'
import type { RagConfig } from './rag-memory.types'
import { ragMemoryStyles as styles } from './rag-memory.styles'

interface RagMemoryRetrievalSectionProps {
  config: RagConfig
  onChange: (config: RagConfig) => void
}

export const RagMemoryRetrievalSection: React.FC<RagMemoryRetrievalSectionProps> = ({
  config,
  onChange
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <View
      style={[
        styles.configBlock,
        {
          marginHorizontal: tokens.spacing.lg,
          marginBottom: tokens.spacing.md,
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle
        }
      ]}
    >
      <View style={styles.configBlockHeader}>
        <Text style={[styles.configBlockTitle, { color: colors.textPrimary }]}>
          {t('settings.rag_config_params')}
        </Text>
      </View>

      <View
        style={[styles.paramSliderRow, { borderTopWidth: 1, borderTopColor: colors.borderSubtle }]}
      >
        <View style={styles.paramLabelRow}>
          <Text style={[styles.paramLabel, { color: colors.textPrimary }]}>Top K</Text>
          <Text style={[styles.paramValue, { color: colors.primary }]}>{config.ragTopK}</Text>
        </View>
        <NativeSlider
          value={config.ragTopK}
          minValue={1}
          maxValue={20}
          step={1}
          onChange={(v) => onChange({ ...config, ragTopK: Math.round(v as number) })}
        />
      </View>

      <View
        style={[styles.paramSliderRow, { borderTopWidth: 1, borderTopColor: colors.borderSubtle }]}
      >
        <View style={styles.paramLabelRow}>
          <Text style={[styles.paramLabel, { color: colors.textPrimary }]}>
            {t('settings.rag_similarity_threshold')}
          </Text>
          <Text style={[styles.paramValue, { color: colors.primary }]}>
            {config.ragSimilarityThreshold.toFixed(2)}
          </Text>
        </View>
        <NativeSlider
          value={config.ragSimilarityThreshold}
          minValue={0}
          maxValue={1}
          step={0.01}
          onChange={(v) =>
            onChange({
              ...config,
              ragSimilarityThreshold: Math.round((v as number) * 100) / 100
            })
          }
        />
      </View>

      <View
        style={[styles.paramSliderRow, { borderTopWidth: 1, borderTopColor: colors.borderSubtle }]}
      >
        <View style={styles.paramLabelRow}>
          <Text style={[styles.paramLabel, { color: colors.textPrimary }]}>
            {t('settings.rag_batch_embed_concurrency', '批量嵌入并发')}
          </Text>
          <Text style={[styles.paramValue, { color: colors.primary }]}>
            {config.batchEmbedConcurrency ?? DEFAULT_BATCH_EMBED_CONCURRENCY}
          </Text>
        </View>
        <NativeSlider
          value={config.batchEmbedConcurrency ?? DEFAULT_BATCH_EMBED_CONCURRENCY}
          minValue={BATCH_EMBED_CONCURRENCY_MIN}
          maxValue={BATCH_EMBED_CONCURRENCY_MAX}
          step={1}
          onChange={(v) =>
            onChange({ ...config, batchEmbedConcurrency: Math.round(v as number) })
          }
        />
        <Text style={[styles.hint, { color: colors.textSecondary, paddingHorizontal: 0 }]}>
          {t('settings.rag_batch_embed_concurrency_hint')}
        </Text>
      </View>
    </View>
  )
}
