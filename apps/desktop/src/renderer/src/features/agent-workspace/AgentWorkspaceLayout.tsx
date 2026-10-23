import React, { Suspense, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { isAgentWorkspaceEditorPath } from './utils/agent-workspace-route.util'
import { WorkbenchDirectorySidebar } from './workbench/home/WorkbenchDirectorySidebar'
import styles from './AgentWorkspaceLayout.module.css'

export const AgentWorkspaceLayout: React.FC = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [folderRoot, setFolderRoot] = useState<string | null>(null)
  const showDirectorySidebar = !isAgentWorkspaceEditorPath(pathname)

  return (
    <div className={styles.layoutContainer}>
      <div
        className={showDirectorySidebar ? styles.directorySidebar : styles.directorySidebarHidden}
      >
        <WorkbenchDirectorySidebar setFolderRoot={setFolderRoot} />
      </div>
      <div className={styles.outlet}>
        <Suspense fallback={null}>
          <Outlet context={{ folderRoot, setFolderRoot, navigate }} />
        </Suspense>
      </div>
    </div>
  )
}
