import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WorkbenchStatusBranchMenu } from './WorkbenchStatusBranchMenu'
import { useDismissOnOutsideClick } from './GitWorkbenchMenus'
import type { WorkbenchGitStatusBarProps } from './WorkbenchMainPane.types'
import styles from './WorkbenchMainPane.module.css'

export function WorkbenchGitStatusBar({
  gitStatusBar
}: {
  gitStatusBar: WorkbenchGitStatusBarProps
}) {
  const { t } = useTranslation()
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)
  const branchMenuRef = useDismissOnOutsideClick(branchMenuOpen, () => setBranchMenuOpen(false))

  return (
    <div className={styles.statusBar}>
      {gitStatusBar.branch ? (
        <div className={styles.statusBranchWrap} ref={branchMenuRef}>
          <button
            type="button"
            className={styles.statusBranch}
            onClick={() => {
              setBranchMenuOpen((open) => !open)
              if (!branchMenuOpen) gitStatusBar.onRefreshBranches?.()
            }}
            title={t('workbench.git_switch_branch', '切换分支')}
          >
            <span className={styles.statusBranchIcon}>⎇</span>
            <span>{gitStatusBar.branch}</span>
            {gitStatusBar.behind ? (
              <span className={styles.statusSync}>↓{gitStatusBar.behind}</span>
            ) : null}
            {gitStatusBar.ahead ? (
              <span className={styles.statusSync}>↑{gitStatusBar.ahead}</span>
            ) : null}
          </button>
          <WorkbenchStatusBranchMenu
            open={branchMenuOpen}
            onClose={() => setBranchMenuOpen(false)}
            current={gitStatusBar.branch ?? undefined}
            branches={gitStatusBar.branches ?? []}
            onCheckout={(branch) => gitStatusBar.onCheckoutBranch?.(branch)}
            onCreate={(branch) => gitStatusBar.onCreateBranch?.(branch)}
            onPublish={() => gitStatusBar.onPublishBranch?.()}
          />
        </div>
      ) : null}
      <span className={styles.statusSpacer} />
      {(gitStatusBar.changesCount ?? 0) > 0 ? (
        <span className={styles.statusChanges}>
          {t('workbench.git_changes_count', '{{count}} 项变更', {
            count: gitStatusBar.changesCount
          })}
        </span>
      ) : (
        <span className={styles.statusChanges}>{t('workbench.git_clean', '工作区干净')}</span>
      )}
    </div>
  )
}
