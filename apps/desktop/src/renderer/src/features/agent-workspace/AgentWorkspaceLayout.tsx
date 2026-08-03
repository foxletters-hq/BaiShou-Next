import React, { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import styles from './AgentWorkspaceLayout.module.css'

export const AgentWorkspaceLayout: React.FC = () => {
  const navigate = useNavigate()
  const [folderRoot, setFolderRoot] = useState<string | null>(null)

  return (
    <div className={styles.layoutContainer}>
      <Outlet context={{ folderRoot, setFolderRoot, navigate }} />
    </div>
  )
}
