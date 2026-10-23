import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Minus, Plus, Undo2 } from 'lucide-react'
import { isTextDiffablePath } from '@baishou/shared'
import { getFileTypeIcon, type GitManagementViewModel } from '@baishou/ui'
import styles from './GitWorkbenchPanel.module.css'
import { getFileStatusIcon, splitGitDisplayPath } from './git-workbench.utils'

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
      </button>
      <div className={styles.subgroupTrailing}>
        {count > 0 ? <span className={styles.subgroupBadge}>{count}</span> : null}
        {headerActions ? <div className={styles.subgroupActions}>{headerActions}</div> : null}
      </div>
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
  statusKey: string
  onOpen?: () => void
  actions: React.ReactNode
}> = ({ path, statusKey, onOpen, actions }) => {
  const { name, dir } = splitGitDisplayPath(path)
  const letter = getFileStatusIcon(statusKey)
  return (
    <div
      className={`${styles.treeRow} ${onOpen ? styles.treeRowClickable : ''}`}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      title={path}
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
      <span className={styles.treeFileIcon}>{getFileTypeIcon(name, 16)}</span>
      <span
        className={`${styles.treeName} ${statusKey === 'deleted' ? styles.treeNameDeleted : ''}`}
      >
        {name}
      </span>
      {dir ? <span className={styles.treeDir}>{dir}</span> : null}
      <div className={styles.treeRowEnd}>
        <span className={`${styles.treeBadge} ${statusBadgeClass(statusKey)}`}>{letter}</span>
        <div className={styles.treeActions}>{actions}</div>
      </div>
    </div>
  )
}

function IconAction(props: {
  title: string
  onClick: () => void
  children: React.ReactNode
}): React.ReactElement {
  return (
    <button
      type="button"
      className={styles.treeIconBtn}
      title={props.title}
      onClick={(event) => {
        event.stopPropagation()
        props.onClick()
      }}
    >
      {props.children}
    </button>
  )
}

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
            <IconAction
              title={t('version_control.unstage_all', '全部取消暂存')}
              onClick={() => void handleUnstageAll()}
            >
              <Minus size={14} />
            </IconAction>
          }
        >
          {gitStatus.staged.map((file) => {
            const canDiff = isTextDiffablePath(file.path)
            return (
              <FileRow
                key={`staged:${file.path}`}
                path={file.path}
                statusKey={file.stagedStatus}
                onOpen={canDiff ? () => void handleViewWorkingDiff(file.path, true) : undefined}
                actions={
                  <IconAction
                    title={t('version_control.unstage', '取消暂存')}
                    onClick={() => void handleUnstageFile(file.path)}
                  >
                    <Minus size={14} />
                  </IconAction>
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
              <IconAction
                title={t('version_control.discard_all', '全部撤销')}
                onClick={() => void handleDiscardAll()}
              >
                <Undo2 size={14} />
              </IconAction>
              <IconAction
                title={t('version_control.stage_all', '全部暂存')}
                onClick={() => void handleStageAll()}
              >
                <Plus size={14} />
              </IconAction>
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
              statusKey={file.unstagedStatus}
              onOpen={canDiff ? () => void handleViewWorkingDiff(file.path, false) : undefined}
              actions={
                <>
                  <IconAction
                    title={t('version_control.discard', '撤销')}
                    onClick={() => void handleDiscardFile(file.path)}
                  >
                    <Undo2 size={14} />
                  </IconAction>
                  <IconAction
                    title={t('version_control.stage', '暂存')}
                    onClick={() => void handleStageFile(file.path)}
                  >
                    <Plus size={14} />
                  </IconAction>
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
              statusKey="untracked"
              onOpen={canDiff ? () => void handleViewWorkingDiff(file, false) : undefined}
              actions={
                <>
                  <IconAction
                    title={t('version_control.discard', '撤销')}
                    onClick={() => void handleDiscardFile(file, { untracked: true })}
                  >
                    <Undo2 size={14} />
                  </IconAction>
                  <IconAction
                    title={t('version_control.stage', '暂存')}
                    onClick={() => void handleStageFile(file)}
                  >
                    <Plus size={14} />
                  </IconAction>
                </>
              }
            />
          )
        })}
      </ChangesSubgroup>
    </section>
  )
}
