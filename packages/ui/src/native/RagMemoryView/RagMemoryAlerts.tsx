import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { RagState } from './rag-memory.types'
import { ragMemoryStyles as styles } from './rag-memory.styles'

interface RagMemoryAlertsProps {
  ragState: RagState
  hasMismatchModel: boolean
  migrationCancelBusy?: boolean
  onTriggerMigration?: () => Promise<void>
  onCancelMigration?: () => Promise<void>
}

export const RagMemoryAlerts: React.FC<RagMemoryAlertsProps> = ({
  ragState,
  hasMismatchModel,
  migrationCancelBusy = false,
  onTriggerMigration,
  onCancelMigration
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const isLongRunning =
    ragState.isRunning &&
    (ragState.type === 'reembed' ||
      ragState.type === 'migration' ||
      ragState.type === 'batchEmbed')
  const isAborting =
    migrationCancelBusy || ragState.statusKey === 'settings.rag_migration_aborting'
  const showEmbedError = !isLongRunning && !!ragState.error

  return (
    <>
      {isLongRunning && (
        <View
          style={[
            styles.alertBox,
            {
              backgroundColor: colors.primaryLight,
              borderColor: colors.primaryTrackMuted
            }
          ]}
        >
          <View style={styles.migrationRow}>
            <Text style={[styles.alertTitle, { color: colors.primary, flex: 1 }]}>
              {isAborting
                ? t('settings.rag_migration_aborting', '正在取消并停止嵌入…')
                : t('settings.rag_migrating', '知识库正在迁移中...')}
            </Text>
            {onCancelMigration ? (
              <TouchableOpacity
                onPress={() => void onCancelMigration()}
                disabled={isAborting}
                activeOpacity={0.7}
                style={[
                  styles.alertAction,
                  {
                    backgroundColor: colors.bgSurface,
                    borderColor: colors.primaryTrackMuted,
                    marginTop: 0,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    opacity: isAborting ? 0.5 : 1
                  }
                ]}
              >
                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 12 }}>
                  {isAborting
                    ? t('settings.rag_migration_cancelling', '取消中...')
                    : t('settings.rag_migration_cancel', '取消')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
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

      {!isLongRunning && hasMismatchModel && (
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
