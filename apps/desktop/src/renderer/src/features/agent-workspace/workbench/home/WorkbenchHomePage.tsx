import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  useDialog,
  AssistantPickerSheet,
  SessionModelMenu,
  useTheme,
  getProviderIcon
} from '@baishou/ui'
import {
  applyWorkspaceSecurityModeToConfig,
  resolveWorkspaceSecurityMode,
  formatDialogueModelLabel,
  getReasoningControlForModel,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  isEmbeddingModel,
  isTtsModel,
  normalizeReasoningEffortSetting,
  type AgentWorkspaceEntry,
  type AgentWorkspaceSecurityMode,
  type BaishouAgentGateConfig,
  type ReasoningEffortSetting
} from '@baishou/shared'
import { usePromptShortcutStore } from '@baishou/store'
import { Cloud, Sparkles } from 'lucide-react'
import { useAgentWorkspaces } from '../../hooks/useAgentWorkspaces'
import { useWorkspaceSessions } from '../../hooks/useWorkspaceSessions'
import { useAgentWorkspaceChrome } from '../../hooks/useAgentWorkspaceChrome'
import { SETTINGS_HUB_PREFIX } from '../../../settings/settings-route.util'
import { usePersistedSearchMode } from '../../../agent/hooks/usePersistedSearchMode'
import {
  getReasoningEffortForModel,
  setReasoningEffortForModel,
  setSessionReasoningEffortOverride
} from '../../../agent/reasoning-effort-session'
import {
  buildModelReasoningPreviewMap,
  formatReasoningControlPreview
} from '../../../agent/format-reasoning-control-preview'
import chromeStyles from '../../../agent/components/AgentChatChrome.module.css'
import { WorkbenchWorkspaceGateSheet } from '../WorkbenchWorkspaceGateSheet'
import { WorkbenchHomeSidebar } from './WorkbenchHomeSidebar'
import { WorkbenchHomeComposer } from './WorkbenchHomeComposer'
import { stashWorkspaceInitMeta } from '../../utils/workspace-init-meta.util'
import styles from './WorkbenchHomePage.module.css'

interface WorkspaceOutletContext {
  setFolderRoot: (path: string | null) => void
}

function sortWorkspaces(
  list: AgentWorkspaceEntry[],
  lastActiveId: string | null
): AgentWorkspaceEntry[] {
  return [...list].sort((a, b) => {
    const aPinned = Boolean(a.pinnedAt)
    const bPinned = Boolean(b.pinnedAt)
    if (aPinned !== bPinned) return aPinned ? -1 : 1
    if (aPinned && bPinned) {
      return Date.parse(b.pinnedAt ?? '') - Date.parse(a.pinnedAt ?? '')
    }
    if (lastActiveId) {
      if (a.id === lastActiveId) return -1
      if (b.id === lastActiveId) return 1
    }
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  })
}

async function persistSecurityMode(params: {
  workspaceId: string
  mode: AgentWorkspaceSecurityMode
  currentGate: BaishouAgentGateConfig | null
}): Promise<BaishouAgentGateConfig> {
  const current =
    params.currentGate ??
    (await window.api.settings.getBaishouAgentGateConfig({
      kind: 'workspace',
      workspaceId: params.workspaceId
    }))
  const next = applyWorkspaceSecurityModeToConfig(current, params.mode)
  return window.api.settings.setBaishouAgentGateConfig(next, {
    kind: 'workspace',
    workspaceId: params.workspaceId
  })
}

