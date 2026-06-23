import React, { useEffect, useState } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router-dom'
import styles from './AgentWorkspaceLayout.module.css'

export const AgentWorkspaceLayout: React.FC = () => {
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const [folderRoot, setFolderRoot] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId || sessionId === 'new-session') return
    void window.api?.agentWorkspace
      ?.getBinding?.(sessionId)
      .then((binding) => {
        if (binding?.folderRoot) {
          setFolderRoot(binding.folderRoot)
        }
      })
      .catch(() => undefined)
  }, [sessionId])

  return (
    <div className={styles.layoutContainer}>
      <Outlet context={{ folderRoot, setFolderRoot, sessionId, navigate }} />
    </div>
  )
}
