import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './WorkbenchGitView.module.css'

export interface WorkbenchGitViewProps {
  changesCount: number
}

export const WorkbenchGitView: React.FC<WorkbenchGitViewProps> = ({ changesCount }) => {
  const { t } = useTranslation()

  return (
    <div className={styles.root}>
      <p className={styles.title}>{t('workbench.git', 'Git')}</p>
      <p className={styles.hint}>{t('workbench.git_empty', 'Git 变更视图即将推出')}</p>
      {changesCount > 0 ? (
        <p className={styles.meta}>
          {t('workbench.changed_files', { count: changesCount, defaultValue: '{{count}} 个文件已变更' })}
        </p>
      ) : null}
    </div>
  )
}
