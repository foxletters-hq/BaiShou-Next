import React, { useImperativeHandle, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MdClose } from 'react-icons/md'
import type { WorkspaceChangeEntry } from '@baishou/shared'
import { FileChangeDiff } from '@baishou/ui'
import { WorkbenchEmptyState } from './WorkbenchEmptyState'
import { WorkbenchLivePreviewEditor } from './WorkbenchLivePreviewEditor'
import { useWorkbenchTabs } from './useWorkbenchTabs'
import styles from './WorkbenchMainPane.module.css'

export interface WorkbenchMainPaneHandle {
  openFile: (relativePath: string) => void
  openDiff: (change: WorkspaceChangeEntry) => void
}

export interface WorkbenchMainPaneProps {
  folderRoot: string | null
  onOpenFolder: () => void
  onTabContentChange?: (tabId: string, content: string, relativePath: string) => void
}

export const WorkbenchMainPane = forwardRef<WorkbenchMainPaneHandle, WorkbenchMainPaneProps>(
  function WorkbenchMainPane({ folderRoot, onOpenFolder, onTabContentChange }, ref) {
    const { t } = useTranslation()
    const tabsState = useWorkbenchTabs(folderRoot)

    useImperativeHandle(
      ref,
      () => ({
        openFile: (relativePath) => void tabsState.openFile(relativePath),
        openDiff: (change) => tabsState.openDiff(change)
      }),
      [tabsState]
    )

    if (!folderRoot) {
      return <WorkbenchEmptyState onOpenFolder={onOpenFolder} />
    }

    const { tabs, activeTab, activeTabId, setActiveTabId, closeTab, updateTabContent } = tabsState

    return (
      <div className={styles.pane}>
        <div className={styles.tabBar}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`${styles.tab} ${tab.id === activeTabId ? styles.tabActive : ''}`}
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
                  <MdClose size={14} />
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <div className={styles.content}>
          {!activeTab || activeTab.kind === 'welcome' ? (
            <div className={styles.welcome}>
              <p>{t('agent_workspace.select_session_hint', '选择左侧文件，或在右侧 Agent 面板开始对话。')}</p>
            </div>
          ) : activeTab.loading ? (
            <p className={styles.status}>{t('workbench.loading_file', '正在加载文件…')}</p>
          ) : activeTab.error ? (
            <p className={styles.error}>{t('workbench.load_file_failed', '无法加载文件')}</p>
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
              onChange={(content) => {
                updateTabContent(activeTab.id, content)
                onTabContentChange?.(activeTab.id, content, activeTab.relativePath!)
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
      </div>
    )
  }
)
