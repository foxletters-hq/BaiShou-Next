import React, { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  AgentWorkspaceEntry,
  AgentWorkspaceSessionListItem,
  WorkspaceChangeEntry
} from '@baishou/shared'
import { WorkbenchSidePane } from './WorkbenchSidePane'
import { WorkbenchMainPane, type WorkbenchMainPaneHandle } from './WorkbenchMainPane'
import { WorkbenchAgentPanel, type WorkbenchAgentPanelProps } from './WorkbenchAgentPanel'
import { WorkbenchResizeSash } from './WorkbenchResizeSash'
import { useWorkbenchLayoutState } from './useWorkbenchLayoutState'
import { usePanelResize } from './usePanelResize'
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
    toggleSidePane,
    setActiveSideView,
    setSidePaneWidth,
    setAgentPanelWidth
  } = useWorkbenchLayoutState(layoutScopeKey)
  const mainPaneRef = useRef<WorkbenchMainPaneHandle>(null)

  /** 拖拽中临时宽度；非拖拽时直接用 layout，避免持久化宽度晚一拍闪烁 */
  const [dragSideWidth, setDragSideWidth] = useState<number | null>(null)
  const [dragAgentWidth, setDragAgentWidth] = useState<number | null>(null)
  const [agentSessionsOpen, setAgentSessionsOpen] = useState(false)
  const [gitChangesCount, setGitChangesCount] = useState(0)
  const [gitBranchMeta, setGitBranchMeta] = useState<{
    branch?: string
    ahead: number
    behind: number
  }>({ ahead: 0, behind: 0 })

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

  const handleOpenGitView = useCallback(() => {
    setActiveSideView('git')
    if (!layout.sidePaneVisible) {
      toggleSidePane()
    }
  }, [setActiveSideView, layout.sidePaneVisible, toggleSidePane])

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
              onGitMetaChange={setGitBranchMeta}
              width={liveSideWidth}
              changesCount={gitChangesCount}
              onGitChangesCountChange={setGitChangesCount}
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
          onOpenFolder={onOpenFolder}
          sidePaneVisible={layout.sidePaneVisible}
          agentPanelVisible={showAgentPanel}
          onToggleSidePane={toggleSidePane}
          onToggleAgentPanel={toggleAgentPanel}
          gitStatusBar={{
            branch: gitBranchMeta.branch,
            ahead: gitBranchMeta.ahead,
            behind: gitBranchMeta.behind,
            changesCount: gitChangesCount,
            onOpenGitView: handleOpenGitView
          }}
        />

        {showAgentPanel ? (
          <>
            <WorkbenchResizeSash
              ariaLabel={t('workbench.resize_agent_panel', '调整右侧 Agent 面板宽度')}
              onMouseDown={rightSash.onMouseDown}
            />
            <WorkbenchAgentPanel
              {...agentPanel}
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
