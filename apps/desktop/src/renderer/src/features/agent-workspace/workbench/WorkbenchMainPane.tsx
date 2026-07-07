import React, { useImperativeHandle, forwardRef, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X, PanelLeft, PanelRight } from 'lucide-react'
import type { WorkspaceChangeEntry } from '@baishou/shared'
import { FileChangeDiff, GitDiffViewer } from '@baishou/ui'
import { WorkbenchEmptyState } from './WorkbenchEmptyState'
import { WorkbenchLivePreviewEditor } from './WorkbenchLivePreviewEditor'
import { WorkbenchGitEditableDiff } from './WorkbenchGitEditableDiff'
import { useWorkbenchTabs } from './useWorkbenchTabs'
import styles from './WorkbenchMainPane.module.css'

export interface WorkbenchMainPaneHandle {
  openFile: (relativePath: string, options?: { line?: number; column?: number }) => void
  openDiff: (change: WorkspaceChangeEntry) => void
  openGitDiff: (filePath: string, options?: { staged?: boolean; commitHash?: string }) => void
}

export interface WorkbenchGitStatusBarProps {
  branch?: string | null
  ahead?: number
  behind?: number
  changesCount?: number
  onOpenGitView?: () => void
}

export interface WorkbenchMainPaneProps {
  folderRoot: string | null
  onOpenFolder: () => void
  sidePaneVisible: boolean
  agentPanelVisible: boolean
  onToggleSidePane: () => void
  onToggleAgentPanel: () => void
  onTabContentChange?: (tabId: string, content: string, relativePath: string) => void
  gitStatusBar?: WorkbenchGitStatusBarProps
}

