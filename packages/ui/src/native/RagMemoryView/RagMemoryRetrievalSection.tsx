import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import Slider from '@react-native-community/slider'
import { useNativeTheme } from '../theme'
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

const TRACK_HEIGHT = 6

const ThickSlider: React.FC<{
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  primaryColor: string
  trackMutedColor: string
}> = ({ value, min, max, step, onChange, primaryColor, trackMutedColor }) => {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <View style={styles.sliderWrap}>
      <View
        style={[
          styles.trackBase,
          { height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, backgroundColor: trackMutedColor }
        ]}
      />
      <View
        style={[
          styles.trackActive,
          {
            height: TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            backgroundColor: primaryColor,
            width: `${pct}%`
          }
        ]}
      />
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={(v) => onChange(v)}
        minimumTrackTintColor="transparent"
        maximumTrackTintColor="transparent"
        thumbTintColor={primaryColor}
      />
    </View>
  )
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
        <ThickSlider
          value={config.ragTopK}
          min={1}
          max={20}
          step={1}
          onChange={(v) => onChange({ ...config, ragTopK: Math.round(v) })}
          primaryColor={colors.primary}
          trackMutedColor={colors.bgSurfaceNormal}
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
        <ThickSlider
          value={config.ragSimilarityThreshold}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) =>
            onChange({ ...config, ragSimilarityThreshold: Math.round(v * 100) / 100 })
          }
          primaryColor={colors.primary}
          trackMutedColor={colors.bgSurfaceNormal}
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
        <ThickSlider
          value={config.batchEmbedConcurrency ?? DEFAULT_BATCH_EMBED_CONCURRENCY}
          min={BATCH_EMBED_CONCURRENCY_MIN}
          max={BATCH_EMBED_CONCURRENCY_MAX}
          step={1}
          onChange={(v) => onChange({ ...config, batchEmbedConcurrency: Math.round(v) })}
          primaryColor={colors.primary}
          trackMutedColor={colors.bgSurfaceNormal}
        />
        <Text style={[styles.hint, { color: colors.textSecondary, paddingHorizontal: 0 }]}>
          {t('settings.rag_batch_embed_concurrency_hint')}
        </Text>
      </View>
    </View>
  )
}
