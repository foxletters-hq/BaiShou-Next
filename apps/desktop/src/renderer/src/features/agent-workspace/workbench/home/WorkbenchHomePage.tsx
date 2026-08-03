import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDialog } from '@baishou/ui'
import {
  applyWorkspacePresetsToConfig,
  inferWorkspacePresets,
  type AgentGateApprovalPreset,
  type AgentWorkspaceEntry,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import { usePromptShortcutStore } from '@baishou/store'
import { useAgentWorkspaces } from '../../hooks/useAgentWorkspaces'
import { SETTINGS_HUB_PREFIX } from '../../../settings/settings-route.util'
import { WorkbenchWorkspaceGateSheet } from '../WorkbenchWorkspaceGateSheet'
import { WorkbenchHomeSidebar } from './WorkbenchHomeSidebar'
import { WorkbenchHomeComposer } from './WorkbenchHomeComposer'
import { WorkbenchRecentProjects } from './WorkbenchRecentProjects'
import styles from './WorkbenchHomePage.module.css'

interface WorkspaceOutletContext {
  setFolderRoot: (path: string | null) => void
}

function sortWorkspaces(
  list: AgentWorkspaceEntry[],
  lastActiveId: string | null
): AgentWorkspaceEntry[] {
  return [...list].sort((a, b) => {
    if (lastActiveId) {
      if (a.id === lastActiveId) return -1
      if (b.id === lastActiveId) return 1
    }
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  })
}

/** 工作台目录首页：侧栏导航 + 中央对话入口 + 最近项目 */
export const WorkbenchHomePage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dialog = useDialog()
  const { setFolderRoot } = useOutletContext<WorkspaceOutletContext>()
  const {
    workspaces,
    lastActiveWorkspaceId,
    loading: loadingWorkspaces,
    selectWorkspace,
    addWorkspaceFromPicker,
    ensureScratchWorkspace,
    refresh
  } = useAgentWorkspaces()
  const { shortcuts, loadShortcuts } = usePromptShortcutStore()

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [approvalPreset, setApprovalPreset] = useState<AgentGateApprovalPreset>('always_ask')
  const [gateConfig, setGateConfig] = useState<BaishouAgentGateConfig | null>(null)
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)
  const bootstrappedRef = useRef(false)

  useEffect(() => {
    setFolderRoot(null)
  }, [setFolderRoot])

  useEffect(() => {
    void loadShortcuts()
  }, [loadShortcuts])

  const sortedWorkspaces = useMemo(
    () => sortWorkspaces(workspaces, lastActiveWorkspaceId),
    [workspaces, lastActiveWorkspaceId]
  )

  useEffect(() => {
    if (loadingWorkspaces || bootstrappedRef.current) return
    let cancelled = false

    const bootstrap = async () => {
      setBootstrapping(true)
      try {
        if (
          lastActiveWorkspaceId &&
          workspaces.some((entry) => entry.id === lastActiveWorkspaceId)
        ) {
          if (!cancelled) {
            setSelectedWorkspaceId(lastActiveWorkspaceId)
            bootstrappedRef.current = true
          }
          return
        }
        const scratch = await ensureScratchWorkspace()
        if (cancelled) return
        await refresh()
        if (cancelled) return
        setSelectedWorkspaceId(scratch.id)
        bootstrappedRef.current = true
      } catch (error) {
        console.error('[WorkbenchHomePage] bootstrap workspace failed:', error)
      } finally {
        if (!cancelled) setBootstrapping(false)
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [ensureScratchWorkspace, lastActiveWorkspaceId, loadingWorkspaces, refresh, workspaces])

  useEffect(() => {
    if (!bootstrappedRef.current || loadingWorkspaces) return
    if (selectedWorkspaceId && workspaces.some((entry) => entry.id === selectedWorkspaceId)) {
      return
    }
    let cancelled = false
    const recover = async () => {
      if (lastActiveWorkspaceId && workspaces.some((entry) => entry.id === lastActiveWorkspaceId)) {
        setSelectedWorkspaceId(lastActiveWorkspaceId)
        return
      }
      try {
        const scratch = await ensureScratchWorkspace()
        if (cancelled) return
        await refresh()
        if (!cancelled) setSelectedWorkspaceId(scratch.id)
      } catch (error) {
        console.error('[WorkbenchHomePage] recover workspace failed:', error)
      }
    }
    void recover()
    return () => {
      cancelled = true
    }
  }, [
    ensureScratchWorkspace,
    lastActiveWorkspaceId,
    loadingWorkspaces,
    refresh,
    selectedWorkspaceId,
    workspaces
  ])

  const selectedWorkspace = sortedWorkspaces.find((ws) => ws.id === selectedWorkspaceId) ?? null

  useEffect(() => {
    if (!selectedWorkspaceId) return
    let cancelled = false
    const loadGate = async () => {
      try {
        const config = await window.api.settings.getBaishouAgentGateConfig({
          kind: 'workspace',
          workspaceId: selectedWorkspaceId
        })
        if (cancelled) return
        setGateConfig(config)
        setApprovalPreset(inferWorkspacePresets(config).approvalPreset)
      } catch (error) {
        console.error('[WorkbenchHomePage] load gate config failed:', error)
      }
    }
    void loadGate()
    return () => {
      cancelled = true
    }
  }, [selectedWorkspaceId])

  const workspaceOptions = useMemo(
    () =>
      sortedWorkspaces.map((ws) => ({
        value: ws.id,
        label: ws.kind === 'scratch' ? t('workbench.home_scratch_name', '稿纸') : ws.displayName
      })),
    [sortedWorkspaces, t]
  )

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

  const handleOpenFolder = useCallback(async () => {
    setCreating(true)
    try {
      const entry = await addWorkspaceFromPicker()
      if (!entry) return
      setSelectedWorkspaceId(entry.id)
      setFolderRoot(entry.folderRoot)
      navigate(`/agent-workspace/open/${entry.id}`)
    } catch (error) {
      console.error('[WorkbenchHomePage] add workspace failed:', error)
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

  const handleWorkspaceChange = useCallback(
    async (workspaceId: string) => {
      setSelectedWorkspaceId(workspaceId)
      await selectWorkspace(workspaceId)
    },
    [selectWorkspace]
  )

  const handleApprovalChange = useCallback(
    async (preset: AgentGateApprovalPreset) => {
      if (!selectedWorkspaceId || preset === 'custom') return
      setApprovalPreset(preset)
      try {
        const current =
          gateConfig ??
          (await window.api.settings.getBaishouAgentGateConfig({
            kind: 'workspace',
            workspaceId: selectedWorkspaceId
          }))
        const inferred = inferWorkspacePresets(current)
        const next = applyWorkspacePresetsToConfig(
          current,
          {
            scopePreset:
              inferred.scopePreset === 'custom' ? 'workspace_write' : inferred.scopePreset,
            approvalPreset: preset
          },
          inferred.trustedExternalDirs
        )
        const saved = await window.api.settings.setBaishouAgentGateConfig(next, {
          kind: 'workspace',
          workspaceId: selectedWorkspaceId
        })
        setGateConfig(saved)
        setApprovalPreset(inferWorkspacePresets(saved).approvalPreset)
      } catch (error) {
        console.error('[WorkbenchHomePage] save approval preset failed:', error)
      }
    },
    [gateConfig, selectedWorkspaceId]
  )

  const handleOpenSettings = useCallback(async () => {
    if (!selectedWorkspaceId) {
      try {
        const scratch = await ensureScratchWorkspace()
        setSelectedWorkspaceId(scratch.id)
        await refresh()
      } catch (error) {
        console.error('[WorkbenchHomePage] ensure scratch for settings failed:', error)
        navigate(`${SETTINGS_HUB_PREFIX}/general`)
        return
      }
    }
    setSettingsOpen(true)
  }, [ensureScratchWorkspace, navigate, refresh, selectedWorkspaceId])

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return false

      setSending(true)
      try {
        let workspace = selectedWorkspace
        if (!workspace) {
          workspace = await ensureScratchWorkspace()
          setSelectedWorkspaceId(workspace.id)
          await refresh()
        }

        await selectWorkspace(workspace.id)
        setFolderRoot(workspace.folderRoot)

        if (gateConfig && approvalPreset !== 'custom') {
          const inferred = inferWorkspacePresets(gateConfig)
          const next = applyWorkspacePresetsToConfig(
            gateConfig,
            {
              scopePreset:
                inferred.scopePreset === 'custom' ? 'workspace_write' : inferred.scopePreset,
              approvalPreset
            },
            inferred.trustedExternalDirs
          )
          await window.api.settings.setBaishouAgentGateConfig(next, {
            kind: 'workspace',
            workspaceId: workspace.id
          })
        }

        const sessionId = await window.api.agentWorkspace.createSession({
          folderRoot: workspace.folderRoot
        })
        navigate(`/agent-workspace/${sessionId}?init=${encodeURIComponent(trimmed)}`)
        return true
      } catch (error) {
        console.error('[WorkbenchHomePage] send failed:', error)
        await dialog.alert(
          error instanceof Error
            ? error.message
            : t('workbench.home_new_session_failed', '新建会话失败'),
          t('workbench.home_composer', '开始对话')
        )
        return false
      } finally {
        setSending(false)
      }
    },
    [
      approvalPreset,
      dialog,
      ensureScratchWorkspace,
      gateConfig,
      navigate,
      refresh,
      selectWorkspace,
      selectedWorkspace,
      sending,
      setFolderRoot,
      t
    ]
  )

  const settingsWorkspace =
    sortedWorkspaces.find((ws) => ws.id === selectedWorkspaceId) ?? selectedWorkspace

  return (
    <div className={styles.page}>
      <WorkbenchHomeSidebar
        activeNav="home"
        onNewProject={() => void handleOpenFolder()}
        onOpenHome={() => navigate('/agent-workspace')}
        onOpenKnowledge={() => navigate('/agent-workspace/knowledge')}
        onOpenTemplates={() => navigate('/agent-workspace/templates')}
        onOpenProjects={() => navigate('/agent-workspace/projects')}
        onOpenSettings={() => void handleOpenSettings()}
        creating={creating}
      />

      <main className={styles.main}>
        <div className={styles.mainInner}>
          <WorkbenchHomeComposer
            workspaceOptions={workspaceOptions}
            workspaceId={selectedWorkspaceId}
            onWorkspaceChange={(id) => void handleWorkspaceChange(id)}
            onOpenFolder={() => void handleOpenFolder()}
            approvalPreset={approvalPreset}
            onApprovalChange={(preset) => void handleApprovalChange(preset)}
            onOpenWorkspaceSettings={() => void handleOpenSettings()}
            onSend={handleSend}
            shortcuts={shortcuts}
            onManageShortcuts={() => navigate('/chat/new-session?focus=manage-shortcuts')}
            sending={sending || bootstrapping}
          />
          <WorkbenchRecentProjects
            workspaces={sortedWorkspaces}
            loading={loadingWorkspaces}
            onOpen={(id) => void enterWorkspace(id)}
            onViewAll={() => void handleOpenFolder()}
          />
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
