import React, { useRef } from 'react'
import type { WorkspaceChangeEntry } from '@baishou/shared'
import { WorkbenchRail } from './WorkbenchRail'
import { WorkbenchSidePane } from './WorkbenchSidePane'
import { WorkbenchMainPane, type WorkbenchMainPaneHandle } from './WorkbenchMainPane'
import { WorkbenchAgentPanel, type WorkbenchAgentPanelProps } from './WorkbenchAgentPanel'
import { useWorkbenchLayoutState } from './useWorkbenchLayoutState'
import styles from './WorkbenchShell.module.css'

export interface WorkbenchShellProps {
  folderRoot: string | null
  layoutScopeKey: string | null
  changes: WorkspaceChangeEntry[]
  onOpenFolder: () => void
  agentPanel: Omit<
    WorkbenchAgentPanelProps,
    'collapsed' | 'width' | 'onToggleCollapsed' | 'changes' | 'onSelectChange'
  >
}

export const WorkbenchShell: React.FC<WorkbenchShellProps> = ({
  folderRoot,
  layoutScopeKey,
  changes,
  onOpenFolder,
  agentPanel
}) => {
  const { layout, toggleAgentPanel, setActiveSideView } = useWorkbenchLayoutState(layoutScopeKey)
  const mainPaneRef = useRef<WorkbenchMainPaneHandle>(null)

  const handleOpenFile = (relativePath: string) => {
    mainPaneRef.current?.openFile(relativePath)
  }

  const handleSelectChange = (change: WorkspaceChangeEntry) => {
    mainPaneRef.current?.openDiff(change)
  }

  return (
    <div className={styles.shell}>
      <WorkbenchRail />
      {folderRoot && layout.sidePaneVisible ? (
        <WorkbenchSidePane
          folderRoot={folderRoot}
          activeView={layout.activeSideView}
          onViewChange={setActiveSideView}
          onOpenFile={handleOpenFile}
          width={layout.sidePaneWidth}
          changesCount={changes.length}
        />
      ) : null}
      <WorkbenchMainPane
        ref={mainPaneRef}
        folderRoot={folderRoot}
        onOpenFolder={onOpenFolder}
      />
      <WorkbenchAgentPanel
        {...agentPanel}
        collapsed={layout.agentPanelCollapsed}
        width={layout.agentPanelWidth}
        onToggleCollapsed={toggleAgentPanel}
        changes={changes}
        onSelectChange={handleSelectChange}
      />
    </div>
  )
}
