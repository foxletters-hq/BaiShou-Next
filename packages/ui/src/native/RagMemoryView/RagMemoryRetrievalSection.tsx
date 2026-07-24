import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import { SettingsSliderRow } from '../settings/SettingsSliderRow'
import { settingsCardStyles } from '../settings/settings-card.styles'
import {
  BATCH_EMBED_CONCURRENCY_MIN,
  MOBILE_BATCH_EMBED_CONCURRENCY_CAP,
  RAG_SIMILARITY_SLIDER_SCALE,
  RAG_TOP_K_MAX,
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
  const similaritySliderValue = Math.round(ragSimilarityThreshold * RAG_SIMILARITY_SLIDER_SCALE)

  return (
    <View>
      <Text style={[settingsCardStyles.label, { color: colors.textPrimary, marginBottom: 12 }]}>
        {t('settings.rag_config_params')}
      </Text>

      <SettingsSliderRow
        title={t('settings.rag_top_k')}
        value={ragTopK}
        min={1}
        max={RAG_TOP_K_MAX}
        step={1}
        onChange={(v) => onChange({ ...config, ragTopK: v })}
      />

      <SettingsSliderRow
        title={t('settings.rag_similarity_threshold')}
        value={similaritySliderValue}
        min={0}
        max={RAG_SIMILARITY_SLIDER_SCALE}
        step={1}
        formatValue={(v) => (coerceNumber(v, 0) / RAG_SIMILARITY_SLIDER_SCALE).toFixed(2)}
        onChange={(v) =>
          onChange({
            ...config,
            ragSimilarityThreshold: Math.round(v) / RAG_SIMILARITY_SLIDER_SCALE
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

      <View style={[settingsCardStyles.row, { marginTop: 8 }]}>
        <View style={settingsCardStyles.rowText}>
          <Text style={[settingsCardStyles.cardTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
            {t('settings.rag_auto_resume_embed_on_online', '联网后自动恢复嵌入')}
          </Text>
          <Text style={[settingsCardStyles.hint, { color: colors.textSecondary, marginTop: 6 }]}>
            {t(
              'settings.rag_auto_resume_embed_on_online_hint',
              '开启后，冷启动入账或嵌入失败的日记会在联网/空闲时自动补嵌。关闭后仍可手动「全量扫描未索引日记」。'
            )}
          </Text>
        </View>
        <Switch
          value={config.autoResumeEmbedOnOnline !== false}
          onValueChange={(v) => onChange({ ...config, autoResumeEmbedOnOnline: v })}
        />
      </View>
    </View>
  )
}
