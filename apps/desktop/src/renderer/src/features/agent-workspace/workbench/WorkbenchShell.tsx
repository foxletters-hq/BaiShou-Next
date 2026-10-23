import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  AgentGateFileChangePreview,
  AgentWorkspaceEntry,
  AgentWorkspaceSessionListItem,
  PromptFileRef,
  WorkspaceChangeEntry
} from '@baishou/shared'
import { WorkbenchSidePane } from './WorkbenchSidePane'
import { WorkbenchMainPane, type WorkbenchMainPaneHandle } from './WorkbenchMainPane'
import {
  WorkbenchAgentPanel,
  type WorkbenchAgentPanelHandle,
  type WorkbenchAgentPanelProps
} from './WorkbenchAgentPanel'
import { joinWorkspaceAbsolutePath } from '../utils/workspace-composer-drop.util'
import { dispatchWorkbenchRevealPath } from './workbench-explorer-selection.util'
import { shouldQueueWorkbenchFileContext } from './workbench-file-context-queue.util'
import { workspaceChangeFromGatePreview } from '../utils/workspace-gate-file-changes.util'
import { WorkbenchResizeSash } from './WorkbenchResizeSash'
import { useWorkbenchLayoutState } from './useWorkbenchLayoutState'
import { usePanelResize } from './usePanelResize'
import { useWorkbenchStatusGit } from './useWorkbenchStatusGit'
import { isMarkdownPath } from './useWorkbenchTabs'
import styles from './WorkbenchShell.module.css'

const MIN_SIDE_WIDTH = 200
const MAX_SIDE_WIDTH = 480
const MIN_AGENT_WIDTH = 380
const MAX_AGENT_WIDTH = 800
const MIN_EDITOR_WIDTH = 360
const SASH_WIDTH = 8

function fitPanelMax(
  shellWidth: number,
  reserved: number,
  hardMin: number,
  hardMax: number
): number {
  if (shellWidth <= 0) return hardMax
  const available = Math.floor(shellWidth - reserved)
  if (available <= hardMin) return hardMin
  return Math.min(hardMax, available)
}

function sashLimit(width: number, min: number, max: number): 'free' | 'min' | 'max' | 'locked' {
  const atMin = width <= min + 1
  const atMax = max - width <= 1
  if (atMin && atMax) return 'locked'
  if (atMax) return 'max'
  if (atMin) return 'min'
  return 'free'
}

export interface WorkbenchShellProps {
  folderRoot: string | null
  layoutScopeKey: string | null
  workspace: AgentWorkspaceEntry | null
  sessions: AgentWorkspaceSessionListItem[]
  loadingSessions?: boolean
  activeSessionId?: string
  onOpenFolder: () => void
  onBackToHome: () => void
  onNewSession: () => void
  onSelectSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, title: string) => void
  agentPanel: Omit<
    WorkbenchAgentPanelProps,
    | 'width'
    | 'workspace'
    | 'sessions'
    | 'loadingSessions'
    | 'onSelectChange'
    | 'onReviewAll'
    | 'sessionsViewActive'
    | 'onToggleSessionsView'
    | 'onNewSession'
    | 'onSelectSession'
    | 'onDeleteSession'
    | 'onRenameSession'
    | 'recentFilePaths'
    | 'onOpenFile'
  >
}

