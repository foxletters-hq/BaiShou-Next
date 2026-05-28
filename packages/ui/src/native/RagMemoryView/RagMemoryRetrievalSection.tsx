import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import Slider from '@react-native-community/slider'
import { useNativeTheme } from '../theme'
import { SettingsSection } from '../SettingsSection'
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
  const { colors } = useNativeTheme()

  return (
    <SettingsSection title={t('rag.retrieval', '检索参数')}>
      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('rag.top_k', 'Top-K')}: {config.ragTopK}
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={20}
          step={1}
          value={config.ragTopK}
          onValueChange={(v) => onChange({ ...config, ragTopK: Math.round(v) })}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.borderMuted}
          thumbTintColor={colors.primary}
        />
      </View>

      <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('rag.similarity_threshold', '相似度阈值')}: {config.ragSimilarityThreshold.toFixed(2)}
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          step={0.01}
          value={config.ragSimilarityThreshold}
          onValueChange={(v) =>
            onChange({ ...config, ragSimilarityThreshold: Math.round(v * 100) / 100 })
          }
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.borderMuted}
          thumbTintColor={colors.primary}
        />
      </View>

      <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('settings.rag_batch_embed_concurrency', '批量嵌入并发')}:{' '}
          {config.batchEmbedConcurrency ?? DEFAULT_BATCH_EMBED_CONCURRENCY}
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={BATCH_EMBED_CONCURRENCY_MIN}
          maximumValue={BATCH_EMBED_CONCURRENCY_MAX}
          step={1}
          value={config.batchEmbedConcurrency ?? DEFAULT_BATCH_EMBED_CONCURRENCY}
          onValueChange={(v) => onChange({ ...config, batchEmbedConcurrency: Math.round(v) })}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.borderMuted}
          thumbTintColor={colors.primary}
        />
      </View>
    </SettingsSection>
  )
}
