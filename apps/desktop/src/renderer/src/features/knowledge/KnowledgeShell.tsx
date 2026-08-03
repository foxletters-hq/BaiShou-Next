import React, { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDialog } from '@baishou/ui'
import { useAgentWorkspaces } from '../agent-workspace/hooks/useAgentWorkspaces'
import { SETTINGS_HUB_PREFIX } from '../settings/settings-route.util'
import { WorkbenchWorkspaceGateSheet } from '../agent-workspace/workbench/WorkbenchWorkspaceGateSheet'
import {
  WorkbenchHomeSidebar,
  type WorkbenchHomeNavId
} from '../agent-workspace/workbench/home/WorkbenchHomeSidebar'
import pageStyles from '../agent-workspace/workbench/home/WorkbenchHomePage.module.css'

interface WorkspaceOutletContext {
  setFolderRoot: (path: string | null) => void
}

export interface KnowledgeShellProps {
  activeNav?: WorkbenchHomeNavId
  children: React.ReactNode
  setFolderRoot: WorkspaceOutletContext['setFolderRoot']
}

/** 知识库页共用工作台侧栏壳 */
export const KnowledgeShell: React.FC<KnowledgeShellProps> = ({
  activeNav = 'knowledge',
  children,
  setFolderRoot
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dialog = useDialog()
  const { addWorkspaceFromPicker, ensureScratchWorkspace, refresh } = useAgentWorkspaces()
  const [creating, setCreating] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsWorkspace, setSettingsWorkspace] = useState<{
    id: string
    displayName: string
  } | null>(null)

  const handleOpenFolder = useCallback(async () => {
    setCreating(true)
    try {
      const entry = await addWorkspaceFromPicker()
      if (!entry) return
      setFolderRoot(entry.folderRoot)
      navigate(`/agent-workspace/open/${entry.id}`)
    } catch (error) {
      console.error('[KnowledgeShell] add workspace failed:', error)
      await dialog.alert(
        error instanceof Error
          ? error.message
          : t('agent_workspace.add_workspace_failed', '添加工作区失败，请重启应用后重试'),
        t('workbench.home_new_project', '新建项目')
      )
    } finally {
      setCreating(false)
    }
  }, [addWorkspaceFromPicker, dialog, navigate, setFolderRoot, t])

  const handleOpenSettings = useCallback(async () => {
    try {
      const scratch = await ensureScratchWorkspace()
      await refresh()
      setSettingsWorkspace({ id: scratch.id, displayName: scratch.displayName })
      setSettingsOpen(true)
    } catch (error) {
      console.error('[KnowledgeShell] ensure scratch for settings failed:', error)
      navigate(`${SETTINGS_HUB_PREFIX}/general`)
    }
  }, [ensureScratchWorkspace, navigate, refresh])

  return (
    <div className={pageStyles.page}>
      <WorkbenchHomeSidebar
        activeNav={activeNav}
        onNewProject={() => void handleOpenFolder()}
        onOpenHome={() => navigate('/agent-workspace')}
        onOpenKnowledge={() => navigate('/agent-workspace/knowledge')}
        onOpenTemplates={() => navigate('/agent-workspace/templates')}
        onOpenProjects={() => navigate('/agent-workspace/projects')}
        onOpenSettings={() => void handleOpenSettings()}
        creating={creating}
      />
      <main className={pageStyles.main}>{children}</main>
      {settingsWorkspace ? (
        <WorkbenchWorkspaceGateSheet
          open={settingsOpen}
          workspaceId={settingsWorkspace.id}
          workspaceName={settingsWorkspace.displayName}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  )
}
