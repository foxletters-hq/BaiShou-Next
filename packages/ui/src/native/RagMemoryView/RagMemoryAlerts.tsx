import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button } from '../Button'
import { useNativeTheme } from '../theme'
import type { RagState } from './rag-memory.types'
import { ragMemoryStyles as styles } from './rag-memory.styles'

interface RagMemoryAlertsProps {
  ragState: RagState
  hasMismatchModel: boolean
  migrationCancelBusy?: boolean
  onTriggerMigration?: () => Promise<void>
  onCancelMigration?: () => Promise<void>
  onPauseBatchEmbed?: () => Promise<void>
  onResumeBatchEmbed?: () => Promise<void>
  onCancelBatchEmbed?: () => Promise<void>
}

export const RagMemoryAlerts: React.FC<RagMemoryAlertsProps> = ({
  ragState,
  hasMismatchModel,
  migrationCancelBusy = false,
  onTriggerMigration,
  onCancelMigration,
  onPauseBatchEmbed,
  onResumeBatchEmbed,
  onCancelBatchEmbed
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const isBatchEmbedding = ragState.isRunning && ragState.type === 'batchEmbed'
  const isMigrating =
    ragState.isRunning && (ragState.type === 'reembed' || ragState.type === 'migration')
  const isAborting =
    migrationCancelBusy ||
    ragState.cancelling ||
    ragState.statusKey === 'settings.rag_migration_aborting'
  const showEmbedError = !ragState.isRunning && !!ragState.error
  const batchTitle = isAborting
    ? t('settings.rag_batch_embed_cancelling', '正在取消索引…')
    : ragState.paused
      ? t('settings.rag_batch_embed_paused', '索引已暂停')
      : t('settings.rag_indexing', '正在补齐嵌入…')

  return (
    <>
      {isBatchEmbedding && (
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
            <Text style={[styles.alertTitle, { color: colors.primary, flex: 1, marginBottom: 0 }]}>
              {batchTitle}
            </Text>
            {(onPauseBatchEmbed || onResumeBatchEmbed || onCancelBatchEmbed) && (
              <View style={styles.batchEmbedActions}>
                {ragState.paused && !isAborting
                  ? onResumeBatchEmbed && (
                      <Button variant="outlined" onPress={() => void onResumeBatchEmbed()}>
                        {t('settings.rag_batch_embed_resume', '继续')}
                      </Button>
                    )
                  : onPauseBatchEmbed && (
                      <Button
                        variant="outlined"
                        disabled={isAborting}
                        onPress={() => void onPauseBatchEmbed()}
                      >
                        {t('settings.rag_batch_embed_pause', '暂停')}
                      </Button>
                    )}
                {onCancelBatchEmbed && (
                  <Button
                    variant="outlined"
                    disabled={isAborting}
                    isLoading={isAborting}
                    onPress={() => void onCancelBatchEmbed()}
                  >
                    {t('settings.rag_batch_embed_cancel', '取消')}
                  </Button>
                )}
              </View>
            )}
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

      {isMigrating && (
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
            <Text style={[styles.alertTitle, { color: colors.primary, flex: 1, marginBottom: 0 }]}>
              {isAborting
                ? t('settings.rag_migration_aborting', '正在取消并停止嵌入…')
                : t('settings.rag_migrating', '知识库正在迁移中...')}
            </Text>
            {onCancelMigration ? (
              <Button
                variant="outlined"
                disabled={isAborting}
                isLoading={isAborting}
                onPress={() => void onCancelMigration()}
              >
                {isAborting
                  ? t('settings.rag_migration_cancelling', '取消中...')
                  : t('settings.rag_migration_cancel', '取消')}
              </Button>
            ) : null}
          </View>
          {ragState.statusText ? (
            <Text style={[styles.alertDesc, { color: colors.textSecondary }]}>
              {ragState.statusText}
            </Text>
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

      {!ragState.isRunning && hasMismatchModel && (
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
            <Button
              variant="outlined"
              onPress={() => void onTriggerMigration()}
              disabled={ragState.isRunning}
            >
              {t('settings.rag_trigger_migration')}
            </Button>
          ) : null}
        </View>
      )}
    </>
  )
}
