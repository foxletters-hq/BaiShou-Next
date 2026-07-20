import React, { useState, useCallback, useRef, useEffect } from 'react'
import type {
  AgentWorkspaceEntry,
  AgentWorkspaceSessionListItem,
  WorkspaceChangeEntry
} from '@baishou/shared'
import { WorkbenchRail } from './WorkbenchRail'
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
  workspaces: AgentWorkspaceEntry[]
  activeWorkspaceId?: string | null
  sessions: AgentWorkspaceSessionListItem[]
  loadingSessions?: boolean
  activeSessionId?: string
  changes: WorkspaceChangeEntry[]
  onOpenFolder: () => void
  onSelectWorkspace: (workspaceId: string) => void
  onChangeWorkspaceAvatar?: (workspaceId: string) => void
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
    | 'changes'
    | 'onSelectChange'
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
  workspaces,
  activeWorkspaceId,
  sessions,
  loadingSessions,
  activeSessionId: _activeSessionId,
  changes,
  onOpenFolder,
  onSelectWorkspace,
  onChangeWorkspaceAvatar,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  agentPanel
}) => {
  const {
    layout,
    toggleAgentPanel,
    toggleSidePane,
    setActiveSideView,
    setSidePaneWidth,
    setAgentPanelWidth
  } = useWorkbenchLayoutState(layoutScopeKey)
  const mainPaneRef = useRef<WorkbenchMainPaneHandle>(null)

  const [liveSideWidth, setLiveSideWidth] = useState(layout.sidePaneWidth)
  const [liveAgentWidth, setLiveAgentWidth] = useState(layout.agentPanelWidth)
  const [agentSessionsOpen, setAgentSessionsOpen] = useState(false)
  const [gitChangesCount, setGitChangesCount] = useState(0)
  const [gitBranchMeta, setGitBranchMeta] = useState<{
    branch?: string
    ahead: number
    behind: number
  }>({ ahead: 0, behind: 0 })
  const sideWidthRef = useRef(liveSideWidth)
  const agentWidthRef = useRef(liveAgentWidth)

  useEffect(() => {
    setLiveSideWidth(layout.sidePaneWidth)
    sideWidthRef.current = layout.sidePaneWidth
  }, [layout.sidePaneWidth])

  useEffect(() => {
    setLiveAgentWidth(layout.agentPanelWidth)
    agentWidthRef.current = layout.agentPanelWidth
  }, [layout.agentPanelWidth])

  const handleOpenFile = (relativePath: string, options?: { line?: number; column?: number }) => {
    mainPaneRef.current?.openFile(relativePath, options)
  }

  const handleSelectChange = (change: WorkspaceChangeEntry) => {
    mainPaneRef.current?.openDiff(change)
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
      setLiveSideWidth(width)
      sideWidthRef.current = width
      setSidePaneWidth(width)
    },
    [setSidePaneWidth]
  )

  const commitAgentWidth = useCallback(
    (width: number) => {
      setLiveAgentWidth(width)
      agentWidthRef.current = width
      setAgentPanelWidth(width)
    },
    [setAgentPanelWidth]
  )

  const leftSash = usePanelResize({
    min: MIN_SIDE_WIDTH,
    max: MAX_SIDE_WIDTH,
    getWidth: () => sideWidthRef.current,
    onResize: (width) => {
      setLiveSideWidth(width)
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
      setLiveAgentWidth(width)
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
      <WorkbenchRail
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={onSelectWorkspace}
        onOpenFolder={onOpenFolder}
        onChangeAvatar={onChangeWorkspaceAvatar}
      />
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
            />
            <WorkbenchResizeSash ariaLabel="调整左侧边栏宽度" onMouseDown={leftSash.onMouseDown} />
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
              ariaLabel="调整右侧 Agent 面板宽度"
              onMouseDown={rightSash.onMouseDown}
            />
            <WorkbenchAgentPanel
              {...agentPanel}
              workspace={workspace}
              width={liveAgentWidth}
              sessions={sessions}
              loadingSessions={loadingSessions}
              changes={changes}
              onSelectChange={handleSelectChange}
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
