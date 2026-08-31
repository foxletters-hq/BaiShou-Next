import React, { useEffect } from 'react'
import './GitManagementPage.css'
import type { GitManagementPageProps } from './git-management.types'
import { useGitManagementPage } from './useGitManagementPage'
import { GitScopeSection } from './GitScopeSection'
import { GitRemoteStatusSection } from './GitRemoteStatusSection'
import { GitVersionCommitBar } from './GitVersionCommitBar'
import { GitStagedSection } from './GitStagedSection'
import { GitChangesSection } from './GitChangesSection'
import { GitCommitsSection } from './GitCommitsSection'
import { GitDestructiveConfirmDialog } from './GitDestructiveConfirmDialog'
import { SettingsPageChrome } from '../shared/SettingsPageChrome'
import stack from '../shared/SettingsStack.module.css'

export const GitManagementPage: React.FC<GitManagementPageProps> = (props) => {
  const vm = useGitManagementPage(props)

  useEffect(() => {
    void vm.handleRefreshStatus({ fetch: true })
    // 父级每次渲染都会给出新的回调，不能放进依赖，否则会反复 fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.isInitialized])

  useEffect(() => {
    if (!vm.isInitialized) return
    void vm.handleLoadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.isInitialized, vm.page, vm.pageSize])

  return (
    <SettingsPageChrome title={vm.t('version_control.title', '版本控制')} layout="stack">
      <div className="git-management-page">
        <div className="gmp-content">
          <div className={stack.stack}>
            <GitScopeSection />
            <GitRemoteStatusSection vm={vm} />

            {vm.isInitialized ? (
              <div className={stack.stackGroup}>
                <div className={stack.sectionLabelRow}>
                  <h3 className={stack.sectionLabel}>
                    {vm.t('version_control.workspace_section', '工作区')}
                  </h3>
                </div>
                <div className="gmp-card">
                  <GitVersionCommitBar vm={vm} />
                  <GitStagedSection vm={vm} />
                  <GitChangesSection vm={vm} />
                </div>
              </div>
            ) : null}

            {vm.isInitialized ? (
              <div className={stack.stackGroup}>
                <div className={stack.sectionLabelRow}>
                  <h3 className={stack.sectionLabel}>
                    {vm.t('workbench.git_history', '提交历史')}
                  </h3>
                </div>
                <div className="gmp-card">
                  <GitCommitsSection vm={vm} />
                </div>
              </div>
            ) : null}
          </div>

          <GitDestructiveConfirmDialog
            request={vm.destructiveConfirm}
            isConfirming={vm.isConfirmingDestructive}
            onConfirm={vm.confirmDestructiveAction}
            onCancel={vm.cancelDestructiveAction}
          />
        </div>
      </div>
    </SettingsPageChrome>
  )
}