export const WorkbenchMainPane = forwardRef<WorkbenchMainPaneHandle, WorkbenchMainPaneProps>(
  function WorkbenchMainPane(
    {
      folderRoot,
      onOpenFolder,
      sidePaneVisible,
      agentPanelVisible,
      onToggleSidePane,
      onToggleAgentPanel,
      onTabContentChange,
      gitStatusBar
    },
    ref
  ) {
    const { t } = useTranslation()
    const tabsState = useWorkbenchTabs(folderRoot)
    const { tabs, activeTab, activeTabId, setActiveTabId, closeTab, updateTabContent, clearTabScrollTarget } =
      tabsState
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleContentChange = useCallback(
      (tabId: string, content: string, relativePath: string) => {
        updateTabContent(tabId, content)
        onTabContentChange?.(tabId, content, relativePath)
        if (!folderRoot) return
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => {
          void window.api.agentWorkspace.writeFile(folderRoot, relativePath, content)
        }, 600)
      },
      [folderRoot, onTabContentChange, updateTabContent]
    )

    const handleTabMouseDown = useCallback(
      (event: React.MouseEvent, tabId: string, closable: boolean) => {
        if (event.button !== 1 || !closable) return
        event.preventDefault()
        event.stopPropagation()
        closeTab(tabId)
      },
      [closeTab]
    )

    useImperativeHandle(
      ref,
      () => ({
        openFile: (relativePath, options) => void tabsState.openFile(relativePath, options),
        openDiff: (change) => tabsState.openDiff(change),
        openGitDiff: (filePath, options) => void tabsState.openGitDiff(filePath, options)
      }),
      [tabsState]
    )

    if (!folderRoot) {
      return <WorkbenchEmptyState onOpenFolder={onOpenFolder} />
    }

    return (
      <div className={styles.pane}>
        <div className={styles.tabBar}>
          <div className={styles.tabBarLeading}>
            <button
              type="button"
              className={`${styles.layoutBtn} ${sidePaneVisible ? styles.layoutBtnActive : ''}`}
              onClick={onToggleSidePane}
              title={t('workbench.toggle_side_bar', '切换左侧边栏')}
              aria-pressed={sidePaneVisible}
            >
              <PanelLeft size={18} strokeWidth={1.75} />
            </button>
          </div>

          <div className={styles.tabScroll}>
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`${styles.tab} ${tab.id === activeTabId ? styles.tabActive : ''}`}
                onMouseDown={(event) => handleTabMouseDown(event, tab.id, tab.kind !== 'welcome')}
              >
                <button
                  type="button"
                  className={styles.tabLabel}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  {tab.title}
                </button>
                {tab.kind !== 'welcome' ? (
                  <button
                    type="button"
                    className={styles.tabClose}
                    onClick={() => closeTab(tab.id)}
                    aria-label={t('common.close', '关闭')}
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div className={styles.tabBarTrailing}>
            <button
              type="button"
              className={`${styles.layoutBtn} ${agentPanelVisible ? styles.layoutBtnActive : ''}`}
              onClick={onToggleAgentPanel}
              title={t('workbench.toggle_agent_panel', '切换 Agent 面板')}
              aria-pressed={agentPanelVisible}
            >
              <PanelRight size={18} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className={styles.content}>
          {!activeTab || activeTab.kind === 'welcome' ? (
            <div className={styles.welcome}>
              <p>
                {t(
                  'agent_workspace.select_session_hint',
                  '选择左侧文件或会话，或在右侧 Agent 面板开始对话。'
                )}
              </p>
            </div>
          ) : activeTab.loading ? (
            <p className={styles.status}>{t('workbench.loading_file', '正在加载文件…')}</p>
          ) : activeTab.error ? (
            <p className={styles.error}>{t('workbench.load_file_failed', '无法加载文件')}</p>
          ) : activeTab.kind === 'git-diff' && activeTab.loading ? (
            <p className={styles.status}>{t('workbench.loading_diff', '正在加载 diff…')}</p>
          ) : activeTab.kind === 'git-diff' && activeTab.gitDiffEditable && activeTab.relativePath ? (
            <div className={styles.diffWrap}>
              <div className={styles.diffHeader}>
                {activeTab.relativePath}
                {activeTab.gitDiffStaged
                  ? ` (${t('version_control.staged', '已暂存')})`
                  : ` (${t('workbench.git_working_copy', '工作区')})`}
              </div>
              <div className={styles.diffBody}>
                <WorkbenchGitEditableDiff
                  originalContent={activeTab.gitDiffOriginal ?? ''}
                  content={activeTab.content ?? ''}
                  onChange={(content) => {
                    handleContentChange(activeTab.id, content, activeTab.relativePath!)
                  }}
                />
              </div>
            </div>
          ) : activeTab.kind === 'git-diff' && activeTab.fileDiff ? (
            <div className={styles.diffWrap}>
              <div className={styles.diffHeader}>
                {activeTab.relativePath}
                {activeTab.gitDiffCommitHash
                  ? ` @ ${activeTab.gitDiffCommitHash.slice(0, 7)}`
                  : activeTab.gitDiffStaged
                    ? ` (${t('version_control.staged', '已暂存')})`
                    : ''}
              </div>
              <div className={styles.diffBody}>
                <GitDiffViewer
                  diff={activeTab.fileDiff}
                  defaultMode="split"
                  showModeToggle
                  fillHeight
                />
              </div>
            </div>
          ) : activeTab.kind === 'diff' && activeTab.change ? (
            <div className={styles.diffWrap}>
              <div className={styles.diffHeader}>{activeTab.change.path}</div>
              <FileChangeDiff data={activeTab.change.data} className={styles.diffBody} />
            </div>
          ) : activeTab.kind === 'markdown' && activeTab.relativePath ? (
            <WorkbenchLivePreviewEditor
              documentId={activeTab.id}
              content={activeTab.content ?? ''}
              folderRoot={folderRoot}
              scrollToLine={activeTab.scrollToLine}
              scrollToColumn={activeTab.scrollToColumn}
              onScrolledToLine={() => clearTabScrollTarget(activeTab.id)}
              onChange={(content) => {
                handleContentChange(activeTab.id, content, activeTab.relativePath!)
              }}
            />
          ) : (
            <div className={styles.textPreview}>
              <p className={styles.previewHint}>
                {t('workbench.preview_unsupported', '此文件类型暂不支持编辑，仅显示预览。')}
              </p>
              <pre>{activeTab.content}</pre>
            </div>
          )}
        </div>

        {gitStatusBar ? (
          <div className={styles.statusBar}>
            <button
              type="button"
              className={styles.statusBranch}
              onClick={gitStatusBar.onOpenGitView}
              title={t('workbench.git', 'Git')}
            >
              <span className={styles.statusBranchIcon}>⎇</span>
              <span>{gitStatusBar.branch ?? '—'}</span>
              {gitStatusBar.behind ? <span className={styles.statusSync}>↓{gitStatusBar.behind}</span> : null}
              {gitStatusBar.ahead ? <span className={styles.statusSync}>↑{gitStatusBar.ahead}</span> : null}
            </button>
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
        ) : null}
      </div>
    )
  }
)
