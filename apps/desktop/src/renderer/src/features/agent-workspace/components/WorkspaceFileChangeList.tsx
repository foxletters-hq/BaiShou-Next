import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import type { WorkspaceChangeEntry } from '@baishou/shared'
import { DiffChanges, formatFileChangeListPath } from '@baishou/ui'
import {
  formatFileOpActionLabel,
  formatWorkspaceFileOpListTitle
} from '../utils/workspace-file-op-list.util'
import styles from './WorkspaceFileChangeList.module.css'

export interface WorkspaceFileChangeListProps {
  changes: WorkspaceChangeEntry[]
  running?: boolean
  onSelectChange: (change: WorkspaceChangeEntry) => void
  onReviewAll?: (changes: WorkspaceChangeEntry[]) => void
}

export const WorkspaceFileChangeList: React.FC<WorkspaceFileChangeListProps> = ({
  changes,
  running = false,
  onSelectChange,
  onReviewAll
}) => {
  const { t } = useTranslation()
  const [listOpen, setListOpen] = useState(true)

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

  if (changes.length === 0) return null

  const title = formatWorkspaceFileOpListTitle(running, changes.length, t)

  const handleHeaderMain = () => {
    if (onReviewAll) {
      onReviewAll(changes)
      return
    }
    setListOpen((open) => !open)
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button type="button" className={styles.headerMain} onClick={handleHeaderMain}>
          <span className={styles.headerTitle}>{title}</span>
          <DiffChanges additions={totals.additions} deletions={totals.deletions} />
        </button>
        <button
          type="button"
          className={styles.headerToggle}
          aria-expanded={listOpen}
          onClick={() => setListOpen((open) => !open)}
        >
          <ChevronRight
            className={`${styles.chevron} ${listOpen ? styles.chevronOpen : ''}`}
            size={14}
            aria-hidden
          />
        </button>
      </div>
      {listOpen ? (
        <ul className={styles.list}>
          {changes.map((change) => (
            <li key={change.id}>
              <button
                type="button"
                className={styles.item}
                onClick={() => onSelectChange(change)}
                title={t('workbench.open_changed_file', '在中间打开 {{path}}', {
                  path: change.path
                })}
              >
                <span className={styles.action}>
                  {formatFileOpActionLabel(t, change.kind, running)}
                </span>
                <span className={styles.path}>{formatFileChangeListPath(change.path)}</span>
                <DiffChanges additions={change.additions} deletions={change.deletions} />
                <ChevronRight className={styles.itemChevron} size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
