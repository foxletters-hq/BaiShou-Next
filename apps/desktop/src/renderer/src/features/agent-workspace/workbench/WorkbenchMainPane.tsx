import React, {
  useImperativeHandle,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import type { DropResult } from '@hello-pangea/dnd'
import type { PromptFileRef } from '@baishou/shared'
import { getFileTypeIcon, type WorkbenchSelectionAffordanceState } from '@baishou/ui'
import { WorkbenchEmptyState } from './WorkbenchEmptyState'
import { useWorkbenchTabs } from './useWorkbenchTabs'
import {
  type WorkbenchActiveSelection,
  type WorkbenchEditorSelectionHandle
} from './workbench-editor-selection.util'
import {
  registerWorkbenchFileContextCommands,
  WORKBENCH_ADD_FILE_CONTEXT_EVENT,
  WORKBENCH_COMMENT_FILE_CONTEXT_EVENT,
  type WorkbenchFileContextRangeDetail
} from './workbench-file-context-commands'
import { commentPopoverAnchorFromSelectionCoords } from './workbench-comment-popover.util'
import { useWorkbenchIdleCaption } from '../utils/workbench-idle-caption'
import { shouldApplyWorkspaceFsChange } from './workbench-path.util'
import { isWorkbenchTabPathDeleted } from './workbench-tab-close.util'
import { shouldEnableWorkbenchTabReorder } from './workbench-tab-reorder.util'
import { WorkbenchStatusBranchMenu } from './WorkbenchStatusBranchMenu'
import { useDismissOnOutsideClick } from './GitWorkbenchMenus'
import { WorkbenchEditorTabBar } from './WorkbenchEditorTabBar'
import { WorkbenchEditorContent } from './WorkbenchEditorContent'
import { WorkbenchSelectionChrome, type WorkbenchCommentDraft } from './WorkbenchSelectionChrome'
import {
  commentPopoverPosition,
  isPositiveLine,
  splitRelativePath
} from './workbench-main-pane.util'
import type { WorkbenchMainPaneHandle, WorkbenchMainPaneProps } from './WorkbenchMainPane.types'
import styles from './WorkbenchMainPane.module.css'

export type {
  WorkbenchGitStatusBarProps,
  WorkbenchMainPaneHandle,
  WorkbenchMainPaneProps
} from './WorkbenchMainPane.types'

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
      gitStatusBar,
      onAddFileContext,
      onOpenFilePathsChange
    },
    ref
  ) {
    const { t } = useTranslation()
    const idleCaption = useWorkbenchIdleCaption()
    const tabsState = useWorkbenchTabs(folderRoot)
    const {
      tabs,
      activeTab,
      activeTabId,
      setActiveTabId,
      closeTab,
      closeTabsForDeletedPath,
      reorderTabs,
      updateTabContent,
      reloadOpenFileContents,
      clearTabScrollTarget
    } = tabsState
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const savePathRef = useRef<string | null>(null)
    const markdownEditorRef = useRef<WorkbenchEditorSelectionHandle>(null)
    const gitDiffEditorRef = useRef<WorkbenchEditorSelectionHandle>(null)
    const mergeDiffEditorRef = useRef<WorkbenchEditorSelectionHandle>(null)
    const [selectionAffordance, setSelectionAffordance] =
      useState<WorkbenchSelectionAffordanceState | null>(null)
    const selectionAffordanceRef = useRef<WorkbenchSelectionAffordanceState | null>(null)
    const dismissedSelectionKeyRef = useRef<string | null>(null)
    const [branchMenuOpen, setBranchMenuOpen] = useState(false)
    const branchMenuRef = useDismissOnOutsideClick(branchMenuOpen, () => setBranchMenuOpen(false))
    const [commentDraft, setCommentDraft] = useState<WorkbenchCommentDraft | null>(null)
    const closeCommentDraft = useCallback(() => setCommentDraft(null), [])
    const commentPopoverRef = useDismissOnOutsideClick(Boolean(commentDraft), closeCommentDraft)

    selectionAffordanceRef.current = selectionAffordance

    const handleSelectionAffordanceChange = useCallback(
      (next: WorkbenchSelectionAffordanceState | null) => {
        if (!next) {
          dismissedSelectionKeyRef.current = null
          setSelectionAffordance(null)
          return
        }
        if (next.key === dismissedSelectionKeyRef.current) return
        setSelectionAffordance(next)
      },
      []
    )

    const dismissSelectionAffordance = useCallback(() => {
      const current = selectionAffordanceRef.current
      if (current) dismissedSelectionKeyRef.current = current.key
      setSelectionAffordance(null)
    }, [])

    const resolveActiveRelativePath = useCallback(() => {
      return activeTab?.relativePath || activeTab?.change?.path || ''
    }, [activeTab])

    const readActiveSelection = useCallback((): WorkbenchActiveSelection | null => {
      const relativePath = resolveActiveRelativePath()
      if (!relativePath) return null
      const range =
        markdownEditorRef.current?.getSelectionLines() ||
        gitDiffEditorRef.current?.getSelectionLines() ||
        mergeDiffEditorRef.current?.getSelectionLines()
      if (!range) return null
      return { relativePath, ...range }
    }, [resolveActiveRelativePath])

    const openCommentDraft = useCallback(
      (range: { startLine: number; endLine: number; x?: number; y?: number }) => {
        const fallback = selectionAffordanceRef.current
        const fallbackAnchor = fallback
          ? commentPopoverAnchorFromSelectionCoords({
              left: fallback.endLeft,
              right: fallback.endLeft,
              top: fallback.endTop,
              bottom: fallback.endTop
            })
          : {}
        setCommentDraft({
          startLine: range.startLine,
          endLine: range.endLine,
          ...commentPopoverPosition({
            x: range.x ?? fallbackAnchor.x,
            y: range.y ?? fallbackAnchor.y
          }),
          text: ''
        })
        dismissSelectionAffordance()
      },
      [dismissSelectionAffordance]
    )

    const emitFileContext = useCallback(
      (partial: {
        startLine: number
        endLine: number
        comment?: string
        origin?: PromptFileRef['origin']
      }) => {
        const relativePath = resolveActiveRelativePath()
        if (!relativePath) return
        onAddFileContext?.({
          relativePath,
          selection: { startLine: partial.startLine, endLine: partial.endLine },
          comment: partial.comment,
          origin: partial.origin ?? (partial.comment ? 'comment' : 'selection')
        })
        dismissSelectionAffordance()
      },
      [dismissSelectionAffordance, onAddFileContext, resolveActiveRelativePath]
    )

    const handleContentChange = useCallback(
      (tabId: string, content: string, relativePath: string) => {
        updateTabContent(tabId, content)
        onTabContentChange?.(tabId, content, relativePath)
        if (!folderRoot) return
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        savePathRef.current = relativePath
        saveTimerRef.current = setTimeout(() => {
          savePathRef.current = null
          void window.api.agentWorkspace.writeFile(folderRoot, relativePath, content)
        }, 600)
      },
      [folderRoot, onTabContentChange, updateTabContent]
    )

    const cancelPendingSaveForDeletedPath = useCallback((deletedPath: string) => {
      if (!savePathRef.current || !isWorkbenchTabPathDeleted(savePathRef.current, deletedPath)) {
        return
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      savePathRef.current = null
    }, [])

    const handleDeletedPath = useCallback(
      (deletedPath: string) => {
        if (!deletedPath) return
        cancelPendingSaveForDeletedPath(deletedPath)
        closeTabsForDeletedPath(deletedPath)
      },
      [cancelPendingSaveForDeletedPath, closeTabsForDeletedPath]
    )

    useEffect(() => {
      if (!folderRoot) return
      const onTreeRefresh = () => {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current)
          saveTimerRef.current = null
        }
        savePathRef.current = null
        void reloadOpenFileContents()
      }
      const onEntryDeleted = (event: Event) => {
        const relativePath = (event as CustomEvent<{ relativePath?: string }>).detail?.relativePath
        if (relativePath) handleDeletedPath(relativePath)
      }
      const unsubscribeFs = window.api.agentWorkspace.onFsChanged?.((payload) => {
        if (!shouldApplyWorkspaceFsChange(folderRoot, payload.folderRoot)) return
        if (payload.kind !== 'delete') return
        handleDeletedPath(payload.path)
      })
      window.addEventListener('baishou:workspace-tree-refresh', onTreeRefresh)
      window.addEventListener('baishou:workspace-entry-deleted', onEntryDeleted)
      return () => {
        unsubscribeFs?.()
        window.removeEventListener('baishou:workspace-tree-refresh', onTreeRefresh)
        window.removeEventListener('baishou:workspace-entry-deleted', onEntryDeleted)
      }
    }, [folderRoot, handleDeletedPath, reloadOpenFileContents])

    const handleTabMouseDown = useCallback(
      (event: React.MouseEvent, tabId: string, closable: boolean) => {
        if (event.button !== 1 || !closable) return
        event.preventDefault()
        event.stopPropagation()
        closeTab(tabId)
      },
      [closeTab]
    )

    const handleTabDragEnd = useCallback(
      (result: DropResult) => {
        if (!result.destination) return
        if (result.source.index === result.destination.index) return
        reorderTabs(result.source.index, result.destination.index)
      },
      [reorderTabs]
    )

    const breadcrumbSegments = useMemo(() => {
      if (!activeTab?.relativePath) return null
      return splitRelativePath(activeTab.relativePath)
    }, [activeTab?.relativePath])

    useImperativeHandle(
      ref,
      () => ({
        openFile: (relativePath, options) => void tabsState.openFile(relativePath, options),
        openDiff: (change) => tabsState.openDiff(change),
        openDiffs: (changes) => tabsState.openDiffs(changes),
        openGitDiff: (filePath, options) => void tabsState.openGitDiff(filePath, options),
        getActiveSelection: () => readActiveSelection(),
        dismissSelectionAffordance,
        getOpenFilePaths: () =>
          tabs
            .map((tab) => tab.relativePath || tab.change?.path)
            .filter((path): path is string => Boolean(path))
      }),
      [dismissSelectionAffordance, readActiveSelection, tabs, tabsState]
    )

    useEffect(() => {
      registerWorkbenchFileContextCommands()
    }, [])

    useEffect(() => {
      dismissedSelectionKeyRef.current = null
      setSelectionAffordance(null)
    }, [activeTabId])

    useEffect(() => {
      if (!selectionAffordance) return
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.key !== 'Escape') return
        event.preventDefault()
        dismissSelectionAffordance()
      }
      window.addEventListener('keydown', onKeyDown)
      return () => window.removeEventListener('keydown', onKeyDown)
    }, [dismissSelectionAffordance, selectionAffordance])

    useEffect(() => {
      onOpenFilePathsChange?.(
        tabs
          .map((tab) => tab.relativePath || tab.change?.path)
          .filter((path): path is string => Boolean(path))
      )
    }, [onOpenFilePathsChange, tabs])

    useEffect(() => {
      const onAdd = (event: Event) => {
        const detail = (event as CustomEvent<WorkbenchFileContextRangeDetail>).detail
        if (!isPositiveLine(detail?.startLine) || !isPositiveLine(detail?.endLine)) return
        emitFileContext({
          startLine: detail.startLine,
          endLine: detail.endLine,
          origin: 'selection'
        })
      }
      const onComment = (event: Event) => {
        const detail = (event as CustomEvent<WorkbenchFileContextRangeDetail>).detail
        if (!isPositiveLine(detail?.startLine) || !isPositiveLine(detail?.endLine)) return
        openCommentDraft(detail)
      }
      window.addEventListener(WORKBENCH_ADD_FILE_CONTEXT_EVENT, onAdd)
      window.addEventListener(WORKBENCH_COMMENT_FILE_CONTEXT_EVENT, onComment)
      return () => {
        window.removeEventListener(WORKBENCH_ADD_FILE_CONTEXT_EVENT, onAdd)
        window.removeEventListener(WORKBENCH_COMMENT_FILE_CONTEXT_EVENT, onComment)
      }
    }, [emitFileContext, openCommentDraft])

    const submitCommentDraft = useCallback(() => {
      if (!commentDraft) return
      const comment = commentDraft.text.trim()
      if (!comment) return
      setCommentDraft(null)
      emitFileContext({
        startLine: commentDraft.startLine,
        endLine: commentDraft.endLine,
        comment,
        origin: 'comment'
      })
    }, [commentDraft, emitFileContext])

    if (!folderRoot) {
      return <WorkbenchEmptyState onOpenFolder={onOpenFolder} />
    }

    return (
      <div className={styles.pane}>
        <WorkbenchEditorTabBar
          tabs={tabs}
          activeTabId={activeTabId}
          enableReorder={shouldEnableWorkbenchTabReorder(tabs.length)}
          sidePaneVisible={sidePaneVisible}
          agentPanelVisible={agentPanelVisible}
          onToggleSidePane={onToggleSidePane}
          onToggleAgentPanel={onToggleAgentPanel}
          onSelectTab={setActiveTabId}
          onCloseTab={closeTab}
          onTabMouseDown={handleTabMouseDown}
          onTabDragEnd={handleTabDragEnd}
        />

        {breadcrumbSegments && breadcrumbSegments.length > 0 ? (
          <nav className={styles.breadcrumb} aria-label={t('workbench.breadcrumb', '文件路径')}>
            <div className={styles.breadcrumbInner}>
              {breadcrumbSegments.map((segment, index) => {
                const isLast = index === breadcrumbSegments.length - 1
                return (
                  <React.Fragment key={`${index}-${segment}`}>
                    {index > 0 ? <span className={styles.breadcrumbSep}>›</span> : null}
                    <span
                      className={`${styles.breadcrumbSeg} ${isLast ? styles.breadcrumbCurrent : ''}`}
                    >
                      {isLast ? (
                        <span className={styles.breadcrumbIcon} aria-hidden>
                          {getFileTypeIcon(segment, 14)}
                        </span>
                      ) : null}
                      {segment}
                    </span>
                  </React.Fragment>
                )
              })}
            </div>
          </nav>
        ) : null}

        <div className={styles.content}>
          <WorkbenchEditorContent
            folderRoot={folderRoot}
            activeTab={activeTab}
            idleCaption={idleCaption}
            markdownEditorRef={markdownEditorRef}
            gitDiffEditorRef={gitDiffEditorRef}
            mergeDiffEditorRef={mergeDiffEditorRef}
            onContentChange={handleContentChange}
            onScrolledToLine={clearTabScrollTarget}
            onSelectionAffordanceChange={handleSelectionAffordanceChange}
          />
        </div>

        {gitStatusBar ? (
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
        ) : null}

        <WorkbenchSelectionChrome
          selectionAffordance={selectionAffordance}
          commentDraft={commentDraft}
          commentPopoverRef={commentPopoverRef}
          onEmitSelection={(range) => {
            emitFileContext({ ...range, origin: 'selection' })
          }}
          onOpenComment={openCommentDraft}
          onCommentTextChange={(text) =>
            setCommentDraft((prev) => (prev ? { ...prev, text } : prev))
          }
          onCloseComment={closeCommentDraft}
          onSubmitComment={submitCommentDraft}
        />
      </div>
    )
  }
)
