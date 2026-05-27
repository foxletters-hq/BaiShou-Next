import React from 'react'
import styles from './AttachmentManagementView.module.css'
import type { AttachmentManagementViewModel } from './useAttachmentManagementView'

type Vm = Pick<
  AttachmentManagementViewModel,
  't' | 'formatSize' | 'totalSizeMB' | 'totalFiles' | 'orphanSizeMB'
>

export const SessionAttachmentOverview: React.FC<{ vm: Vm }> = ({ vm }) => {
  const { t, formatSize, totalSizeMB, totalFiles, orphanSizeMB } = vm
  return (
    <div className={styles.overviewCardWrapper}>
      <div className={styles.overviewCard}>
        <div className={styles.statColumn}>
          <span className={styles.statLabel}>
            {t('settings.attachment_total_size', '总占用空间')}
          </span>
          <span className={`${styles.statValue} ${styles.colorPrimary}`}>
            {formatSize(totalSizeMB)}
          </span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statColumn}>
          <span className={styles.statLabel}>
            {t('settings.attachment_total_count', '附件总数')}
          </span>
          <span className={`${styles.statValue} ${styles.colorOnSurface}`}>{totalFiles}</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statColumn}>
          <span className={styles.statLabel}>
            {t('settings.attachment_orphans_size', '孤立附件体积')}
          </span>
          <span
            className={`${styles.statValue} ${orphanSizeMB > 0 ? styles.colorError : styles.colorOnSurface}`}
          >
            {formatSize(orphanSizeMB)}
          </span>
        </div>
      </div>
    </div>
  )
}
