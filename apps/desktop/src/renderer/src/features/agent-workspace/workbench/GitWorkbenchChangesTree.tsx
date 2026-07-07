import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { isTextDiffablePath } from '@baishou/shared'
import type { GitManagementViewModel } from '@baishou/ui'
import styles from './GitWorkbenchPanel.module.css'
import { getFileStatusIcon } from './git-workbench.utils'

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'added':
      return styles.badge_added
    case 'deleted':
      return styles.badge_deleted
    case 'renamed':
      return styles.badge_renamed
    case 'untracked':
      return styles.badge_untracked
    default:
      return styles.badge_modified
  }
}

const ChangesSubgroup: React.FC<{
  title: string
  count: number
  expanded: boolean
  onToggle: () => void
  headerActions?: React.ReactNode
  emptyLabel: string
  children: React.ReactNode
}> = ({ title, count, expanded, onToggle, headerActions, emptyLabel, children }) => (
  <div className={styles.changesSubgroup}>
    <div className={styles.subgroupHeader}>
      <button type="button" className={styles.subgroupToggle} onClick={onToggle}>
        <ChevronRight
          size={14}
          className={`${styles.sectionChevron} ${expanded ? styles.sectionChevronOpen : ''}`}
        />
        <span className={styles.subgroupTitle}>{title}</span>
        {count > 0 ? <span className={styles.subgroupBadge}>{count}</span> : null}
      </button>
      {headerActions ? <div className={styles.subgroupActions}>{headerActions}</div> : null}
    </div>
    {expanded ? (
      <div className={styles.subgroupBody}>
        {count === 0 ? <div className={styles.treeEmpty}>{emptyLabel}</div> : children}
      </div>
    ) : null}
  </div>
)

const FileRow: React.FC<{
  path: string
  status: string
  statusClass: string
  onOpen?: () => void
  actions: React.ReactNode
}> = ({ path, status, statusClass, onOpen, actions }) => (
  <div
    className={`${styles.treeRow} ${onOpen ? styles.treeRowClickable : ''}`}
    onClick={onOpen}
    role={onOpen ? 'button' : undefined}
    tabIndex={onOpen ? 0 : undefined}
    onKeyDown={
      onOpen
        ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onOpen()
            }
          }
        : undefined
    }
  >
    <span className={`${styles.treeBadge} ${statusClass}`}>{status}</span>
    <span className={styles.treePath} title={path}>
      {path}
    </span>
    <div className={styles.treeActions}>{actions}</div>
  </div>
)

export const GitWorkbenchChangesTree: React.FC<{ vm: GitManagementViewModel }> = ({ vm }) => {
  const { t } = useTranslation()
  const {
    isInitialized,
    expandedSections,
    toggleSection,
    stagedCount,
    unstagedCount,
    gitStatus,
    handleUnstageAll,
    handleStageAll,
    handleDiscardAll,
    handleViewWorkingDiff,
    handleStageFile,
    handleUnstageFile,
    handleDiscardFile
  } = vm

  if (!isInitialized || !gitStatus) return null

  const totalChanges = stagedCount + unstagedCount

  return (
    <section className={styles.changesSection}>
      {stagedCount > 0 ? (
        <ChangesSubgroup
          title={t('version_control.staged_changes', 'Staged Changes')}
          count={stagedCount}
          expanded={expandedSections.staged}
          onToggle={() => toggleSection('staged')}
          emptyLabel={t('version_control.no_staged_changes', '没有已暂存的变更')}
          headerActions={
            <button
              type="button"
              className={styles.treeActionBtn}
              onClick={() => void handleUnstageAll()}
            >
              {t('version_control.unstage_all', '全部取消暂存')}
            </button>
          }
        >
          {gitStatus.staged.map((file) => {
            const canDiff = isTextDiffablePath(file.path)
            return (
              <FileRow
                key={`staged:${file.path}`}
                path={file.path}
                status={getFileStatusIcon(file.stagedStatus)}
                statusClass={statusBadgeClass(file.stagedStatus)}
                onOpen={canDiff ? () => void handleViewWorkingDiff(file.path, true) : undefined}
                actions={
                  <button
                    type="button"
                    className={styles.treeActionBtn}
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleUnstageFile(file.path)
                    }}
                  >
                    {t('version_control.unstage', '取消暂存')}
                  </button>
                }
              />
            )
          })}
        </ChangesSubgroup>
      ) : null}

      <ChangesSubgroup
        title={t('version_control.changes', 'Changes')}
        count={unstagedCount}
        expanded={expandedSections.changes}
        onToggle={() => toggleSection('changes')}
        emptyLabel={
          totalChanges === 0
            ? t('version_control.no_changes', '没有变更')
            : t('version_control.no_unstaged_changes', '没有未暂存的变更')
        }
        headerActions={
          unstagedCount > 0 ? (
            <>
              <button
                type="button"
                className={styles.treeActionBtn}
                onClick={() => void handleStageAll()}
              >
                {t('version_control.stage_all', '全部暂存')}
              </button>
              <button
                type="button"
                className={styles.treeActionBtn}
                onClick={() => void handleDiscardAll()}
              >
                {t('version_control.discard_all', '全部撤销')}
              </button>
            </>
          ) : null
        }
      >
        {gitStatus.unstaged.map((file) => {
          const canDiff = isTextDiffablePath(file.path)
          return (
            <FileRow
              key={`unstaged:${file.path}`}
              path={file.path}
              status={getFileStatusIcon(file.unstagedStatus)}
              statusClass={statusBadgeClass(file.unstagedStatus)}
              onOpen={canDiff ? () => void handleViewWorkingDiff(file.path, false) : undefined}
              actions={
                <>
                  <button
                    type="button"
                    className={styles.treeActionBtn}
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleStageFile(file.path)
                    }}
                  >
                    {t('version_control.stage', '暂存')}
                  </button>
                  <button
                    type="button"
                    className={styles.treeActionBtn}
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleDiscardFile(file.path)
                    }}
                  >
                    {t('version_control.discard', '撤销')}
                  </button>
                </>
              }
            />
          )
        })}
        {gitStatus.untracked.map((file) => {
          const canDiff = isTextDiffablePath(file)
          return (
            <FileRow
              key={`untracked:${file}`}
              path={file}
              status="U"
              statusClass={styles.badge_untracked}
              onOpen={canDiff ? () => void handleViewWorkingDiff(file, false) : undefined}
              actions={
                <>
                  <button
                    type="button"
                    className={styles.treeActionBtn}
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleStageFile(file)
                    }}
                  >
                    {t('version_control.stage', '暂存')}
                  </button>
                  <button
                    type="button"
                    className={styles.treeActionBtn}
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleDiscardFile(file, { untracked: true })
                    }}
                  >
                    {t('version_control.discard', '撤销')}
                  </button>
                </>
              }
            />
          )
        })}
      </ChangesSubgroup>
    </section>
  )
}
