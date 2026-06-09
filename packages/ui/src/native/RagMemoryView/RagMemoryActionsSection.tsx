import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { RagState } from './rag-memory.types'
import { ragMemoryStyles as styles } from './rag-memory.styles'

interface RagMemoryActionsSectionProps {
  ragState: RagState
  onBatchEmbed?: () => Promise<void>
  onAddManualMemory?: () => Promise<void>
}

export const RagMemoryActionsSection: React.FC<RagMemoryActionsSectionProps> = ({
  ragState,
  onBatchEmbed,
  onAddManualMemory
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const progressPercent =
    ragState.total > 0 ? Math.round((ragState.progress / ragState.total) * 100) : 0
  const isBatchEmbedding = ragState.isRunning && ragState.type === 'batchEmbed'
  const showInlineProgress =
    ragState.isRunning && ragState.type !== 'reembed' && ragState.type !== 'migration'

  return (
    <View>
      {showInlineProgress && (
        <View style={styles.progressBox}>
          <Text style={[styles.statusText, { color: colors.textPrimary }]}>
            {ragState.statusText || t('common.processing')}
          </Text>
          <View style={[styles.progressBar, { backgroundColor: colors.bgSurfaceNormal }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: `${progressPercent}%`
                }
              ]}
            />
          </View>
          {ragState.total > 0 ? (
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
              {ragState.progress}/{ragState.total}
            </Text>
          ) : null}
        </View>
      )}

      <View style={styles.actionRow}>
        {onBatchEmbed && (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: colors.primaryLight,
                borderColor: 'transparent',
                opacity: ragState.isRunning ? 0.5 : 1
              }
            ]}
            onPress={() => void onBatchEmbed()}
            disabled={ragState.isRunning}
            activeOpacity={0.7}
          >
            <MaterialIcons name="auto-stories" size={16} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>
              {isBatchEmbedding
                ? `${t('common.processing')} ${ragState.progress}/${ragState.total}`
                : t('settings.rag_batch_embed')}
            </Text>
          </TouchableOpacity>
        )}
        {onAddManualMemory && (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.actionBtnOutlined,
              {
                backgroundColor: colors.bgSurfaceHigh,
                borderColor: colors.borderMuted,
                opacity: ragState.isRunning ? 0.5 : 1
              }
            ]}
            onPress={() => void onAddManualMemory()}
            disabled={ragState.isRunning}
            activeOpacity={0.7}
          >
            <MaterialIcons name="add-comment" size={16} color={colors.success} />
            <Text style={[styles.actionBtnText, { color: colors.success }]}>
              {t('settings.rag_add_manual')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}
