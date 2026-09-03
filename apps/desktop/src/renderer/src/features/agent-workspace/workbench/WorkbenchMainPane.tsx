import React, {
  useImperativeHandle,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type { PromptFileRef } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { MessageSquare, MessageSquarePlus, X, PanelLeft, PanelRight } from 'lucide-react'
import type { WorkspaceChangeEntry } from '@baishou/shared'
import { GitDiffViewer, getFileTypeIcon, type WorkbenchSelectionAffordanceState } from '@baishou/ui'
import { WorkbenchEmptyState } from './WorkbenchEmptyState'
import { WorkbenchLivePreviewEditor } from './WorkbenchLivePreviewEditor'
import { WorkbenchGitEditableDiff } from './WorkbenchGitEditableDiff'
import { WorkbenchFileChangeDiffPane } from './WorkbenchFileChangeDiffPane'
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
import {
  commentPopoverAnchorFromSelectionCoords,
  resolveWorkbenchCommentPopoverPosition
} from './workbench-comment-popover.util'
import { useWorkbenchIdleCaption } from '../utils/workbench-idle-caption'
import { WorkbenchStatusBranchMenu } from './WorkbenchStatusBranchMenu'
import { useDismissOnOutsideClick } from './GitWorkbenchMenus'
import workbenchMascot from './assets/workbench-mascot.png'
import styles from './WorkbenchMainPane.module.css'

function splitRelativePath(relativePath: string): string[] {
  return relativePath.split(/[/\\]/).filter(Boolean)
}

function tabIconName(tab: { title: string; relativePath?: string }): string {
  return tab.relativePath || tab.title
}

function isPositiveLine(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
}

function commentPopoverPosition(anchor: { x?: number; y?: number }): { x: number; y: number } {
  return resolveWorkbenchCommentPopoverPosition({
    x: anchor.x,
    y: anchor.y,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight
  })
}

function addSelectionShortcutLabel(): string {
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)) {
    return '⌘⇧L'
  }
  return 'Ctrl+Shift+L'
}

export interface WorkbenchMainPaneHandle {
  openFile: (relativePath: string, options?: { line?: number; column?: number }) => void
  openDiff: (change: WorkspaceChangeEntry) => void
  openDiffs: (changes: WorkspaceChangeEntry[]) => void
  openGitDiff: (filePath: string, options?: { staged?: boolean; commitHash?: string }) => void
  getActiveSelection: () => WorkbenchActiveSelection | null
  dismissSelectionAffordance: () => void
  getOpenFilePaths: () => string[]
}

