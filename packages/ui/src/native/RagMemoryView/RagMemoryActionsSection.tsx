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
  onClearAll?: () => Promise<void>
  onClearDimension?: () => Promise<void>
  onDetectDimension?: () => Promise<void>
}

export const RagMemoryActionsSection: React.FC<RagMemoryActionsSectionProps> = ({
  ragState,
  onBatchEmbed,
  onClearAll,
  onClearDimension,
  onDetectDimension
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const progressPercent =
    ragState.total > 0 ? Math.round((ragState.progress / ragState.total) * 100) : 0

  return (
    <>
      {ragState.isRunning && (
        <SettingsSection title={t('rag.progress', '任务进度')}>
          <View style={styles.progressBox}>
            <Text style={[styles.statusText, { color: colors.textPrimary }]}>
              {ragState.statusText}
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
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
              {ragState.progress}/{ragState.total}
            </Text>
          </View>
        </SettingsSection>
      )}

      <View style={styles.actionRow}>
        {onBatchEmbed && (
          <Button
            variant="outlined"
            onPress={onBatchEmbed}
            disabled={ragState.isRunning}
            style={styles.actionBtn}
          >
            {t('rag.batch_embed', '全量嵌入')}
          </Button>
        )}
        {onClearAll && (
          <Button
            variant="outlined"
            onPress={onClearAll}
            disabled={ragState.isRunning}
            style={styles.actionBtn}
          >
            {t('rag.clear_all', '清空全部')}
          </Button>
        )}
      </View>

      <View style={styles.actionRow}>
        {onClearDimension && (
          <Button
            variant="text"
            onPress={onClearDimension}
            disabled={ragState.isRunning}
            style={styles.actionBtn}
          >
            {t('rag.clear_dimension', '清除维度')}
          </Button>
        )}
        {onDetectDimension && (
          <Button
            variant="text"
            onPress={onDetectDimension}
            disabled={ragState.isRunning}
            style={styles.actionBtn}
          >
            {t('rag.detect_dimension', '检测维度')}
          </Button>
        )}
      </View>
    </>
  )
}
