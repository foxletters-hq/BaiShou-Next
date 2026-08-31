import React, { useCallback, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDialog } from '@baishou/ui'
import { useAgentWorkspaces } from '../../hooks/useAgentWorkspaces'
import { useWorkspaceSessions } from '../../hooks/useWorkspaceSessions'
import { SETTINGS_HUB_PREFIX } from '../../../settings/settings-route.util'
import { WorkbenchWorkspaceGateSheet } from '../WorkbenchWorkspaceGateSheet'
import { WorkbenchHomeSidebar } from './WorkbenchHomeSidebar'
import pageStyles from './WorkbenchHomePage.module.css'
import styles from './WorkbenchPlaceholderPage.module.css'

interface WorkspaceOutletContext {
  setFolderRoot: (path: string | null) => void
}

export type WorkbenchPlaceholderSection = 'projects'

export interface WorkbenchPlaceholderPageProps {
  section: WorkbenchPlaceholderSection
}

/** 工作台侧栏二级页占位：正式功能落地前先跳到空白页 */
export const WorkbenchPlaceholderPage: React.FC<WorkbenchPlaceholderPageProps> = ({ section }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dialog = useDialog()
  const { setFolderRoot } = useOutletContext<WorkspaceOutletContext>()
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
      console.error('[WorkbenchPlaceholderPage] add workspace failed:', error)
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
        console.error('[WorkbenchPlaceholderPage] delete session failed:', error)
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
      console.error('[WorkbenchPlaceholderPage] ensure scratch for settings failed:', error)
      navigate(`${SETTINGS_HUB_PREFIX}/general`)
    }
  }, [ensureScratchWorkspace, navigate, refresh])

  return (
    <div className={pageStyles.page}>
      <WorkbenchHomeSidebar
        activeNav={section}
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

      <main className={pageStyles.main}>
        <div className={styles.empty}>
          <h1 className={styles.title}>{t('workbench.home_projects', '项目')}</h1>
          <p className={styles.desc}>
            {t('workbench.placeholder_projects_desc', '项目列表即将上线，敬请期待。')}
          </p>
        </div>
      </main>

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
