import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { PromptFileRef } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import type {
  AgentWorkspaceEntry,
  AgentWorkspaceSessionListItem,
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
import { shouldQueueWorkbenchFileContext } from './workbench-file-context-queue.util'
import { WorkbenchResizeSash } from './WorkbenchResizeSash'
import { useWorkbenchLayoutState } from './useWorkbenchLayoutState'
import { usePanelResize } from './usePanelResize'
import { useWorkbenchStatusGit } from './useWorkbenchStatusGit'
import styles from './WorkbenchShell.module.css'

const MIN_SIDE_WIDTH = 200
const MAX_SIDE_WIDTH = 480
const MIN_AGENT_WIDTH = 380
const MAX_AGENT_WIDTH = 560

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

  const liveSideWidth = dragSideWidth ?? layout.sidePaneWidth
  const liveAgentWidth = dragAgentWidth ?? layout.agentPanelWidth
  const sideWidthRef = useRef(liveSideWidth)
  const agentWidthRef = useRef(liveAgentWidth)
  sideWidthRef.current = liveSideWidth
  agentWidthRef.current = liveAgentWidth

  const handleOpenFile = (relativePath: string, options?: { line?: number; column?: number }) => {
    mainPaneRef.current?.openFile(relativePath, options)
  }

  const handleSelectChange = (change: WorkspaceChangeEntry) => {
    mainPaneRef.current?.openDiff(change)
  }

  const handleReviewAll = (reviewChanges: WorkspaceChangeEntry[]) => {
    mainPaneRef.current?.openDiffs(reviewChanges)
  }

  const handleOpenGitDiff = (
    filePath: string,
    options?: { staged?: boolean; commitHash?: string }
  ) => {
    mainPaneRef.current?.openGitDiff(filePath, options)
  }

  const commitSideWidth = useCallback(
    (width: number) => {
      setSidePaneWidth(width)
      setDragSideWidth(null)
    },
    [setSidePaneWidth]
  )

  const commitAgentWidth = useCallback(
    (width: number) => {
      setAgentPanelWidth(width)
      setDragAgentWidth(null)
    },
    [setAgentPanelWidth]
  )

  const leftSash = usePanelResize({
    min: MIN_SIDE_WIDTH,
    max: MAX_SIDE_WIDTH,
    getWidth: () => sideWidthRef.current,
    onResize: (width) => {
      setDragSideWidth(width)
      sideWidthRef.current = width
    },
    onCommit: commitSideWidth
  })

  const rightSash = usePanelResize({
    min: MIN_AGENT_WIDTH,
    max: MAX_AGENT_WIDTH,
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
    <div className={styles.shell}>
      <div className={styles.editorLayout}>
        {showSidePane ? (
          <>
            <WorkbenchSidePane
              folderRoot={folderRoot}
              activeView={layout.activeSideView}
              onViewChange={setActiveSideView}
              onOpenFile={handleOpenFile}
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
