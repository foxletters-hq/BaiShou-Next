import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AssistantPickerSheet,
  SessionModelMenu,
  useTheme,
  getProviderIcon,
  useReasoningCatalogEpoch
} from '@baishou/ui'
import {
  formatDialogueModelLabel,
  getReasoningControlForModel,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  isEmbeddingModel,
  isTtsModel,
  normalizeReasoningEffortSetting,
  resolveDialogueEffortPreference,
  type ReasoningEffortSetting
} from '@baishou/shared'
import { usePromptShortcutStore } from '@baishou/store'
import { Cloud, Sparkles } from 'lucide-react'
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
import { useDialogueSlotEffort } from '../../../agent/use-dialogue-slot-effort'
import chromeStyles from '../../../agent/components/AgentChatChrome.module.css'
import { AssistantCreateModal } from '../../../agent/components/AssistantCreateModal'
import { WorkbenchWorkspaceGateSheet } from '../WorkbenchWorkspaceGateSheet'
import { WorkbenchHomeSidebar } from './WorkbenchHomeSidebar'
import { WorkbenchHomeComposer } from './WorkbenchHomeComposer'
import { useWorkbenchHomeWorkspace } from './useWorkbenchHomeWorkspace'
import styles from './WorkbenchHomePage.module.css'

interface WorkspaceOutletContext {
  setFolderRoot: (path: string | null) => void
}

/** 工作台目录首页：侧栏导航 + 中央对话入口 */
export const WorkbenchHomePage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setFolderRoot } = useOutletContext<WorkspaceOutletContext>()
  const { shortcuts, loadShortcuts } = usePromptShortcutStore()
  const { searchMode, toggleSearchMode } = usePersistedSearchMode()
  const chrome = useAgentWorkspaceChrome()
  const { isDark } = useTheme()
  const modelTriggerRef = useRef<HTMLButtonElement>(null)
  const [modelMenuAnchor, setModelMenuAnchor] = useState<DOMRect | null>(null)
  const [reasoningPreviewTick, setReasoningPreviewTick] = useState(0)
  const dialogueSlotEffort = useDialogueSlotEffort()
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffortSetting>('auto')
  const home = useWorkbenchHomeWorkspace({
    setFolderRoot,
    selectedAssistantId: chrome.selectedAssistantId,
    currentProviderId: chrome.model.currentProviderId,
    currentModelId: chrome.model.currentModelId
  })

  useEffect(() => {
    setFolderRoot(null)
  }, [setFolderRoot])

  useEffect(() => {
    void loadShortcuts()
    const unsubSkills = (
      window.api as { skills?: { onChanged?: (cb: () => void) => () => void } }
    ).skills?.onChanged?.(() => {
      void loadShortcuts()
    })
    return () => {
      unsubSkills?.()
    }
  }, [loadShortcuts])

  const reasoningProviderType = useMemo(() => {
    const provider = chrome.providers.find((item) => item.id === chrome.model.currentProviderId)
    return provider?.type || chrome.model.currentProviderId
  }, [chrome.model.currentProviderId, chrome.providers])

  const reasoningCatalogEpoch = useReasoningCatalogEpoch()
  const reasoningControl = useMemo(() => {
    // 目录热更新只改模块表、不改 modelId；引用 epoch 才能按新表重算
    void reasoningCatalogEpoch
    return getReasoningControlForModel(chrome.model.currentModelId, reasoningProviderType)
  }, [chrome.model.currentModelId, reasoningProviderType, reasoningCatalogEpoch])

  useEffect(() => {
    const next = resolveDialogueEffortPreference(
      getReasoningEffortForModel(chrome.model.currentProviderId, chrome.model.currentModelId),
      dialogueSlotEffort
    )
    setReasoningEffort(next)
    setSessionReasoningEffortOverride(next)
  }, [chrome.model.currentModelId, chrome.model.currentProviderId, dialogueSlotEffort])

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

  return (
    <div className={styles.page}>
      <WorkbenchHomeSidebar
        activeNav="home"
        onNewProject={() => void home.handleOpenFolder()}
        onOpenHome={() => navigate('/agent-workspace')}
        onOpenKnowledge={() => navigate('/agent-workspace/knowledge')}
        onOpenSkills={() => navigate('/agent-workspace/skills')}
        onOpenProjects={() => navigate('/agent-workspace/projects')}
        onOpenSettings={() => void home.handleOpenSettings()}
        creating={home.creating}
        recentWorkspaces={home.sortedWorkspaces}
        lastActiveWorkspaceId={home.lastActiveWorkspaceId}
        sessions={home.sessions}
        onOpenWorkspace={(id) => void home.enterWorkspace(id)}
        onOpenSession={(sessionId, workspaceId) =>
          void home.handleOpenSession(sessionId, workspaceId)
        }
        onDeleteSession={(sessionId) => void home.handleDeleteSession(sessionId)}
        onRemoveWorkspace={home.handleRemoveWorkspace}
        onTogglePinWorkspace={home.handleTogglePinWorkspace}
        onTogglePinSession={home.pinSession}
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
            workspaceOptions={home.workspaceOptions}
            workspaceId={home.selectedWorkspaceId}
            folderRoot={home.selectedWorkspace?.folderRoot ?? null}
            onWorkspaceChange={(id) => void home.handleWorkspaceChange(id)}
            onOpenFolder={() => void home.handlePickFolderInComposer()}
            securityMode={home.securityMode}
            onSecurityModeChange={(mode) => void home.handleSecurityModeChange(mode)}
            onOpenWorkspaceSettings={() => void home.handleOpenSettings()}
            onSend={home.handleSend}
            shortcuts={shortcuts}
            searchMode={searchMode}
            onToggleSearchMode={toggleSearchMode}
            sending={home.sending || home.bootstrapping}
            metaTrailing={
              <button
                ref={modelTriggerRef}
                type="button"
                className={`${chromeStyles.modelSwitcherTrigger} ${chromeStyles.modelSwitcherInMeta}`}
                onClick={openModelSwitcher}
                aria-label={t('models.switch_model', '切换模型')}
                title={displayModelName}
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
        onCreateNew={chrome.openCreateAssistant}
      />

      <AssistantCreateModal
        isOpen={chrome.isCreateAssistantOpen}
        assistantCount={chrome.assistants.length}
        onClose={() => chrome.setIsCreateAssistantOpen(false)}
        onBackToPicker={() => chrome.setShowAssistantPicker(true)}
        onCreated={chrome.fetchAssistants}
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

      {home.settingsWorkspace ? (
        <WorkbenchWorkspaceGateSheet
          open={home.settingsOpen}
          workspaceId={home.settingsWorkspace.id}
          workspaceName={home.settingsWorkspace.displayName}
          onClose={home.handleCloseSettings}
        />
      ) : null}
    </div>
  )
}
