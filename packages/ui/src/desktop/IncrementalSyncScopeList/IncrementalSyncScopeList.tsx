import React from 'react'
import { useTranslation } from 'react-i18next'
import { INCREMENTAL_SYNC_SCOPE_I18N_KEYS } from '@baishou/shared'
import { SyncModeComparisonHelp } from '../SyncModeComparisonNotice'
import styles from './IncrementalSyncScopeList.module.css'

export const IncrementalSyncScopeList: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className={styles.container}>
      <div className={styles.titleRow}>
        <div className={styles.title}>{t('data_sync.incremental_sync_scope_title')}</div>
        <SyncModeComparisonHelp context="incremental" />
      </div>
      <ul className={styles.list}>
        {INCREMENTAL_SYNC_SCOPE_I18N_KEYS.map((key) => (
          <li key={key} className={styles.item}>
            {t(`data_sync.${key}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}
