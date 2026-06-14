import { RefreshCw, FileText, Cloud, HelpCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, formatSyncProgressStatus } from '@baishou/ui'
import { SyncConfigForm } from './components/sync/SyncConfigForm'
import { useOrchestratedSync } from '../../hooks/useOrchestratedSync'

export const IncrementalSyncPage: React.FC = () => {
  const { t } = useTranslation()
  const { isSyncing, syncResult, progress, startSync } = useOrchestratedSync()

  const formatDuration = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`)

  return (
    <div
      style={{
        flex: 1,
        padding: '24px 32px',
        overflowY: 'auto',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)'
      }}
    >
      <h2
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          margin: '0 0 24px 0',
          fontSize: '18px',
          fontWeight: 600
        }}
      >
        <FileText size={18} style={{ marginRight: 2 }} />
        <span>{t('data_sync.incremental_sync', 'File Sync')}</span>
        <Tooltip
          content={t(
            'data_sync.incremental_sync_tooltip',
            'File sync uses a two-way incremental sync mechanism. It automatically compares modification times and hash values between local and cloud files, transfers only changed files, and propagates deletions in both directions. The sync scope covers core data including your diaries, historical summaries, and AI chat partners.'
          )}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'color 0.2s ease',
              marginTop: '2px'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            <HelpCircle size={16} />
          </span>
        </Tooltip>
      </h2>

      <SyncConfigForm />

      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '20px 24px'
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>
          <Cloud size={14} style={{ marginRight: 6 }} />
          {t('data_sync.sync_actions', 'Sync Actions')}
        </h3>

        <button
          onClick={() => void startSync()}
          disabled={isSyncing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            border: '1px solid var(--color-primary)',
            borderRadius: '8px',
            background: isSyncing ? 'var(--bg-surface)' : 'var(--color-primary)',
            color: isSyncing ? 'var(--text-primary)' : 'var(--text-on-primary)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            opacity: isSyncing ? 0.6 : 1
          }}
        >
          <RefreshCw
            size={16}
            style={isSyncing ? { animation: 'spin 1s linear infinite' } : undefined}
          />
          {isSyncing ? t('data_sync.syncing', 'Syncing...') : t('data_sync.sync_now', 'Sync')}
        </button>

        {isSyncing && progress && progress.total > 0 && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                height: 3,
                background: 'var(--bg-surface-low)',
                borderRadius: 2,
                overflow: 'hidden',
                marginBottom: 4
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: 'var(--color-primary)',
                  borderRadius: 2,
                  transition: 'width 0.3s ease',
                  width: `${Math.round((progress.current / progress.total) * 100)}%`
                }}
              />
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              {progress.current}/{progress.total}
              {(() => {
                const line = formatSyncProgressStatus(progress, t)
                return line ? ` · ${line}` : ''
              })()}
            </div>
          </div>
        )}

        {syncResult && (
          <div
            style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}
          >
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
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const StatCard: React.FC<{
  label: string
  value: number | string
  color: string
  isText?: boolean
}> = ({ label, value, color, isText }) => (
  <div
    style={{
      background: 'var(--bg-surface-low)',
      borderRadius: '8px',
      padding: '12px',
      textAlign: 'center'
    }}
  >
    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: isText ? '13px' : '20px', fontWeight: 600, color }}>{value}</div>
  </div>
)
