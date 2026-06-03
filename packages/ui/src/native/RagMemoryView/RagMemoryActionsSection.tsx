import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Button } from '../Button'
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

      <View style={[styles.actionRow, { paddingHorizontal: 16, marginBottom: 8 }]}>
        {onBatchEmbed && (
          <Button
            variant="outlined"
            onPress={onBatchEmbed}
            disabled={ragState.isRunning}
            style={styles.actionBtn}
          >
            {isBatchEmbedding
              ? `${t('common.processing')} ${ragState.progress}/${ragState.total}`
              : t('settings.rag_batch_embed')}
          </Button>
        )}
        {onAddManualMemory && (
          <Button
            variant="outlined"
            onPress={onAddManualMemory}
            disabled={ragState.isRunning}
            style={styles.actionBtn}
          >
            {t('settings.rag_add_manual')}
          </Button>
        )}
      </View>
    </>
  )
}
