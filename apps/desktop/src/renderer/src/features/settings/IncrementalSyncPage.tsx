import { RefreshCw, FileText, Cloud, HelpCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isIncrementalSyncReady } from '@baishou/shared'
import { Tooltip, formatSyncProgressStatus, IncrementalSyncScopeList } from '@baishou/ui'
import { SyncConfigForm } from './components/sync/SyncConfigForm'
import { useOrchestratedSync } from '../../hooks/useOrchestratedSync'
import { INCREMENTAL_SYNC_CONFIG_CHANGED_EVENT } from '../../lib/incremental-sync-config-events'
import styles from './IncrementalSyncPage.module.css'

export const IncrementalSyncPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { t } = useTranslation()
  const { isSyncing, isPlanning, syncResult, progress, startSync } = useOrchestratedSync()
  const [syncReady, setSyncReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const refreshSyncReady = async () => {
      try {
        const cfg = await window.api.incrementalSync.getConfig()
        if (!cancelled) setSyncReady(isIncrementalSyncReady(cfg))
      } catch {
        if (!cancelled) setSyncReady(false)
      }
    }

    void refreshSyncReady()
    window.addEventListener(INCREMENTAL_SYNC_CONFIG_CHANGED_EVENT, refreshSyncReady)
    return () => {
      cancelled = true
      window.removeEventListener(INCREMENTAL_SYNC_CONFIG_CHANGED_EVENT, refreshSyncReady)
    }
  }, [])

  const formatDuration = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`)

  return (
    <div className={styles.container}>
      {!embedded ? (
        <section className={styles.cardSection}>
          <h2 className={styles.cardTitle} style={{ fontSize: '16px', marginBottom: 0 }}>
            <FileText size={18} />
            <span>{t('data_sync.incremental_sync', '增量同步')}</span>
            <Tooltip content={t('data_sync.incremental_sync_tooltip')}>
              <span className={styles.helpIcon}>
                <HelpCircle size={16} />
              </span>
            </Tooltip>
          </h2>
        </section>
      ) : (
        <section className={styles.cardSection}>
          <p className={styles.embeddedDesc}>{t('data_sync.incremental_sync_desc')}</p>
        </section>
      )}

      <section className={styles.cardSection}>
        <SyncConfigForm />
      </section>

      <section className={styles.cardSection}>
        <h3 className={styles.cardTitle}>
          <Cloud size={14} />
          {t('data_sync.sync_actions', 'Sync Actions')}
        </h3>

        <button
          className={styles.syncButton}
          onClick={() => void startSync()}
          disabled={isSyncing || isPlanning || !syncReady}
          title={
            syncReady
              ? t('data_sync.sync_now', 'Sync')
              : t('data_sync.error_sync_disabled', '请先在上方开启「文件同步」开关后再同步')
          }
          style={
            isSyncing || isPlanning
              ? {
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)'
                }
              : !syncReady
                ? { opacity: 0.55, cursor: 'not-allowed' }
                : undefined
          }
        >
          <RefreshCw size={16} className={isSyncing || isPlanning ? styles.spinning : undefined} />
          {isSyncing
            ? t('data_sync.syncing', 'Syncing...')
            : isPlanning
              ? t('data_sync.planning', 'Analyzing sync changes…')
              : t('data_sync.sync_now', 'Sync')}
        </button>

        {isSyncing && progress && progress.total > 0 && (
          <div>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
              />
            </div>
            <div className={styles.progressMeta}>
              {progress.current}/{progress.total}
              {(() => {
                const line = formatSyncProgressStatus(progress, t)
                return line ? ` · ${line}` : ''
              })()}
            </div>
          </div>
        )}

        {syncResult && (
          <div className={styles.statsGrid}>
            <StatCard
              label={t('data_sync.stat_uploaded', 'Uploaded')}
              value={syncResult.uploaded?.length || 0}
              color="var(--color-primary)"
            />
            <StatCard
              label={t('data_sync.stat_downloaded', 'Downloaded')}
              value={syncResult.downloaded?.length || 0}
              color="var(--color-success)"
            />
            <StatCard
              label={t('data_sync.stat_deleted', 'Deleted')}
              value={
                (syncResult.deletedRemote?.length || 0) + (syncResult.deletedLocal?.length || 0)
              }
              color="var(--color-error)"
            />
            <StatCard
              label={t('data_sync.stat_conflicts', 'Conflicts')}
              value={syncResult.conflicted?.length || 0}
              color="var(--color-warning)"
            />
            <StatCard
              label={t('data_sync.stat_skipped', 'Skipped')}
              value={syncResult.skipped?.length || 0}
              color="var(--text-tertiary)"
            />
            <StatCard
              label={t('data_sync.stat_duration', 'Duration')}
              value={syncResult.duration ? formatDuration(syncResult.duration) : '-'}
              color="var(--text-secondary)"
              isText
            />
          </div>
        )}
      </section>

      <IncrementalSyncScopeList />
    </div>
  )
}

const StatCard: React.FC<{
  label: string
  value: number | string
  color: string
  isText?: boolean
}> = ({ label, value, color, isText }) => (
  <div className={styles.statCard}>
    <div className={styles.statLabel}>{label}</div>
    <div className={isText ? styles.statValueText : styles.statValue} style={{ color }}>
      {value}
    </div>
  </div>
)
