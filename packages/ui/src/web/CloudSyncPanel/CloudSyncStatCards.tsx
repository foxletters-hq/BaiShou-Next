import React from 'react'
import { Database, History } from 'lucide-react'
import styles from './CloudSyncPanel.module.css'
import type { CloudSyncPanelViewModel } from './useCloudSyncPanel'

export interface CloudSyncStatCardsProps {
  vm: CloudSyncPanelViewModel
}

export const CloudSyncStatCards: React.FC<CloudSyncStatCardsProps> = ({ vm }) => {
  const { t, config, activeTab, records, sizeString, getTargetIcon, getTargetColor } = vm

  if (activeTab === 'local') return null

  return (
    <div className={styles.statCardsRow}>
      <div className={styles.statCard}>
        <div
          className={styles.statIconWrapper}
          style={{
            backgroundColor: `${getTargetColor(config.target)}15`,
            color: getTargetColor(config.target)
          }}
        >
          {getTargetIcon(config.target)}
        </div>
        <div className={styles.statInfo}>
          <div className={styles.statLabel}>{t('data_sync.sync_target', '备份目标 (Target)')}</div>
          <div className={styles.statValue}>{config.target.toUpperCase()}</div>
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
          <Database size={20} strokeWidth={1.5} />
        </div>
        <div className={styles.statInfo}>
          <div className={styles.statLabel}>
            {activeTab === 'snapshot'
              ? t('data_sync.total_snapshot_size', '总快照大小')
              : t('data_sync.total_backup_size', '总备份大小')}
          </div>
          <div className={styles.statValue}>{sizeString}</div>
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
          <History size={20} strokeWidth={1.5} />
        </div>
        <div className={styles.statInfo}>
          <div className={styles.statLabel}>
            {activeTab === 'snapshot'
              ? t('data_sync.snapshot_count', '快照数量')
              : t('data_sync.backup_count', '备份数量')}
          </div>
          <div className={styles.statValue}>
            {records.length}{' '}
            <span style={{ fontSize: 13, fontWeight: 'normal' }}>
              {t('common.copies_unit', '份')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
