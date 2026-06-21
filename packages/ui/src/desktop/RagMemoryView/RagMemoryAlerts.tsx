import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdWarning } from 'react-icons/md'
import type { EmbeddingMigrationStateView } from '@baishou/shared'
import type { RagState } from './rag-memory.types'
import styles from './RagMemoryView.module.css'

interface RagMemoryAlertsProps {
  ragState: RagState
  hasMismatchModel: boolean
  migrationState?: EmbeddingMigrationStateView | null
  onTriggerMigration?: () => Promise<void>
  onCancelMigration?: () => Promise<void>
  onRestoreMigration?: () => Promise<void>
  onResumeMigration?: () => Promise<void>
}

export const RagMemoryAlerts: React.FC<RagMemoryAlertsProps> = ({
  ragState,
  hasMismatchModel,
  migrationState,
  onTriggerMigration,
  onCancelMigration,
  onRestoreMigration,
  onResumeMigration
}) => {
  const { t } = useTranslation()
  const isMigrating = ragState.isRunning && ragState.type === 'migration'
  const showEmbedError = !isMigrating && !!ragState.error
  const showInterrupted =
    !isMigrating &&
    migrationState &&
    (migrationState.status === 'interrupted' ||
      migrationState.canRestore ||
      migrationState.canResume)

  return (
    <>
      {isMigrating && (
        <div className={styles.migrationAlert}>
          <div className={styles.migrationRow}>
            <div className={styles.spinner}></div>
            <span className={styles.migTitle}>
              {t('settings.rag_migrating', '知识库正在迁移中...')}
            </span>
            {onCancelMigration && (
              <button
                type="button"
                className={styles.migrationCancelBtn}
                onClick={() => void onCancelMigration()}
              >
                {t('settings.rag_migration_cancel', '取消迁移')}
              </button>
            )}
          </div>
          <p className={styles.migDesc}>{ragState.statusText}</p>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${Math.min(100, Math.max(0, (ragState.progress / ragState.total) * 100))}%`
              }}
            ></div>
          </div>
        </div>
      )}

      {showEmbedError && (
        <div className={styles.dangerAlert}>
          <div className={styles.dangerRow}>
            <MdWarning size={18} color="#ef4444" />
            <span className={styles.dangerTitle}>
              {t('settings.rag_operation_failed', '向量嵌入操作失败')}
            </span>
          </div>
          <p className={styles.dangerDesc}>{ragState.error}</p>
        </div>
      )}

      {showInterrupted && (
        <div className={styles.dangerAlert}>
          <div className={styles.dangerRow}>
            <MdWarning size={18} color="#ef4444" />
            <span className={styles.dangerTitle}>
              {t('settings.rag_migration_interrupted_title', '检测到未完成的嵌入迁移')}
            </span>
          </div>
          <p className={styles.dangerDesc}>
            {migrationState?.canRestore
              ? t(
                  'settings.rag_migration_interrupted_restore_desc',
                  '迁移尚未完成。已保留迁移前完整备份，您可一键恢复原有向量数据与嵌入模型。'
                )
              : t(
                  'settings.rag_migration_interrupted_resume_desc',
                  '迁移尚未完成。您可以从上次进度继续迁移，或先恢复备份数据。'
                )}
          </p>
          <div className={styles.migrationActionRow}>
            {migrationState?.canRestore && onRestoreMigration && (
              <button
                type="button"
                className={styles.migrationRestoreBtn}
                onClick={() => void onRestoreMigration()}
              >
                {t('settings.rag_migration_restore_backup', '一键恢复备份数据')}
              </button>
            )}
            {migrationState?.canResume && onResumeMigration && (
              <button
                type="button"
                className={styles.migrationResumeBtn}
                onClick={() => void onResumeMigration()}
              >
                {t('settings.rag_migration_resume', '继续迁移')}
              </button>
            )}
          </div>
        </div>
      )}

      {!isMigrating && !showInterrupted && hasMismatchModel && (
        <div className={styles.dangerAlert}>
          <div className={styles.dangerRow}>
            <MdWarning size={18} color="#ef4444" />
            <span className={styles.dangerTitle}>
              {t('settings.rag_model_mismatch', '模型版本不匹配')}
            </span>
          </div>
          <p className={styles.dangerDesc}>
            {t(
              'settings.rag_model_mismatch_desc',
              '系统检测到当前的向量库由不同的嵌入模型(Embedding)生成。必须执行数据迁移，否则搜索功能将无法正确工作或引发错误。'
            )}
          </p>
          {onTriggerMigration && (
            <div className={styles.migrationActionRow}>
              <button
                type="button"
                className={styles.migrationResumeBtn}
                onClick={() => void onTriggerMigration()}
              >
                {t('settings.rag_trigger_migration', '执行向量库迁移')}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