export interface WorkbenchGitStatusBarProps {
  branch?: string | null
  branches?: string[]
  ahead?: number
  behind?: number
  changesCount?: number
  onCheckoutBranch?: (branch: string) => void
  onCreateBranch?: (branch: string) => void
  onPublishBranch?: () => void
  onRefreshBranches?: () => void
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
  onAddFileContext?: (ref: PromptFileRef) => void
  onOpenFilePathsChange?: (paths: string[]) => void
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
      reorderTabs,
      updateTabContent,
      reloadOpenFileContents,
      clearTabScrollTarget
    } = tabsState
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const markdownEditorRef = useRef<WorkbenchEditorSelectionHandle>(null)
    const gitDiffEditorRef = useRef<WorkbenchEditorSelectionHandle>(null)
    const mergeDiffEditorRef = useRef<WorkbenchEditorSelectionHandle>(null)
    const [selectionAffordance, setSelectionAffordance] =
      useState<WorkbenchSelectionAffordanceState | null>(null)
    const selectionAffordanceRef = useRef<WorkbenchSelectionAffordanceState | null>(null)
    const dismissedSelectionKeyRef = useRef<string | null>(null)
    const [branchMenuOpen, setBranchMenuOpen] = useState(false)
    const branchMenuRef = useDismissOnOutsideClick(branchMenuOpen, () => setBranchMenuOpen(false))
    const [commentDraft, setCommentDraft] = useState<{
      startLine: number
      endLine: number
      x: number
      y: number
      text: string
    } | null>(null)
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
        saveTimerRef.current = setTimeout(() => {
          void window.api.agentWorkspace.writeFile(folderRoot, relativePath, content)
        }, 600)
      },
      [folderRoot, onTabContentChange, updateTabContent]
    )

    useEffect(() => {
      if (!folderRoot) return
      const onTreeRefresh = () => {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current)
          saveTimerRef.current = null
        }
        void reloadOpenFileContents()
      }
      window.addEventListener('baishou:workspace-tree-refresh', onTreeRefresh)
      return () => {
        window.removeEventListener('baishou:workspace-tree-refresh', onTreeRefresh)
      }
    }, [folderRoot, reloadOpenFileContents])

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

          <DragDropContext onDragEnd={handleTabDragEnd}>
            <Droppable droppableId="workbench-tabs" direction="horizontal">
              {(droppableProvided) => (
                <div
                  className={styles.tabScroll}
                  ref={droppableProvided.innerRef}
                  {...droppableProvided.droppableProps}
                >
                  {tabs.map((tab, index) => (
                    <Draggable key={tab.id} draggableId={tab.id} index={index}>
                      {(draggableProvided, snapshot) => (
                        <div
                          ref={draggableProvided.innerRef}
                          {...draggableProvided.draggableProps}
                          {...draggableProvided.dragHandleProps}
                          style={{
                            ...draggableProvided.draggableProps.style,
                            cursor: 'default'
                          }}
                          className={`${styles.tab} ${tab.id === activeTabId ? styles.tabActive : ''} ${snapshot.isDragging ? styles.tabDragging : ''}`}
                          onMouseDown={(event) => handleTabMouseDown(event, tab.id, true)}
                          onClick={() => setActiveTabId(tab.id)}
                          title={tab.relativePath || tab.title}
                        >
                          <span className={styles.tabIcon} aria-hidden>
                            {getFileTypeIcon(tabIconName(tab), 16)}
                          </span>
                          <span className={styles.tabLabel}>{tab.title}</span>
                          <button
                            type="button"
                            className={styles.tabClose}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation()
                              closeTab(tab.id)
                            }}
                            aria-label={t('common.close', '关闭')}
                          >
                            <X size={14} strokeWidth={2} />
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {droppableProvided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

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
          {!activeTab ? (
            <div className={styles.idleHero}>
              <img src={workbenchMascot} alt="" className={styles.idleMascot} draggable={false} />
              <p className={styles.idleCaption}>{idleCaption}</p>
            </div>
          ) : activeTab.loading ? (
            <p className={styles.status}>{t('workbench.loading_file', '正在加载文件…')}</p>
          ) : activeTab.error ? (
            <p className={styles.error}>{t('workbench.load_file_failed', '无法加载文件')}</p>
          ) : activeTab.kind === 'git-diff' && activeTab.loading ? (
            <p className={styles.status}>{t('workbench.loading_diff', '正在加载 diff…')}</p>
          ) : activeTab.kind === 'git-diff' &&
            activeTab.gitDiffEditable &&
            activeTab.relativePath ? (
            <div className={styles.diffWrap}>
              <div className={styles.diffHeader}>
                {activeTab.relativePath}
                {activeTab.gitDiffStaged
                  ? ` (${t('version_control.staged', '已暂存')})`
                  : ` (${t('workbench.git_working_copy', '工作区')})`}
              </div>
              <div className={styles.diffBody}>
                <WorkbenchGitEditableDiff
                  ref={gitDiffEditorRef}
                  originalContent={activeTab.gitDiffOriginal ?? ''}
                  content={activeTab.content ?? ''}
                  onChange={(content) => {
                    handleContentChange(activeTab.id, content, activeTab.relativePath!)
                  }}
                  onSelectionAffordanceChange={handleSelectionAffordanceChange}
                />
              </div>
            </div>
          ) : activeTab.kind === 'git-diff' &&
            activeTab.gitDiffReadOnly &&
            activeTab.relativePath ? (
            <div className={styles.diffWrap}>
              <div className={styles.diffHeader}>
                {activeTab.relativePath}
                {activeTab.gitDiffCommitHash ? ` @ ${activeTab.gitDiffCommitHash.slice(0, 7)}` : ''}
              </div>
              <div className={styles.diffBody}>
                <WorkbenchGitEditableDiff
                  ref={gitDiffEditorRef}
                  originalContent={activeTab.gitDiffOriginal ?? ''}
                  content={activeTab.content ?? ''}
                  readOnly
                  onSelectionAffordanceChange={handleSelectionAffordanceChange}
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
            <WorkbenchFileChangeDiffPane
              ref={mergeDiffEditorRef}
              folderRoot={folderRoot}
              change={activeTab.change}
              onModifiedChange={
                activeTab.change.path
                  ? (content) => {
                      handleContentChange(activeTab.id, content, activeTab.change!.path)
                    }
                  : undefined
              }
              onSelectionAffordanceChange={handleSelectionAffordanceChange}
            />
          ) : activeTab.kind === 'markdown' && activeTab.relativePath ? (
            <WorkbenchLivePreviewEditor
              ref={markdownEditorRef}
              documentId={activeTab.id}
              content={activeTab.content ?? ''}
              folderRoot={folderRoot}
              relativePath={activeTab.relativePath}
              scrollToLine={activeTab.scrollToLine}
              scrollToColumn={activeTab.scrollToColumn}
              onScrolledToLine={() => clearTabScrollTarget(activeTab.id)}
              onChange={(content) => {
                handleContentChange(activeTab.id, content, activeTab.relativePath!)
              }}
              onSelectionAffordanceChange={handleSelectionAffordanceChange}
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

        {selectionAffordance ? (
          <div
            className={styles.selectionAffordance}
            data-placement={selectionAffordance.placement}
            data-workbench-selection-affordance
            style={{
              left: selectionAffordance.left,
              top: selectionAffordance.top
            }}
            onMouseDown={(event) => {
              // 保留编辑器选区，让点击动作读取到同一范围。
              event.preventDefault()
            }}
          >
            <button
              type="button"
              className={styles.selectionAffordanceAction}
              tabIndex={-1}
              title={t(
                'workbench.add_selection_to_chat_with_shortcut',
                '将第 {{start}} 至 {{end}} 行加入对话（{{shortcut}}）',
                {
                  start: selectionAffordance.startLine,
                  end: selectionAffordance.endLine,
                  shortcut: addSelectionShortcutLabel()
                }
              )}
              onClick={() => {
                emitFileContext({
                  startLine: selectionAffordance.startLine,
                  endLine: selectionAffordance.endLine,
                  origin: 'selection'
                })
              }}
            >
              <MessageSquarePlus size={14} strokeWidth={1.9} aria-hidden />
              <span>{t('workbench.add_to_chat', '加入对话')}</span>
              <kbd className={styles.selectionAffordanceShortcut}>{addSelectionShortcutLabel()}</kbd>
            </button>
            <button
              type="button"
              className={styles.selectionAffordanceAction}
              tabIndex={-1}
              title={t('workbench.comment_selection', '评论此选区')}
              onClick={() => {
                openCommentDraft({
                  startLine: selectionAffordance.startLine,
                  endLine: selectionAffordance.endLine,
                  ...commentPopoverAnchorFromSelectionCoords({
                    left: selectionAffordance.endLeft,
                    right: selectionAffordance.endLeft,
                    top: selectionAffordance.endTop,
                    bottom: selectionAffordance.endTop
                  })
                })
              }}
            >
              <MessageSquare size={14} strokeWidth={1.9} aria-hidden />
              <span>{t('workbench.comment_selection', '评论此选区')}</span>
            </button>
          </div>
        ) : null}

        {commentDraft ? (
          <div
            ref={commentPopoverRef}
            className={styles.commentPopover}
            style={{ left: commentDraft.x, top: commentDraft.y }}
          >
            <p className={styles.commentPopoverTitle}>
              {commentDraft.startLine === commentDraft.endLine
                ? t('workbench.comment_line', '评论第 {{line}} 行', {
                    line: commentDraft.startLine
                  })
                : t('workbench.comment_lines', '评论第 {{start}} 至 {{end}} 行', {
                    start: commentDraft.startLine,
                    end: commentDraft.endLine
                  })}
            </p>
            <textarea
              className={styles.commentPopoverInput}
              value={commentDraft.text}
              autoFocus
              placeholder={t('workbench.comment_placeholder', '写下要交给模型看的评论')}
              onChange={(event) =>
                setCommentDraft((prev) => (prev ? { ...prev, text: event.target.value } : prev))
              }
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  closeCommentDraft()
                  return
                }
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault()
                  submitCommentDraft()
                }
              }}
            />
            <div className={styles.commentPopoverActions}>
              <button type="button" onClick={closeCommentDraft}>
                {t('common.cancel', '取消')}
              </button>
              <button
                type="button"
                disabled={!commentDraft.text.trim()}
                onClick={submitCommentDraft}
              >
                {t('workbench.add_to_chat', '加入对话')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    )
  }
)
