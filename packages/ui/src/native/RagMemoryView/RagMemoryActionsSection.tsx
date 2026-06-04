import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { SettingsSection } from '../SettingsSection'
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
    <>
      {showInlineProgress && (
        <SettingsSection title={t('settings.rag_migrating', '处理中')}>
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
        </SettingsSection>
      )}

      <View style={styles.actionRow}>
        {onBatchEmbed && (
          <TouchableOpacity
            style={[
              styles.actionBtnBlue,
              {
                backgroundColor: colors.primaryLight,
                borderColor: 'rgba(91, 168, 245, 0.2)',
                opacity: ragState.isRunning ? 0.5 : 1
              }
            ]}
            onPress={() => void onBatchEmbed()}
            disabled={ragState.isRunning}
            activeOpacity={0.7}
          >
            <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
              {isBatchEmbedding
                ? `${t('common.processing')} ${ragState.progress}/${ragState.total}`
                : t('settings.rag_batch_embed')}
            </Text>
          </TouchableOpacity>
        )}
        {onAddManualMemory && (
          <TouchableOpacity
            style={[
              styles.actionBtnGreen,
              {
                backgroundColor: 'rgba(34, 197, 94, 0.05)',
                borderColor: 'rgba(34, 197, 94, 0.3)',
                opacity: ragState.isRunning ? 0.5 : 1
              }
            ]}
            onPress={() => void onAddManualMemory()}
            disabled={ragState.isRunning}
            activeOpacity={0.7}
          >
            <Text style={{ color: colors.success, fontWeight: '600', fontSize: 13 }}>
              {t('settings.rag_add_manual')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  )
}