export const WorkbenchShell: React.FC<WorkbenchShellProps> = ({
  folderRoot,
  layoutScopeKey,
  workspace,
  sessions,
  loadingSessions,
  activeSessionId: _activeSessionId,
  onOpenFolder,
  onBackToHome,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  agentPanel
}) => {
  const { t } = useTranslation()
  const {
    layout,
    toggleAgentPanel,
    ensureAgentPanelOpen,
    toggleSidePane,
    setActiveSideView,
    setSidePaneWidth,
    setAgentPanelWidth
  } = useWorkbenchLayoutState(layoutScopeKey)
  const mainPaneRef = useRef<WorkbenchMainPaneHandle>(null)
  const agentPanelRef = useRef<WorkbenchAgentPanelHandle>(null)
  const [recentFilePaths, setRecentFilePaths] = useState<string[]>([])
  const [agentSessionsOpen, setAgentSessionsOpen] = useState(false)

  const pendingFileContextRef = useRef<PromptFileRef[]>([])

  const deliverFileContext = useCallback(
    (ref: PromptFileRef) => {
      const filePath = folderRoot ? joinWorkspaceAbsolutePath(folderRoot, ref.relativePath) : ''
      agentPanelRef.current?.addFileContext({
        ...ref,
        filePath: filePath || undefined
      })
    },
    [folderRoot]
  )

  const handleAddFileContext = useCallback(
    (ref: PromptFileRef) => {
      const shouldQueue = shouldQueueWorkbenchFileContext({
        agentPanelCollapsed: layout.agentPanelCollapsed,
        sessionsViewOpen: agentSessionsOpen,
        agentPanelMounted: Boolean(agentPanelRef.current)
      })
      if (shouldQueue) {
        pendingFileContextRef.current.push(ref)
        ensureAgentPanelOpen()
        if (agentSessionsOpen) setAgentSessionsOpen(false)
        return
      }
      deliverFileContext(ref)
    },
    [agentSessionsOpen, deliverFileContext, ensureAgentPanelOpen, layout.agentPanelCollapsed]
  )

  useLayoutEffect(() => {
    if (layout.agentPanelCollapsed || agentSessionsOpen) return
    const pending = pendingFileContextRef.current
    if (!pending.length) return
    pendingFileContextRef.current = []
    for (const ref of pending) deliverFileContext(ref)
  }, [agentSessionsOpen, deliverFileContext, layout.agentPanelCollapsed])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return
      if (event.key.toLowerCase() !== 'l') return
      if (event.repeat) return
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        if (target.isContentEditable && !target.closest('.workbench-cm-editor')) return
      }
      const selection = mainPaneRef.current?.getActiveSelection()
      if (!selection) return
      event.preventDefault()
      handleAddFileContext({
        relativePath: selection.relativePath,
        selection: { startLine: selection.startLine, endLine: selection.endLine },
        origin: 'selection'
      })
      mainPaneRef.current?.dismissSelectionAffordance()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleAddFileContext])

  /** 拖拽中临时宽度；非拖拽时直接用 layout，避免持久化宽度晚一拍闪烁 */
  const [dragSideWidth, setDragSideWidth] = useState<number | null>(null)
  const [dragAgentWidth, setDragAgentWidth] = useState<number | null>(null)
  const statusGit = useWorkbenchStatusGit(folderRoot)

  const shellRef = useRef<HTMLDivElement>(null)
  const [shellWidth, setShellWidth] = useState(0)
  useLayoutEffect(() => {
    const el = shellRef.current
    if (!el) return
    const update = () => setShellWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const liveSideWidth = dragSideWidth ?? layout.sidePaneWidth
  const liveAgentWidth = dragAgentWidth ?? layout.agentPanelWidth
  const sideVisible = Boolean(folderRoot && layout.sidePaneVisible)
  const agentVisible = !layout.agentPanelCollapsed
  const sideMax = fitPanelMax(
    shellWidth,
    MIN_EDITOR_WIDTH + (agentVisible ? liveAgentWidth + SASH_WIDTH * 2 : SASH_WIDTH),
    MIN_SIDE_WIDTH,
    MAX_SIDE_WIDTH
  )
  const agentMax = fitPanelMax(
    shellWidth,
    MIN_EDITOR_WIDTH + (sideVisible ? liveSideWidth + SASH_WIDTH * 2 : SASH_WIDTH),
    MIN_AGENT_WIDTH,
    MAX_AGENT_WIDTH
  )
  const sideLimit = sashLimit(liveSideWidth, MIN_SIDE_WIDTH, sideMax)
  const agentLimit = sashLimit(liveAgentWidth, MIN_AGENT_WIDTH, agentMax)
  const sideWidthRef = useRef(liveSideWidth)
  const agentWidthRef = useRef(liveAgentWidth)
  sideWidthRef.current = liveSideWidth
  agentWidthRef.current = liveAgentWidth

  const revealFileInSidebar = useCallback(
    (relativePath: string) => {
      setActiveSideView('files')
      window.setTimeout(() => {
        dispatchWorkbenchRevealPath(relativePath)
      }, 0)
    },
    [setActiveSideView]
  )

  const handleOpenFile = (
    relativePath: string,
    options?: { line?: number; column?: number; isDirectory?: boolean }
  ) => {
    if (options?.isDirectory) {
      setActiveSideView('files')
      dispatchWorkbenchRevealPath(relativePath, { isDirectory: true })
      return
    }
    mainPaneRef.current?.openFile(relativePath, options)
  }

  const handleAddExplorerToChat = useCallback(
    (entries: Array<{ relativePath: string; isDirectory: boolean }>) => {
      for (const entry of entries) {
        handleAddFileContext({
          relativePath: entry.relativePath,
          origin: 'explorer-drop',
          ...(entry.isDirectory ? { isDirectory: true } : {})
        })
      }
    },
    [handleAddFileContext]
  )

  const handleSelectChange = (change: WorkspaceChangeEntry) => {
    mainPaneRef.current?.openDiff(change)
  }

  const handleReviewAll = (reviewChanges: WorkspaceChangeEntry[]) => {
    mainPaneRef.current?.openDiffs(reviewChanges)
  }

  const handleOpenGateFileChange = (preview: AgentGateFileChangePreview) => {
    const change = workspaceChangeFromGatePreview(agentPanel.pendingAsk, preview)
    if (change) mainPaneRef.current?.openDiff(change)
  }

  const handleOpenGitDiff = (
    filePath: string,
    options?: { staged?: boolean; commitHash?: string }
  ) => {
    if (!options?.commitHash && isMarkdownPath(filePath)) {
      mainPaneRef.current?.openFile(filePath)
      return
    }
    mainPaneRef.current?.openGitDiff(filePath, options)
  }

  const commitSideWidth = useCallback(
    (width: number) => {
      setSidePaneWidth(width)
      setDragSideWidth(null)
    },
    [setSidePaneWidth]
  )

  useLayoutEffect(() => {
    if (shellWidth <= 0) return
    if (sideVisible && dragSideWidth == null && layout.sidePaneWidth > sideMax) {
      setSidePaneWidth(sideMax)
    }
    if (agentVisible && dragAgentWidth == null && layout.agentPanelWidth > agentMax) {
      setAgentPanelWidth(agentMax)
    }
  }, [
    agentMax,
    agentVisible,
    dragAgentWidth,
    dragSideWidth,
    layout.agentPanelWidth,
    layout.sidePaneWidth,
    setAgentPanelWidth,
    setSidePaneWidth,
    shellWidth,
    sideMax,
    sideVisible
  ])

  const commitAgentWidth = useCallback(
    (width: number) => {
      setAgentPanelWidth(width)
      setDragAgentWidth(null)
    },
    [setAgentPanelWidth]
  )

  const leftSash = usePanelResize({
    min: MIN_SIDE_WIDTH,
    max: sideMax,
    cursor: sideLimit === 'max' ? 'w-resize' : sideLimit === 'min' ? 'e-resize' : 'col-resize',
    getWidth: () => sideWidthRef.current,
    onResize: (width) => {
      setDragSideWidth(width)
      sideWidthRef.current = width
    },
    onCommit: commitSideWidth
  })

  const rightSash = usePanelResize({
    min: MIN_AGENT_WIDTH,
    max: agentMax,
    cursor: agentLimit === 'max' ? 'e-resize' : agentLimit === 'min' ? 'w-resize' : 'col-resize',
    invertDelta: true,
    getWidth: () => agentWidthRef.current,
    onResize: (width) => {
      setDragAgentWidth(width)
      agentWidthRef.current = width
    },
    onCommit: commitAgentWidth
  })

  const showSidePane = Boolean(folderRoot && layout.sidePaneVisible)
  const showAgentPanel = !layout.agentPanelCollapsed

  const handleToggleSessionsView = useCallback(() => {
    setAgentSessionsOpen((prev) => !prev)
  }, [])

  const handleAgentSelectSession = useCallback(
    (id: string) => {
      onSelectSession(id)
      setAgentSessionsOpen(false)
    },
    [onSelectSession]
  )

  const handleAgentNewSession = useCallback(() => {
    onNewSession()
    setAgentSessionsOpen(false)
  }, [onNewSession])

  return (
    <div className={styles.shell} ref={shellRef}>
      <div className={styles.editorLayout}>
        {showSidePane ? (
          <>
            <WorkbenchSidePane
              folderRoot={folderRoot}
              activeView={layout.activeSideView}
              onViewChange={setActiveSideView}
              onOpenFile={handleOpenFile}
              onAddToChat={handleAddExplorerToChat}
              onOpenGitDiff={handleOpenGitDiff}
              onGitMetaChange={statusGit.applyViewMeta}
              syncBranch={statusGit.meta.branch}
              width={liveSideWidth}
              changesCount={statusGit.changesCount}
              onGitChangesCountChange={statusGit.setChangesCount}
              onBackToHome={onBackToHome}
              workspaceId={workspace?.id}
              workspaceName={workspace?.displayName}
            />
            <WorkbenchResizeSash
              ariaLabel={t('workbench.resize_side_pane', '调整左侧边栏宽度')}
              onMouseDown={leftSash.onMouseDown}
              growDirection="right"
              limit={sideLimit}
            />
          </>
        ) : null}

        <WorkbenchMainPane
          ref={mainPaneRef}
          folderRoot={folderRoot}
          onAddFileContext={handleAddFileContext}
          onOpenFilePathsChange={setRecentFilePaths}
          onOpenFolder={onOpenFolder}
          sidePaneVisible={layout.sidePaneVisible}
          agentPanelVisible={showAgentPanel}
          onToggleSidePane={toggleSidePane}
          onToggleAgentPanel={toggleAgentPanel}
          onRevealFileInSidebar={revealFileInSidebar}
          gitStatusBar={{
            branch: statusGit.meta.branch,
            branches: statusGit.meta.branches,
            ahead: statusGit.meta.ahead,
            behind: statusGit.meta.behind,
            changesCount: statusGit.changesCount,
            onCheckoutBranch: statusGit.checkout,
            onCreateBranch: statusGit.createBranch,
            onPublishBranch: statusGit.publish,
            onRefreshBranches: statusGit.refresh
          }}
        />

        {showAgentPanel ? (
          <>
            <WorkbenchResizeSash
              ariaLabel={t('workbench.resize_agent_panel', '调整右侧 Agent 面板宽度')}
              onMouseDown={rightSash.onMouseDown}
              growDirection="left"
              limit={agentLimit}
            />
            <WorkbenchAgentPanel
              ref={agentPanelRef}
              {...agentPanel}
              onOpenFile={handleOpenFile}
              recentFilePaths={recentFilePaths}
              workspace={workspace}
              width={liveAgentWidth}
              sessions={sessions}
              loadingSessions={loadingSessions}
              onSelectChange={handleSelectChange}
              onReviewAll={handleReviewAll}
              onOpenGateFileChange={handleOpenGateFileChange}
              sessionsViewActive={agentSessionsOpen}
              onToggleSessionsView={handleToggleSessionsView}
              onNewSession={handleAgentNewSession}
              onSelectSession={handleAgentSelectSession}
              onDeleteSession={onDeleteSession}
              onRenameSession={onRenameSession}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}
