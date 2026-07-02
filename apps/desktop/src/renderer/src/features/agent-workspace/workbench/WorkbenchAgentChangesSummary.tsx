import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { WorkspaceChangeEntry } from '@baishou/shared'
import { DiffChanges, basenameFromPath, fileChangeKindLabel } from '@baishou/ui'
import styles from './WorkbenchAgentChangesSummary.module.css'

export interface WorkbenchAgentChangesSummaryProps {
  changes: WorkspaceChangeEntry[]
  onSelectChange: (change: WorkspaceChangeEntry) => void
}

export const WorkbenchAgentChangesSummary: React.FC<WorkbenchAgentChangesSummaryProps> = ({
  changes,
  onSelectChange
}) => {
  const { t } = useTranslation()

  const totals = useMemo(
    () =>
      changes.reduce(
        (acc, change) => ({
          additions: acc.additions + change.additions,
          deletions: acc.deletions + change.deletions
        }),
        { additions: 0, deletions: 0 }
      ),
    [changes]
  )

  if (changes.length === 0) {
    return (
      <div className={styles.empty}>
        {t('file_change.no_changes', '暂无文件变更')}
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span>
          {t('workbench.changed_files', {
            count: changes.length,
            defaultValue: '{{count}} 个文件已变更'
          })}
        </span>
        <DiffChanges additions={totals.additions} deletions={totals.deletions} />
      </div>
      <ul className={styles.list}>
        {changes.map((change) => (
          <li key={change.id}>
            <button type="button" className={styles.item} onClick={() => onSelectChange(change)}>
              <span className={styles.kind}>{fileChangeKindLabel(t, change.kind)}</span>
              <span className={styles.path} title={change.path}>
                <span className={styles.fileName}>{basenameFromPath(change.path)}</span>
                <span className={styles.dir}>{change.path}</span>
              </span>
              <DiffChanges additions={change.additions} deletions={change.deletions} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
