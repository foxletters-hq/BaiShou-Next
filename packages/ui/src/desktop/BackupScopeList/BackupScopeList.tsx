import React from 'react'
import { useTranslation } from 'react-i18next'
import { FULL_BACKUP_SCOPE_I18N_KEYS } from '@baishou/shared'
import { SyncModeComparisonHelp } from '../SyncModeComparisonNotice'
import styles from './BackupScopeList.module.css'

export const BackupScopeList: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className={styles.container}>
      <div className={styles.titleRow}>
        <div className={styles.title}>{t('data_sync.backup_scope_title')}</div>
        <SyncModeComparisonHelp context="fullBackup" />
      </div>
      <ul className={styles.list}>
        {FULL_BACKUP_SCOPE_I18N_KEYS.map((key) => (
          <li key={key} className={styles.item}>
            {t(`data_sync.${key}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}