/** 工作台目录首页：侧栏导航 + 中央对话入口 */
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
    removeWorkspace,
    setWorkspacePinned,
    refresh
  } = useAgentWorkspaces()
  const { shortcuts, loadShortcuts } = usePromptShortcutStore()
  const { searchMode, toggleSearchMode } = usePersistedSearchMode()
  const chrome = useAgentWorkspaceChrome()
  const { isDark } = useTheme()
  const modelTriggerRef = useRef<HTMLButtonElement>(null)
  const [modelMenuAnchor, setModelMenuAnchor] = useState<DOMRect | null>(null)
  const [reasoningPreviewTick, setReasoningPreviewTick] = useState(0)
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffortSetting>('unset')

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [securityMode, setSecurityMode] = useState<AgentWorkspaceSecurityMode>('auto_review')
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

  const { sessions, reloadSessions } = useWorkspaceSessions()

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

  /** 输入框内「打开文件夹」：只选中工作区，留在首页 */
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
      _attachments?: unknown[],
      _searchMode?: boolean,
      meta?: {
        displayText?: string
        skillRefs?: Array<{ command: string; content: string }>
      }
    ) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return false

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
          assistantId: chrome.selectedAssistantId,
          providerId: chrome.model.currentProviderId,
          modelId: chrome.model.currentModelId
        })
        stashWorkspaceInitMeta(sessionId, {
          text: trimmed,
          displayText: meta?.displayText?.trim() || undefined,
          skillRefs: meta?.skillRefs
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
      chrome.selectedAssistantId,
      chrome.model.currentProviderId,
      chrome.model.currentModelId,
      securityMode,
      dialog,
      ensureScratchWorkspace,
      gateConfig,
      navigate,
      refresh,
      selectWorkspace,
      selectedWorkspace,
      selectedWorkspaceId,
      sending,
      setFolderRoot,
      t
    ]
  )

  const reasoningProviderType = useMemo(() => {
    const provider = chrome.providers.find((item) => item.id === chrome.model.currentProviderId)
    return provider?.type || chrome.model.currentProviderId
  }, [chrome.model.currentProviderId, chrome.providers])

  const reasoningControl = useMemo(
    () => getReasoningControlForModel(chrome.model.currentModelId, reasoningProviderType),
    [chrome.model.currentModelId, reasoningProviderType]
  )

  useEffect(() => {
    const next = getReasoningEffortForModel(
      chrome.model.currentProviderId,
      chrome.model.currentModelId
    )
    setReasoningEffort(next)
    setSessionReasoningEffortOverride(next)
  }, [chrome.model.currentProviderId, chrome.model.currentModelId])

  const handleReasoningEffortChange = useCallback(
    (value: ReasoningEffortSetting) => {
      const normalized = normalizeReasoningEffortSetting(value)
      setReasoningEffort(normalized)
      setSessionReasoningEffortOverride(normalized)
      if (chrome.model.currentProviderId && chrome.model.currentModelId) {
        setReasoningEffortForModel(
          chrome.model.currentProviderId,
          chrome.model.currentModelId,
          normalized
        )
        setReasoningPreviewTick((n) => n + 1)
      }
    },
    [chrome.model.currentProviderId, chrome.model.currentModelId]
  )

  const modelReasoningPreviews = useMemo(
    () => buildModelReasoningPreviewMap(chrome.providers),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick refreshes after persist
    [chrome.providers, reasoningPreviewTick, chrome.showModelSwitcher]
  )

  const effortSuffix = formatReasoningControlPreview({
    modelId: chrome.model.currentModelId,
    providerTypeOrId: reasoningProviderType,
    effort: reasoningEffort
  })

  const openModelSwitcher = useCallback(() => {
    setModelMenuAnchor(modelTriggerRef.current?.getBoundingClientRect() ?? null)
    chrome.setShowModelSwitcher(true)
  }, [chrome])

  const providerIconUrl = useMemo(() => {
    if (!isConfiguredProviderId(chrome.model.currentProviderId)) return undefined
    const providerRecord = chrome.providers.find(
      (provider) => provider.id === chrome.model.currentProviderId
    )
    return (
      getProviderIcon(chrome.model.currentProviderId, isDark) ||
      (providerRecord?.type ? getProviderIcon(providerRecord.type, isDark) : undefined)
    )
  }, [chrome.model.currentProviderId, chrome.providers, isDark])

  const noModelSelected = !isConfiguredDialogueModelId(chrome.model.currentModelId)
  const displayModelName =
    formatDialogueModelLabel(chrome.model.currentModelId) ??
    t('agent.no_model_selected', '暂未选择模型')

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
        recentWorkspaces={sortedWorkspaces}
        lastActiveWorkspaceId={lastActiveWorkspaceId}
        sessions={sessions}
        onOpenWorkspace={(id) => void enterWorkspace(id)}
        onOpenSession={(sessionId, workspaceId) => void handleOpenSession(sessionId, workspaceId)}
        onDeleteSession={(sessionId) => void handleDeleteSession(sessionId)}
        onRemoveWorkspace={handleRemoveWorkspace}
        onTogglePinWorkspace={handleTogglePinWorkspace}
      />

      <main className={styles.main}>
        <div className={styles.mainInner}>
          <WorkbenchHomeComposer
            currentAssistant={
              chrome.currentAssistant
                ? {
                    id: String(chrome.currentAssistant.id),
                    name: chrome.currentAssistant.name,
                    avatarPath: chrome.currentAssistant.avatarPath
                  }
                : undefined
            }
            onAssistantClick={() => chrome.setShowAssistantPicker(true)}
            workspaceOptions={workspaceOptions}
            workspaceId={selectedWorkspaceId}
            onWorkspaceChange={(id) => void handleWorkspaceChange(id)}
            onOpenFolder={() => void handlePickFolderInComposer()}
            securityMode={securityMode}
            onSecurityModeChange={(mode) => void handleSecurityModeChange(mode)}
            onOpenWorkspaceSettings={() => void handleOpenSettings()}
            onSend={handleSend}
            shortcuts={shortcuts}
            searchMode={searchMode}
            onToggleSearchMode={toggleSearchMode}
            sending={sending || bootstrapping}
            metaTrailing={
              <button
                ref={modelTriggerRef}
                type="button"
                className={`${chromeStyles.modelSwitcherTrigger} ${chromeStyles.modelSwitcherInMeta}`}
                onClick={openModelSwitcher}
                aria-label={t('models.switch_model', '切换模型')}
                title={t('models.switch_model', '切换模型')}
              >
                <span className={chromeStyles.modelProviderIcon} aria-hidden>
                  {providerIconUrl ? (
                    <img src={providerIconUrl} alt="" />
                  ) : noModelSelected ? (
                    <Sparkles size={15} />
                  ) : (
                    <Cloud size={15} />
                  )}
                </span>
                <span className={chromeStyles.modelName}>{displayModelName}</span>
                {effortSuffix ? (
                  <span className={chromeStyles.modelEffort}>{effortSuffix}</span>
                ) : null}
                <span className={chromeStyles.chevron}>▼</span>
              </button>
            }
          />
        </div>
      </main>

      <AssistantPickerSheet
        isOpen={chrome.showAssistantPicker}
        assistants={chrome.assistants.map((a) => ({
          ...a,
          id: String(a.id),
          emoji: a.emoji || '✨',
          systemPrompt: a.systemPrompt || '',
          compressSystemPrompt: a.compressSystemPrompt ?? null
        }))}
        currentAssistantId={chrome.selectedAssistantId}
        onSelect={(assistant) => chrome.handleAssistantSelected(assistant)}
        onClose={() => chrome.setShowAssistantPicker(false)}
        onRefreshAssistants={() => chrome.fetchAssistants()}
        pinnedIds={new Set(chrome.pinnedIds)}
        onTogglePin={async (id, isPinned) => {
          if (window.electron) {
            await window.electron.ipcRenderer.invoke('agent:pin-assistant', id, isPinned)
            await chrome.fetchAssistants()
          }
        }}
        onCreateNew={() => chrome.setShowAssistantPicker(false)}
      />

      {chrome.showModelSwitcher ? (
        <SessionModelMenu
          onClose={() => chrome.setShowModelSwitcher(false)}
          providers={chrome.providers
            .map((provider) => {
              const modelList =
                provider.enabledModels && provider.enabledModels.length > 0
                  ? provider.enabledModels
                  : provider.models || []
              const filteredModels = modelList.filter(
                (model) => !isEmbeddingModel(model) && !isTtsModel(model)
              )
              return {
                id: provider.id,
                name: provider.name || provider.id,
                type: provider.type || 'custom',
                models: provider.models || [],
                enabledModels: filteredModels
              }
            })
            .filter((provider) => provider.enabledModels.length > 0)}
          currentProviderId={chrome.model.currentProviderId}
          currentModelId={chrome.model.currentModelId}
          onSelect={(providerId, modelId) => {
            chrome.model.userManuallySetModelRef.current = true
            chrome.model.setCurrentProviderId(providerId)
            chrome.model.setCurrentModelId(modelId)
          }}
          onManageProviders={() => navigate(`${SETTINGS_HUB_PREFIX}/ai-services`)}
          reasoningEffort={reasoningEffort}
          onReasoningEffortChange={handleReasoningEffortChange}
          reasoningControl={reasoningControl}
          modelReasoningPreviews={modelReasoningPreviews}
          anchorRect={modelMenuAnchor}
        />
      ) : null}

      {settingsWorkspace ? (
        <WorkbenchWorkspaceGateSheet
          open={settingsOpen}
          workspaceId={settingsWorkspace.id}
          workspaceName={settingsWorkspace.displayName}
          onClose={handleCloseSettings}
        />
      ) : null}
    </div>
  )
}
