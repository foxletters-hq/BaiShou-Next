import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { WorkspaceChangeEntry } from '@baishou/shared'
import { DiffChanges, getFileTypeIcon } from '@baishou/ui'
import styles from './WorkbenchAgentChangesSummary.module.css'

export interface WorkbenchAgentChangesSummaryProps {
  changes: WorkspaceChangeEntry[]
  onSelectChange: (change: WorkspaceChangeEntry) => void
  onReviewAll?: (changes: WorkspaceChangeEntry[]) => void
}

export const WorkbenchAgentChangesSummary: React.FC<WorkbenchAgentChangesSummaryProps> = ({
  changes,
  onSelectChange,
  onReviewAll
}) => {
  const { t } = useTranslation()

  const handleReviewAll = useCallback(() => {
    if (onReviewAll) {
      onReviewAll(changes)
      return
    }
    for (const change of changes) {
      onSelectChange(change)
    }
  }, [changes, onReviewAll, onSelectChange])

  if (changes.length === 0) {
    return null
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.root}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>
            {t('workbench.changed_files', {
              count: changes.length,
              defaultValue: '{{count}} 个文件变更'
            })}
          </span>
          <button type="button" className={styles.reviewBtn} onClick={handleReviewAll}>
            {t('workbench.review_changes', 'Review')}
          </button>
        </div>
        <ul className={styles.list}>
          {changes.map((change) => (
            <li key={change.id}>
              <button
                type="button"
                className={styles.item}
                onClick={() => onSelectChange(change)}
                title={change.path}
              >
                <span className={styles.icon} aria-hidden>
                  {getFileTypeIcon(change.path, 16)}
                </span>
                <span className={styles.path}>{change.path}</span>
                <DiffChanges additions={change.additions} deletions={change.deletions} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
