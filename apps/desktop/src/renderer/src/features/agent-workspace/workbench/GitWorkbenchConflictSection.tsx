import React from 'react'
import { useTranslation } from 'react-i18next'
import type { GitManagementViewModel } from '@baishou/ui'
import styles from './GitWorkbenchPanel.module.css'

export const GitWorkbenchConflictSection: React.FC<{ vm: GitManagementViewModel }> = ({ vm }) => {
  const { t, conflicts, onResolveConflict } = vm
  if (conflicts.length === 0) return null

  return (
    <section className={styles.conflictSection}>
      <h3 className={styles.conflictTitle}>
        {t('version_control.conflict_detected', '检测到冲突')}
      </h3>
      {conflicts.map((filePath) => (
        <div key={filePath} className={styles.conflictRow}>
          <span className={styles.conflictPath} title={filePath}>
            {filePath}
          </span>
          <button
            type="button"
            className={styles.treeActionBtn}
            onClick={() => onResolveConflict(filePath, 'ours')}
          >
            {t('version_control.resolve_ours', '保留本地')}
          </button>
          <button
            type="button"
            className={styles.treeActionBtn}
            onClick={() => onResolveConflict(filePath, 'theirs')}
          >
            {t('version_control.resolve_theirs', '保留远程')}
          </button>
        </div>
      ))}
    </section>
  )
}
