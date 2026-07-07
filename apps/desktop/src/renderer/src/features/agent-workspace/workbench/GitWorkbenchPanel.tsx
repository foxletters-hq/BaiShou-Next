import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { GitDestructiveConfirmDialog, type GitManagementViewModel } from '@baishou/ui'
import styles from './GitWorkbenchPanel.module.css'
import { GitWorkbenchRepositoriesSection } from './GitWorkbenchRepositoriesSection'
import { GitWorkbenchChangesTree } from './GitWorkbenchChangesTree'
import { GitWorkbenchGraphSection } from './GitWorkbenchGraphSection'
import { GitWorkbenchConflictSection } from './GitWorkbenchConflictSection'
import { GitWorkbenchRemoteSheet } from './GitWorkbenchRemoteSheet'
import { useDismissOnOutsideClick } from './GitWorkbenchMenus'

const GitWorkbenchCommitForm: React.FC<{ vm: GitManagementViewModel }> = ({ vm }) => {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useDismissOnOutsideClick(menuOpen, () => setMenuOpen(false))

  return (
    <div className={styles.commitBox}>
      <textarea
        className={styles.commitMessage}
        value={vm.commitMessage}
        onChange={(event) => vm.setCommitMessage(event.target.value)}
        placeholder={t(
          'workbench.git_commit_message',
          '消息（留空将使用当前日期时间；Ctrl+Enter 提交暂存变更）'
        )}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && vm.canCommitStaged) {
            event.preventDefault()
            void vm.handleManualCommit()
          }
        }}
      />
      <div className={styles.commitActions}>
        <button
          type="button"
          className={styles.commitPrimary}
          disabled={!vm.canCommitStaged}
          onClick={() => void vm.handleManualCommit()}
        >
          {t('version_control.commit', '提交')}
        </button>
        <div className={styles.branchWrap} ref={menuRef}>
          <button
            type="button"
            className={styles.commitMenuBtn}
            title={t('workbench.git_commit_actions', '提交操作')}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <ChevronDown size={14} />
          </button>
          {menuOpen ? (
            <div className={styles.menu}>
              <button
                type="button"
                className={styles.menuItem}
                disabled={!vm.canCommitStaged}
                onClick={() => {
                  setMenuOpen(false)
                  void vm.handleManualCommit()
                }}
              >
                {t('workbench.git_commit_staged', '提交（仅暂存）')}
              </button>
              <button
                type="button"
                className={styles.menuItem}
                disabled={!vm.canCommit}
                onClick={() => {
                  setMenuOpen(false)
                  void vm.handleCommitAll()
                }}
              >
                {t('workbench.git_commit_all', '全部提交')}
              </button>
              <div className={styles.menuDivider} />
              <button
                type="button"
                className={styles.menuItem}
                disabled={!vm.canCommitStaged}
                onClick={() => {
                  setMenuOpen(false)
                  void vm.handleCommitAndPush()
                }}
              >
                {t('version_control.commit_push', '提交并推送')}
              </button>
              <button
                type="button"
                className={styles.menuItem}
                disabled={!vm.canCommit}
                onClick={() => {
                  setMenuOpen(false)
                  void vm.handleCommitAll().then(() => vm.handlePush())
                }}
              >
                {t('workbench.git_commit_all_push', '全部提交并推送')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export interface GitWorkbenchPanelProps {
  vm: GitManagementViewModel
  repositoryName: string
}

export const GitWorkbenchPanel: React.FC<GitWorkbenchPanelProps> = ({ vm, repositoryName }) => {
  const { t } = useTranslation()
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    void vm.handleRefreshStatus()
    void vm.handleLoadHistory()
  }, [vm.handleRefreshStatus, vm.handleLoadHistory])

  return (
    <div className={styles.panel}>
      <header className={styles.viewHeader}>
        <h2 className={styles.viewTitle}>{t('workbench.source_control', '源代码管理')}</h2>
      </header>

      <div className={styles.scroll}>
        <GitWorkbenchRepositoriesSection
          vm={vm}
          repositoryName={repositoryName}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <GitWorkbenchCommitForm vm={vm} />
        <GitWorkbenchChangesTree vm={vm} />
        <GitWorkbenchGraphSection vm={vm} />
        <GitWorkbenchConflictSection vm={vm} />
      </div>

      <GitWorkbenchRemoteSheet vm={vm} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <GitDestructiveConfirmDialog
        request={vm.destructiveConfirm}
        isConfirming={vm.isConfirmingDestructive}
        onConfirm={vm.confirmDestructiveAction}
        onCancel={vm.cancelDestructiveAction}
      />
    </div>
  )
}
