import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import type { FileChangeKind, WorkspaceChangeEntry } from '@baishou/shared'
import { DiffChanges, basenameFromPath } from '@baishou/ui'
import styles from './WorkspaceFileChangeList.module.css'

export interface WorkspaceFileChangeListProps {
  changes: WorkspaceChangeEntry[]
  running?: boolean
  onSelectChange: (change: WorkspaceChangeEntry) => void
}

function fileOpActionLabel(
  t: (key: string, fallback: string) => string,
  kind: FileChangeKind
): string {
  if (kind === 'delete') return t('file_change.kind_delete', '删除')
  if (kind === 'rename') return t('file_change.kind_rename', '重命名')
  if (kind === 'create') return t('file_change.kind_create', '新建')
  return t('file_change.kind_edit', '编辑')
}

export const WorkspaceFileChangeList: React.FC<WorkspaceFileChangeListProps> = ({
  changes,
  running = false,
  onSelectChange
}) => {
  const { t } = useTranslation()
  const [listOpen, setListOpen] = useState(false)

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

  const title = running
    ? t('workbench.writing_files', '正在写入 {{count}} 个文件', { count: changes.length })
    : t('workbench.edited_files', '编辑了 {{count}} 个文件', { count: changes.length })

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={listOpen}
        onClick={() => setListOpen((open) => !open)}
      >
        <span className={styles.headerTitle}>{title}</span>
        <DiffChanges additions={totals.additions} deletions={totals.deletions} />
        <ChevronRight
          className={`${styles.chevron} ${listOpen ? styles.chevronOpen : ''}`}
          size={14}
          aria-hidden
        />
      </button>
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
                <span className={styles.action}>{fileOpActionLabel(t, change.kind)}</span>
                <span className={styles.path}>{basenameFromPath(change.path)}</span>
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
