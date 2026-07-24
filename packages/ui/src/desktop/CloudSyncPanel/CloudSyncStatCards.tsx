import React from 'react'
import { Archive, Database, Folder, History } from 'lucide-react'
import styles from './CloudSyncPanel.module.css'
import type { CloudSyncPanelViewModel } from './useCloudSyncPanel'

export interface CloudSyncStatCardsProps {
  vm: CloudSyncPanelViewModel
}

export const CloudSyncStatCards: React.FC<CloudSyncStatCardsProps> = ({ vm }) => {
  const { t, config, activeTab, records, sizeString, getTargetIcon, getTargetColor } = vm
  const isLocalTab = activeTab === 'local'
  const isSnapshotTab = activeTab === 'snapshot'

  const targetColor =
    isLocalTab || isSnapshotTab ? 'var(--color-primary)' : getTargetColor(config.target)
  const targetIconBg =
    isLocalTab || isSnapshotTab
      ? 'rgba(var(--color-primary-rgb), 0.1)'
      : `${getTargetColor(config.target)}1a`

  const targetLabel = isSnapshotTab
    ? t('data_sync.storage_target', '存储目标')
    : t('data_sync.sync_target', '备份目标 (Target)')

  const targetValue = isLocalTab
    ? t('data_sync.local_zip_target', 'ZIP')
    : isSnapshotTab
      ? t('data_sync.target_local_short', '本地')
      : config.target.toUpperCase()

  return (
    <div className={styles.statCardsRow}>
      <div className={styles.statCard}>
        <div
          className={styles.statIconWrapper}
          style={{
            backgroundColor: targetIconBg,
            color: targetColor
          }}
        >
          {isLocalTab ? (
            <Archive size={18} strokeWidth={2} />
          ) : isSnapshotTab ? (
            <Folder size={18} strokeWidth={2} />
          ) : (
            getTargetIcon(config.target, 18)
          )}
        </div>
        <div className={styles.statInfo}>
          <div className={styles.statLabel}>{targetLabel}</div>
          <div className={styles.statValue}>{targetValue}</div>
        </div>
      </div>

      <div className={styles.statCard}>
        <div
          className={styles.statIconWrapper}
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            color: '#10b981'
          }}
        >
          <Database size={18} strokeWidth={2} />
        </div>
        <div className={styles.statInfo}>
          <div className={styles.statLabel}>
            {isLocalTab
              ? t('data_sync.local_zip_size_label', '导出方式')
              : isSnapshotTab
                ? t('data_sync.total_snapshot_size', '总快照大小')
                : t('data_sync.total_backup_size', '总备份大小')}
          </div>
          <div className={styles.statValue}>
            {isLocalTab ? t('data_sync.local_zip_size_value', '按需导出') : sizeString}
          </div>
        </div>
      </div>

      <div className={styles.statCard}>
        <div
          className={styles.statIconWrapper}
          style={{
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            color: '#a855f7'
          }}
        >
          <History size={18} strokeWidth={2} />
        </div>
        <div className={styles.statInfo}>
          <div className={styles.statLabel}>
            {isLocalTab
              ? t('data_sync.local_zip_count_label', '存放位置')
              : isSnapshotTab
                ? t('data_sync.snapshot_count', '快照数量')
                : t('data_sync.backup_count', '备份数量')}
          </div>
          <div className={styles.statValue}>
            {isLocalTab ? (
              t('data_sync.local_zip_count_value', '本机文件')
            ) : (
              <>
                {records.length}{' '}
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {t('common.copies_unit', '份')}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
