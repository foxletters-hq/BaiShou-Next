import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { RagState } from './rag-memory.types'
import { ragMemoryStyles as styles } from './rag-memory.styles'

interface RagMemoryAlertsProps {
  ragState: RagState
  hasMismatchModel: boolean
  onTriggerMigration?: () => Promise<void>
}

export const RagMemoryAlerts: React.FC<RagMemoryAlertsProps> = ({
  ragState,
  hasMismatchModel,
  onTriggerMigration
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const isReembedding =
    ragState.isRunning && (ragState.type === 'reembed' || ragState.type === 'migration')
  const showEmbedError = !isReembedding && !!ragState.error

  return (
    <>
      {isReembedding && (
        <View
          style={[
            styles.alertBox,
            {
              backgroundColor: colors.primaryLight,
              borderColor: colors.primaryTrackMuted
            }
          ]}
        >
          <Text style={[styles.alertTitle, { color: colors.primary }]}>
            {t('settings.rag_migrating')}
          </Text>
          {ragState.statusText ? (
            <Text style={[styles.alertDesc, { color: colors.textSecondary }]}>
              {ragState.statusText}
            </Text>
          ) : null}
          {ragState.total > 0 ? (
            <View
              style={[
                styles.progressBar,
                { backgroundColor: colors.bgSurfaceNormal, marginTop: 8 }
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${Math.min(100, Math.max(0, (ragState.progress / ragState.total) * 100))}%`
                  }
                ]}
              />
            </View>
          ) : null}
        </View>
      )}

      {showEmbedError && (
        <View
          style={[
            styles.alertBox,
            {
              backgroundColor: colors.errorContainer,
              borderColor: colors.errorContainer
            }
          ]}
        >
          <Text style={[styles.alertTitle, { color: colors.error }]}>
            {t('settings.rag_operation_failed')}
          </Text>
          <Text style={[styles.alertDesc, { color: colors.onErrorContainer }]}>
            {ragState.error}
          </Text>
        </View>
      )}

      {!isReembedding && hasMismatchModel && (
        <View
          style={[
            styles.alertBox,
            {
              backgroundColor: colors.errorContainer,
              borderColor: colors.errorContainer
            }
          ]}
        >
          <Text style={[styles.alertTitle, { color: colors.error }]}>
            {t('settings.rag_model_mismatch')}
          </Text>
          <Text style={[styles.alertDesc, { color: colors.onErrorContainer }]}>
            {t('settings.rag_model_mismatch_desc')}
          </Text>
          {onTriggerMigration ? (
            <TouchableOpacity
              style={[
                styles.alertAction,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.primaryTrackMuted
                }
              ]}
              onPress={() => void onTriggerMigration()}
              disabled={ragState.isRunning}
              activeOpacity={0.7}
            >
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
                {t('settings.rag_trigger_migration')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </>
  )
}
