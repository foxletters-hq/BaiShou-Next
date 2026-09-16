import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  RAG_BATCH_EMBED_PHASE_IDS,
  phaseCountForId,
  ragBatchEmbedPhaseLabelKey,
  resolvePhaseRowStatus,
  type EmbeddingMigrationStateView
} from '@baishou/shared'
import type { RagState } from './rag-memory.types'
import styles from './RagMemoryView.module.css'
import { Button } from '../Button/Button'
import { TriangleAlert } from 'lucide-react'

interface RagMemoryAlertsProps {
  ragState: RagState
  hasMismatchModel: boolean
  migrationState?: EmbeddingMigrationStateView | null
  migrationCancelBusy?: boolean
  onTriggerMigration?: () => Promise<void>
  onCancelMigration?: () => Promise<void>
  onPauseBatchEmbed?: () => Promise<void>
  onResumeBatchEmbed?: () => Promise<void>
  onCancelBatchEmbed?: () => Promise<void>
  onRestoreMigration?: () => Promise<void>
  onResumeMigration?: () => Promise<void>
  graphExtract?: { current: number; total: number; percent: number } | null
  graphExtractWaiting?: boolean
  pendingGraphCount?: number
}

export const RagMemoryAlerts: React.FC<RagMemoryAlertsProps> = ({
  ragState,
  hasMismatchModel,
  migrationState,
  migrationCancelBusy = false,
  onTriggerMigration,
  onCancelMigration,
  onPauseBatchEmbed,
  onResumeBatchEmbed,
  onCancelBatchEmbed,
  onRestoreMigration,
  onResumeMigration,
  graphExtract = null,
  graphExtractWaiting = false,
  pendingGraphCount = 0
}) => {
  const { t } = useTranslation()
  const isMigrating = ragState.isRunning && ragState.type === 'migration'
  const isBatchEmbedding = ragState.isRunning && ragState.type === 'batchEmbed'
  const isAborting = ragState.statusKey === 'settings.rag_migration_aborting' || migrationCancelBusy
  const progressPercent =
    ragState.total > 0 ? Math.min(100, Math.max(0, (ragState.progress / ragState.total) * 100)) : 0
  const showInterrupted =
    !isMigrating &&
    !isBatchEmbedding &&
    migrationState &&
    (migrationState.status === 'interrupted' ||
      migrationState.canRestore ||
      migrationState.canResume)
  const graphExtractRunning = Boolean(graphExtract && graphExtract.total > 0)
  const showGraphInEmbedPhases = isBatchEmbedding && (graphExtractWaiting || graphExtractRunning)
  const showGraphExtractCard = !isBatchEmbedding && (graphExtractRunning || graphExtractWaiting)
  const graphPhaseStatus = graphExtractRunning
    ? 'running'
    : pendingGraphCount > 0 || (graphExtractWaiting && !isBatchEmbedding)
      ? 'pending'
      : 'skipped'
  const graphPhaseValue =
    graphPhaseStatus === 'running'
      ? `${graphExtract!.current}/${graphExtract!.total}`
      : graphPhaseStatus === 'pending'
        ? pendingGraphCount > 0
          ? t('memory.readiness_graph_pending', '待整理 {{count}} 篇', { count: pendingGraphCount })
          : t('settings.rag_phase_waiting', '等待中')
        : t('settings.rag_phase_skipped', '无需补齐')
  const graphPhaseRow = (
    <li
      key="life_graph"
      className={`${styles.phaseRow} ${
        graphPhaseStatus === 'running'
          ? styles.phaseRowCurrent
          : graphPhaseStatus === 'skipped'
            ? styles.phaseRowMuted
            : ''
      }`}
    >
      <span className={styles.phaseLabel}>{t('memory.readiness_graph', '关系图谱')}</span>
      {graphPhaseStatus === 'running' ? (
        <div className={styles.phaseBar}>
          <div
            className={styles.phaseBarFill}
            style={{
              width: `${Math.min(100, Math.max(0, graphExtract!.percent || (graphExtract!.total > 0 ? (graphExtract!.current / graphExtract!.total) * 100 : 0)))}%`
            }}
          />
        </div>
      ) : (
        <span className={styles.phaseBarSpacer} />
      )}
      <span className={styles.phaseValue}>{graphPhaseValue}</span>
    </li>
  )

  return (
    <>
      {isMigrating && (
        <div className={styles.migrationAlert}>
          <div className={styles.migrationRow}>
            <div className={styles.spinner}></div>
            <span className={styles.migTitle}>
              {isAborting
                ? t('settings.rag_migration_aborting', '正在取消迁移并恢复数据...')
                : t('settings.rag_migrating', '知识库正在迁移中...')}
            </span>
            {onCancelMigration && (
              <Button
                type="button"
                variant="outlined"
                size="small"
                disabled={isAborting}
                isLoading={isAborting}
                onClick={() => void onCancelMigration()}
              >
                {t('settings.rag_migration_cancel', '取消迁移')}
              </Button>
            )}
          </div>
          <p className={styles.migDesc}>{ragState.statusText}</p>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      )}

      {isBatchEmbedding && (
        <div className={styles.migrationAlert}>
          <div className={styles.migrationRow}>
            {ragState.paused && !ragState.cancelling ? (
              <div className={styles.pauseMark} aria-hidden="true" />
            ) : (
              <div className={styles.spinner}></div>
            )}
            <span className={styles.migTitle}>
              {ragState.cancelling
                ? t('settings.rag_batch_embed_cancelling', '正在取消索引…')
                : ragState.paused
                  ? t('settings.rag_batch_embed_paused', '索引已暂停')
                  : showGraphInEmbedPhases
                    ? t('memory.readiness_organizing', '正在整理记忆…')
                    : t('settings.rag_indexing', '正在补齐嵌入…')}
            </span>
            {(onPauseBatchEmbed || onResumeBatchEmbed || onCancelBatchEmbed) && (
              <div className={styles.batchEmbedActions}>
                {ragState.paused && !ragState.cancelling
                  ? onResumeBatchEmbed && (
                      <Button
                        type="button"
                        variant="outlined"
                        size="small"
                        onClick={() => void onResumeBatchEmbed()}
                      >
                        {t('settings.rag_batch_embed_resume', '继续')}
                      </Button>
                    )
                  : onPauseBatchEmbed && (
                      <Button
                        type="button"
                        variant="outlined"
                        size="small"
                        disabled={!!ragState.cancelling}
                        onClick={() => void onPauseBatchEmbed()}
                      >
                        {t('settings.rag_batch_embed_pause', '暂停')}
                      </Button>
                    )}
                {onCancelBatchEmbed && (
                  <Button
                    type="button"
                    variant="outlined"
                    size="small"
                    disabled={!!ragState.cancelling}
                    isLoading={!!ragState.cancelling}
                    onClick={() => void onCancelBatchEmbed()}
                  >
                    {t('settings.rag_batch_embed_cancel', '取消')}
                  </Button>
                )}
              </div>
            )}
          </div>
          {ragState.phases ? (
            <ul className={styles.phaseList}>
              {RAG_BATCH_EMBED_PHASE_IDS.map((id) => {
                const item = phaseCountForId(ragState.phases!, id)
                const status = resolvePhaseRowStatus(id, ragState.phase, item)
                const label = t(ragBatchEmbedPhaseLabelKey(id), id)
                const value =
                  status === 'skipped'
                    ? t('settings.rag_phase_skipped', '无需补齐')
                    : status === 'pending'
                      ? t('settings.rag_phase_waiting', '等待中')
                      : status === 'done'
                        ? t('settings.rag_phase_done_count', '已完成 {{completed}}/{{total}}', {
                            completed: item.completed,
                            total: item.total
                          })
                        : `${item.completed}/${item.total}`
                const barPercent =
                  status === 'running' && item.total > 0
                    ? Math.min(100, Math.max(0, (item.completed / item.total) * 100))
                    : status === 'done'
                      ? 100
                      : 0
                return (
                  <li
                    key={id}
                    className={`${styles.phaseRow} ${
                      status === 'running'
                        ? styles.phaseRowCurrent
                        : status === 'skipped'
                          ? styles.phaseRowMuted
                          : ''
                    }`}
                  >
                    <span className={styles.phaseLabel}>{label}</span>
                    {status === 'running' || status === 'done' ? (
                      <div className={styles.phaseBar}>
                        <div className={styles.phaseBarFill} style={{ width: `${barPercent}%` }} />
                      </div>
                    ) : (
                      <span className={styles.phaseBarSpacer} />
                    )}
                    <span className={styles.phaseValue}>{value}</span>
                  </li>
                )
              })}
              {showGraphInEmbedPhases ? graphPhaseRow : null}
            </ul>
          ) : (
            <>
              <p className={styles.migDesc}>
                {ragState.statusText || t('settings.rag_batch_embed_starting', '正在开始索引…')}
                {ragState.total > 0 ? ` ${ragState.progress}/${ragState.total}` : ''}
              </p>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progressPercent}%` }}></div>
              </div>
            </>
          )}
        </div>
      )}

      {showGraphExtractCard && (
        <div className={styles.migrationAlert}>
          <div className={styles.migrationRow}>
            <div className={styles.spinner}></div>
            <span className={styles.migTitle}>
              {graphExtractRunning
                ? t('graph.extract_progress', '正在整理 {{current}}/{{total}}', {
                    current: graphExtract!.current,
                    total: graphExtract!.total
                  })
                : t('memory.readiness_graph_starting', '正在开始整理关系图谱')}
            </span>
          </div>
          <ul className={styles.phaseList}>{graphPhaseRow}</ul>
        </div>
      )}

      {showInterrupted && (
        <div className={styles.dangerAlert}>
          <div className={styles.dangerRow}>
            <TriangleAlert size={18} color="var(--color-error)" />
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
              <Button
                type="button"
                variant="outlined"
                size="small"
                onClick={() => void onRestoreMigration()}
              >
                {t('settings.rag_migration_restore_backup', '一键恢复备份数据')}
              </Button>
            )}
            {migrationState?.canResume && onResumeMigration && (
              <Button
                type="button"
                variant="outlined"
                size="small"
                onClick={() => void onResumeMigration()}
              >
                {t('settings.rag_migration_resume', '继续迁移')}
              </Button>
            )}
          </div>
        </div>
      )}

      {!isMigrating && !isBatchEmbedding && !showInterrupted && hasMismatchModel && (
        <div className={styles.dangerAlert}>
          <div className={styles.dangerRow}>
            <TriangleAlert size={18} color="var(--color-error)" />
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
              <Button
                type="button"
                variant="outlined"
                size="small"
                onClick={() => void onTriggerMigration()}
              >
                {t('settings.rag_trigger_migration', '执行向量库迁移')}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
