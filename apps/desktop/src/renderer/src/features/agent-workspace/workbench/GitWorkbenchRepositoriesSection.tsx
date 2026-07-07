import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronRight, MoreHorizontal, RefreshCw } from 'lucide-react'
import type { GitManagementViewModel } from '@baishou/ui'
import styles from './GitWorkbenchPanel.module.css'
import { GitWorkbenchBranchMenu, GitWorkbenchMoreMenu } from './GitWorkbenchMenus'

export interface GitWorkbenchRepositoriesSectionProps {
  vm: GitManagementViewModel
  repositoryName: string
  onOpenSettings: () => void
}

export const GitWorkbenchRepositoriesSection: React.FC<GitWorkbenchRepositoriesSectionProps> = ({
  vm,
  repositoryName,
  onOpenSettings
}) => {
  const { t } = useTranslation()
  const [sectionOpen, setSectionOpen] = useState(true)
  const [branchOpen, setBranchOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const branch = vm.branchInfo
  const behind = branch?.behind ?? 0
  const ahead = branch?.ahead ?? 0
  const hasLocalChanges = vm.stagedCount + vm.unstagedCount > 0
  const branchLabel = branch?.current ?? '…'

  if (!vm.isInitialized) return null

  return (
    <section className={styles.vscodeSection}>
      <button
        type="button"
        className={styles.sectionHeader}
        onClick={() => setSectionOpen((open) => !open)}
      >
        <ChevronRight
          size={14}
          className={`${styles.sectionChevron} ${sectionOpen ? styles.sectionChevronOpen : ''}`}
        />
        <span className={styles.sectionTitle}>
          {t('workbench.git_repositories', 'REPOSITORIES')}
        </span>
      </button>

      {sectionOpen ? (
        <div className={styles.repoRow}>
          <div className={styles.repoMain}>
            <button
              type="button"
              className={styles.repoInfo}
              onClick={() => setBranchOpen((open) => !open)}
              title={t('workbench.git_branch', '分支')}
            >
              <span className={styles.repoName}>{repositoryName}</span>
              <span className={styles.repoBranch}>
                {branchLabel}
                {hasLocalChanges || ahead > 0 || behind > 0 ? '*' : ''}
                {behind > 0 || ahead > 0 ? (
                  <span className={styles.repoSync}>
                    {behind > 0 ? ` ↓${behind}` : ''}
                    {ahead > 0 ? ` ↑${ahead}` : ''}
                  </span>
                ) : null}
              </span>
            </button>
            <GitWorkbenchBranchMenu
              vm={vm}
              open={branchOpen}
              onClose={() => setBranchOpen(false)}
              anchorClassName={styles.menuRepo}
            />
          </div>

          <div className={styles.repoActions}>
            <button
              type="button"
              className={styles.iconBtn}
              title={t('common.refresh', '刷新')}
              onClick={() => void vm.handleRefreshStatus()}
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title={t('version_control.commit', '提交')}
              disabled={!vm.canCommitStaged}
              onClick={() => void vm.handleManualCommit()}
            >
              <Check size={15} />
            </button>
            <div className={styles.branchWrap}>
              <button
                type="button"
                className={styles.iconBtn}
                title={t('common.more', '更多')}
                onClick={() => setMoreOpen((open) => !open)}
              >
                <MoreHorizontal size={15} />
              </button>
              <GitWorkbenchMoreMenu
                vm={vm}
                open={moreOpen}
                onClose={() => setMoreOpen(false)}
                onOpenSettings={onOpenSettings}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
