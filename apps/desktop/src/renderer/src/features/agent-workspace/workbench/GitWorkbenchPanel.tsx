import React, { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, MoreHorizontal, RefreshCw } from 'lucide-react'
import { GitDestructiveConfirmDialog, type GitManagementViewModel } from '@baishou/ui'
import styles from './GitWorkbenchPanel.module.css'
import { GitWorkbenchMoreMenu } from './GitWorkbenchMenus'
import { GitWorkbenchChangesTree } from './GitWorkbenchChangesTree'
import { GitWorkbenchGraphSection } from './GitWorkbenchGraphSection'
import { GitWorkbenchConflictSection } from './GitWorkbenchConflictSection'
import { GitWorkbenchRemoteSheet } from './GitWorkbenchRemoteSheet'
import { useDismissOnOutsideClick } from './GitWorkbenchMenus'
import { WorkbenchResizeSash } from './WorkbenchResizeSash'
import { useVerticalSplitResize } from './useVerticalSplitResize'
import { loadGitSplitRatio, persistGitSplitRatio } from './git-workbench-split.util'
import {
  GIT_WORKBENCH_COMMIT_MENU_ITEMS,
  isGitWorkbenchCommitMenuActionEnabled,
  runGitWorkbenchCommitMenuAction
} from './git-workbench-commit-menu.util'

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
          '消息（留空将使用当前日期时间；Ctrl+Enter 提交）'
        )}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            (event.ctrlKey || event.metaKey) &&
            vm.canCommit &&
            !vm.isCommitActionInFlight
          ) {
            event.preventDefault()
            void vm.handleManualCommit()
          }
        }}
      />
      <div className={styles.commitActions}>
        <button
          type="button"
          className={styles.commitPrimary}
          disabled={!vm.canCommit || vm.isCommitActionInFlight}
          onClick={() => void vm.handleManualCommit()}
        >
          <Check size={14} strokeWidth={2.25} />
          {t('version_control.commit', '提交')}
        </button>
        <div className={styles.branchWrap} ref={menuRef}>
          <button
            type="button"
            className={styles.commitMenuBtn}
            title={t('workbench.git_commit_actions', '提交操作')}
            disabled={vm.isCommitActionInFlight}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <ChevronDown size={14} />
          </button>
          {menuOpen ? (
            <div className={styles.menu}>
              {GIT_WORKBENCH_COMMIT_MENU_ITEMS.map((item) => (
                <Fragment key={item.id}>
                  {item.dividerBefore ? <div className={styles.menuDivider} /> : null}
                  <button
                    type="button"
                    className={styles.menuItem}
                    disabled={
                      !isGitWorkbenchCommitMenuActionEnabled(
                        item.id,
                        vm.canCommit,
                        vm.canCommitStaged,
                        vm.isCommitActionInFlight
                      )
                    }
                    onClick={() => {
                      setMenuOpen(false)
                      runGitWorkbenchCommitMenuAction(item.id, vm)
                    }}
                  >
                    {t(item.labelKey, item.labelFallback)}
                  </button>
                </Fragment>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export interface GitWorkbenchPanelProps {
  vm: GitManagementViewModel
}

export const GitWorkbenchPanel: React.FC<GitWorkbenchPanelProps> = ({ vm }) => {
  const { t } = useTranslation()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [changesRatio, setChangesRatio] = useState(loadGitSplitRatio)
  const splitRef = useRef<HTMLDivElement>(null)
  const { handleRefreshStatus, handleLoadHistory, page, pageSize } = vm
  const refreshStatusRef = useRef(handleRefreshStatus)
  const loadHistoryRef = useRef(handleLoadHistory)
  refreshStatusRef.current = handleRefreshStatus
  loadHistoryRef.current = handleLoadHistory

  useEffect(() => {
    void refreshStatusRef.current()
    void loadHistoryRef.current()
  }, [page, pageSize])

  const getContainerHeight = useCallback(() => splitRef.current?.clientHeight ?? 0, [])
  const getRatio = useCallback(() => changesRatio, [changesRatio])
  const { onMouseDown: onSplitMouseDown } = useVerticalSplitResize({
    getContainerHeight,
    getRatio,
    onResize: setChangesRatio,
    onCommit: persistGitSplitRatio
  })

  return (
    <div className={styles.panel}>
      <header className={styles.viewHeader}>
        <h2 className={styles.viewTitle}>{t('workbench.source_control', '源代码管理')}</h2>
        <div className={styles.viewHeaderActions}>
          <button
            type="button"
            className={styles.iconBtn}
            title={t('common.refresh', '刷新')}
            onClick={() => {
              void vm.handleRefreshStatus()
              void vm.handleLoadHistory()
            }}
          >
            <RefreshCw size={15} />
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
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
        </div>
      </header>

      <div className={styles.fixedChrome}>
        <GitWorkbenchCommitForm vm={vm} />
      </div>

      <div className={styles.splitBody} ref={splitRef}>
        <div
          className={`${styles.splitPane} ${historyOpen ? '' : styles.splitPaneGrow}`}
          style={historyOpen ? { flexGrow: changesRatio } : undefined}
        >
          <GitWorkbenchChangesTree vm={vm} />
        </div>
        {historyOpen ? (
          <WorkbenchResizeSash
            orientation="horizontal"
            onMouseDown={onSplitMouseDown}
            ariaLabel={t('workbench.resize_git_split', '调整变更与历史区域高度')}
          />
        ) : null}
        <div
          className={`${styles.splitPane} ${historyOpen ? '' : styles.splitPaneCollapsed}`}
          style={historyOpen ? { flexGrow: 1 - changesRatio } : undefined}
        >
          <GitWorkbenchGraphSection vm={vm} open={historyOpen} onOpenChange={setHistoryOpen} />
        </div>
      </div>

      <GitWorkbenchConflictSection vm={vm} />

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
