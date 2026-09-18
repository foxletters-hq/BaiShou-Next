import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDialog } from '@baishou/ui'
import {
  resolveWorkspaceSecurityMode,
  type AgentWorkspaceSecurityMode,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import { useAgentWorkspaces } from '../../hooks/useAgentWorkspaces'
import { useWorkspaceSessions } from '../../hooks/useWorkspaceSessions'
import { SETTINGS_HUB_PREFIX } from '../../../settings/settings-route.util'
import { stashWorkspaceInitMeta } from '../../utils/workspace-init-meta.util'
import { sortAgentWorkspaces } from '../../utils/workspace-display.util'
import {
  hasWorkspaceComposerPayload,
  normalizeWorkspaceSendAttachments
} from '../../utils/workspace-message-display.util'
import { mergeWorkspaceFileRefsIntoAttachments } from '../../utils/workspace-file-ref-send.util'
import { persistSecurityMode } from './workbench-home-security.util'

export function useWorkbenchHomeWorkspace({
  setFolderRoot,
  selectedAssistantId,
  currentProviderId,
  currentModelId
}: {
  setFolderRoot: (path: string | null) => void
  selectedAssistantId?: string
  currentProviderId?: string
  currentModelId?: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dialog = useDialog()
  const {
    workspaces,
    lastActiveWorkspaceId,
    loading: loadingWorkspaces,
    selectWorkspace,
    addWorkspaceFromPicker,
    ensureScratchWorkspace,
    removeWorkspace,
    setWorkspacePinned,
    refresh
  } = useAgentWorkspaces()
  const { sessions, reloadSessions, pinSession } = useWorkspaceSessions()

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [securityMode, setSecurityMode] = useState<AgentWorkspaceSecurityMode>('auto_review')
  const [gateConfig, setGateConfig] = useState<BaishouAgentGateConfig | null>(null)
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)
  const bootstrappedRef = useRef(false)

  const sortedWorkspaces = useMemo(
    () => sortAgentWorkspaces(workspaces, lastActiveWorkspaceId),
    [workspaces, lastActiveWorkspaceId]
  )
  const fallbackWorkspaceId = sortedWorkspaces[0]?.id ?? null

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
        // 不强制创建稿纸：用户未选文件夹时，发送/开设置再 ensureScratch
        if (!cancelled) {
          setSelectedWorkspaceId(fallbackWorkspaceId)
          bootstrappedRef.current = true
        }
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
  }, [fallbackWorkspaceId, lastActiveWorkspaceId, loadingWorkspaces, workspaces])

  useEffect(() => {
    if (!bootstrappedRef.current || loadingWorkspaces) return
    if (selectedWorkspaceId && workspaces.some((entry) => entry.id === selectedWorkspaceId)) {
      return
    }
    if (lastActiveWorkspaceId && workspaces.some((entry) => entry.id === lastActiveWorkspaceId)) {
      setSelectedWorkspaceId(lastActiveWorkspaceId)
      return
    }
    // 当前选中被删掉：切到仍有的项目，否则留空（发消息时再自动用稿纸）
    setSelectedWorkspaceId(fallbackWorkspaceId)
  }, [
    fallbackWorkspaceId,
    lastActiveWorkspaceId,
    loadingWorkspaces,
    selectedWorkspaceId,
    workspaces
  ])

  const selectedWorkspace = sortedWorkspaces.find((ws) => ws.id === selectedWorkspaceId) ?? null

  useEffect(() => {
    if (!selectedWorkspaceId) {
      setGateConfig(null)
      return
    }
    let cancelled = false
    const loadGate = async () => {
      try {
        const config = await window.api.settings.getBaishouAgentGateConfig({
          kind: 'workspace',
          workspaceId: selectedWorkspaceId
        })
        if (cancelled) return
        setGateConfig(config)
        setSecurityMode(resolveWorkspaceSecurityMode(config))
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
        console.error('[WorkbenchHomePage] delete session failed:', error)
        await dialog.alert(
          t('common.error', '操作失败'),
          t('agent_workspace.delete_session', '删除会话')
        )
      }
    },
    [dialog, reloadSessions, t]
  )

  const handleRemoveWorkspace = useCallback(
    async (workspaceId: string) => {
      const ok = await removeWorkspace(workspaceId)
      if (ok) {
        setSelectedWorkspaceId((prev) => (prev === workspaceId ? null : prev))
        setGateConfig((prev) => (selectedWorkspaceId === workspaceId ? null : prev))
      }
      return ok
    },
    [removeWorkspace, selectedWorkspaceId]
  )

  const handleTogglePinWorkspace = useCallback(
    async (workspaceId: string, pinned: boolean) => setWorkspacePinned(workspaceId, pinned),
    [setWorkspacePinned]
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

  const handlePickFolderInComposer = useCallback(async () => {
    setCreating(true)
    try {
      const entry = await addWorkspaceFromPicker()
      if (!entry) return
      setSelectedWorkspaceId(entry.id)
    } catch (error) {
      console.error('[WorkbenchHomePage] pick folder in composer failed:', error)
      await dialog.alert(
        error instanceof Error
          ? error.message
          : t('agent_workspace.add_workspace_failed', '添加工作区失败，请重启应用后重试'),
        t('workbench.home_open_folder_option', '打开文件夹…')
      )
    } finally {
      setCreating(false)
    }
  }, [addWorkspaceFromPicker, dialog, t])

  const handleWorkspaceChange = useCallback(
    async (workspaceId: string) => {
      setSelectedWorkspaceId(workspaceId)
      await selectWorkspace(workspaceId)
    },
    [selectWorkspace]
  )

  const handleSecurityModeChange = useCallback(
    async (mode: AgentWorkspaceSecurityMode) => {
      setSecurityMode(mode)
      try {
        let workspaceId = selectedWorkspaceId
        let currentGate = gateConfig
        if (!workspaceId) {
          const scratch = await ensureScratchWorkspace()
          workspaceId = scratch.id
          setSelectedWorkspaceId(scratch.id)
          await refresh()
          currentGate = null
        }
        const saved = await persistSecurityMode({
          workspaceId,
          mode,
          currentGate: workspaceId === selectedWorkspaceId ? currentGate : null
        })
        setGateConfig(saved)
        const resolved = resolveWorkspaceSecurityMode(saved)
        if (resolved !== mode) {
          const forced = await persistSecurityMode({
            workspaceId,
            mode,
            currentGate: null
          })
          setGateConfig(forced)
          setSecurityMode(resolveWorkspaceSecurityMode(forced) === mode ? mode : resolved)
        } else {
          setSecurityMode(resolved)
        }
      } catch (error) {
        console.error('[WorkbenchHomePage] save security mode failed:', error)
      }
    },
    [ensureScratchWorkspace, gateConfig, refresh, selectedWorkspaceId]
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
    async (
      text: string,
      incomingAttachments?: unknown[],
      _searchMode?: boolean,
      meta?: {
        displayText?: string
        skillRefs?: Array<{ command: string; content: string }>
        fileRefs?: Array<{
          relativePath: string
          selection?: { startLine: number; endLine: number }
          comment?: string
          origin?: 'explorer-drop' | 'mention' | 'selection' | 'comment'
        }>
      }
    ) => {
      const trimmed = text.trim()
      const incoming = normalizeWorkspaceSendAttachments(incomingAttachments)
      if (
        sending ||
        !hasWorkspaceComposerPayload({
          text: trimmed,
          attachments: incoming,
          skillRefs: meta?.skillRefs,
          fileRefs: meta?.fileRefs
        })
      ) {
        return false
      }

      setSending(true)
      try {
        let workspace = selectedWorkspace
        let createdScratch = false
        if (!workspace) {
          workspace = await ensureScratchWorkspace()
          createdScratch = true
          setSelectedWorkspaceId(workspace.id)
          await refresh()
        }

        await selectWorkspace(workspace.id)
        setFolderRoot(workspace.folderRoot)

        const cachedGate =
          !createdScratch && selectedWorkspaceId === workspace.id ? gateConfig : null
        const saved = await persistSecurityMode({
          workspaceId: workspace.id,
          mode: securityMode,
          currentGate: cachedGate
        })
        setGateConfig(saved)

        const sessionId = await window.api.agentWorkspace.createSession({
          folderRoot: workspace.folderRoot,
          assistantId: selectedAssistantId,
          providerId: currentProviderId,
          modelId: currentModelId
        })
        stashWorkspaceInitMeta(sessionId, {
          text: trimmed,
          displayText: meta?.displayText?.trim() || undefined,
          skillRefs: meta?.skillRefs,
          fileRefs: meta?.fileRefs,
          attachments: normalizeWorkspaceSendAttachments(
            mergeWorkspaceFileRefsIntoAttachments({
              attachments: incoming,
              fileRefs: meta?.fileRefs,
              folderRoot: workspace.folderRoot
            })
          )
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
      currentModelId,
      currentProviderId,
      dialog,
      ensureScratchWorkspace,
      gateConfig,
      navigate,
      refresh,
      securityMode,
      selectWorkspace,
      selectedAssistantId,
      selectedWorkspace,
      selectedWorkspaceId,
      sending,
      setFolderRoot,
      t
    ]
  )

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false)
    if (!selectedWorkspaceId) return
    void window.api.settings
      .getBaishouAgentGateConfig({ kind: 'workspace', workspaceId: selectedWorkspaceId })
      .then((config) => {
        setGateConfig(config)
        setSecurityMode(resolveWorkspaceSecurityMode(config))
      })
      .catch(() => undefined)
  }, [selectedWorkspaceId])

  const settingsWorkspace =
    sortedWorkspaces.find((ws) => ws.id === selectedWorkspaceId) ?? selectedWorkspace

  return {
    lastActiveWorkspaceId,
    sortedWorkspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    workspaceOptions,
    sessions,
    pinSession,
    securityMode,
    sending,
    creating,
    settingsOpen,
    bootstrapping,
    settingsWorkspace,
    enterWorkspace,
    handleOpenSession,
    handleDeleteSession,
    handleRemoveWorkspace,
    handleTogglePinWorkspace,
    handleOpenFolder,
    handlePickFolderInComposer,
    handleWorkspaceChange,
    handleSecurityModeChange,
    handleOpenSettings,
    handleSend,
    handleCloseSettings
  }
}
