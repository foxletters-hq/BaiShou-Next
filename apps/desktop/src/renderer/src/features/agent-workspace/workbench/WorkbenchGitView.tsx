import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGitManagementPage, type GitManagementPageProps } from '@baishou/ui'
import { GitWorkbenchPanel } from './GitWorkbenchPanel'
import { getRepositoryDisplayName } from './git-workbench.utils'
import styles from './WorkbenchGitView.module.css'

interface WorkbenchGitPanelBodyProps {
  panelProps: GitManagementPageProps
  onChangesCountChange?: (count: number) => void
  onOpenGitDiff?: (filePath: string, options?: { staged?: boolean; commitHash?: string }) => void
  onGitMetaChange?: (meta: { branch?: string; ahead: number; behind: number }) => void
}

const WorkbenchGitPanelBody: React.FC<WorkbenchGitPanelBodyProps & { repositoryName: string }> = ({
  panelProps,
  repositoryName,
  onChangesCountChange,
  onOpenGitDiff,
  onGitMetaChange
}) => {
  const vm = useGitManagementPage({
    ...panelProps,
    onOpenDiffInEditor: onOpenGitDiff
      ? (filePath, staged) => onOpenGitDiff(filePath, { staged })
      : undefined,
    onOpenCommitDiffInEditor: onOpenGitDiff
      ? (filePath, commitHash) => onOpenGitDiff(filePath, { commitHash })
      : undefined
  })

  useEffect(() => {
    vm.setPageSize(50)
  }, [vm.setPageSize])

  useEffect(() => {
    if (!panelProps.isInitialized) {
      onChangesCountChange?.(0)
      return
    }
    void panelProps.onGetStatus().then((status) => {
      const count =
        status.staged.length +
        status.unstaged.length +
        status.untracked.length +
        status.conflicted.length
      onChangesCountChange?.(count)
    })
  }, [onChangesCountChange, panelProps, vm.gitStatus])

  useEffect(() => {
    if (!vm.branchInfo) return
    const current = vm.branchInfo.current?.trim()
    // 无提交/未建立分支时 rev-parse 可能得到 HEAD，状态栏不展示
    const branch = current && current !== 'HEAD' ? current : undefined
    onGitMetaChange?.({
      branch,
      ahead: vm.branchInfo.ahead,
      behind: vm.branchInfo.behind
    })
  }, [vm.branchInfo, onGitMetaChange])

  return <GitWorkbenchPanel vm={vm} repositoryName={repositoryName} />
}

export interface WorkbenchGitViewProps {
  folderRoot: string | null
  panelProps: GitManagementPageProps | null
  onChangesCountChange?: (count: number) => void
  onOpenGitDiff?: (filePath: string, options?: { staged?: boolean; commitHash?: string }) => void
  onGitMetaChange?: (meta: { branch?: string; ahead: number; behind: number }) => void
}

export const WorkbenchGitView: React.FC<WorkbenchGitViewProps> = ({
  folderRoot,
  panelProps,
  onChangesCountChange,
  onOpenGitDiff,
  onGitMetaChange
}) => {
  const { t } = useTranslation()

  if (!folderRoot) {
    return (
      <div className={styles.root}>
        <p className={styles.placeholder}>
          {t('agent_workspace.pick_workspace_hint', '请先选择或添加工作区')}
        </p>
      </div>
    )
  }

  if (!panelProps) return null

  if (!panelProps.isInitialized) {
    return (
      <div className={styles.root}>
        <div className={styles.initCard}>
          <h3 className={styles.initTitle}>{t('workbench.git', 'Git')}</h3>
          <p className={styles.initHint}>
            {t(
              'workbench.git_init_hint',
              '当前文件夹尚未初始化 Git。初始化后可查看变更、提交历史与 diff。'
            )}
          </p>
          <button type="button" className={styles.initBtn} onClick={() => void panelProps.onInit()}>
            {t('version_control.init_git', '初始化 Git 仓库')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <WorkbenchGitPanelBody
        panelProps={panelProps}
        repositoryName={getRepositoryDisplayName(folderRoot)}
        onChangesCountChange={onChangesCountChange}
        onOpenGitDiff={onOpenGitDiff}
        onGitMetaChange={onGitMetaChange}
      />
    </div>
  )
}
