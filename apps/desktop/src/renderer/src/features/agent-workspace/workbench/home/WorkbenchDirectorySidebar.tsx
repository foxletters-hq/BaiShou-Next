import React, { useCallback, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDialog } from '@baishou/ui'
import { useAgentWorkspaces } from '../../hooks/useAgentWorkspaces'
import { useWorkspaceSessions } from '../../hooks/useWorkspaceSessions'
import { SETTINGS_HUB_PREFIX } from '../../../settings/settings-route.util'
import { resolveWorkbenchDirectoryNav } from '../../utils/agent-workspace-route.util'
import { WorkbenchWorkspaceGateSheet } from '../WorkbenchWorkspaceGateSheet'
import { WorkbenchHomeSidebar } from './WorkbenchHomeSidebar'

/**
 * 目录页共用侧栏。挂在工作台布局上，首页 / 知识库 / 技能切换时不卸载，
 * 最近项目列表因此不会跟着子页面重新请求。
 */
export const WorkbenchDirectorySidebar: React.FC<{
  setFolderRoot: (path: string | null) => void
}> = ({ setFolderRoot }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const dialog = useDialog()
  const {
    workspaces,
    lastActiveWorkspaceId,
    addWorkspaceFromPicker,
    ensureScratchWorkspace,
    refresh,
    selectWorkspace,
    removeWorkspace,
    setWorkspacePinned
  } = useAgentWorkspaces()
  const { sessions, reloadSessions, pinSession } = useWorkspaceSessions()
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
      console.error('[WorkbenchDirectorySidebar] add workspace failed:', error)
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

  const enterWorkspace = useCallback(
    async (workspaceId: string) => {
      const target = workspaces.find((entry) => entry.id === workspaceId)
      if (!target) return
      await selectWorkspace(workspaceId)
      setFolderRoot(target.folderRoot)
      navigate(`/agent-workspace/open/${workspaceId}`)
    },
    [navigate, selectWorkspace, setFolderRoot, workspaces]
  )

  const handleOpenSession = useCallback(
    async (sessionId: string, workspaceId: string) => {
      const target = workspaces.find((entry) => entry.id === workspaceId)
      if (!target) return
      await selectWorkspace(workspaceId)
      setFolderRoot(target.folderRoot)
      navigate(`/agent-workspace/${sessionId}`)
    },
    [navigate, selectWorkspace, setFolderRoot, workspaces]
  )

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      const confirmed = await dialog.confirm(
        t(
          'agent_workspace.delete_session_confirm',
          '确定删除此工作区会话？相关对话记录也会被移除。'
        ),
        t('agent_workspace.delete_session', '删除会话')
      )
      if (!confirmed) return
      try {
        await window.api.agentWorkspace.deleteSession(sessionId)
        window.dispatchEvent(new CustomEvent('baishou:workspace-sessions-changed'))
        await reloadSessions()
      } catch (error) {
        console.error('[WorkbenchDirectorySidebar] delete session failed:', error)
        await dialog.alert(
          t('common.error', '操作失败'),
          t('agent_workspace.delete_session', '删除会话')
        )
      }
    },
    [dialog, reloadSessions, t]
  )

  const handleOpenSettings = useCallback(async () => {
    try {
      const scratch = await ensureScratchWorkspace()
      await refresh()
      setSettingsWorkspace({ id: scratch.id, displayName: scratch.displayName })
      setSettingsOpen(true)
    } catch (error) {
      console.error('[WorkbenchDirectorySidebar] ensure scratch for settings failed:', error)
      navigate(`${SETTINGS_HUB_PREFIX}/general`)
    }
  }, [ensureScratchWorkspace, navigate, refresh])

  return (
    <>
      <WorkbenchHomeSidebar
        activeNav={resolveWorkbenchDirectoryNav(pathname)}
        onNewProject={() => void handleOpenFolder()}
        onOpenHome={() => navigate('/agent-workspace')}
        onOpenKnowledge={() => navigate('/agent-workspace/knowledge')}
        onOpenSkills={() => navigate('/agent-workspace/skills')}
        onOpenProjects={() => navigate('/agent-workspace/projects')}
        onOpenSettings={() => void handleOpenSettings()}
        creating={creating}
        recentWorkspaces={workspaces}
        lastActiveWorkspaceId={lastActiveWorkspaceId}
        sessions={sessions}
        onOpenWorkspace={(id) => void enterWorkspace(id)}
        onOpenSession={(sessionId, workspaceId) => void handleOpenSession(sessionId, workspaceId)}
        onDeleteSession={(sessionId) => void handleDeleteSession(sessionId)}
        onRemoveWorkspace={removeWorkspace}
        onTogglePinWorkspace={(id, pinned) => setWorkspacePinned(id, pinned)}
        onTogglePinSession={pinSession}
      />
      {settingsWorkspace ? (
        <WorkbenchWorkspaceGateSheet
          open={settingsOpen}
          workspaceId={settingsWorkspace.id}
          workspaceName={settingsWorkspace.displayName}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </>
  )
}
