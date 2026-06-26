import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdChevronRight } from 'react-icons/md'
import type { WorkspaceChangeEntry } from '@baishou/shared'
import { FileChangeDiff, formatFileChangeStats, fileChangeKindLabel } from '@baishou/ui'
import styles from './WorkspaceChangesPanel.module.css'

export interface WorkspaceChangesPanelProps {
  changes: WorkspaceChangeEntry[]
  selectedChangeId: string | null
  onSelectChange: (changeId: string | null) => void
  collapsed: boolean
  onToggleCollapsed: () => void
  className?: string
}

export const WorkspaceChangesPanel: React.FC<WorkspaceChangesPanelProps> = ({
  changes,
  selectedChangeId,
  onSelectChange,
  collapsed,
  onToggleCollapsed,
  className
}) => {
  const { t } = useTranslation()

  if (collapsed) {
    return null
  }

  return (
    <aside className={`${styles.panel} ${className ?? ''}`}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>{t('file_change.changes_title', '变更列表')}</span>
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={onToggleCollapsed}
          title={t('agent_workspace.collapse_changes_panel', '收起变更面板')}
        >
          <MdChevronRight size={20} />
        </button>
      </div>

      <div className={styles.body}>
        {changes.length === 0 ? (
          <p className={styles.placeholder}>{t('file_change.no_changes', '暂无文件变更')}</p>
        ) : (
          <ul className={styles.changeList}>
            {changes.map((change) => {
              const isActive = change.id === selectedChangeId
              return (
                <li key={change.id} className={styles.changeItem}>
                  <button
                    type="button"
                    className={`${styles.changeBtn} ${isActive ? styles.changeBtnActive : ''}`}
                    onClick={() => onSelectChange(isActive ? null : change.id)}
                    aria-expanded={isActive}
                  >
                    <span className={styles.changeKind}>{fileChangeKindLabel(t, change.kind)}</span>
                    <span className={styles.changePath} title={change.path}>
                      {change.path}
                    </span>
                    <span className={styles.changeStats}>
                      {formatFileChangeStats(change.additions, change.deletions)}
                    </span>
                  </button>
                  {isActive ? (
                    <div className={styles.inlineDiff}>
                      <FileChangeDiff data={change.data} className={styles.diffBody} />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
