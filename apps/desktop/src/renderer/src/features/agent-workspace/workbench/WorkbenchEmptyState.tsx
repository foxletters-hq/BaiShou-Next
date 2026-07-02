import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './WorkbenchEmptyState.module.css'

export interface WorkbenchEmptyStateProps {
  onOpenFolder: () => void
}

export const WorkbenchEmptyState: React.FC<WorkbenchEmptyStateProps> = ({ onOpenFolder }) => {
  const { t } = useTranslation()

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <h2 className={styles.title}>{t('workbench.open_folder_title', '打开文件夹')}</h2>
        <p className={styles.desc}>
          {t(
            'workbench.open_folder_desc',
            '选择一个文件夹作为工作台根目录，浏览文件并与 Agent 协作。'
          )}
        </p>
        <button type="button" className={styles.btn} onClick={onOpenFolder}>
          {t('agent_workspace.open_folder', '打开文件夹')}
        </button>
      </div>
    </div>
  )
}
